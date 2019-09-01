import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import needle = require('needle');
import sleep = require('sleep-promise');
import setup = require('../setup'); // Must be located before 'tap' import
// tslint:disable-next-line: ordered-imports
import * as tap from 'tap';
import * as config from '../../src/common/config';
import { IWorkloadLocator } from '../../src/transmitter/types';
import { getKindConfigPath } from '../helpers/kind';
import { WorkloadKind } from '../../src/kube-scanner/types';

let integrationId: string;
const toneDownFactor = 5;
const maxPodChecks = setup.KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS / toneDownFactor;

type WorkloadLocatorValidator = (workloads: IWorkloadLocator[] | undefined) => boolean;

async function tearDown() {
  console.log('Begin removing the snyk-monitor...');
  await tap.removeMonitor();
  console.log('Removed the snyk-monitor!');
}

tap.tearDown(tearDown);

// Make sure this runs first -- deploying the monitor for the next tests
tap.test('deploy snyk-monitor', async (t) => {
  console.log('Begin deploying the snyk-monitor...');
  t.plan(1);

  try {
    integrationId = await tap.deployMonitor();
    console.log(`Deployed the snyk-monitor with integration ID ${integrationId}!`);
    t.pass('successfully deployed the snyk-monitor');
  } catch (err) {
    console.error(err);
    t.fail('failed setting up the snyk-monitor');
    try {
      // attempt to clean up ...
      await tearDown();
    } catch (teardownError) {
      // ignore cleanup errors
    } finally {
      // ... but make sure the test suite doesn't proceed if the setup failed
      process.exit(-1);
    }
  }
});

tap.test('snyk-monitor container started', async (t) => {
  t.plan(4);

  console.log('Getting KinD config...');
  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
  console.log('Loaded KinD config!');

  // wait to let the container go through a cycle
  await sleep(config.MONITOR.INITIAL_REFRESH_MS);

  console.log('Querying the snyk-monitor...');
  const response = await k8sApi.listNamespacedPod('snyk-monitor');
  t.ok(response.body.items.length > 0, 'PodList is not empty');

  const monitorPod = response.body.items.find((pod) => pod.metadata !== undefined &&
    pod.metadata.name !== undefined && pod.metadata.name.includes('snyk-monitor'));
  t.ok(monitorPod !== undefined, 'Snyk monitor container exists');
  t.ok(monitorPod!.status !== undefined, 'Snyk monitor status object exists');
  t.notEqual(monitorPod!.status!.phase, 'Failed', 'Snyk monitor container didn\'t fail');
  console.log('Done -- snyk-monitor exists!');
});

async function validateHomebaseStoredData(
  validatorFn: WorkloadLocatorValidator, relativeUrl: string, remainingChecks: number = maxPodChecks,
): Promise<boolean> {
  // TODO: consider if we're OK to expose this publicly?
  while (remainingChecks > 0) {
    const responseBody = await getHomebaseResponseBody(relativeUrl);
    const workloads: IWorkloadLocator[] | undefined = responseBody.workloads;
    const result = validatorFn(workloads);
    if (result) {
      return true;
    }
    await sleep(1000 * toneDownFactor);
    remainingChecks--;
  }
  return false;
}

async function getHomebaseResponseBody(relativeUrl: string): Promise<any> {
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@homebase-int.dev.snyk.io/${relativeUrl}`;
  const homebaseResponse = await needle('get', url, null);
  const responseBody = homebaseResponse.body;
  return responseBody;
}

tap.test('snyk-monitor sends data to homebase', async (t) => {
  t.plan(1);

  console.log(`Begin polling Homebase for the expected workloads with integration ID ${integrationId}...`);

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return workloads !== undefined && workloads.length === 4 &&
      workloads.find((workload) => workload.name === 'alpine' &&
        workload.type === WorkloadKind.Pod) !== undefined &&
      workloads.find((workload) => workload.name === 'nginx' &&
        workload.type === WorkloadKind.ReplicationController) !== undefined &&
      workloads.find((workload) => workload.name === 'redis' &&
        workload.type === WorkloadKind.Deployment) !== undefined &&
      workloads.find((workload) => workload.name === 'alpine-from-sha' &&
        workload.type === WorkloadKind.Deployment) !== undefined;
  };

  // We don't want to spam Homebase with requests; do it infrequently
  const homebaseTestResult = await validateHomebaseStoredData(
    validatorFn, `api/v2/workloads/${integrationId}/Default cluster/services`);
  t.ok(homebaseTestResult, 'snyk-monitor sent expected data to homebase in the expected timeframe');
});

tap.test('snyk-monitor sends correct data to homebase after adding another deployment', async (t) => {
  t.plan(3);

  const deploymentName = 'nginx-deployment';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.Deployment;
  const imageName = 'nginx';

  await setup.applyK8sYaml('./test/fixtures/nginx-deployment.yaml');
  console.log(`Begin polling Homebase for the expected workloads with integration ID ${integrationId}...`);

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return workloads !== undefined &&
      workloads.find((workload) => workload.name === deploymentName &&
        workload.type === WorkloadKind.Deployment) !== undefined;
  };

  const homebaseTestResult = await validateHomebaseStoredData(
    validatorFn, `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`);
  t.ok(homebaseTestResult, 'snyk-monitor sent expected data to homebase in the expected timeframe');

  const depGraphResult = await getHomebaseResponseBody(
    `api/v1/dependency-graphs/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`);
  t.ok('dependencyGraphResults' in depGraphResult,
    'expected dependencyGraphResults field to exist in /dependency-graphs response');
  t.ok('imageMetadata' in JSON.parse(depGraphResult.dependencyGraphResults[imageName]),
    'snyk-monitor sent expected data to homebase in the expected timeframe');
});

tap.test('snyk-monitor sends deleted workload to homebase', async (t) => {
  // First ensure the deployment exists from the previous test
  const deploymentValidatorFn: WorkloadLocatorValidator = (workloads) => {
    return workloads !== undefined &&
      workloads.find((workload) => workload.name === 'nginx-deployment' &&
        workload.type === WorkloadKind.Deployment) !== undefined;
  };

  const homebaseTestResult = await validateHomebaseStoredData(deploymentValidatorFn,
    `api/v2/workloads/${integrationId}/Default cluster/services`);
  t.ok(homebaseTestResult, 'snyk-monitor sent expected data to homebase in the expected timeframe');

  const deploymentName = 'nginx-deployment';
  const namespace = 'services';
  await setup.deleteDeployment(deploymentName, namespace);

  // Finally, remove the workload and ensure that the snyk-monitor notifies Homebase
  const deleteValidatorFn: WorkloadLocatorValidator = (workloads) => {
    return workloads !== undefined && workloads.every((workload) => workload.name !== 'nginx-deployment');
  };

  const clusterName = 'Default cluster';
  const homebaseDeleteTestResult = await validateHomebaseStoredData(deleteValidatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`);
  t.ok(homebaseDeleteTestResult, 'snyk-monitor sent deleted workload data to homebase in the expected timeframe');
});

tap.test(`snyk-monitor has resource limits`, async (t) => {
  t.plan(5);
  const snykMonitorDeployment = await setup.getDeloymentJson('snyk-monitor', 'snyk-monitor');
  const monitorResources = snykMonitorDeployment.spec.template.spec.containers[0].resources;

  t.ok(monitorResources !== undefined, 'snyk-monitor has resources');
  t.ok(monitorResources.requests.cpu !== undefined, 'snyk-monitor has cpu resource request');
  t.ok(monitorResources.requests.memory !== undefined, 'snyk-monitor has memory resource request');
  t.ok(monitorResources.requests.cpu !== undefined, 'snyk-monitor has cpu resource request');
  t.ok(monitorResources.requests.memory !== undefined, 'snyk-monitor has memory resource request');
});
