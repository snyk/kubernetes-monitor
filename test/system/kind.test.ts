import * as sinon from 'sinon';
import * as fsExtra from 'fs-extra';
import * as tap from 'tap';
import * as nock from 'nock';
import * as sleep from 'sleep-promise';
import { exec } from 'child-process-promise';
import { join as pathJoin } from 'path';
import { readFileSync } from 'fs';

import * as kubectl from '../helpers/kubectl';
import * as kind from '../setup/platforms/kind';
import * as transmitterTypes from '../../src/transmitter/types';

// let integrationId: string;

async function tearDown() {
  console.log('Begin removing the snyk-monitor...');
  await kind.deleteCluster();
  console.log('Removed the snyk-monitor!');
}

tap.tearDown(tearDown);

tap.test('Kubernetes-Monitor with KinD', async (t) => {

  const emptyDirSyncStub = sinon.stub(fsExtra, 'emptyDirSync').returns({});

  // Start fresh
  try {
    await tearDown();
  } catch (error) {
    console.log(`could not start with a clean environment: ${error.message}`);
  }

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
    kubectl.applyK8sYaml('./test/fixtures/java-deployment.yaml'),
    kubectl.waitForDeployment('java', 'services'),
  ]);

  // Setup nocks
  nock(/https\:\/\/127\.0\.0\.1\:\d+/, { allowUnmocked: true})
    .get('/api/v1/namespaces')
    .times(1)
    .replyWithError({
      code: 'ECONNREFUSED'
    })
    .get('/api/v1/namespaces')
    .times(1)
    .replyWithError({
      code: 'ETIMEDOUT'
    });

  nock(/https\:\/\/127\.0\.0\.1\:\d+/, { allowUnmocked: true})
    .get('/apis/apps/v1/namespaces/snyk-monitor/deployments')
    .times(1)
    .replyWithError({
      code: 'ECONNREFUSED'
    })
    .get('/apis/apps/v1/namespaces/snyk-monitor/deployments')
    .times(1)
    .replyWithError({
      code: 'ETIMEDOUT'
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/workload')
    .times(1)
    .reply(200, (uri, requestBody: transmitterTypes.IWorkloadMetadataPayload) => {
      t.ok('workloadLocator' in requestBody, 'workload locator is present in workload payload');
      t.ok(
        'cluster' in requestBody.workloadLocator &&
          'name' in requestBody.workloadLocator &&
          'namespace' in requestBody.workloadLocator &&
          'type' in requestBody.workloadLocator &&
          'userLocator' in requestBody.workloadLocator,
        'all properties are present in the workload locator',
      );
      t.ok('workloadMetadata' in requestBody, 'workload metadata is present in workload payload');
      t.ok(
        'annotations' in requestBody.workloadMetadata &&
          'labels' in requestBody.workloadMetadata &&
          'podSpec' in requestBody.workloadMetadata &&
          'revision' in requestBody.workloadMetadata &&
          'specAnnotations' in requestBody.workloadMetadata &&
          'specLabels' in requestBody.workloadMetadata,
        'all properties are present in the workload metadata',
      );
      t.ok('agentId' in requestBody, 'agent ID is present in workload payload');
      
      const podSpec = requestBody.workloadMetadata.podSpec;
      const resources = podSpec.containers[0].resources;
      t.same(resources?.limits, { cpu: '1', memory: '1Gi' });

      const securityContext = podSpec.containers[0].securityContext;
      t.same(securityContext?.privileged, false);
      t.same(securityContext?.capabilities?.drop, ['ALL']);
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/dependency-graph')
    .times(1)
    .replyWithError({
      code: 'ECONNRESET',
      message: 'socket hang up',
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/dependency-graph')
    .times(1)
    .replyWithError({
      code: 'EAI_AGAIN',
      message: 'getaddrinfo EAI_AGAIN kubernetes-upstream.snyk.io',
    });

  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/dependency-graph')
    .times(1)
    .reply(200, (uri, requestBody: transmitterTypes.IDependencyGraphPayload) => {
      t.ok('metadata' in requestBody, 'metadata is present in dependency graph payload');
      // TODO: this is weird, why is agentId present in two places?
      t.ok('agentId' in requestBody, 'agent ID is present in dependency graph payload');
      t.ok(
        'metadata' in requestBody && 'agentId' in requestBody.metadata,
        'agent ID is present in dependency graph payload',
      );
      t.ok('imageLocator' in requestBody, 'image locator is present in dependency graph payload');
      t.ok(
        'cluster' in requestBody.imageLocator &&
          'name' in requestBody.imageLocator &&
          'imageId' in requestBody.imageLocator &&
          'namespace' in requestBody.imageLocator &&
          'type' in requestBody.imageLocator &&
          'userLocator' in requestBody.imageLocator,
        'all properties are present in the image locator',
      );
      t.ok(
        'dependencyGraph' in requestBody &&
          typeof requestBody.dependencyGraph === 'string',
        'dependency graph is in payload and has the right type',
      );

      const dependencyGraphFixture = readFileSync(
        pathJoin(__dirname, 'java-dep-graph-request.json'),
        { encoding: 'utf8' },
      );
      const expectedDependencyGraph = JSON.parse(dependencyGraphFixture);
      const sentDependencyGraph = JSON.parse(requestBody.dependencyGraph!);
      t.deepEqual(
        sentDependencyGraph,
        expectedDependencyGraph,
        'dependency graph matches',
      );
    });

  // Start the monitor
  require('../../src');

  sinon.assert.called(emptyDirSyncStub);

  // TODO: replace with being event driven?
  // will still need SOME timeout 
  while (true) {
    if (nock.isDone()) {
      break;
    } else {
      await sleep(5 * 1000);
    }
  }

  // additional asserts?
  t.ok(nock.isDone(), 'all outgoing calls were made');

  // instruct the Monitor to ignore errors from this point
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { state: kubernetesMonitorState } = require('../../src/state');
  kubernetesMonitorState.shutdownInProgress = true;

  // TODO cleanup the images we saved to /var/tmp?
});
