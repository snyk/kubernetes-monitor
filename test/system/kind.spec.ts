import nock from 'nock';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import fsExtra = require('fs-extra');
import sleep from 'sleep-promise';
import { resolve as resolvePath } from 'path';
import { copyFile, readFile, mkdir, exists } from 'fs';

import * as kubectl from '../helpers/kubectl';
import * as kind from '../setup/platforms/kind';
import * as transmitterTypes from '../../src/transmitter/types';
import { execWrapper as exec } from '../helpers/exec';

const copyFileAsync = promisify(copyFile);
const readFileAsync = promisify(readFile);
const mkdirAsync = promisify(mkdir);
const existsAsync = promisify(exists);

/**
 * TODO graceful shutdown
 * We abruptly close the connection to the K8s API server during shutdown, which can result in exceptions.
 * For now we ignore them in this specific case, but in the future we must implement a clean shutdown that we can invoke.
 *
 * Don't be alarmed if you see anything like this in the Jest logs, it is expected for now:
 *   Unhandled error
 *     at process.uncaught (node_modules/jest-jasmine2/build/jasmine/Env.js:248:21)
 *   Error: Client network socket disconnected before secure TLS connection was established
 */
import { state as kubernetesMonitorState } from '../../src/state';
import * as kubernetesApiWrappers from '../../src/supervisor/kuberenetes-api-wrappers';

async function tearDown() {
  console.log('Begin removing the snyk-monitor...');
  try {
    await kind.deleteCluster();

    // Workaround. Tests are failing, cos deleting cluster finishes after the test
    await sleep(15 * 1000);
  } catch (err: any) {
    console.log('Could not cleanly tear down the environment', err.message);
  }
  console.log('Removed the snyk-monitor!');
}

beforeAll(tearDown);
afterAll(async () => {
  jest.restoreAllMocks();

  kubernetesMonitorState.shutdownInProgress = true;
  await tearDown();
  // TODO cleanup the images we saved to /var/tmp?
});

test('Kubernetes-Monitor with KinD', async () => {
  const emptyDirSyncStub = jest
    .spyOn(fsExtra, 'emptyDirSync')
    .mockReturnValue({});

  const agentId = randomUUID();
  const retryKubernetesApiRequestMock = jest
    .spyOn(kubernetesApiWrappers, 'retryKubernetesApiRequestIndefinitely')
    .mockResolvedValueOnce({
      body: {
        metadata: {
          uid: agentId,
        },
      },
    });

  try {
    await exec('which skopeo');
    console.log('Skopeo already installed :tada:');
  } catch (err) {
    throw new Error('Please install skopeo on your machine');
  }

  const kubernetesVersion = 'latest';
  // kubectl
  await kubectl.downloadKubectl(kubernetesVersion);

  // KinD
  await kind.setupTester();
  await kind.createCluster(kubernetesVersion);
  await kind.exportKubeConfig();

  await Promise.all([
    kubectl.createNamespace('snyk-monitor'),
    kubectl.createNamespace('services'),
  ]);

  // wait for default service account
  await kubectl.waitForServiceAccount('default', 'default');

  // Services
  await Promise.all([
    kubectl.applyK8sYaml(resolvePath('./test/fixtures/java-deployment.yaml')),
    kubectl.waitForDeployment('java', 'services'),
  ]);

  // Create a copy of the policy file fixture in the location that snyk-monitor is expecting to load it from.
  const regoPolicyFixturePath = resolvePath(
    './test/fixtures/workload-events.rego',
  );
  const expectedPoliciesPath = resolvePath('/tmp/policies');
  if (!(await existsAsync(expectedPoliciesPath))) {
    await mkdirAsync(expectedPoliciesPath);
  }
  await copyFileAsync(
    regoPolicyFixturePath,
    resolvePath(expectedPoliciesPath, 'workload-events.rego'),
  );

  const regoPolicyContents = await readFileAsync(regoPolicyFixturePath, 'utf8');
  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/policy')
    .times(1)
    .reply(
      200,
      (uri, requestBody: transmitterTypes.IWorkloadEventsPolicyPayload) => {
        expect(
          requestBody,
        ).toEqual<transmitterTypes.IWorkloadEventsPolicyPayload>({
          agentId,
          cluster: expect.any(String),
          userLocator: expect.any(String),
          policy: regoPolicyContents,
        });
      },
    );

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/cluster')
    .times(1)
    .reply(
      200,
      (uri, requestBody: transmitterTypes.IClusterMetadataPayload) => {
        expect(requestBody).toEqual<
          Partial<transmitterTypes.IClusterMetadataPayload>
        >({
          agentId,
          cluster: expect.any(String),
          userLocator: expect.any(String),
          // also should have version here but due to test limitation it is undefined
          // as it is injected as an environment variable via the Helm chart
        });
      },
    );

  nock(/https\:\/\/127\.0\.0\.1\:\d+/, { allowUnmocked: true })
    .get('/apis/apps/v1/deployments')
    .times(1)
    .replyWithError({
      code: 'ECONNREFUSED',
    })
    .get('/apis/apps/v1/deployments')
    .times(1)
    .replyWithError({
      code: 'ECONNRESET',
    });

  nock(/https\:\/\/127\.0\.0\.1\:\d+/)
    .get('/apis/argoproj.io/v1alpha1/rollouts')
    .query(true)
    .times(1)
    .reply(200);

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/workload')
    .times(1)
    .reply(
      200,
      (uri, requestBody: transmitterTypes.IWorkloadMetadataPayload) => {
        expect(requestBody).toEqual<transmitterTypes.IWorkloadMetadataPayload>({
          workloadLocator: {
            cluster: expect.any(String),
            name: expect.any(String),
            namespace: expect.any(String),
            type: expect.any(String),
            userLocator: expect.any(String),
          },
          workloadMetadata: expect.objectContaining({
            annotations: expect.any(Object),
            labels: expect.any(Object),
            revision: expect.any(Number),
            specAnnotations: expect.any(Object),
            specLabels: expect.any(Object),
            podSpec: expect.objectContaining({
              containers: expect.arrayContaining([
                expect.objectContaining({
                  resources: expect.objectContaining({
                    limits: { cpu: '1', memory: '1Gi' },
                  }),
                  securityContext: expect.objectContaining({
                    privileged: false,
                    capabilities: expect.objectContaining({
                      drop: ['ALL'],
                    }),
                  }),
                }),
              ]),
            }),
          }),
          agentId,
        });
      },
    );

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/scan-results')
    .times(1)
    .replyWithError({
      code: 'ECONNRESET',
      message: 'socket hang up',
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/scan-results')
    .times(1)
    .replyWithError({
      code: 'EAI_AGAIN',
      message: 'getaddrinfo EAI_AGAIN kubernetes-upstream.snyk.io',
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/scan-results')
    .times(1)
    // Reply with an error (500) so that we can see that snyk-monitor falls back to sending to the /dependency-graph API.
    .reply(500, (uri, requestBody: transmitterTypes.ScanResultsPayload) => {
      expect(requestBody).toEqual<transmitterTypes.ScanResultsPayload>({
        agentId,
        telemetry: {
          enqueueDurationMs: expect.any(Number),
          imagePullDurationMs: expect.any(Number),
          imageScanDurationMs: expect.any(Number),
          imageSizeBytes: expect.any(Number),
          queueSize: expect.any(Number),
        },
        imageLocator: expect.objectContaining({
          imageId: expect.any(String),
        }),
        scanResults: [
          {
            facts: expect.arrayContaining([
              { type: 'depGraph', data: expect.any(Object) },
              { type: 'keyBinariesHashes', data: expect.any(Array) },
              { type: 'imageId', data: expect.any(String) },
              { type: 'imageLayers', data: expect.any(Array) },
              { type: 'rootFs', data: expect.any(Array) },
              { type: 'imageOsReleasePrettyName', data: expect.any(String) },
            ]),
            target: { image: 'docker-image|docker.io/library/openjdk' },
            identity: { type: 'rpm', args: { platform: 'linux/amd64' } },
          },
          {
            facts: [
              { type: 'jarFingerprints', data: expect.any(Object) },
              { type: 'imageId', data: expect.any(String) },
            ],
            identity: {
              type: 'maven',
              targetFile: '/usr/share/ca-certificates-java',
            },
            target: { image: 'docker-image|docker.io/library/openjdk' },
          },
          {
            facts: [
              { type: 'jarFingerprints', data: expect.any(Object) },
              { type: 'imageId', data: expect.any(String) },
            ],
            identity: {
              type: 'maven',
              targetFile: '/usr/java/openjdk-18/lib',
            },
            target: { image: 'docker-image|docker.io/library/openjdk' },
          },
        ],
      });
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/dependency-graph')
    .times(1)
    .reply(
      200,
      (uri, requestBody: transmitterTypes.IDependencyGraphPayload) => {
        expect(requestBody).toEqual<transmitterTypes.IDependencyGraphPayload>({
          agentId,
          dependencyGraph: expect.stringContaining(
            'docker-image|docker.io/library/openjdk',
          ),
          imageLocator: {
            userLocator: expect.any(String),
            cluster: expect.any(String),
            imageId: expect.any(String),
            name: expect.any(String),
            namespace: expect.any(String),
            type: expect.any(String),
            imageWithDigest: expect.any(String),
          },
        });

        expect(retryKubernetesApiRequestMock).toHaveBeenCalled();
      },
    );

  // Start the monitor
  require('../../src');

  expect(emptyDirSyncStub).toHaveBeenCalled();
});
