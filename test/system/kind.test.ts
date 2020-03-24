import * as tap from 'tap';
import * as nock from 'nock';
import * as sleep from 'sleep-promise';

import * as kubectl from '../helpers/kubectl';
import * as kind from '../setup/platforms/kind';
import { tools } from '../setup/tools';

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

  await tools.skopeo.install();

  // kubectl
  await kubectl.downloadKubectl();

  // KinD
  await kind.setupTester();
  await kind.createCluster();
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
  ]);

  // TODO: wait for the services to start?

  // Setup nocks
  nock('https://kubernetes-upstream.snyk.io')
    .post('/api/v1/workload')
    .times(1)
    .reply(200, (uri, requestBody) => {
      // TODO assert POST payload
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
    .reply(200, (uri, requestBody) => {
      // TODO assert POST payload
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
