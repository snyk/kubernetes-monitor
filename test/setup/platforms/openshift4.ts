import { Writable } from 'stream';
import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform, tmpdir } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';

import * as kubectl from '../../helpers/kubectl';

const OPENSHIFT_CLI_VERSION = '4.3.0';

export async function setupTester(): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'oc'), constants.R_OK);
  } catch (error) {
    const nodeJsPlatform = platform();
    const downloadUrl = getDownloadUrlForOpenShiftCli(nodeJsPlatform, OPENSHIFT_CLI_VERSION);
    console.log('Downloading OpenShift CLI...');
    const response = await needle('get', downloadUrl);
    await extractOpenShiftCli(response.body);
    console.log('OpenShift CLI downloaded and installed!');
  }
}

export async function returnUnchangedImageNameAndTag(imageNameAndTag: string): Promise<string> {
  // For OpenShift, the image name requires no pre-processing or loading into a cluster, hence we don't modify it.
  return imageNameAndTag;
}

export async function createCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  const user = process.env['OPENSHIFT4_USER'];
  const userPassword = process.env['OPENSHIFT4_PASSWORD'];
  const clusterURL = process.env['OPENSHIFT4_CLUSTER_URL'];
  const tmp = tmpdir();
  const kubeconfigPath = `${tmp}/kubeconfig`;
  const cmd = `./oc login -u "${user}" -p "${userPassword}" "${clusterURL}" --insecure-skip-tls-verify=true --kubeconfig ${kubeconfigPath}`;
  await exec(cmd);
  process.env.KUBECONFIG = kubeconfigPath;
}

export async function clean(): Promise<void> {
  await Promise.all([
    kubectl.deleteNamespace('services'),
    kubectl.deleteNamespace('snyk-monitor'),
  ]);
}

async function extractOpenShiftCli(fileStream: Writable): Promise<void> {
  const tmp = tmpdir();
  const osClientPath = `${tmp}/openshift-cli`;
  writeFileSync(osClientPath, fileStream);
  await exec(`tar -xzvf ${osClientPath} -C ${tmp}`);
  await exec(`mv ${tmp}/oc .`);
  chmodSync('oc', 0o755); // rwxr-xr-x
}

function getDownloadUrlForOpenShiftCli(nodeJsPlatform: string, cliVersion: string): string {
  const normalisedPlatform = nodeJsPlatform === 'darwin' ? 'mac' : nodeJsPlatform;
  return `https://mirror.openshift.com/pub/openshift-v4/clients/ocp/${cliVersion}/openshift-client-${normalisedPlatform}-${cliVersion}.tar.gz`;
}
