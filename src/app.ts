import * as config from './common/config';
import { beginWatchingWorkloads } from './lib/kube-scanner/watchers/namespaces';

function safeMonitoring() {
  try {
    beginWatchingWorkloads();
  } catch (error) {
    const errorMessage = (error && error.response)
      ? `${error.response.statusCode} ${error.response.statusMessage}`
      : error.message;
    console.log(`An error occurred during image scan: ${errorMessage}`);
  }
}

export function monitor() {
  setTimeout(safeMonitoring, config.MONITOR.INITIAL_REFRESH_MS);
}
