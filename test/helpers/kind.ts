import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as needle from 'needle';

export async function downloadKind(osDistro: string): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'kind'), constants.R_OK);
  } catch (error) {
    console.log('Downloading KinD...');

    const bodyData = null;
    // eslint-disable-next-line @typescript-eslint/camelcase
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

export async function getKindConfigPath() {
  try {
    const parentDir = resolve(process.cwd());
    const kindPath = await exec('./kind get kubeconfig-path', {cwd: parentDir});
    return kindPath.stdout.replace(/[\n\t\r]/g, '');
  } catch (err) {
    throw new Error(`Couldn't execute proccess: ${err}`);
  }
}

// available tags may be viewed at https://hub.docker.com/r/kindest/node/tags
export async function createKindCluster(
  clusterName = 'kind',
  kindImageTag = 'latest',
): Promise<void> {
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

export async function deleteKindCluster(clusterName = 'kind'): Promise<void> {
  console.log(`Deleting cluster ${clusterName}...`);
  await exec(`./kind delete cluster --name=${clusterName}`);
  console.log(`Deleted cluster ${clusterName}!`);
}

export async function exportKubeConfig(clusterName = 'kind'): Promise<void> {
  console.log('Exporting K8s config...');
  const kindResponse = await exec(`./kind get kubeconfig-path --name="${clusterName}"`);
  const configPath = kindResponse.stdout.replace(/[\n\t\r]/g, '');
  process.env.KUBECONFIG = configPath;
  console.log('Exported K8s config!');
}

export async function loadImageInCluster(imageNameAndTag): Promise<void> {
  console.log(`Loading image ${imageNameAndTag} in cluster...`);
  await exec(`./kind load docker-image ${imageNameAndTag}`);
  console.log(`Loaded image ${imageNameAndTag}!`);
}
