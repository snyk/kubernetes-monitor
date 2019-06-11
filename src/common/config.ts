import * as uuidv4 from 'uuid/v4';

const config = require('snyk-config')(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

config.AGENT_ID = uuidv4();

export = config;
