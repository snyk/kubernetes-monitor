import { platform } from 'os';
import { existsSync, chmodSync } from 'fs';

import { IDeployer, IDeployOptions, IImageOptions } from './types';
import { execWrapper as exec } from '../../helpers/exec';

const helmVersion = '3.0.0';
const helmPath = './helm';
const helmChartPath = './snyk-monitor';

export const helmDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  imageOptions: IImageOptions,
  deployOptions: IDeployOptions,
): Promise<void> {
  if (!existsSync(helmPath)) {
    await downloadHelm();
  }

  const imageNameAndTag = imageOptions.nameAndTag.split(':');
  const imageName = imageNameAndTag[0];
  const imageTag = imageNameAndTag[1];
  const imagePullPolicy = imageOptions.pullPolicy;

  await exec(
    `${helmPath} upgrade --install snyk-monitor ${helmChartPath} --namespace snyk-monitor ` +
      `--set image.repository=${imageName} ` +
      `--set image.tag=${imageTag} ` +
      `--set image.pullPolicy=${imagePullPolicy} ` +
      '--set integrationApi=https://api.dev.snyk.io/v2/kubernetes-upstream ' +
      `--set clusterName=${deployOptions.clusterName} ` +
      '--set nodeSelector."kubernetes\\.io/os"=linux ' +
      '--set pvc.enabled=true ' +
      '--set pvc.create=true ' +
      '--set log_level="INFO" ' +
      '--set rbac.serviceAccount.annotations."foo"="bar" ' +
      '--set volumes.projected.serviceAccountToken=true ' +
      '--set securityContext.fsGroup=65534 ' +
      '--set skopeo.compression.level=1 ' +
      '--set workers.count=5 ' +
      '--set sysdig.enabled=true ',
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
