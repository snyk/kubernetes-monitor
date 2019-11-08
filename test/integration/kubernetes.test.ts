import { CoreV1Api, KubeConfig, AppsV1Api, BatchV1Api, Watch, V1Job } from '@kubernetes/client-node';
import setup = require('../setup');
import * as tap from 'tap';
import { getKindConfigPath } from '../helpers/kind';
import { WorkloadKind } from '../../src/kube-scanner/types';
import { WorkloadMetadataValidator, WorkloadLocatorValidator } from '../helpers/types';
import {
  validateHomebaseStoredData,
  validateHomebaseStoredMetadata,
  getHomebaseResponseBody,
} from '../helpers/homebase';
import { validateSecureConfiguration, validateVolumeMounts } from '../helpers/deployment';
import * as sleep from 'sleep-promise';

let integrationId: string;

async function tearDown() {
  console.log('Begin removing the snyk-monitor...');
  await setup.removeMonitor();
  console.log('Removed the snyk-monitor!');
}

tap.tearDown(tearDown);

// Make sure this runs first -- deploying the monitor for the next tests
tap.test('deploy snyk-monitor', async (t) => {
  t.plan(1);

  integrationId = await setup.deployMonitor();

  t.pass('successfully deployed the snyk-monitor');
});

// Next we apply some sample workloads
tap.test('deploy sample workloads', async (t) => {
  t.plan(1);

  await setup.createSampleDeployments();

  t.pass('successfully deployed sample workloads');
});

tap.test('snyk-monitor container started', async (t) => {
  t.plan(4);

  console.log('Getting KinD config...');
  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
  console.log('Loaded KinD config!');

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

tap.test('snyk-monitor sends data to homebase', async (t) => {
  t.plan(2);

  console.log(`Begin polling Homebase for the expected workloads with integration ID ${integrationId}...`);

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return workloads !== undefined && workloads.length === 5 &&
      workloads.find((workload) => workload.name === 'alpine' &&
        workload.type === WorkloadKind.Pod) !== undefined &&
      workloads.find((workload) => workload.name === 'nginx' &&
        workload.type === WorkloadKind.ReplicationController) !== undefined &&
      workloads.find((workload) => workload.name === 'redis' &&
        workload.type === WorkloadKind.Deployment) !== undefined &&
      workloads.find((workload) => workload.name === 'alpine-from-sha' &&
        workload.type === WorkloadKind.Deployment) !== undefined &&
      workloads.find((workload) => workload.name === 'centos' &&
        workload.type === WorkloadKind.Deployment) !== undefined;
  };

  const metaValidator: WorkloadMetadataValidator = (workloadInfo) => {
    return workloadInfo !== undefined && 'revision' in workloadInfo && 'labels' in workloadInfo &&
      'specLabels' in workloadInfo && 'annotations' in workloadInfo && 'specAnnotations' in workloadInfo &&
      'podSpec' in workloadInfo;
  };

  // We don't want to spam Homebase with requests; do it infrequently
  const homebaseDepGraphTestResult = await validateHomebaseStoredData(
    validatorFn, `api/v2/workloads/${integrationId}/Default cluster/services`);
  t.ok(homebaseDepGraphTestResult, 'snyk-monitor sent expected data to homebase in the expected timeframe');
  const homebaseWorkloadMetadataResult = await validateHomebaseStoredMetadata(metaValidator,
    `api/v1/workload/${integrationId}/Default cluster/services/Deployment/redis`);
  t.ok(homebaseWorkloadMetadataResult, 'snyk-monitor sent expected metadata in the expected timeframe');
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

tap.test('snyk-monitor secure configuration is as expected', async (t) => {
  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);

  const k8sApi = kubeConfig.makeApiClient(AppsV1Api);

  const response = await k8sApi.readNamespacedDeployment(
    'snyk-monitor',
    'snyk-monitor',
  );
  const deployment = response.body;

  validateSecureConfiguration(t, deployment);
  validateVolumeMounts(t, deployment);
});

/**
 * The snyk-monitor should detect that a Pod which doesn't have
 * a parent (OwnerReference) is deleted and should notify upstream.
 *
 * This is the only special case of a workload, where the Pod
 * itself is the workload (because it was created on its own).
 */
tap.test('notify upstream of deleted pods that have no OwnerReference', async (t) => {
  const clusterName = 'Default cluster';

  const podName = 'alpine';
  const namespace = 'services';

  await setup.deletePod(podName, namespace);

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) => workload.name === 'alpine' && workload.type === WorkloadKind.Pod,
      ) === undefined
    );
  };

  const validationResult = await validateHomebaseStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  t.ok(
    validationResult,
    'snyk-monitor sends deleted workloads to upstream for pods without OwnerReference',
  );
});

tap.test('job does not get processed', async (t) => {
  const clusterName = 'Default cluster';
  const namespace = 'services';

  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(BatchV1Api);

  await setup.applyK8sYaml('./test/fixtures/hello-world-job.yaml');

  await Promise.race([
    sleep(60 * 1000), // Ensure this doesn't take longer than a minute
    new Promise((resolve) => {
      const watch = new Watch(kubeConfig).watch(
        `/apis/batch/v1/watch/namespaces/${namespace}/jobs`,
        {},
        (_phase: string, job: V1Job) => {
          if (!job || !job.status || !job.status.completionTime) {
            return;
          }

          k8sApi.deleteNamespacedJob('hello-world-job', namespace);
          resolve(watch.abort());
        },
        () => {},
      );
    }),
  ]).catch((error) => {
    t.fail(error);
  });

  console.log('Validating that job is not present in upstream...');

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) => workload.name === 'hello-world-job' && workload.type === WorkloadKind.Job,
      ) !== undefined
    );
  };
  const validationResult = await validateHomebaseStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
    12, // one minute
  );

  t.false(validationResult, 'the job did not appear in the upstream');
});
