import * as SourceMapSupport from 'source-map-support';
import logger = require('./common/logger');
import { currentClusterName } from './scanner/cluster';
import { beginWatchingWorkloads } from './scanner/watchers';

process.on('uncaughtException', (err) => {
  try {
    logger.error({err}, 'UNCAUGHT EXCEPTION!');
  } catch (ignore) {
    console.log('UNCAUGHT EXCEPTION!', err);
  } finally {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({reason, promise}, 'unhandled rejection');
});

function monitor(): void {
  try {
    logger.info({cluster: currentClusterName}, 'starting to monitor');
    beginWatchingWorkloads();
  } catch (error) {
    logger.error({error}, 'an error occurred while monitoring the cluster');
    process.exit(1);
  }
}

SourceMapSupport.install();
monitor();
