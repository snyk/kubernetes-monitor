import * as config from './common/config';
import logger = require('./common/logger');
import { currentClusterName } from './lib/kube-scanner/cluster';
import { beginWatchingWorkloads } from './lib/kube-scanner/watchers/namespaces';

function safeMonitoring() {
  try {
    logger.info({cluster: currentClusterName}, 'Starting to monitoring');
    beginWatchingWorkloads();
  } catch (error) {
    logger.error({error}, 'An error occurred while monitoring the cluster');
  }
}

export function monitor() {
  setTimeout(safeMonitoring, config.MONITOR.INITIAL_REFRESH_MS);
}
