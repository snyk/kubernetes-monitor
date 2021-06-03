import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

import * as kubectl from '../../helpers/kubectl';
import { IDeployer, IImageOptions } from './types';

export const yamlDeployer: IDeployer = {
  deploy: deployKubernetesMonitor,
};

async function deployKubernetesMonitor(
  imageOptions: IImageOptions,
): Promise<void> {
  const testYaml = 'snyk-monitor-test-deployment.yaml';
  createTestYamlDeployment(
    testYaml,
    imageOptions.nameAndTag,
    imageOptions.pullPolicy,
  );

  await kubectl.applyK8sYaml('./snyk-monitor-cluster-permissions.yaml');
  await kubectl.applyK8sYaml('./snyk-monitor-test-deployment.yaml');
}

function createTestYamlDeployment(
  newYamlPath: string,
  imageNameAndTag: string,
  imagePullPolicy: string,
): void {
  console.log('Creating YAML snyk-monitor deployment...');
  const originalDeploymentYaml = readFileSync(
    './snyk-monitor-deployment.yaml',
    'utf8',
  );
  const deployment = parse(originalDeploymentYaml);

  const container = deployment.spec.template.spec.containers.find(
    (container) => container.name === 'snyk-monitor',
  );
  container.image = imageNameAndTag;
  container.imagePullPolicy = imagePullPolicy;

  // Inject the baseUrl of kubernetes-upstream that snyk-monitor container use to send metadata
  const envVar = container.env.find(
    (env) => env.name === 'SNYK_INTEGRATION_API',
  );
  envVar.value = 'https://kubernetes-upstream.dev.snyk.io';
  delete envVar.valueFrom;

  writeFileSync(newYamlPath, stringify(deployment));
  console.log('Created YAML snyk-monitor deployment');
}
