import * as kubectl from '../../helpers/kubectl';
import { execWrapper as exec } from '../../helpers/exec';
import { throwIfEnvironmentVariableUnset } from './helpers';

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

  const accountIdResult = await exec(
    'aws sts get-caller-identity --query Account --output text',
  );
  const accountId = accountIdResult.stdout.trim();
  const ecrURL = `${accountId}.dkr.ecr.${process.env.AWS_REGION}.amazonaws.com`;

  const ecrLogin = await exec(
    `aws ecr get-login-password | docker login --username AWS --password-stdin "${ecrURL}"`,
  );

  // validate output so we don't execute malicious stuff
  if (!ecrLogin.stdout.includes('Login Succeeded')) {
    throw new Error('aws ecr get-login-password returned an unexpected output');
  }

  const targetImage = `${ecrURL}/snyk/kubernetes-monitor-private-fork:local`;

  await exec(`docker tag ${imageNameAndTag} ${targetImage}`);
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
