import { IDeployer, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';

export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  _imageOptions: IImageOptions,
): Promise<void> {
  await kubectl.applyK8sYaml('./test/fixtures/operator/operator-source.yaml');
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');

  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await kubectl.waitForDeployment('snyk-operator', 'snyk-monitor');

  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource.yaml');
}
