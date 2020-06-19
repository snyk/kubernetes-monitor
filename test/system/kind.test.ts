import * as tap from 'tap';
import * as nock from 'nock';
import * as sleep from 'sleep-promise';
import { exec } from 'child-process-promise';

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

  // Start fresh
  try {
    await tearDown();
  } catch (error) {
    console.log(`could not start with a clean environment: ${error.message}`);
  }

  // install Skopeo
  // TODO: this thing should probably be in a setup test environment script
  // not in this file
  try {
    await exec('which skopeo');
    console.log('Skopeo already installed :tada:');
  } catch (err) {
    // linux-oriented, not mac
    // for mac, install skopeo with brew
    console.log('installing Skopeo');
    await exec('git clone --depth 1 -b "v0.2.0" https://github.com/containers/skopeo');
    await exec('(cd skopeo && make binary-static DISABLE_CGO=1)');
    await exec('sudo mkdir -p /etc/containers');
    await exec('sudo chown circleci:circleci /etc/containers');
    await exec('cp ./skopeo/default-policy.json /etc/containers/policy.json');

    process.env['PATH'] = process.env['PATH'] + ':./skopeo';
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
    });

  // Start the monitor
  require('../../src');

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
  const kubernetesMonitorState = require('../../src/state');
  kubernetesMonitorState.shutdownInProgress = true;

  // TODO cleanup the images we saved to /var/tmp?
});
