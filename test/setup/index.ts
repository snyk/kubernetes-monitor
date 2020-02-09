import { readFileSync, writeFileSync } from 'fs';
import * as sleep from 'sleep-promise';
import * as uuidv4 from 'uuid/v4';
import { parse, stringify } from 'yaml';
import platforms from './platforms';
import * as kubectl from '../helpers/kubectl';
import * as waiters from './waiters';

const testPlatform = process.env['TEST_PLATFORM'] || 'kind';
const createCluster = process.env['CREATE_CLUSTER'] === 'true';

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
  imagePullPolicy: string,
): void {
  console.log('Creating test deployment...');
  const originalDeploymentYaml = readFileSync('./snyk-monitor-deployment.yaml', 'utf8');
  const deployment = parse(originalDeploymentYaml);

  deployment.spec.template.spec.containers[0].image = imageNameAndTag;
  deployment.spec.template.spec.containers[0].imagePullPolicy = imagePullPolicy;

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

  // Inject the baseUrl of kubernetes-upstream that snyk-monitor container use to send metadata
  deployment.spec.template.spec.containers[0].env[2] = {
    name: 'SNYK_INTEGRATION_API',
    value: 'https://kubernetes-upstream.dev.snyk.io',
  };

  writeFileSync(newYamlPath, stringify(deployment));
  console.log('Created test deployment');
}

export async function removeMonitor(): Promise<void> {
  try {
    if (createCluster) {
      await platforms[testPlatform].delete();
    } else {
      await platforms[testPlatform].clean();
    }
  } catch (error) {
    console.log(`Could not remove the Kubernetes-Monitor: ${error.message}`);
  }
}

async function createEnvironment(): Promise<void> {
  // TODO: we probably want to use k8s-api for that, not kubectl
  await kubectl.createNamespace('services');
  // Small hack to prevent timing problems in CircleCI...
  // TODO: should be replaced by actively waiting for the namespace to be created
  await sleep(5000);
}

async function createSecretForGcrIoAccess(): Promise<void> {
  const gcrSecretName = 'gcr-io';
  const gcrKubectlSecretsKeyPrefix = '--';
  const gcrSecretType = 'docker-registry';
  const gcrToken = getEnvVariableOrDefault('GCR_IO_SERVICE_ACCOUNT', '{}');
  await kubectl.createSecret(
    gcrSecretName,
    'services',
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

async function installKubernetesMonitor(
  imageNameAndTag: string,
  imagePullPolicy: string,
  ): Promise<string> {
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
  createTestYamlDeployment(testYaml, integrationId, imageNameAndTag, imagePullPolicy);

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

    console.log(`platform chosen is ${testPlatform}, createCluster===${createCluster}`);

    await kubectl.downloadKubectl();
    if (createCluster) {
      await platforms[testPlatform].create();
      await platforms[testPlatform].config();
    } else {
      await platforms[testPlatform].config();
      await platforms[testPlatform].clean();
    }
    const remoteImageName = await platforms[testPlatform].loadImage(imageNameAndTag);
    await createEnvironment();
    await createSecretForGcrIoAccess();

    // TODO: hack, rewrite this
    const imagePullPolicy = testPlatform === 'kind' ? 'Never' : 'Always';

    const integrationId = await installKubernetesMonitor(remoteImageName, imagePullPolicy);
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
  }
}
