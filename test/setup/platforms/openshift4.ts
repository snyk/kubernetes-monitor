import { exec } from 'child-process-promise';
import * as kubectl from '../../helpers/kubectl';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform, tmpdir } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';

export async function createCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  await installOpenShiftCli(normalizePlatform(platform()), version());
  const userPassword = process.env['OPEN_SHIFT_4_USER_PASSWORD'];
  const clusterURL = process.env['OPEN_SHIFT_4_CLUSTER_URL'];
  const cmd = `./oc login -u kubeadmin -p ${userPassword} ${clusterURL} --insecure-skip-tls-verify=true --kubeconfig ./kubeconfig`;

  await exec(cmd);
  process.env.KUBECONFIG = './kubeconfig';
}

export async function loadImageInCluster(imageNameAndTag: string): Promise<string> {
  return imageNameAndTag;
}

export async function clean(): Promise<void> {
  await exportKubeConfig();
  await Promise.all([
    kubectl.deleteNamespace('services'),
    kubectl.deleteNamespace('snyk-monitor'),
  ]);
}

async function installOpenShiftCli(osDistro: string, version: string): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'oc'), constants.R_OK);
  } catch (error) {
    console.log('Downloading OpenShift OC...');

    const ocpURL = constructCliDownloadUrl(osDistro, version);
    const bodyData = null;
    // eslint-disable-next-line @typescript-eslint/camelcase
    const requestOptions = { follow_max: 2 };
    await needle('get',
      ocpURL,
      bodyData,
      requestOptions,
    ).then( async (response) => {
      writeFileSync(`${tmpdir()}/openshift-client`, response.body);
      await exec(`tar -xzvf ${tmpdir()}/openshift-client -C ${tmpdir()}`);
      await exec(`cp ${tmpdir()}/oc .`);
      chmodSync('oc', 0o755); // rwxr-xr-x
    });

    console.log('OpenShift OC downloaded and installed!');
  }
}

function constructCliDownloadUrl(platform: string, version: string): string {
  return `https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/openshift-client-${platform}-${version}.tar.gz`;
}

function version(): string {
  return "4.3.0";
}

function normalizePlatform(platform: string): string {
  if (platform === "darwin") platform = "mac";

  return platform;
}