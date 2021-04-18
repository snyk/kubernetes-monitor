import { Server } from 'ws';

import { emptyDirSync } from 'fs-extra';

import * as SourceMapSupport from 'source-map-support';

import { state } from './state';
import { config } from './common/config';
import { logger } from './common/logger';
import { currentClusterName } from './supervisor/cluster';
// import { beginWatchingWorkloads } from './supervisor/watchers';
import { workloadWatchMetadata } from './supervisor/watchers/handlers/index';
import { loadAndSendWorkloadAutoImportPolicy } from './common/policy';

process.on('uncaughtException', (err) => {
  if (state.shutdownInProgress) {
    return;
  }

  try {
    logger.error({err}, 'UNCAUGHT EXCEPTION!');
  } catch (ignore) {
    console.log('UNCAUGHT EXCEPTION!', err);
  } finally {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  if (state.shutdownInProgress) {
    return;
  }

  try {
    logger.error({reason}, 'UNHANDLED REJECTION!');
  } catch (ignore) {
    console.log('UNHANDLED REJECTION!', reason);
  } finally {
    process.exit(1);
  }
});

function startWebSocketServer(): void {
  const wss = new Server({ port: 8080, noServer: true, path: '/events' });

  wss.on('connection', function (ws) {
    ws.on('message', async function (message) {
      const { kind, event, object } = JSON.parse(message as string);
      logger.info({ event}, 'event received, calling handler');
      return await workloadWatchMetadata[kind].handlers[event.toLowerCase()](object);
    });
  });
}

function cleanUpTempStorage(): void {
  const { IMAGE_STORAGE_ROOT } = config;
  try {
    emptyDirSync(IMAGE_STORAGE_ROOT);
    logger.info({}, 'Cleaned temp storage');
  } catch (err) {
    logger.error({ err }, 'Error deleting files');
  }
}

function monitor(): void {
  try {
    logger.info({cluster: currentClusterName}, 'starting to monitor');
    console.log('aadsadafs');
    // beginWatchingWorkloads();
  } catch (error) {
    logger.error({error}, 'an error occurred while monitoring the cluster');
    process.exit(1);
  }
}

SourceMapSupport.install();
cleanUpTempStorage();

// Allow running in an async context
setImmediate(async function setUpAndMonitor(): Promise<void> {
  await loadAndSendWorkloadAutoImportPolicy();
  startWebSocketServer();
  monitor();
});
