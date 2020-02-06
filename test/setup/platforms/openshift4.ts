import { Writable } from 'stream';
import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform, tmpdir } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';
import * as kubectl from '../../helpers/kubectl';

export async function createCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  await installOpenShiftCli(normalizePlatform(platform()), version());
  const user = process.env['OPEN_SHIFT_4_USER'];
  const userPassword = process.env['OPEN_SHIFT_4_USER_PASSWORD'];
  const clusterURL = process.env['OPEN_SHIFT_4_CLUSTER_URL'];
  const cmd = `./oc login -u ${user} -p ${userPassword} ${clusterURL} --insecure-skip-tls-verify=true --kubeconfig ./kubeconfig`;

  await exec(cmd);
  process.env.KUBECONFIG = './kubeconfig';
}

export async function targetImageName(imageNameAndTag: string): Promise<string> {
  return imageNameAndTag;
}

export async function loadImageInCluster(targetImageName: string): Promise<void> {
  throw new Error(`Using DockerHub image ${targetImageName}`);
}

export async function clean(): Promise<void> {
  await Promise.all([
    kubectl.deleteNamespace('services'),
    kubectl.deleteNamespace('snyk-monitor'),
  ]);
}

export async function deploymentFileConfig(deployment): Promise<void> {
  delete deployment.spec.template.spec.containers[0].securityContext.runAsUser;
  delete deployment.spec.template.spec.containers[0].securityContext.runAsGroup;
}

async function installOpenShiftCli(osDistro: string, version: string): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'oc'), constants.R_OK);
  } catch (error) {
    const downloadUrl = constructCliDownloadUrl(osDistro, version);
    const body = null;

    console.log('Downloading OpenShift OC...');
    const response = await needle(
      'get',
      downloadUrl,
      body,
    );
    await extractOpenShiftClient(response.body);
    console.log('OpenShift OC downloaded and installed!');
  }
}

async function extractOpenShiftClient(fileStream: Writable): Promise<void> {
  const tmp = tmpdir();
  const osClientPath = `${tmp}/openshift-client`;
  const ocPath = `${tmp}/oc`;
  writeFileSync(osClientPath, fileStream);
  await exec(`tar -xzvf ${osClientPath} -C ${tmp}`);
  await exec(`cp ${ocPath} .`);
  chmodSync('oc', 0o755); // rwxr-xr-x
}

function constructCliDownloadUrl(platform: string, version: string): string {
  return `https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/openshift-client-${platform}-${version}.tar.gz`;
}

function version(): string {
  return '4.3.0';
}

function normalizePlatform(platform: string): string {
  if (platform === 'darwin') {
    platform = 'mac';
  }

  return platform;
}
