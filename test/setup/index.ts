import * as fs from 'fs';
import * as sleep from 'sleep-promise';
import * as uuidv4 from 'uuid/v4';
import { exec } from 'child-process-promise';

import platforms, { getKubernetesVersionForPlatform } from './platforms';
import deployers from './deployers';
import { IImageOptions } from './deployers/types';
import * as kubectl from '../helpers/kubectl';

const testPlatform = process.env['TEST_PLATFORM'] || 'kind';
const createCluster = process.env['CREATE_CLUSTER'] === 'true';
const deploymentType = process.env['DEPLOYMENT_TYPE'] || 'YAML';

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

export async function removeMonitor(): Promise<void> {
  await dumpLogs();
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

export async function removeLocalContainerRegistry(): Promise<void> {
  try {
    await exec('docker rm kind-registry --force');
  } catch (error) {
    console.log(`Could not remove container registry, it probably did not exist: ${error.message}`);
  }
}

export async function removeUnusedKindNetwork(): Promise<void> {
  try {
    await exec('docker network rm kind');
  } catch (error) {
    console.log(`Could not remove "kind" network: ${error.message}`);
  }
}

async function createEnvironment(): Promise<void> {
  // TODO: we probably want to use k8s-api for that, not kubectl
  await kubectl.createNamespace('services');
  // Small hack to prevent timing problems in CircleCI...
  // TODO: should be replaced by actively waiting for the namespace to be created
  await sleep(5000);
}

async function predeploy(integrationId: string): Promise<void> {
  try {
    const namespace = 'snyk-monitor';
    await kubectl.createNamespace(namespace);

    const secretName = 'snyk-monitor';
    const gcrDockercfg = process.env['GCR_IO_DOCKERCFG'] || '{}';
    await kubectl.createSecret(secretName, namespace, {
      'dockercfg.json': gcrDockercfg,
      integrationId,
    });
    await createRegistriesConfigMap();
  } catch (error) {
    console.log('Could not create namespace and secret, they probably already exist');
  }
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

async function createRegistriesConfigMap(): Promise<void> {
  await kubectl.createConfigMap('snyk-monitor-registries-conf', 'snyk-monitor', './test/fixtures/insecure-registries/registries.conf');
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

    const kubernetesVersion = getKubernetesVersionForPlatform(testPlatform);
    await kubectl.downloadKubectl(kubernetesVersion);

    await platforms[testPlatform].setupTester();
    if (createCluster) {
      await platforms[testPlatform].create(kubernetesVersion);
      await platforms[testPlatform].config();
    } else {
      await platforms[testPlatform].config();
      await platforms[testPlatform].clean();
    }
    const remoteImageName = await platforms[testPlatform].loadImage(imageNameAndTag);
    await createEnvironment();
    await createSecretForGcrIoAccess();

    const integrationId = getIntegrationId();
    await predeploy(integrationId);

    // TODO: hack, rewrite this
    const imagePullPolicy = testPlatform === 'kind' || testPlatform === 'kindolm' || testPlatform === 'openshift3' ? 'Never' : 'Always';
    const deploymentImageOptions: IImageOptions = {
      nameAndTag: remoteImageName,
      pullPolicy: imagePullPolicy,
    };
    await deployers[deploymentType].deploy(deploymentImageOptions);
    await kubectl.waitForDeployment('snyk-monitor', 'snyk-monitor');
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

async function dumpLogs(): Promise<void> {
  const logDir = `/tmp/logs/test/integration/${testPlatform}`;
  if (!(fs.existsSync(logDir))) {
    console.log('not dumping logs because', logDir, 'does not exist');
    return;
  }
  const podNames = await kubectl.getPodNames('snyk-monitor');
  const logs = await kubectl.getPodLogs(podNames[0], 'snyk-monitor');
  const logPath = `${logDir}/kubernetes-monitor.log`;
  console.log('dumping logs to', logPath);
  fs.writeFileSync(logPath, logs);
}
