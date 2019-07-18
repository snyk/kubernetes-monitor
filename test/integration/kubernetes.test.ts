import { Core_v1Api, KubeConfig } from '@kubernetes/client-node';
import needle = require('needle');
import sleep = require('sleep-promise');
import setup = require('../setup'); // Must be located before 'tap' import
// tslint:disable-next-line: ordered-imports
import * as tap from 'tap';
import * as config from '../../src/common/config';
import { IWorkloadLocator } from '../../src/transmitter/types';
import { getKindConfigPath } from '../helpers/kind';

let integrationId: string;

tap.tearDown(async () => {
  console.log('Begin removing the snyk-monitor...');
  await tap.removeMonitor();
  console.log('Removed the snyk-monitor!');
});

// Make sure this runs first -- deploying the monitor for the next tests
tap.test('deploy snyk-monitor', async (t) => {
  console.log('Begin deploying the snyk-monitor...');

  t.plan(1);

  integrationId = await tap.deployMonitor();

  console.log(`Deployed the snyk-monitor with integration ID ${integrationId}!`);
  t.pass('successfully deployed the snyk-monitor');
});

tap.test('snyk-monitor container started', async (t) => {
  t.plan(3);

  console.log('Getting KinD config...');
  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(Core_v1Api);
  console.log('Loaded KinD config!');

  // wait to let the container go through a cycle
  await sleep(config.MONITOR.INITIAL_REFRESH_MS);

  console.log('Querying the snyk-monitor...');
  const response = await k8sApi.listNamespacedPod('snyk-monitor');
  t.ok(response.body.items.length > 0, 'PodList is not empty');

  const monitorPod = response.body.items.find((pod) => pod.metadata.name.includes('snyk-monitor'));
  t.ok(monitorPod !== undefined, 'Snyk monitor container exists');
  t.notEqual(monitorPod!.status.phase, 'Failed', 'Snyk monitor container didn\'t fail');
  console.log('Done -- snyk-monitor exists!');
});

tap.test('snyk-monitor sends data to homebase', async (t) => {
  t.plan(1);

  console.log(`Begin polling Homebase for the expected workloads with integration ID ${integrationId}...`);
  // We don't want to spam Homebase with requests; do it infrequently
  const toneDownFactor = 5;
  let podStartChecks = setup.KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS / toneDownFactor;
  // TODO: consider if we're OK to expose this publicly?
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@homebase-int.dev.snyk.io/api/v1/workloads/${integrationId}`;
  while (podStartChecks-- > 0) {
    const homebaseResponse = await needle('get', url, null)
      .catch((error) => t.fail(error));

    const responseBody = homebaseResponse.body;
    const workloads: IWorkloadLocator[] | undefined = responseBody.workloads;

    if (workloads !== undefined && workloads.length === 3 &&
        workloads.every((workload) => workload.userLocator === integrationId) &&
        workloads.every((workload) => workload.cluster === 'inCluster') &&
        workloads.find((workload) => workload.name === 'alpine' &&
          workload.type === 'Pod' && workload.namespace === 'services') &&
        workloads.find((workload) => workload.name === 'nginx' &&
          workload.type === 'ReplicationController' && workload.namespace === 'services') &&
        workloads.find((workload) => workload.name === 'redis'
          && workload.type === 'Deployment' && workload.namespace === 'services')) {
      break;
    }

    await sleep(1000 * toneDownFactor);
  }
  if (podStartChecks <= 0) {
    t.fail('The snyk-monitor did not send data to homebase in the expected timeframe');
  } else {
    t.pass('k8s monitor successfully sent expected data to homebase');
    console.log('Done -- snyk-monitor sent data to Homebase!');
  }
});

tap.test('snyk-monitor sends correct data to homebase after adding another deployment', async (t) => {
  t.plan(1);

  await setup.applyK8sYaml('./test/fixtures/nginx-deployment.yaml');

  console.log(`Begin polling Homebase for the expected workloads with integration ID ${integrationId}...`);
  // We don't want to spam Homebase with requests; do it infrequently
  const toneDownFactor = 5;
  let podStartChecks = setup.KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS / toneDownFactor;
  // TODO: consider if we're OK to expose this publicly?
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@homebase-int.dev.snyk.io/api/v1/workloads/${integrationId}`;
  while (podStartChecks-- > 0) {
    const homebaseResponse = await needle('get', url, null)
      .catch((error) => t.fail(error));

    const responseBody = homebaseResponse.body;
    const workloads: IWorkloadLocator[] | undefined = responseBody.workloads;

    if (workloads && workloads.find((workload) => workload.name === 'nginx-deployment'
          && workload.type === 'Deployment' && workload.namespace === 'services')) {
      break;
    }

    await sleep(1000 * toneDownFactor);
  }
  if (podStartChecks <= 0) {
    t.fail('The snyk-monitor did not send data to homebase in the expected timeframe');
  } else {
    t.pass('k8s monitor successfully sent expected data to homebase');
    console.log('Done -- snyk-monitor sent data to Homebase!');
  }
});
