import KubeApiWrapper = require('./lib/kube-scanner');

export async function monitor(config, logger) {
  setTimeout(() => {
    setInterval(async () => {
      const scan_output = await KubeApiWrapper.scan();
      console.log(scan_output);
    }, config.MONITOR.SCAN_INTERVAL_MS);
  }, config.MONITOR.INITIAL_REFRESH_MS);
}
