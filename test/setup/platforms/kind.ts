import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';

const clusterName = 'kind';

export async function setupTester(): Promise<void> {
  const osDistro = platform();
  await download(osDistro);
}

export async function createCluster(): Promise<void> {
  // available tags may be viewed at https://hub.docker.com/r/kindest/node/tags
  const kindImageTag = 'latest';
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

export async function loadImageInCluster(imageNameAndTag: string): Promise<string> {
  console.log(`Loading image ${imageNameAndTag} in KinD cluster...`);
  await exec(`./kind load docker-image ${imageNameAndTag}`);
  console.log(`Loaded image ${imageNameAndTag}`);
  return imageNameAndTag;
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
      `https://github.com/kubernetes-sigs/kind/releases/download/v0.7.0/kind-${osDistro}-amd64`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kind', response.body);
      chmodSync('kind', 0o755); // rwxr-xr-x
    });

    console.log('KinD downloaded!');
  }
}
