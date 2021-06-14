import { throwIfEnvironmentVariableUnset } from './helpers';
import * as kubectl from '../../helpers/kubectl';
import { execWrapper as exec } from '../../helpers/exec';

export async function validateRequiredEnvironment(): Promise<void> {
  console.log(
    'Checking for the required environment variables: AZ_SP_APP_ID, AZ_SP_TENANT, AZ_SP_PASSWORD, AZ_ACR_REGISTRY, AZ_SUBSCRIPTION, AZ_RESOURCE_NAME, AZ_RESOURCE_GROUP',
  );
  throwIfEnvironmentVariableUnset('AZ_SP_APP_ID');
  throwIfEnvironmentVariableUnset('AZ_SP_TENANT');
  throwIfEnvironmentVariableUnset('AZ_SP_PASSWORD');
  throwIfEnvironmentVariableUnset('AZ_ACR_REGISTRY');
  throwIfEnvironmentVariableUnset('AZ_SUBSCRIPTION');
  throwIfEnvironmentVariableUnset('AZ_RESOURCE_NAME');
  throwIfEnvironmentVariableUnset('AZ_RESOURCE_GROUP');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_USERNAME');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_PASSWORD');
}

export async function setupTester(): Promise<void> {
  const {
    AZ_SP_APP_ID,
    AZ_SP_PASSWORD,
    AZ_SP_TENANT,
    AZ_RESOURCE_GROUP,
    AZ_RESOURCE_NAME,
    AZ_SUBSCRIPTION,
  } = process.env;
  await exec(
    `az login --service-principal --username ${AZ_SP_APP_ID} --password ${AZ_SP_PASSWORD} --tenant ${AZ_SP_TENANT}`,
  );

  await exec(`az account set --subscription ${AZ_SUBSCRIPTION}`);
  await exec(
    `az aks get-credentials --resource-group ${AZ_RESOURCE_GROUP} --name ${AZ_RESOURCE_NAME}`,
  );
}

export async function createCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  const { HOME } = process.env;
  process.env.KUBECONFIG = `${HOME}/.kube/config`;
}

export async function loadImageInCluster(
  imageNameAndTag: string,
): Promise<string> {
  const { AZ_ACR_REGISTRY } = process.env;
  console.log(`Loading image ${imageNameAndTag} in ACR...`);

  await exec(`az acr login --name ${AZ_ACR_REGISTRY}`);

  const targetImage = `${AZ_ACR_REGISTRY}.azurecr.io/${imageNameAndTag}`;

  await exec(`docker tag ${imageNameAndTag} ${targetImage}`);
  await exec(`docker push ${targetImage}`);

  console.log(`Loaded image in ACR`);
  return targetImage;
}

export async function clean(): Promise<void> {
  await Promise.all([
    kubectl.deleteNamespace('services'),
    kubectl.deleteNamespace('snyk-monitor'),
  ]);
}
