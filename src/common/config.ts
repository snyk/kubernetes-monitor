const config = require('snyk-config')(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

export = config;
