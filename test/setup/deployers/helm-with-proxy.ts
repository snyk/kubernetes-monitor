import { platform } from 'os';
import { existsSync, chmodSync } from 'fs';

import { IDeployer, IDeployOptions, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';
import { execWrapper as exec } from '../../helpers/exec';

const helmVersion = '3.0.0';
const helmPath = './helm';
const helmChartPath = './snyk-monitor';

export const helmWithProxyDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  imageOptions: IImageOptions,
  deployOptions: IDeployOptions,
): Promise<void> {
  if (!existsSync(helmPath)) {
    await downloadHelm();
  }

  await kubectl.applyK8sYaml('test/fixtures/proxying/tinyproxy-service.yaml');
  await kubectl.applyK8sYaml(
    'test/fixtures/proxying/tinyproxy-deployment.yaml',
  );
  await kubectl.waitForDeployment('forwarding-proxy', 'snyk-monitor');

  const imageNameAndTag = imageOptions.nameAndTag.split(':');
  const imageName = imageNameAndTag[0];
  const imageTag = imageNameAndTag[1];
  const imagePullPolicy = imageOptions.pullPolicy;

  await exec(
    `${helmPath} upgrade --install snyk-monitor ${helmChartPath} --namespace snyk-monitor ` +
      `--set image.repository=${imageName} ` +
      `--set image.tag=${imageTag} ` +
      `--set image.pullPolicy=${imagePullPolicy} ` +
      '--set integrationApi=https://kubernetes-upstream.dev.snyk.io ' +
      `--set clusterName=${deployOptions.clusterName} ` +
      '--set https_proxy=http://forwarding-proxy:8080',
  );
  console.log(
    `Deployed ${imageOptions.nameAndTag} with pull policy ${imageOptions.pullPolicy}`,
  );
}

async function downloadHelm(): Promise<void> {
  console.log(`Downloading Helm ${helmVersion}...`);
  const os = platform();
  await exec(
    `curl https://get.helm.sh/helm-v${helmVersion}-${os}-amd64.tar.gz | tar xfzO - ${os}-amd64/helm > ${helmPath}`,
  );
  chmodSync(helmPath, 0o755); // rwxr-xr-x
  console.log('Downloaded Helm');
}
