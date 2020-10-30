import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';
import { IDeployer, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';

export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  _imageOptions: IImageOptions,
): Promise<void> {
  const overriddenOperatorSource = 'snyk-monitor-operator-source.yaml';
  createTestOperatorSource(
    overriddenOperatorSource,
    process.env['QUAY_USERNAME']!,
  );

  await kubectl.applyK8sYaml(overriddenOperatorSource);
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');
  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await kubectl.waitForDeployment('snyk-operator', 'snyk-monitor');
  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource.yaml');
}

function createTestOperatorSource(newYamlPath: string, username: string): void {
  console.log('Creating YAML OperatorSource...');
  const originalDeploymentYaml = readFileSync(
    './test/fixtures/operator/operator-source.yaml',
    'utf8',
  );
  const deployment = parse(originalDeploymentYaml);

  deployment.spec.registryNamespace = username;

  writeFileSync(newYamlPath, stringify(deployment));
  console.log('Created YAML OperatorSource');
}
