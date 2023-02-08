import sleep from 'sleep-promise';
import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';
import { IDeployer, IDeployOptions, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';
import { execWrapper as exec } from '../../helpers/exec';

export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  _imageOptions: IImageOptions,
  deployOptions: IDeployOptions,
): Promise<void> {
  const overriddenOperatorSource = 'snyk-monitor-catalog-source.yaml';
  createTestOperatorSource(overriddenOperatorSource);

  await kubectl.applyK8sYaml(overriddenOperatorSource);
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation.yaml');
  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await deploymentIsReady('snyk-operator', 'snyk-monitor');

  const overriddenCustomResource = 'snyk-monitor-custom-resource.yaml';
  createTestCustomResource(overriddenCustomResource, deployOptions.clusterName);
  await kubectl.applyK8sYaml(overriddenCustomResource);
}

async function deploymentIsReady(
  name: string,
  namespace: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 180; attempt++) {
    try {
      await exec(`./kubectl get deployment.apps/${name} -n ${namespace}`);
      // Give the deployment enough time to settle and apply the CRD
      await sleep(60_000);
      return true;
    } catch (error) {
      await sleep(1000);
    }
  }
  return false;
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

function createTestCustomResource(
  newYamlPath: string,
  clusterName: string,
): void {
  console.log('Creating YAML CustomResource...');
  const originalCustomResourceYaml = readFileSync(
    './test/fixtures/operator/custom-resource.yaml',
    'utf8',
  );
  const customResource: { spec: { clusterName: string } } = parse(
    originalCustomResourceYaml,
  );

  customResource.spec.clusterName = clusterName;

  writeFileSync(newYamlPath, stringify(customResource));
  console.log('Created YAML CustomResource');
}
