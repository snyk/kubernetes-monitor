const config = require('snyk-config')(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

// allow env to overwrite config'd log level (good for travis etc.)
config.LOGGING.level = process.env.LOG_LEVEL || config.LOGGING.level;

config.setMonitoringConfig = () => {
  config.MONITOR = {
    SCAN_INTERVAL: process.env.SCAN_INTERVAL || 60000,
    INITIAL_REFRESH: process.env.INITIAL_REFRESH || 1000,
  };
};

export = config;
