import * as tap from 'tap';

import { unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { validateHomebaseStoredData } from '../helpers/homebase';
import kubectl = require('../helpers/kubectl');
import { deployMonitor, removeMonitor } from '../setup';
import * as fixtureReader from './fixture-reader';

let integrationId: string;

/**
 * This one is set in package.json as part of the package manager tests.
 */
const packageManager = process.env.PACKAGE_MANAGER;
if (!packageManager) {
  throw new Error('Missing PACKAGE_MANAGER environment variable');
}

async function tearDown() {
  console.log('Begin removing the snyk-monitor...');
  await removeMonitor();
  console.log('Removed the snyk-monitor!');
}

tap.tearDown(tearDown);

// Make sure this runs first -- deploying the monitor for the next tests
tap.test('deploy snyk-monitor', async (t) => {
  t.plan(1);

  integrationId = await deployMonitor();

  t.pass('successfully deployed the snyk-monitor');
});

tap.test(
  `static analysis package manager test with ${packageManager} package manager`,
  async (t) => {
    const workloads = fixtureReader.getWorkloadsToTest(packageManager);
    const namespace = 'services';
    const clusterName = 'Default cluster';

    const workloadKeys = Object.keys(workloads);
    t.plan(workloadKeys.length);

    // For every workload, create a promise that:
    // - creates a temporary deployment file for this workload (with the appropriate name and image)
    // - apply the deployment
    // - clean up the temporary file, then await for the monitor to detect the workload and report to Homebase
    const promisesToAwait = Object.keys(workloads).map((deploymentName) => {
      const imageName = workloads[deploymentName];

      const tmpYamlPath = resolve(tmpdir(), `${deploymentName}.yaml`);
      fixtureReader.createDeploymentFile(tmpYamlPath, deploymentName, imageName);

      return kubectl
        .applyK8sYaml(tmpYamlPath)
        .then(() => {
          unlinkSync(tmpYamlPath);
          return validateHomebaseStoredData(
            fixtureReader.validatorFactory(deploymentName),
            `api/v2/workloads/${integrationId}/${clusterName}/${namespace}`,
            // Wait for up to ~16 minutes for this workload.
            // We are starting a lot of them in parallel so they may take a while to scan.
            200,
          );
        })
        .then((homebaseResult) => {
          t.ok(homebaseResult, `Deployed ${deploymentName} successfully`);
        });
    });

    await Promise.all(promisesToAwait);
  },
);
