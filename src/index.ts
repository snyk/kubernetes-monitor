import fsExtra = require('fs-extra');

import * as SourceMapSupport from 'source-map-support';

import { state } from './state';
import { config } from './common/config';
import { logger } from './common/logger';
import { currentClusterName } from './supervisor/cluster';
import { beginWatchingWorkloads } from './supervisor/watchers';
import { loadAndSendWorkloadEventsPolicy } from './common/policy';
import { sendClusterMetadata } from './transmitter';
import { setSnykMonitorAgentId } from './supervisor/agent';
import { scrapeData } from './data-scraper';

process.on('uncaughtException', (err) => {
  if (state.shutdownInProgress) {
    return;
  }

  try {
    logger.error({ err }, 'UNCAUGHT EXCEPTION!');
  } catch (ignore) {
    console.log('UNCAUGHT EXCEPTION!', err);
  } finally {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (state.shutdownInProgress) {
    return;
  }

  try {
    logger.error({ reason, promise }, 'UNHANDLED REJECTION!');
  } catch (ignore) {
    console.log('UNHANDLED REJECTION!', reason, promise);
  } finally {
    process.exit(1);
  }
});

function cleanUpTempStorage() {
  const { IMAGE_STORAGE_ROOT } = config;
  try {
    fsExtra.emptyDirSync(IMAGE_STORAGE_ROOT);
    logger.info({}, 'Cleaned temp storage');
  } catch (err) {
    logger.error({ err }, 'Error deleting files');
  }
}

async function monitor(): Promise<void> {
  try {
    logger.info({ cluster: currentClusterName }, 'starting to monitor');
    await beginWatchingWorkloads();
  } catch (error) {
    logger.error({ error }, 'an error occurred while monitoring the cluster');
    process.exit(1);
  }
}

SourceMapSupport.install();
cleanUpTempStorage();

// Allow running in an async context
setImmediate(async function setUpAndMonitor(): Promise<void> {
  await setSnykMonitorAgentId();
  await sendClusterMetadata();
  await loadAndSendWorkloadEventsPolicy();
  await monitor();

  const interval: number = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  if (config.SYSDIG_ENDPOINT && config.SYSDIG_TOKEN) {
    setInterval(async () => {
      try {
        await scrapeData();
      } catch (error) {
        logger.error(
          { error },
          'an error occurred while scraping runtime data',
        );
      }
    }, interval).unref();
  } else {
    logger.info({}, 'Sysdig integration not detected');
  }
});
