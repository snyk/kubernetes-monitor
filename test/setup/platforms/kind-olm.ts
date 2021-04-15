import * as sleep from 'sleep-promise';

import { createCluster as kindCreateCluster } from './kind';
import * as kubectl from '../../helpers/kubectl';
import { throwIfEnvironmentVariableUnset } from './helpers';

export async function createCluster(version: string): Promise<void> {
  await kindCreateCluster(version);

  // OLM installation: https://github.com/operator-framework/operator-lifecycle-manager/blob/master/doc/install/install.md#installing-olm
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-lifecycle-manager/master/deploy/upstream/quickstart/crds.yaml');
  await sleep(5000); // give enough time to k8s to apply the previous yaml
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-lifecycle-manager/master/deploy/upstream/quickstart/olm.yaml');
  await kubectl.waitForDeployment('catalog-operator', 'olm');
  await kubectl.waitForDeployment('olm-operator', 'olm');
  await kubectl.waitForDeployment('packageserver', 'olm');
}

export async function validateRequiredEnvironment(): Promise<void> {
  console.log(
    'Checking for the required environment variables: DOCKER_HUB_RO_USERNAME, DOCKER_HUB_RO_PASSWORD',
  );
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_USERNAME');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_PASSWORD');
}
