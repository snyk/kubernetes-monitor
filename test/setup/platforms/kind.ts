import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import { execWrapper as exec } from '../../helpers/exec';
import { throwIfEnvironmentVariableUnset } from './helpers';

const clusterName = 'kind';

export async function setupTester(): Promise<void> {
  const osDistro = platform();
  // v0.11.1 (2021) ships kindest/node:v1.21.1, whose kubelet ExecStartPre script
  // refuses to run on a cgroup v2 host whose root cgroup has processes in it:
  //   ERROR: this script needs /sys/fs/cgroup/cgroup.procs to be empty
  //   (for writing the top-level cgroup.subtree_control)
  // The kubelet then never starts, kubeadm times out waiting for the control plane,
  // and cluster creation fails. CI runs cgroup v2, so this is no longer viable.
  await download(osDistro, 'v0.32.0');
}

export async function createCluster(version: string): Promise<void> {
  // available tags may be viewed at https://hub.docker.com/r/kindest/node/tags
  const kindImageTag = version;
  console.log(
    `Creating cluster "${clusterName}" with Kind image tag ${kindImageTag}...`,
  );

  let kindImageArgument = '';
  if (kindImageTag !== 'latest') {
    // not specifying the "--image" argument tells Kind to pick the latest image
    // which does not necessarily have the "latest" tag
    kindImageArgument = `--image="kindest/node:${kindImageTag}"`;
  }
  const clusterConfigPath = 'test/setup/platforms/cluster-config.yaml';

  try {
    // --retain keeps the node containers when creation fails. Without it KinD tears
    // them down itself, so any attempt to read logs afterwards gets
    // `unknown cluster "kind"` and an empty journal. tearDown deletes the cluster
    // either way, so this only changes what survives long enough to be read.
    await exec(
      `./kind create cluster --name="${clusterName}" --retain ${kindImageArgument} --config="${clusterConfigPath}"`,
    );
  } catch (err: any) {
    // The cluster is deleted in afterAll, which destroys the kubelet and container
    // logs that explain *why* it failed. kubeadm only prints a generic hint, so
    // capture the node's logs here, at the failure point, before anything cleans up.
    console.log('Cluster creation failed, exporting KinD logs...');
    try {
      await exec(`./kind export logs /tmp/kind-logs --name="${clusterName}"`);
      console.log('Exported KinD logs to /tmp/kind-logs');
    } catch (exportErr: any) {
      console.log('Could not export KinD logs', exportErr.message);
    }
    // Surface the node's state inline too, so it lands in the CI log even if the
    // artifacts are not collected. journalctl alone came back empty on the first
    // attempt, so probe several sources: the unit's status and exit code, the
    // journal, what the container runtime saw, and the static pod logs.
    const node = `${clusterName}-control-plane`;
    const probes: Array<[string, string]> = [
      ['containers', 'docker ps -a'],
      [
        'kubelet unit status',
        `docker exec ${node} systemctl status kubelet --no-pager -l`,
      ],
      [
        'kubelet journal',
        `docker exec ${node} journalctl -u kubelet --no-pager | tail -n 200`,
      ],
      [
        'all journal errors',
        `docker exec ${node} journalctl -p err --no-pager | tail -n 100`,
      ],
      ['node container logs', `docker logs ${node} 2>&1 | tail -n 100`],
      [
        'containerd containers',
        `docker exec ${node} crictl ps -a 2>&1 | head -n 40`,
      ],
    ];
    for (const [label, command] of probes) {
      try {
        const result = await exec(command);
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
        console.log(`=== ${label} ===\n${output || '(no output)'}`);
      } catch (probeErr: any) {
        console.log(`=== ${label} === failed: ${probeErr.message}`);
      }
    }
    throw err;
  }
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

export async function loadImageInCluster(
  imageNameAndTag: string,
): Promise<string> {
  console.log(`Loading image ${imageNameAndTag} in KinD cluster...`);
  await exec(`./kind load docker-image ${imageNameAndTag}`);
  console.log(`Loaded image ${imageNameAndTag}`);
  return imageNameAndTag;
}

export async function clean(): Promise<void> {
  // just delete the cluster instead
  throw new Error('Not implemented');
}

export async function download(
  osDistro: string,
  kindVersion: string,
): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'kind'), constants.R_OK);
  } catch (error) {
    console.log(`Downloading KinD ${kindVersion}...`);

    const url = `https://github.com/kubernetes-sigs/kind/releases/download/${kindVersion}/kind-${osDistro}-amd64`;
    await exec(`curl -Lo ./kind ${url}`);
    chmodSync('kind', 0o755); // rwxr-xr-x

    console.log('KinD downloaded!');
  }
}

export async function validateRequiredEnvironment(): Promise<void> {
  console.log(
    'Checking for the required environment variables: DOCKER_HUB_RO_USERNAME, DOCKER_HUB_RO_PASSWORD',
  );
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_USERNAME');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_PASSWORD');
}
