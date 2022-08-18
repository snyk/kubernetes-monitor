import fsExtra = require('fs-extra');
import { writeFileSync } from 'fs';

import * as SourceMapSupport from 'source-map-support';

import { state } from './state';
import { config } from './common/config';
import { logger } from './common/logger';
import { currentClusterName, k8sApi } from './supervisor/cluster';
import { beginWatchingWorkloads } from './supervisor/watchers';
import { loadAndSendWorkloadEventsPolicy } from './common/policy';
import { sendClusterMetadata } from './transmitter';
import { setSnykMonitorAgentId } from './supervisor/agent';
import { scrapeData } from './data-scraper';
import { setupHealthCheck } from './healthcheck';

process.on('uncaughtException', (error) => {
  if (state.shutdownInProgress) {
    return;
  }

  try {
    logger.error({ error }, 'UNCAUGHT EXCEPTION!');
  } catch (ignore) {
    console.log('UNCAUGHT EXCEPTION!', error);
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
    logger.info(
      {
        cluster: currentClusterName,
        useKeepalive: config.USE_KEEPALIVE,
      },
      'starting to monitor',
    );
    await beginWatchingWorkloads();
  } catch (error) {
    logger.error({ error }, 'an error occurred while monitoring the cluster');
    process.exit(1);
  }
}

async function setupSysdigIntegration(): Promise<void> {
  if (!config.SYSDIG_ENDPOINT || !config.SYSDIG_TOKEN) {
    logger.info({}, 'Sysdig integration not detected');
    return;
  }

  const initialInterval: number = 20 * 60 * 1000; // 20 mins in milliseconds
  setTimeout(async () => {
    try {
      await scrapeData();
    } catch (error) {
      logger.error(
        { error },
        'an error occurred while scraping initial runtime data',
      );
    }
  }, initialInterval).unref();

  const interval: number = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  setInterval(async () => {
    try {
      await scrapeData();
    } catch (error) {
      logger.error({ error }, 'an error occurred while scraping runtime data');
    }
  }, interval).unref();
}

SourceMapSupport.install();
cleanUpTempStorage();

// Allow running in an async context
setImmediate(async function setUpAndMonitor(): Promise<void> {
  await setSnykMonitorAgentId();
  await sendClusterMetadata();
  await loadAndSendWorkloadEventsPolicy();
  await automagicallyLoadDockercfg();
  await monitor();
  await setupSysdigIntegration();
  await setupHealthCheck();
});

async function automagicallyLoadDockercfg(): Promise<void> {
  const response = await k8sApi.coreClient.listSecretForAllNamespaces();
  const secrets = response.body;
  const dockerConfigs = secrets.items.filter(
    (secret) => secret.type === 'kubernetes.io/dockerconfigjson',
  );
  const dockercfg = dockerConfigs[0];
  if (!dockercfg) {
    logger.warn({}, 'could not find dockercfg in the cluster');
    return;
  }

  const base64Config = dockercfg.data?.['.dockerconfigjson'];
  if (!base64Config) {
    logger.warn({}, 'dockercfg is not base64 encoded');
    return;
  }

  logger.info({}, 'writing dockercfg to file');
  const content = Buffer.from(base64Config, 'base64').toString('utf8');
  writeFileSync('/tmp/dockercfg.json', content, 'utf8');
}
