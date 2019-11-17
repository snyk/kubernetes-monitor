import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, readFileSync, unlinkSync, writeFileSync } from 'fs';
import needle = require('needle');
import { platform } from 'os';
import { resolve as pathResolve } from 'path';
import * as sleep from 'sleep-promise';
import * as uuidv4 from 'uuid/v4';
import { parse, stringify } from 'yaml';
import * as kind from './helpers/kind';
import * as kubectl from './helpers/kubectl';

// Used when polling the monitor for certain data.
// For example, checking every second that the monitor is running,
// or checking that the monitor has stored data in Homebase.
export const KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS = 600;

async function getLatestStableK8sRelease(): Promise<string> {
  const k8sRelease = await needle('get',
    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
    null,
  ).then((response) => response.body.replace(/[\n\t\r]/g, '').trim());
  console.log(`The latest stable K8s release is ${k8sRelease}`);
  return k8sRelease;
}

function getIntegrationId(): string {
  const integrationId = uuidv4();
  console.log(`Generated new integration ID ${integrationId}`);
  return integrationId;
}

function getEnvVariableOrDefault(envVarName: string, defaultValue: string): string {
  const value = process.env[envVarName];
  return value === undefined || value === ''
    ? defaultValue
    : value;
}

function createTestYamlDeployment(
  newYamlPath: string,
  integrationId: string,
  imageNameAndTag: string,
): void {
  console.log('Creating test deployment...');
  const originalDeploymentYaml = readFileSync('./snyk-monitor-deployment.yaml', 'utf8');
  const deployment = parse(originalDeploymentYaml);

  deployment.spec.template.spec.containers[0].image = imageNameAndTag;
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
    value: 'https://kubernetes-upstream.dev.snyk.io',
  };

  writeFileSync(newYamlPath, stringify(deployment));
  console.log('Created test deployment!');
}

async function isMonitorInReadyState(): Promise<boolean> {
  const kindConfigPath = await kind.getKindConfigPath();
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(kindConfigPath);
  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

  // First make sure our monitor Pod exists (is deployed).
  const podsResponse = await k8sApi.listNamespacedPod('snyk-monitor');
  if (podsResponse.body.items.length === 0) {
    return false;
  }

  const monitorPod = podsResponse.body.items.find((pod) => pod.metadata !== undefined &&
    pod.metadata.name !== undefined && pod.metadata.name.includes('snyk-monitor'));
  if (monitorPod === undefined) {
    return false;
  }

  return monitorPod.status !== undefined && monitorPod.status.phase === 'Running';
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

export async function removeMonitor(): Promise<void> {
  try {
    await kind.deleteKindCluster();
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

async function createMonitorDeployment(): Promise<string> {
  const imageNameAndTag = getEnvVariableOrDefault(
    'KUBERNETES_MONITOR_IMAGE_NAME_AND_TAG',
    // the default, determined by ./script/build-image.sh
    'snyk/kubernetes-monitor:local',
  );
  const gcrToken = getEnvVariableOrDefault('GCR_IO_SERVICE_ACCOUNT', '{}');
  const gcrDockercfg = getEnvVariableOrDefault('GCR_IO_DOCKERCFG', '{}');

  const k8sRelease = await getLatestStableK8sRelease();
  const osDistro = platform();

  await kubectl.downloadKubectl(k8sRelease, osDistro);
  await kind.downloadKind(osDistro);

  const kindClusterName = 'kind';
  await kind.createKindCluster(kindClusterName);
  await kind.exportKubeConfig();

  await kind.loadImageInCluster(imageNameAndTag);

  const namespace = 'snyk-monitor';
  await kubectl.createNamespace(namespace);

  const secretName = 'snyk-monitor';
  const integrationId = getIntegrationId();
  await kubectl.createSecret(secretName, namespace, {
    'dockercfg.json': gcrDockercfg,
    integrationId,
  });

  const servicesNamespace = 'services';
  await kubectl.createNamespace(servicesNamespace);
  // Small hack to prevent timing problems in CircleCI...
  await sleep(5000);

  // Create imagePullSecrets for pulling private images from gcr.io.
  // This is needed for deploying gcr.io images in KinD (this is _not_ used by snyk-monitor).
  const gcrSecretName = 'gcr-io';
  const gcrKubectlSecretsKeyPrefix = '--';
  const gcrSecretType = 'docker-registry';
  await kubectl.createSecret(
    gcrSecretName,
    servicesNamespace,
    {
      'docker-server': 'https://gcr.io',
      'docker-username': '_json_key',
      'docker-email': 'egg@snyk.io',
      'docker-password': gcrToken,
    },
    gcrKubectlSecretsKeyPrefix,
    gcrSecretType,
  );

  const testYaml = 'snyk-monitor-test-deployment.yaml';
  createTestYamlDeployment(testYaml, integrationId, imageNameAndTag);

  await kubectl.applyK8sYaml('./snyk-monitor-cluster-permissions.yaml');
  await kubectl.applyK8sYaml('./snyk-monitor-test-deployment.yaml');

  try {
    await waitForMonitorToBeReady();
    console.log(
      `Deployed the snyk-monitor with integration ID ${integrationId}!`,
    );
  } catch (error) {
    console.log(error.message);
    await removeMonitor();
    throw error;
  }

  return integrationId;
}

export async function deployMonitor(): Promise<string> {
  console.log('Begin deploying the snyk-monitor...');

  try {
    return await createMonitorDeployment();
  } catch (err) {
    console.error(err);
    try {
      await removeMonitor();
    } catch (error) {
      // ignore cleanup errors
    } finally {
      // ... but make sure the test suite doesn't proceed if the setup failed
      process.exit(-1);
    }

    throw err;
  }
}

export async function createSampleDeployments(): Promise<void> {
  const servicesNamespace = 'services';
  const someImageWithSha = 'alpine@sha256:7746df395af22f04212cd25a92c1d6dbc5a06a0ca9579a229ef43008d4d1302a';
  await Promise.all([
    kubectl.applyK8sYaml('./test/fixtures/alpine-pod.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/nginx-replicationcontroller.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/redis-deployment.yaml'),
    kubectl.applyK8sYaml('./test/fixtures/centos-deployment.yaml'),
    kubectl.createDeploymentFromImage('alpine-from-sha', someImageWithSha, servicesNamespace),
  ]);
}
