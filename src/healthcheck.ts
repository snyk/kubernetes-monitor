import { config } from './common/config';
import { logger } from './common/logger';
import { state } from './state';

import * as dataScraper from './data-scraper';

export async function setupHealthCheck(): Promise<void> {
  const interval = 1 * 60 * 1000; // 1 minute in milliseconds
  setInterval(healthCheck, interval).unref();
}

async function healthCheck(): Promise<void> {
  const imagesAlreadyScanned = state.imagesAlreadyScanned.values().length;
  const workloadsAlreadyScanned = state.workloadsAlreadyScanned.values().length;
  logger.debug(
    { imagesAlreadyScanned, workloadsAlreadyScanned },
    'cache size report',
  );

  await sysdigHealthCheck();
}

async function sysdigHealthCheck(): Promise<void> {
  if (!config.SYSDIG_ENDPOINT || !config.SYSDIG_TOKEN) {
    return;
  }

  try {
    await dataScraper.validateConnectivity();
  } catch (error) {
    logger.error({ error }, 'could not connect to the Sysdig integration');
  }
}
