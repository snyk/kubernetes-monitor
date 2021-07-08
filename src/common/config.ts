import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from 'snyk-config';

const config: Record<string, any> = loadConfig(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

const namespacesFilePath = '/etc/config/excludedNamespaces';

function loadExcludedNamespaces(): string[] | null {
  try {
    const data = readFileSync(namespacesFilePath, 'utf-8');
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
config.AGENT_ID = uuidv4();

config.INTEGRATION_ID = config.INTEGRATION_ID.trim();
config.CLUSTER_NAME = getClusterName();
config.IMAGE_STORAGE_ROOT = '/var/tmp';
config.POLICIES_STORAGE_ROOT = '/tmp/policies';
config.EXCLUDED_NAMESPACES = loadExcludedNamespaces();

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

config.SKIP_K8S_JOBS = process.env.SKIP_K8S_JOBS === 'true';

export { config };
