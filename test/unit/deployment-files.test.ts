import * as tap from 'tap';
import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { V1Deployment } from '@kubernetes/client-node';
import { config } from '../../src/common/config';
import {
  validateSecureConfiguration,
  validateVolumeMounts,
  validateEnvironmentVariables,
} from '../helpers/deployment';

/**
 * Note that these checks are also performed at runtime on the deployed snyk-monitor, see the integration tests.
 */

tap.test('ensure the security properties of the deployment files are unchanged', async (t) => {
  t.same(config.IMAGE_STORAGE_ROOT, '/var/tmp', 'the snyk-monitor points to the correct mounted path');

  const deploymentFiles = ['./snyk-monitor-deployment.yaml'];

  for (const filePath of deploymentFiles) {
    const fileContent = readFileSync(filePath, 'utf8');
    const deployment: V1Deployment = parse(fileContent);

    validateSecureConfiguration(t, deployment);
    validateVolumeMounts(t, deployment);
    validateEnvironmentVariables(t, deployment);
  }
});
