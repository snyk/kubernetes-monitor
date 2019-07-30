import { Core_v1Api, KubeConfig } from '@kubernetes/client-node';
import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, readFileSync, unlinkSync, writeFileSync } from 'fs';
import needle = require('needle');
import { platform } from 'os';
import { resolve as pathResolve } from 'path';
import * as sleep from 'sleep-promise';
import { Test } from 'tap';
import * as uuidv4 from 'uuid/v4';
import { parse, stringify } from 'yaml';
import { getKindConfigPath } from './helpers/kind';

// Used when polling the monitor for certain data.
// For example, checking every second that the monitor is running,
// or checking that the monitor has stored data in Homebase.
export const KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS = 120;

async function getLatestStableK8sRelease(): Promise<string> {
  const k8sRelease = await needle('get',
    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
    null,
  ).then((response) => response.body.replace(/[\n\t\r]/g, '').trim());
  console.log(`The latest stable K8s release is ${k8sRelease}`);
  return k8sRelease;
}

async function downloadKubectl(k8sRelease: string, osDistro: string): Promise<void> {
  try {
    accessSync(pathResolve(process.cwd(), 'kubectl'), constants.R_OK);
  } catch (error) {
    console.log('Downloading kubectl...');

    const bodyData = null;
    const requestOptions = { follow_max: 2 };
    await needle('get', 'https://storage.googleapis.com/kubernetes-release/release/' +
      `${k8sRelease}/bin/${osDistro}/amd64/kubectl`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kubectl', response.body);
      chmodSync('kubectl', 0o755); // rwxr-xr-x
    });

    console.log('kubectl downloaded!');
  }
}

async function downloadKind(osDistro: string): Promise<void> {
  try {
    accessSync(pathResolve(process.cwd(), 'kind'), constants.R_OK);
  } catch (error) {
    console.log('Downloading KinD...');

    const bodyData = null;
    const requestOptions = { follow_max: 2 };
    await needle('get',
      `https://github.com/kubernetes-sigs/kind/releases/download/v0.3.0/kind-${osDistro}-amd64`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kind', response.body);
      chmodSync('kind', 0o755); // rwxr-xr-x
    });

    console.log('KinD downloaded!');
  }
}

function getIntegrationId(): string {
  const integrationId = uuidv4();
  console.log(`Generated new integration ID ${integrationId}`);
  return integrationId;
}

async function createKindCluster(
    clusterName = 'kind',
    configPath = './test/fixtures/cluster-config.yaml',
): Promise<void> {
  console.log(`Creating cluster "${clusterName}"...`);
  await exec(`./kind create cluster --config="${configPath}" --name="${clusterName}"`);
  console.log(`Created cluster ${clusterName}!`);
}

async function exportKubeConfig(clusterName = 'kind'): Promise<void> {
  console.log('Exporting K8s config...');
  const kindResponse = await exec(`./kind get kubeconfig-path --name="${clusterName}"`);
  const configPath = kindResponse.stdout.replace(/[\n\t\r]/g, '');
  process.env.KUBECONFIG = configPath;
  console.log('Exported K8s config!');
}

async function buildDockerImage(imageNameAndTag = 'snyk-k8s-monitor:test'): Promise<void> {
  console.log('Building kubernetes-monitor Docker image...');
  await exec(`docker build -t ${imageNameAndTag} --no-cache .`);
  console.log('Built Docker image!');
}

async function loadImageInCluster(imageNameAndTag = 'snyk-k8s-monitor:test'): Promise<void> {
  console.log(`Loading image ${imageNameAndTag} in cluster...`);
  await exec(`./kind load docker-image ${imageNameAndTag}`);
  console.log(`Loaded image ${imageNameAndTag}!`);
}

async function createNamespace(namespace: string): Promise<void> {
  console.log(`Creating namespace ${namespace}...`);
  await exec(`./kubectl create namespace ${namespace}`);
  console.log(`Created namespace ${namespace}!`);
}

async function createSecret(secretName: string, namespace: string, secrets: { [key: string]: string }): Promise<void> {
  console.log(`Creating secret ${secretName} in namespace ${namespace}...`);
  const secretsAsKubectlArgument = Object.keys(secrets)
    .reduce((prev, key) => `${prev} --from-literal=${key}="${secrets[key]}"`, '');
  await exec(`./kubectl create secret generic ${secretName} -n ${namespace} ${secretsAsKubectlArgument}`);
  console.log(`Created secret ${secretName}!`);
}

export async function applyK8sYaml(pathToYamlDeployment: string): Promise<void> {
  console.log(`Applying ${pathToYamlDeployment}...`);
  await exec(`./kubectl apply -f ${pathToYamlDeployment}`);
  console.log(`Applied ${pathToYamlDeployment}!`);
}

export async function deleteDeployment(deploymentName: string, namespace: string) {
  console.log(`Deleting deployment ${deploymentName} in namespace ${namespace}...`);
  await exec(`./kubectl delete deployment ${deploymentName} -n ${namespace}`);
  console.log(`Deleted deployment ${deploymentName}!`);
}

function createTestYamlDeployment(newYamlPath: string, integrationId: string): void {
  console.log('Creating test deployment...');
  const originalDeploymentYaml = readFileSync('./snyk-monitor-deployment.yaml', 'utf8');
  const deployment = parse(originalDeploymentYaml);

  deployment.spec.template.spec.containers[0].image = 'snyk-k8s-monitor:test';
  deployment.spec.template.spec.containers[0].imagePullPolicy = 'Never';

  // This is important due to an odd bug when running on Travis.
  // By adding the Google nameserver, the container can start resolving external hosts.
  deployment.spec.template.spec.dnsConfig = {
    nameservers: ['8.8.8.8'],
  };

  // Inject the integration ID that will be used throughout the integration tests.
  deployment.spec.template.spec.containers[0].env[0] = {
    name: 'SNYK_INTEGRATION_ID',
    value: integrationId,
  };

  // Inject the baseUrl of homebase that snyk-monitor container use to send metadata
  deployment.spec.template.spec.containers[0].env[2] = {
    name: 'SNYK_INTEGRATION_API',
    value: 'https://homebase.dev.snyk.io',
  };

  writeFileSync(newYamlPath, stringify(deployment));
  console.log('Created test deployment!');
}

async function isMonitorInReadyState(): Promise<boolean> {
  const kindConfigPath = await getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(Core_v1Api);

  // First make sure our monitor Pod exists (is deployed).
  const podsResponse = await k8sApi.listNamespacedPod('snyk-monitor');
  if (podsResponse.body.items.length === 0) {
    return false;
  }

  const monitorPod = podsResponse.body.items.find((pod) => pod.metadata.name.includes('snyk-monitor'));
  if (monitorPod === undefined) {
    return false;
  }

  return monitorPod.status.phase === 'Running';
}

async function waitForMonitorToBeReady(): Promise<void> {
  // Attempt to check if the monitor is Running.
  let podStartChecks = KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS;

  while (podStartChecks-- > 0) {
    const isMonitorReady = await isMonitorInReadyState();
    if (isMonitorReady) {
      break;
    }

    await sleep(1000);
  }

  if (podStartChecks <= 0) {
    throw Error('The snyk-monitor did not become ready in the expected time');
  }
}

async function deleteKindCluster(clusterName = 'kind'): Promise<void> {
  console.log(`Deleting cluster ${clusterName}...`);
  await exec(`./kind delete cluster --name=${clusterName}`);
  console.log(`Deleted cluster ${clusterName}!`);
}

async function cleanUpMonitorSetup(): Promise<void> {
  try {
    await deleteKindCluster();
  } catch (error) {
    console.log(`Could not delete kind cluster: ${error.message}`);
  }

  console.log('Removing KUBECONFIG environment variable...');
  delete process.env.KUBECONFIG;

  console.log('Removing test YAML file...');
  try {
    unlinkSync('snyk-monitor-test-deployment.yaml');
  } catch (error) {
    console.log(`Could not delete the test YAML file: ${error.message}`);
  }
}

Test.prototype.deployMonitor = async (): Promise<string> => {
  const k8sRelease = await getLatestStableK8sRelease();
  const osDistro = platform();

  await downloadKubectl(k8sRelease, osDistro);
  await downloadKind(osDistro);

  await createKindCluster();
  await exportKubeConfig();

  await buildDockerImage();
  await loadImageInCluster();

  const namespace = 'snyk-monitor';
  await createNamespace(namespace);

  const secretName = 'snyk-monitor';
  const integrationId = getIntegrationId();
  await createSecret(secretName, namespace, { 'dockercfg.json': '{}', 'integrationId': integrationId });

  const servicesNamespace = 'services';
  await createNamespace(servicesNamespace);

  await applyK8sYaml('./test/fixtures/alpine-pod.yaml');
  await applyK8sYaml('./test/fixtures/nginx-replicationcontroller.yaml');
  await applyK8sYaml('./test/fixtures/redis-deployment.yaml');

  const testYaml = 'snyk-monitor-test-deployment.yaml';
  createTestYamlDeployment(testYaml, integrationId);

  await applyK8sYaml('./snyk-monitor-cluster-permissions.yaml');
  await applyK8sYaml('./snyk-monitor-test-deployment.yaml');

  try {
    await waitForMonitorToBeReady();
  } catch (error) {
    console.log(error.message);
    await cleanUpMonitorSetup();
    throw error;
  }

  return integrationId;
};

Test.prototype.removeMonitor = cleanUpMonitorSetup;
