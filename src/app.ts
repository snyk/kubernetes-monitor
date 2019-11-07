import logger = require('./common/logger');
import { currentClusterName } from './kube-scanner/cluster';
import { beginWatchingWorkloads } from './kube-scanner/watchers/namespaces';

export function monitor(): void {
  try {
    logger.info({cluster: currentClusterName}, 'starting to monitor');
    beginWatchingWorkloads();
  } catch (error) {
    logger.error({error}, 'an error occurred while monitoring the cluster');
    process.exit(1);
  }
}
