import { IDeployer, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';

export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  _imageOptions: IImageOptions,
): Promise<void> {
  const namespaces = await kubectl.getNamespaces();
  if (namespaces.includes('openshift-marketplace')) {
    await kubectl.applyK8sYaml('./test/fixtures/operator/operator-source.yaml');
    await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');
    // Await for the Operator to become available, only then
    // the Operator can start processing the custom resource.
    await kubectl.waitForDeployment('snyk-operator', 'openshift-marketplace');
  } else {
    await kubectl.applyK8sYaml('./test/fixtures/operator/operator-source-k8s.yaml');
    await kubectl.applyK8sYaml('./test/fixtures/operator/installation-k8s.yaml');
    // Await for the Operator to become available, only then
    // the Operator can start processing the custom resource.
    await kubectl.waitForDeployment('snyk-operator', 'marketplace');
    await kubectl.waitForCRD('snykmonitors.charts.helm.k8s.io');
  }

  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource.yaml');
}
