import { IWorkloadLocator } from '../../src/transmitter/types';
import { WorkloadKind } from '../../src/kube-scanner/types';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function getFixturePath(fixturePath: string): string {
  return join(__dirname, '../fixtures/package-manager', fixturePath);
}

export function getWorkloadsToTest(packageManager: string): Record<string, string> {
  return require(getFixturePath(`${packageManager}/images.json`));
}

const deploymentTemplate = readFileSync(
  getFixturePath('template.yaml'),
  'utf8',
);

export function createDeploymentFile(
  path: string,
  deploymentName: string,
  imageName: string,
): void {
  const templated = deploymentTemplate
    .replace(new RegExp('DEPLOYMENT_NAME', 'g'), deploymentName)
    .replace(new RegExp('IMAGE_NAME', 'g'), imageName);

  writeFileSync(path, templated);
}

export function validatorFactory(workloadName: string) {
  return function _validator(workloads: IWorkloadLocator[] | undefined) {
    return (
      workloads !== undefined &&
      workloads.find(
        (workload) =>
          workload.name === workloadName &&
          workload.type === WorkloadKind.Deployment,
      ) !== undefined
    );
  };
}
