import { createCluster as kindCreateCluster } from './kind';
import * as kubectl from '../../helpers/kubectl';
import * as sleep from 'sleep-promise';

export async function createCluster(version: string): Promise<void> {
  await kindCreateCluster(version);

  // OLM installation: https://github.com/operator-framework/community-operators/blob/master/docs/testing-operators.md#2-install-olm

  const operatorLifecycleManagerVersion = '0.15.1'; // https://github.com/operator-framework/operator-lifecycle-manager/releases/tag/0.15.1
  await kubectl.applyK8sYaml(`https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${operatorLifecycleManagerVersion}/crds.yaml`);
  await sleep(5000); // give enough time to k8s to apply the previous yaml
  await kubectl.applyK8sYaml(`https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${operatorLifecycleManagerVersion}/olm.yaml`);
  await kubectl.waitForDeployment('catalog-operator', 'olm');
  await kubectl.waitForDeployment('olm-operator', 'olm');
  // await kubectl.waitForDeployment('operatorhubio-catalog', 'olm');
  await kubectl.waitForDeployment('packageserver', 'olm');

  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/01_namespace.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/03_operatorsource.crd.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/04_service_account.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/05_role.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/06_role_binding.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/07_upstream_operatorsource.cr.yaml');
  await kubectl.applyK8sYaml('https://raw.githubusercontent.com/operator-framework/operator-marketplace/master/deploy/upstream/08_operator.yaml');
}

