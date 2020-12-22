import * as uuidv4 from 'uuid/v4';
import { loadConfig } from 'snyk-config';

const config: Record<string, any> = loadConfig(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

config.AGENT_ID = uuidv4();
config.INTEGRATION_ID = config.INTEGRATION_ID.trim();
config.CLUSTER_NAME = config.CLUSTER_NAME || 'Default cluster';
config.IMAGE_STORAGE_ROOT = '/var/tmp';

/**
 * Important: we delete the following env vars because we don't want to proxy requests to the Kubernetes API server.
 * The Kubernetes client library would honor the NO/HTTP/HTTPS_PROXY env vars.
 */
config.HTTPS_PROXY = process.env['HTTPS_PROXY'];
config.HTTP_PROXY = process.env['HTTP_PROXY'];
config.NO_PROXY = process.env['NO_PROXY'];
delete process.env['HTTPS_PROXY'];
delete process.env['HTTP_PROXY'];
delete process.env['NO_PROXY'];

export { config };
