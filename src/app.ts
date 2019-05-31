import KubeApiWrapper = require('./lib/kube-scanner');

let STARTED = false;

async function scan() {
  const scanOutput = await KubeApiWrapper.scan();
  console.log(scanOutput);
}

export async function monitor(config, logger) {
  if (STARTED) {
    return;
  }

  setTimeout(() => {
    setInterval(async () => {
      scan();
    }, config.MONITOR.SCAN_INTERVAL_MS);

    // also do a scan on start up
    scan();
  }, config.MONITOR.INITIAL_REFRESH_MS);

  STARTED = true;
}
