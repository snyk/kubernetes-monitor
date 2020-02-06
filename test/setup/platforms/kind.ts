import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';

const clusterName = 'kind';

export async function createCluster(): Promise<void> {
  const osDistro = platform();
  await download(osDistro);
  await createKindCluster(clusterName);
}

export async function deleteCluster(): Promise<void> {
  console.log(`Deleting cluster ${clusterName}...`);
  await exec(`./kind delete cluster --name=${clusterName}`);
  console.log(`Deleted cluster ${clusterName}!`);
}

export async function exportKubeConfig(): Promise<void> {
  console.log('Exporting K8s config...');
  const kubeconfigResult = await exec('./kind get kubeconfig');
  const kubeconfigContent = kubeconfigResult.stdout;
  const configPath = './kubeconfig-integration-test-kind';
  writeFileSync(configPath, kubeconfigContent);
  process.env.KUBECONFIG = configPath;
  console.log('Exported K8s config!');
}

export async function targetImageName(imageNameAndTag: string): Promise<string> {
  return imageNameAndTag;
}

export async function loadImageInCluster(targetImageName: string): Promise<void> {
  console.log(`Loading image ${targetImageName} in KinD cluster...`);
  await exec(`./kind load docker-image ${targetImageName}`);
  console.log(`Loaded image ${targetImageName}`);
}

export async function clean(): Promise<void> {
  // just delete the cluster instead
  throw new Error('Not implemented');
}

export async function deploymentFileConfig(): Promise<void> {
  // no special configuration is needed
  throw new Error('Not implemented');
}

async function download(osDistro: string): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'kind'), constants.R_OK);
  } catch (error) {
    console.log('Downloading KinD...');

    const bodyData = null;
    // eslint-disable-next-line @typescript-eslint/camelcase
    const requestOptions = { follow_max: 2 };
    await needle('get',
      `https://github.com/kubernetes-sigs/kind/releases/download/v0.6.1/kind-${osDistro}-amd64`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kind', response.body);
      chmodSync('kind', 0o755); // rwxr-xr-x
    });

    console.log('KinD downloaded!');
  }
}

// available tags may be viewed at https://hub.docker.com/r/kindest/node/tags
async function createKindCluster(clusterName, kindImageTag = 'latest'): Promise<void> {
  console.log(`Creating cluster "${clusterName}" with Kind image tag ${kindImageTag}...`);

  let kindImageArgument = '';
  if (kindImageTag !== 'latest') {
    // not specifying the "--image" argument tells Kind to pick the latest image
    // which does not necessarily have the "latest" tag
    kindImageArgument = `--image="kindest/node:${kindImageTag}"`;
  }
  await exec(`./kind create cluster --name="${clusterName}" ${kindImageArgument}`);
  console.log(`Created cluster ${clusterName}!`);
}
