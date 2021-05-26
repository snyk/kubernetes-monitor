import { existsSync, readFile } from 'fs';
import { resolve as resolvePath } from 'path';
import { promisify } from 'util';

import { logger } from './logger';
import { constructWorkloadEventsPolicy } from '../transmitter/payload';
import { sendWorkloadEventsPolicy } from '../transmitter';
import { config } from './config';

const readFileAsync = promisify(readFile);

export async function loadAndSendWorkloadEventsPolicy(): Promise<void> {
  try {
    /** This path is set in snyk-monitor during installation/deployment and is defined in the Helm chart. */
    const userProvidedRegoPolicyPath = resolvePath(
      config.POLICIES_STORAGE_ROOT,
      'workload-events.rego',
    );
    if (!existsSync(userProvidedRegoPolicyPath)) {
      logger.info({}, 'Rego policy file does not exist, skipping loading');
      return;
    }

    const regoPolicy = await readFileAsync(userProvidedRegoPolicyPath, 'utf8');
    const payload = constructWorkloadEventsPolicy(regoPolicy);
    await sendWorkloadEventsPolicy(payload);
  } catch (err) {
    logger.error(
      { err },
      'Unexpected error occurred while loading workload events policy',
    );
  }
}
