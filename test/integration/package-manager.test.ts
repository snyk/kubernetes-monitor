import { deployMonitor, removeMonitor } from '../setup';
import * as tap from 'tap';
import { testPackageManagerWorkloads } from './fixture-reader';

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
    await testPackageManagerWorkloads(t, integrationId, packageManager);
  },
);
