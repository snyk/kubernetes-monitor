import * as tap from 'tap';
import { IWorkloadLocator } from '../../src/transmitter/types';
import { WorkloadKind } from '../../src/kube-scanner/types';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { validateHomebaseStoredData } from '../helpers/homebase';
import kubectl = require('../helpers/kubectl');

function getFixturePath(fixturePath: string): string {
  return join(__dirname, '../fixtures/package-manager', fixturePath);
}

function getWorkloadsToTest(packageManager: string): Record<string, string> {
  return require(getFixturePath(`${packageManager}/images.json`));
}

const deploymentTemplate = readFileSync(
  getFixturePath('template.yaml'),
  'utf8',
);

function createDeploymentFile(
  path: string,
  deploymentName: string,
  imageName: string,
): void {
  const templated = deploymentTemplate
    .replace(new RegExp('DEPLOYMENT_NAME', 'g'), deploymentName)
    .replace(new RegExp('IMAGE_NAME', 'g'), imageName);

  writeFileSync(path, templated);
}

function validatorFactory(workloadName: string) {
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

export async function testPackageManagerWorkloads(
  test: tap,
  integrationId: string,
  packageManager: string,
): Promise<void> {
  const workloads = getWorkloadsToTest(packageManager);
  const namespace = 'services';
  const clusterName = 'Default cluster';

  const workloadKeys = Object.keys(workloads);
  test.plan(workloadKeys.length);

  // For every workload, create a promise that:
  // - creates a temporary deployment file for this workload (with the appropriate name and image)
  // - apply the deployment
  // - clean up the temporary file, then await for the monitor to detect the workload and report to Homebase
  const promisesToAwait = Object.keys(workloads).map((deploymentName) => {
    const imageName = workloads[deploymentName];

    const tmpYamlPath = resolve(tmpdir(), `${deploymentName}.yaml`);
    createDeploymentFile(tmpYamlPath, deploymentName, imageName);

    return kubectl
      .applyK8sYaml(tmpYamlPath)
      .then(() => {
        unlinkSync(tmpYamlPath);
        return validateHomebaseStoredData(
          validatorFactory(deploymentName),
          `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
          // Wait for up to ~16 minutes for this workload.
          // We are starting a lot of them in parallel so they may take a while to scan.
          200,
        );
      })
      .then((homebaseResult) => {
        test.ok(homebaseResult, `Deployed ${deploymentName} successfully`);
      });
  });

  await Promise.all(promisesToAwait);
}
