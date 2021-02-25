import { existsSync, readFile } from 'fs';
import { resolve as resolvePath } from 'path';
import { promisify } from 'util';

import { logger } from './logger';
import { constructWorkloadAutoImportPolicy } from '../transmitter/payload';
import { sendWorkloadAutoImportPolicy } from '../transmitter';
import { config } from './config';

const readFileAsync = promisify(readFile);

export async function loadAndSendWorkloadAutoImportPolicy(): Promise<void> {
  try {
    /** This path is set in snyk-monitor during installation/deployment and is defined in the Helm chart. */
    const userProvidedRegoPolicyPath = resolvePath(
      config.POLICIES_STORAGE_ROOT,
      'workload-auto-import.rego',
    );
    if (!existsSync(userProvidedRegoPolicyPath)) {
      logger.info({}, 'Rego policy file does not exist, skipping loading');
      return;
    }

    const regoPolicy = await readFileAsync(userProvidedRegoPolicyPath, 'utf8');
    const payload = constructWorkloadAutoImportPolicy(regoPolicy);
    await sendWorkloadAutoImportPolicy(payload);
  } catch (err) {
    logger.error({ err }, 'Unexpected error occurred while loading workload auto-import policy');
  }
}
