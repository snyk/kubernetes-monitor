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
  const overriddenOperatorSource = 'snyk-monitor-catalog-source.yaml';
  createTestOperatorSource(overriddenOperatorSource);

  await kubectl.applyK8sYaml(overriddenOperatorSource);
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');
  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await kubectl.waitForDeployment('snyk-operator', 'snyk-monitor');
  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource.yaml');
}

function createTestOperatorSource(newYamlPath: string): void {
  console.log('Creating YAML CatalogSource...');
  const operatorVersion =
    process.env.OPERATOR_VERSION ?? readFileSync('./.operator_version', 'utf8');
  const originalCatalogSourceYaml = readFileSync(
    './test/fixtures/operator/catalog-source.yaml',
    'utf8',
  );
  const catalogSource: { spec: { image: string } } = parse(
    originalCatalogSourceYaml,
  );

  catalogSource.spec.image = catalogSource.spec.image.replace(
    'TAG_OVERRIDE',
    operatorVersion,
  );

  writeFileSync(newYamlPath, stringify(catalogSource));
  console.log('Created YAML CatalogSource');
}
