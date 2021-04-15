import * as sleep from 'sleep-promise';
import { parse, stringify } from 'yaml';
import { readFileSync, writeFileSync } from 'fs';

import { IDeployer, IImageOptions } from './types';
import * as kubectl from '../../helpers/kubectl';

// The event we want to find is:
// Pulling image "docker.io/snyk/kubernetes-operator:{tag}"
const PULL_KUBERNETES_OPERATOR_EVENT = 'Pulling image "docker.io/snyk/kubernetes-operator:';
export const operatorDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function seekEvent(event: string, namespace: string): Promise<boolean> {
  const events = await kubectl.getEvents(namespace);
  const foundEvent = events.indexOf(event) > -1;

  return foundEvent;
}

async function waitToDeployKubernetesOperator(namespace: string): Promise<void> {
  console.log(`Trying to find kubernetes-operator image to be pulled in namespace ${namespace}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    await kubectl.deleteDeployment('snyk-operator', namespace);
    await sleep(5000); // give enough time to k8s to apply the previous yaml

    const found = await seekEvent(PULL_KUBERNETES_OPERATOR_EVENT, namespace);
    if (found) {
      break;
    }
  }
}

async function deployKubernetesMonitor(
  _imageOptions: IImageOptions,
): Promise<void> {
  const overriddenOperatorSource = 'snyk-monitor-catalog-source.yaml';
  createTestOperatorSource(overriddenOperatorSource);
  await kubectl.applyK8sYaml(overriddenOperatorSource);
  await kubectl.applyK8sYaml('./test/fixtures/operator/installation-k8s.yaml');

  // Await for the Operator to become available, only then
  // the Operator can start processing the custom resource.
  await kubectl.waitForDeployment('snyk-operator', 'marketplace');
  await kubectl.waitForCRD('snykmonitors.charts.helm.k8s.io');
  await kubectl.applyK8sYaml('./test/fixtures/operator/custom-resource-k8s.yaml');
  await waitToDeployKubernetesOperator('marketplace');
  await kubectl.waitForDeployment('snyk-operator', 'marketplace');
}

function createTestOperatorSource(newYamlPath: string): void {
  console.log('Creating YAML CatalogSource...');
  const operatorVersion =
    process.env.OPERATOR_VERSION ?? readFileSync('./.operator_version', 'utf8');
  const originalCatalogSourceYaml = readFileSync(
    './test/fixtures/operator/catalog-source-k8s.yaml',
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
