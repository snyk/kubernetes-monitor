import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from 'snyk-config';
import { Config } from './types';

const config = loadConfig(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
}) as unknown as Config;


function loadExcludedNamespaces(): string[] | null {
  const namespacesFilePath = '/etc/config/excluded-namespaces/excludedNamespaces';
  return loadNamespaces(namespacesFilePath);
}

function loadIncludedNamespaces(): string[] | null {
  const namespacesFilePath = '/etc/config/included-namespaces/includedNamespaces';
  return loadNamespaces(namespacesFilePath);
}

function loadNamespaces(filePath: string): string[] | null {
  try {
    const data = readFileSync(filePath, 'utf-8');
    const namespaces: string[] = data.split(/\r?\n/);
    return namespaces;
  } catch (err) {
    return null;
  }
}

function getClusterName(): string {
  if (!config.CLUSTER_NAME) {
    return 'Default cluster';
  }

  if (config.CLUSTER_NAME.includes('/')) {
    // logger is not yet created so defaulting to console.log
    console.log(
      `removing disallowed character "/" from clusterName (${config.CLUSTER_NAME})`,
    );
    return config.CLUSTER_NAME.replace(/\//g, '');
  }

  return config.CLUSTER_NAME;
}

// NOTE: The agent identifier is replaced with a stable identifier once snyk-monitor starts up
config.AGENT_ID = randomUUID();

config.INTEGRATION_ID = config.INTEGRATION_ID.trim();
config.CLUSTER_NAME = getClusterName();
config.IMAGE_STORAGE_ROOT = '/var/tmp';
config.POLICIES_STORAGE_ROOT = '/tmp/policies';
config.INCLUDED_NAMESPACES = loadIncludedNamespaces();
config.EXCLUDED_NAMESPACES = loadExcludedNamespaces();
config.WORKERS_COUNT = Number(config.WORKERS_COUNT) || 10;
config.SKOPEO_COMPRESSION_LEVEL = Number(config.SKOPEO_COMPRESSION_LEVEL) || 6;

// return Sysdig endpoint information
if (config.SYSDIG_ENDPOINT && config.SYSDIG_TOKEN) {
  config.SYSDIG_ENDPOINT = config.SYSDIG_ENDPOINT.trim();
  config.SYSDIG_TOKEN = config.SYSDIG_TOKEN.trim();
}

/**
 * Important: we delete the following env vars because we don't want to proxy requests to the Kubernetes API server.
 * The Kubernetes client library would honor the NO/HTTP/HTTPS_PROXY env vars.
 */
config.HTTPS_PROXY = process.env['HTTPS_PROXY'];
config.HTTP_PROXY = process.env['HTTP_PROXY'];
config.NO_PROXY = process.env['NO_PROXY'];
config.USE_KEEPALIVE = process.env.USE_KEEPALIVE === 'true';
delete process.env['HTTPS_PROXY'];
delete process.env['HTTP_PROXY'];
delete process.env['NO_PROXY'];

config.SKIP_K8S_JOBS = process.env.SKIP_K8S_JOBS === 'true';

export { config };
