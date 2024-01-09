import { config } from './common/config';
import { logger } from './common/logger';
import { state } from './state';
import { validateConnectivityV1 } from './data-scraper/scraping-v1';

import * as dataScraper from './data-scraper';

export const sysdigV1 = 'V1';
export const sysdigV2 = 'V2';

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

export function getSysdigVersion() {
  if (
    config.SYSDIG_REGION_URL &&
    config.SYSDIG_RISK_SPOTLIGHT_TOKEN &&
    config.SYSDIG_CLUSTER_NAME
  ) {
    return sysdigV2;
  } else if (config.SYSDIG_ENDPOINT && config.SYSDIG_TOKEN) {
    return sysdigV1;
  } else {
    return '';
  }
}

async function sysdigHealthCheck(): Promise<void> {
  if (
    !(
      config.SYSDIG_CLUSTER_NAME &&
      config.SYSDIG_RISK_SPOTLIGHT_TOKEN &&
      config.SYSDIG_REGION_URL
    ) ||
    !(config.SYSDIG_ENDPOINT && config.SYSDIG_TOKEN)
  ) {
    return;
  }

  try {
    let sysdigVersion = getSysdigVersion();
    if (sysdigVersion == sysdigV1) {
      await validateConnectivityV1();
    } else {
      await dataScraper.validateConnectivity();
    }
  } catch (error) {
    logger.error({ error }, 'could not connect to the Sysdig integration');
  }
}
