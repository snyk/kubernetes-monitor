import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as sleep from 'sleep-promise';
import * as uuidv4 from 'uuid/v4';
import { parse, stringify } from 'yaml';
import platforms from './platforms';
import * as kubectl from '../helpers/kubectl';
import * as waiters from './waiters';

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
  console.log('Created test deployment');
}

export async function removeMonitor(): Promise<void> {
  try {
    await platforms.kind.delete();
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

async function createEnvironment(): Promise<void> {
  // TODO: we probably want to use k8s-api for that, not kubectl
  const servicesNamespace = 'services';
  await kubectl.createNamespace(servicesNamespace);
  // Small hack to prevent timing problems in CircleCI...
  await sleep(5000);

  // Create imagePullSecrets for pulling private images from gcr.io.
  // This is needed for deploying gcr.io images in KinD (this is _not_ used by snyk-monitor).
  const gcrSecretName = 'gcr-io';
  const gcrKubectlSecretsKeyPrefix = '--';
  const gcrSecretType = 'docker-registry';
  const gcrToken = getEnvVariableOrDefault('GCR_IO_SERVICE_ACCOUNT', '{}');
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
}

async function installKubernetesMonitor(imageNameAndTag: string): Promise<string> {
  const namespace = 'snyk-monitor';
  await kubectl.createNamespace(namespace);

  const secretName = 'snyk-monitor';
  const integrationId = getIntegrationId();
  const gcrDockercfg = getEnvVariableOrDefault('GCR_IO_DOCKERCFG', '{}');
  await kubectl.createSecret(secretName, namespace, {
    'dockercfg.json': gcrDockercfg,
    integrationId,
  });

  const testYaml = 'snyk-monitor-test-deployment.yaml';
  createTestYamlDeployment(testYaml, integrationId, imageNameAndTag);

  await kubectl.applyK8sYaml('./snyk-monitor-cluster-permissions.yaml');
  await kubectl.applyK8sYaml('./snyk-monitor-test-deployment.yaml');

  return integrationId;
}

export async function deployMonitor(): Promise<string> {
  console.log('Begin deploying the snyk-monitor...');

  try {
    const imageNameAndTag = getEnvVariableOrDefault(
      'KUBERNETES_MONITOR_IMAGE_NAME_AND_TAG',
      // the default, determined by ./script/build-image.sh
      'snyk/kubernetes-monitor:local',
    );

    const testPlatform = process.env['TEST_PLATFORM'] || 'kind';
    const createCluster = process.env['CREATE_CLUSTER'] === 'true';
    console.log(`platform chosen is ${testPlatform}, createCluster===${createCluster}`);

    await kubectl.downloadKubectl();
    if (createCluster) {
      await platforms[testPlatform].create(imageNameAndTag);
    }
    await platforms[testPlatform].config();
    await createEnvironment();
    const integrationId = await installKubernetesMonitor(imageNameAndTag);
    await waiters.waitForMonitorToBeReady();
    console.log(`Deployed the snyk-monitor with integration ID ${integrationId}`);
    return integrationId;
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
