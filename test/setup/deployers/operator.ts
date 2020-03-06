import { IDeployer } from './types';
import * as kubectl from '../../helpers/kubectl';

export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  integrationId: string,
  _imageOpts: {
    imageNameAndTag: string;
    imagePullPolicy: string;
  },
): Promise<void> {
  const namespace = 'snyk-monitor';
  await kubectl.createNamespace(namespace);

  const secretName = 'snyk-monitor';
  const gcrDockercfg = process.env['GCR_IO_DOCKERCFG'] || '{}';
  await kubectl.createSecret(secretName, namespace, {
    'dockercfg.json': gcrDockercfg,
    integrationId,
  });

  await kubectl.applyK8sYaml('./test/fixtures/operator/operator-source.yaml');
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');

  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await kubectl.waitForDeployment('snyk-operator', 'snyk-monitor');

  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource.yaml');
}
