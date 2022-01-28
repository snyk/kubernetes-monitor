import { CoreV1Api, KubeConfig, AppsV1Api } from '@kubernetes/client-node';
import { Fact, ScanResult } from 'snyk-docker-plugin';
import * as setup from '../setup';
import { WorkloadKind } from '../../src/supervisor/types';
import {
  WorkloadMetadataValidator,
  WorkloadLocatorValidator,
} from '../helpers/types';
import {
  validateUpstreamStoredData,
  validateUpstreamStoredMetadata,
  getUpstreamResponseBody,
  validateUpstreamStoredScanResults,
} from '../helpers/kubernetes-upstream';
import * as kubectl from '../helpers/kubectl';
import { execWrapper as exec } from '../helpers/exec';
import { IWorkloadLocator } from '../../src/transmitter/types';

let integrationId: string;
let namespace: string;

async function teardown(): Promise<void> {
  console.log('Begin removing the snyk-monitor...');
  await setup.removeMonitor();
  console.log('Removed the snyk-monitor!');

  console.log('Begin removing "kind" network...');
  await setup.removeUnusedKindNetwork();
  console.log('Removed "kind" network');
}

beforeAll(teardown);
afterAll(teardown);

// Make sure this runs first -- deploying the monitor for the next tests
test('deploy snyk-monitor', async () => {
  namespace = setup.snykMonitorNamespace();
  integrationId = await setup.deployMonitor();
});

const cronJobValidator = (workloads: IWorkloadLocator[]) =>
  workloads.find(
    (workload) =>
      workload.name === 'cron-job' && workload.type === WorkloadKind.CronJob,
  ) !== undefined;

const cronJobV1Beta1Validator = (workloads: IWorkloadLocator[]) =>
  workloads.find(
    (workload) =>
      workload.name === 'cron-job-v1beta1' &&
      workload.type === WorkloadKind.CronJob,
  ) !== undefined;

let cronJobV1Supported = true;
let cronJobV1Beta1Supported = true;
// Next we apply some sample workloads
test('deploy sample workloads', async () => {
  const servicesNamespace = 'services';
  const someImageWithSha =
    'docker.io/library/alpine@sha256:7746df395af22f04212cd25a92c1d6dbc5a06a0ca9579a229ef43008d4d1302a';
  await Promise.all([
    kubectl.applyK8sYaml('./test/fixtures/alpine-pod.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/oci-dummy-pod.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/nginx-replicationcontroller.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/redis-deployment.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/centos-deployment.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/scratch-deployment.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/consul-deployment.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/cronjob.yaml').catch((error) => {
      console.log('CronJob is possibly unsupported', error);
      cronJobV1Supported = false;
    }),
    kubectl
      .applyK8sYaml('./test/fixtures/cronjob-v1beta1.yaml')
      .catch((error) => {
        console.log('CronJobV1Beta1 is possibly unsupported', error);
        cronJobV1Beta1Supported = false;
      }),
    kubectl.createPodFromImage(
      'alpine-from-sha',
      someImageWithSha,
      servicesNamespace,
    ),
  ]);
});

test('snyk-monitor container started', async () => {
  console.log('Getting KinD config...');
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();
  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
  console.log('Loaded KinD config!');

  console.log('Querying the snyk-monitor...');
  const response = await k8sApi.listNamespacedPod(namespace);
  expect(response.body.items.length).toBeGreaterThan(0);

  const monitorPod = response.body.items.find(
    (pod) =>
      pod.metadata !== undefined &&
      pod.metadata.name !== undefined &&
      pod.metadata.name.includes('snyk-monitor'),
  );
  expect(monitorPod).toBeDefined();
  expect(monitorPod?.status).toBeDefined();
  expect(monitorPod?.status?.phase).not.toEqual('Failed');
  console.log('Done -- snyk-monitor exists!');
});

test('create local container registry and push an image', async () => {
  if (process.env['TEST_PLATFORM'] !== 'kind') {
    console.log(
      "Not testing local container registry because we're not running in KinD",
    );
    return;
  }
  console.log('Creating local container registry...');
  await exec(
    'docker run -d --restart=always -p "5000:5000" --name "kind-registry" registry:2',
  );
  await exec('docker network connect "kind" "kind-registry"');

  console.log('Pushing python:rc-buster image to the local registry');
  //Note: this job takes a while and waitForJob() should be called before trying to access local registry image,
  //to make sure it completed
  await kubectl.applyK8sYaml(
    './test/fixtures/insecure-registries/push-dockerhub-image-to-local-registry.yaml',
  );

  console.log('successfully started a job to push image to a local registry');
});

test('snyk-monitor sends data to kubernetes-upstream', async () => {
  console.log(
    `Begin polling kubernetes-upstream for the expected workloads with integration ID ${integrationId}...`,
  );

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'alpine' && workload.type === WorkloadKind.Pod,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'oci-dummy' && workload.type === WorkloadKind.Pod,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'nginx' &&
          workload.type === WorkloadKind.ReplicationController,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'redis' &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'alpine-from-sha' &&
          workload.type === WorkloadKind.Pod,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'busybox' &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'centos' &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'consul' &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined &&
      // only one of the cronjob versions needs to be valid
      (cronJobValidator(workloads) || cronJobV1Beta1Validator(workloads))
    );
  };

  const metaValidator: WorkloadMetadataValidator = (workloadInfo) => {
    return (
      workloadInfo !== undefined &&
      'revision' in workloadInfo &&
      'labels' in workloadInfo &&
      'specLabels' in workloadInfo &&
      'annotations' in workloadInfo &&
      'specAnnotations' in workloadInfo &&
      'podSpec' in workloadInfo
    );
  };

  // We don't want to spam kubernetes-upstream with requests; do it infrequently
  const workloadTestResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/Default cluster/services`,
  );
  expect(workloadTestResult).toBeTruthy();
  const workloadMetadataResult = await validateUpstreamStoredMetadata(
    metaValidator,
    `api/v1/workload/${integrationId}/Default cluster/services/Deployment/redis`,
  );
  expect(workloadMetadataResult).toBeTruthy();

  const busyboxScanResultsPath = `api/v1/scan-results/${integrationId}/Default%20cluster/services/Deployment/busybox`;
  const scanResultsScratchImage = await getUpstreamResponseBody(
    busyboxScanResultsPath,
  );
  expect(scanResultsScratchImage).toEqual({
    workloadScanResults: {
      'docker.io/library/busybox': expect.any(Array),
    },
  });

  const busyboxPluginResult =
    scanResultsScratchImage.workloadScanResults['docker.io/library/busybox'];
  const osScanResult = busyboxPluginResult[0];
  expect(osScanResult.facts).toEqual(
    expect.arrayContaining<Fact>([
      { type: 'depGraph', data: expect.any(Object) },
      { type: 'imageId', data: expect.any(String) },
      { type: 'imageLayers', data: expect.any(Array) },
      { type: 'rootFs', data: expect.any(Array) },
    ]),
  );

  expect(osScanResult.target.image).toEqual(
    'docker-image|docker.io/library/busybox',
  );
  expect(osScanResult.identity.type).toEqual('linux');

  const scanResultsConsulDeployment = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/Default%20cluster/services/Deployment/consul`,
  );
  expect(
    scanResultsConsulDeployment.workloadScanResults[
      'docker.io/snyk/runtime-fixtures'
    ],
  ).toEqual<ScanResult[]>([
    {
      identity: { type: 'apk', args: { platform: 'linux/amd64' } },
      facts: expect.any(Array),
      target: { image: 'docker-image|docker.io/snyk/runtime-fixtures' },
    },
    {
      identity: { type: 'gomodules', targetFile: '/bin/consul' },
      facts: expect.arrayContaining([
        { type: 'depGraph', data: expect.any(Object) },
      ]),
      target: { image: 'docker-image|docker.io/snyk/runtime-fixtures' },
    },
  ]);

  if (cronJobV1Beta1Supported) {
    const scanResultsCronJobBeta = await getUpstreamResponseBody(
      `api/v1/scan-results/${integrationId}/Default%20cluster/services/CronJob/cron-job-v1beta1`,
    );
    expect(scanResultsCronJobBeta.workloadScanResults['busybox']).toEqual<
      ScanResult[]
    >([
      {
        identity: { type: 'linux', args: { platform: 'linux/amd64' } },
        facts: expect.any(Array),
        target: { image: 'docker-image|busybox' },
      },
    ]);
  }

  if (cronJobV1Supported) {
    const scanResultsCronJob = await getUpstreamResponseBody(
      `api/v1/scan-results/${integrationId}/Default%20cluster/services/CronJob/cron-job`,
    );
    expect(scanResultsCronJob.workloadScanResults['busybox']).toEqual<
      ScanResult[]
    >([
      {
        identity: { type: 'linux', args: { platform: 'linux/amd64' } },
        facts: expect.any(Array),
        target: { image: 'docker-image|busybox' },
      },
    ]);
  }
});

test('snyk-monitor sends binary hashes to kubernetes-upstream after adding another deployment', async () => {
  const deploymentName = 'binaries-deployment';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.Deployment;

  await kubectl.applyK8sYaml('./test/fixtures/binaries-deployment.yaml');
  console.log(
    `Begin polling kubernetes-upstream for the expected workloads with integration ID ${integrationId}...`,
  );

  const workloadLocatorValidatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === deploymentName &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined
    );
  };

  const scanResultsValidatorFn = (workloadScanResults?: {
    node?: object;
    openjdk?: object;
  }) => {
    return (
      workloadScanResults !== undefined &&
      workloadScanResults['docker.io/library/node'] !== undefined &&
      workloadScanResults['docker.io/library/openjdk'] !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    workloadLocatorValidatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(testResult).toBeTruthy();
  const isWorkloadStored = await validateUpstreamStoredScanResults(
    scanResultsValidatorFn,
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`,
  );
  expect(isWorkloadStored).toBeTruthy();

  const scanResultsResponse = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`,
  );
  expect(scanResultsResponse).toEqual({
    workloadScanResults: {
      'docker.io/library/node': expect.any(Array),
      'docker.io/library/openjdk': expect.any(Array),
    },
  });

  const nodePluginResult =
    scanResultsResponse.workloadScanResults['docker.io/library/node'];
  const nodeOsScanResult = nodePluginResult[0];
  const nodeHashes = nodeOsScanResult.facts.find(
    (fact) => fact.type === 'keyBinariesHashes',
  ).data;
  expect(nodeHashes).toHaveLength(1);
  expect(nodeHashes[0]).toEqual(
    '6d5847d3cd69dfdaaf9dd2aa8a3d30b1a9b3bfa529a1f5c902a511e1aa0b8f55',
  );

  const openjdkPluginResult =
    scanResultsResponse.workloadScanResults['docker.io/library/openjdk'];
  const openjdkOsScanResult = openjdkPluginResult[0];
  const openjdkHashes = openjdkOsScanResult.facts.find(
    (fact) => fact.type === 'keyBinariesHashes',
  ).data;
  expect(openjdkHashes).toEqual([
    '99503bfc6faed2da4fd35f36a5698d62676f886fb056fb353064cc78b1186195',
    '00a90dcce9ca53be1630a21538590cfe15676f57bfe8cf55de0099ee80bbeec4',
  ]);
});

test('snyk-monitor pulls images from a private gcr.io registry and sends data to kubernetes-upstream', async () => {
  const deploymentName = 'debian-gcr-io';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.Deployment;
  const imageName = 'gcr.io/snyk-k8s-fixtures/debian';

  await kubectl.applyK8sYaml(
    './test/fixtures/private-registries/debian-deployment-gcr-io.yaml',
  );
  console.log(
    `Begin polling upstream for the expected private gcr.io image with integration ID ${integrationId}...`,
  );

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === deploymentName &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(testResult).toBeTruthy();

  const scanResultsResponse = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`,
  );
  expect(scanResultsResponse).toBeTruthy();
  const scanResults = scanResultsResponse.workloadScanResults[imageName];
  expect(scanResults[0].facts).toEqual(
    expect.arrayContaining<Fact>([
      { type: 'depGraph', data: expect.any(Object) },
      { type: 'imageId', data: expect.any(String) },
      { type: 'imageLayers', data: expect.any(Array) },
      { type: 'rootFs', data: expect.any(Array) },
    ]),
  );
  expect(scanResults[0].identity.type).toEqual('deb');
});

test('snyk-monitor pulls images from a private ECR and sends data to kubernetes-upstream', async () => {
  if (process.env['TEST_PLATFORM'] !== 'eks') {
    console.log(
      "Not testing private ECR images because we're not running in EKS",
    );
    return;
  }

  const deploymentName = 'debian-ecr';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.Deployment;
  const imageName = '291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/debian';

  await kubectl.applyK8sYaml(
    './test/fixtures/private-registries/debian-deployment-ecr.yaml',
  );
  console.log(
    `Begin polling upstream for the expected private ECR image with integration ID ${integrationId}...`,
  );

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === deploymentName &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(testResult).toBeTruthy();

  const scanResultsResponse = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`,
  );
  expect(scanResultsResponse).toEqual({
    workloadScanResults: {
      [imageName]: expect.any(Array),
    },
  });
});

test('snyk-monitor scans DeploymentConfigs', async () => {
  if (process.env['TEST_PLATFORM'] !== 'openshift4') {
    console.log('Not testing DeploymentConfigs outside of OpenShift');
    return;
  }
  const deploymentConfigName = 'deployment-config';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.DeploymentConfig;
  const imageName = 'docker.io/library/hello-world';
  await kubectl.applyK8sYaml('test/fixtures/hello-world-deploymentconfig.yaml');
  console.log(
    `Begin polling upstream for the expected DeploymentConfig with integration ID ${integrationId}...`,
  );

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === deploymentConfigName &&
          workload.type === deploymentType,
      ) !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(testResult).toBeTruthy();

  const scanResultsResponse = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentConfigName}`,
  );
  expect(scanResultsResponse).toEqual({
    workloadScanResults: {
      [imageName]: expect.any(Array),
    },
  });
});

test('snyk-monitor pulls images from a local registry and sends data to kubernetes-upstream', async () => {
  if (process.env['TEST_PLATFORM'] !== 'kind') {
    console.log(
      "Not testing local container registry because we're not running in KinD",
    );
    return;
  }

  const deploymentName = 'python-local';
  const namespace = 'services';
  const clusterName = 'Default cluster';
  const deploymentType = WorkloadKind.Deployment;
  const imageName = 'kind-registry:5000/python';

  await kubectl.waitForJob('push-to-local-registry', 'default');

  console.log('Applying local registry workload...');
  await kubectl.applyK8sYaml(
    './test/fixtures/insecure-registries/python-local-deployment.yaml',
  );

  console.log(
    `Begin polling upstream for the expected kind-registry:5000 image with integration ID ${integrationId}...`,
  );

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === deploymentName && workload.type === deploymentType,
      ) !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(testResult).toBeTruthy();

  const scanResultsResponse = await getUpstreamResponseBody(
    `api/v1/scan-results/${integrationId}/${clusterName}/${namespace}/${deploymentType}/${deploymentName}`,
  );
  const scanResults = scanResultsResponse.workloadScanResults[imageName];
  expect(scanResults[0].facts).toEqual(
    expect.arrayContaining<Fact>([
      { type: 'depGraph', data: expect.any(Object) },
      { type: 'imageId', data: expect.any(String) },
      { type: 'imageLayers', data: expect.any(Array) },
      { type: 'rootFs', data: expect.any(Array) },
    ]),
  );
  expect(scanResults[0].identity.type).toEqual('deb');
});

test('snyk-monitor sends deleted workload to kubernetes-upstream', async () => {
  // First ensure the deployment exists from the previous test
  const deploymentValidatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'binaries-deployment' &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined
    );
  };

  const testResult = await validateUpstreamStoredData(
    deploymentValidatorFn,
    `api/v2/workloads/${integrationId}/Default cluster/services`,
  );
  expect(testResult).toBeTruthy();

  const deploymentName = 'binaries-deployment';
  const namespace = 'services';
  await kubectl.deleteDeployment(deploymentName, namespace);

  // Finally, remove the workload and ensure that the snyk-monitor notifies kubernetes-upstream
  const deleteValidatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.every((workload) => workload.name !== 'binaries-deployment')
    );
  };

  const clusterName = 'Default cluster';
  const deleteTestResult = await validateUpstreamStoredData(
    deleteValidatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(deleteTestResult).toBeTruthy();
});

test('snyk-monitor has resource limits', async () => {
  const snykMonitorDeployment = await kubectl.getDeploymentJson(
    'snyk-monitor',
    namespace,
  );
  const monitorResources =
    snykMonitorDeployment.spec.template.spec.containers[0].resources;
  expect(monitorResources).toEqual(
    expect.objectContaining({
      requests: {
        cpu: expect.any(String),
        memory: expect.any(String),
      },
      limits: {
        cpu: expect.any(String),
        memory: expect.any(String),
      },
    }),
  );
});

test('snyk-monitor has log level', async () => {
  if (!['Helm', 'YAML'].includes(process.env.DEPLOYMENT_TYPE || '')) {
    console.log(
      "Not testing LOG_LEVEL existence because we're not installing with Helm or Yaml",
    );
    return;
  }

  const snykMonitorDeployment = await kubectl.getDeploymentJson(
    'snyk-monitor',
    namespace,
  );
  const env = snykMonitorDeployment.spec.template.spec.containers[0].env;
  const logLevel = env.find(({ name }) => name === 'LOG_LEVEL');
  expect(logLevel.name).toBeTruthy();
  expect(logLevel.value).toBeTruthy();
});

test('service account has annotations that were set on deployment', async () => {
  if (process.env.DEPLOYMENT_TYPE !== 'Helm') {
    console.log(
      "Not testing annotations existence because we're not installing with Helm",
    );
    return;
  }

  const snykMonitorServiceAccount = await kubectl.getServiceAccountJson(
    'snyk-monitor',
    namespace,
  );
  expect(snykMonitorServiceAccount.metadata?.annotations).toEqual(
    expect.objectContaining({
      foo: 'bar',
    }),
  );
});

test('snyk-monitor has nodeSelector', async () => {
  if (process.env['DEPLOYMENT_TYPE'] !== 'Helm') {
    console.log(
      "Not testing nodeSelector because we're not installing with Helm",
    );
    return;
  }

  const snykMonitorDeployment = await kubectl.getDeploymentJson(
    'snyk-monitor',
    'snyk-monitor',
  );
  const spec = snykMonitorDeployment.spec.template.spec;
  expect(spec).toEqual(
    expect.objectContaining({ nodeSelector: expect.any(Object) }),
  );
});

test('snyk-monitor has PodSecurityPolicy', async () => {
  if (process.env['DEPLOYMENT_TYPE'] !== 'Helm') {
    console.log(
      "Not testing PodSecurityPolicy because we're not installing with Helm",
    );
    return;
  }

  const pspExists = await kubectl.verifyPodSecurityPolicy('snyk-monitor');
  expect(pspExists).toBeTruthy();
});

test('snyk-monitor secure configuration is as expected', async () => {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();
  const k8sApi = kubeConfig.makeApiClient(AppsV1Api);

  const response = await k8sApi.readNamespacedDeployment(
    'snyk-monitor',
    namespace,
  );
  const deployment = response.body;
  expect(deployment.spec?.template?.spec?.containers?.[0]).toEqual(
    expect.objectContaining({
      securityContext: {
        capabilities: expect.objectContaining({
          drop: ['ALL'],
          add: expect.not.arrayContaining(['SYS_ADMIN']),
        }),
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false,
        privileged: false,
        runAsNonRoot: true,
      },
      volumeMounts: expect.arrayContaining([
        expect.objectContaining({
          name: 'temporary-storage',
          mountPath: '/var/tmp',
        }),
        expect.objectContaining({
          name: 'docker-config',
          mountPath: '/srv/app/.docker',
          readOnly: true,
        }),
        expect.objectContaining({
          name: 'workload-policies',
          mountPath: '/tmp/policies',
          readOnly: true,
        }),
      ]),
      env: expect.arrayContaining([{ name: 'HOME', value: '/srv/app' }]),
    }),
  );
});

/**
 * The snyk-monitor should detect that a Pod which doesn't have
 * a parent (OwnerReference) is deleted and should notify upstream.
 *
 * This is the only special case of a workload, where the Pod
 * itself is the workload (because it was created on its own).
 */
test('notify upstream of deleted pods that have no OwnerReference', async () => {
  const clusterName = 'Default cluster';

  const podName = 'alpine';
  const namespace = 'services';

  await kubectl.deletePod(podName, namespace);

  const validatorFn: WorkloadLocatorValidator = (workloads) => {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === 'alpine' && workload.type === WorkloadKind.Pod,
      ) === undefined
    );
  };

  const validationResult = await validateUpstreamStoredData(
    validatorFn,
    `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
  );
  expect(validationResult).toBeTruthy();
});
