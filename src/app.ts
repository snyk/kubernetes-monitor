import * as config from './common/config';
import KubeApiWrapper = require('./lib/kube-scanner');

async function scan() {
  await KubeApiWrapper.scan();
}

async function safeScan() {
  try {
    await scan();
  } catch (error) {
    const errorMessage = (error && error.response)
      ? `${error.response.statusCode} ${error.response.statusMessage}`
      : error.message;
    console.log(`An error occurred during image scan: ${errorMessage}`);
  }
}

export async function monitor() {
  setTimeout(async () => {
    setInterval(async () => {
      await safeScan();
    }, config.MONITOR.SCAN_INTERVAL_MS);

    await safeScan();
  }, config.MONITOR.INITIAL_REFRESH_MS);
}
