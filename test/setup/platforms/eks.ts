import { throwIfEnvironmentVariableUnset } from './helpers';
import * as kubectl from '../../helpers/kubectl';
import { execWrapper as exec } from '../../helpers/exec';

export async function validateRequiredEnvironment(): Promise<void> {
  console.log(
    'Checking for the required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION',
  );
  throwIfEnvironmentVariableUnset('AWS_ACCESS_KEY_ID');
  throwIfEnvironmentVariableUnset('AWS_SECRET_ACCESS_KEY');
  throwIfEnvironmentVariableUnset('AWS_REGION');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_USERNAME');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_PASSWORD');
}

export async function setupTester(): Promise<void> {
  // update the `aws` CLI, the one in CircleCI's default image is outdated and doens't support eks
  await exec('pip install awscli --ignore-installed six');

  // TODO: assert all the vars are present before starting the setup?
  // TODO: wipe out the data during teardown?
  await exec(
    `aws configure set aws_access_key_id ${process.env['AWS_ACCESS_KEY_ID']}`,
  );
  await exec(
    `aws configure set aws_secret_access_key ${process.env['AWS_SECRET_ACCESS_KEY']}`,
  );
  await exec(`aws configure set region ${process.env['AWS_REGION']}`);
}

export async function createCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  await exec(
    'aws eks update-kubeconfig --name runtime-integration-test --kubeconfig ./kubeconfig',
  );
  process.env.KUBECONFIG = './kubeconfig';
}

export async function loadImageInCluster(
  imageNameAndTag: string,
): Promise<string> {
  console.log(`Loading image ${imageNameAndTag} in ECR...`);

  const ecrLogin = await exec(
    'aws ecr get-login --region us-east-2 --no-include-email',
  );

  // aws ecr get-login returns something that looks like:
  // docker login -U AWS -p <secret> https://the-address-of-ecr-we-should-use.com
  // `docker tag` wants just the last part without https://
  // `docker login` wants everything

  // validate output so we don't execute malicious stuff
  if (ecrLogin.stdout.indexOf('docker login -u AWS -p') !== 0) {
    throw new Error('aws ecr get-login returned an unexpected output');
  }

  const targetImage = targetImageFromLoginDetails(ecrLogin.stdout);

  await exec(`docker tag ${imageNameAndTag} ${targetImage}`);
  await exec(ecrLogin.stdout);
  await exec(`docker push ${targetImage}`);

  console.log(`Loaded image ${targetImage} in ECR`);
  return targetImage;
}

export async function clean(): Promise<void> {
  await Promise.all([
    kubectl.deleteNamespace('services'),
    kubectl.deleteNamespace('snyk-monitor'),
  ]);
}

function targetImageFromLoginDetails(ecrLoginOutput: string): string {
  const split = ecrLoginOutput.split(' ');
  const targetImagePrefix = split[split.length - 1]
    .replace('https://', '')
    .trim();
  return `${targetImagePrefix}/snyk/kubernetes-monitor:local`;
}
