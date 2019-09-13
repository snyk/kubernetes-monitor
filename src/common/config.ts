import * as uuidv4 from 'uuid/v4';

const config = require('snyk-config')(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

config.AGENT_ID = uuidv4();
config.INTEGRATION_ID = config.INTEGRATION_ID.trim();
config.CLUSTER_NAME = config.CLUSTER_NAME || 'Default cluster';
config.IMAGE_STORAGE_ROOT = '/snyk-monitor';

export = config;
