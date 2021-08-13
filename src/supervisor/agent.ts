import { config } from '../common/config';
import { logger } from '../common/logger';
import { k8sApi } from './cluster';
import { retryKubernetesApiRequestIndefinitely } from './kuberenetes-api-wrappers';

export async function setSnykMonitorAgentId(): Promise<void> {
  const name = config.DEPLOYMENT_NAME;
  const namespace = config.DEPLOYMENT_NAMESPACE;

  const agentId = await getSnykMonitorDeploymentUid(name, namespace);
  if (agentId === undefined) {
    return;
  }

  config.AGENT_ID = agentId;
}

async function getSnykMonitorDeploymentUid(
  name: string,
  namespace: string,
): Promise<string | undefined> {
  try {
    const attemptedApiCall = await retryKubernetesApiRequestIndefinitely(
      () => k8sApi.appsClient.readNamespacedDeployment(name, namespace),
      config.MAX_RETRY_BACKOFF_DURATION_SECONDS,
    );
    return attemptedApiCall.body.metadata?.uid;
  } catch (error) {
    logger.error(
      { error, namespace, name },
      'could not read the snyk-monitor deployment unique id',
    );
    return undefined;
  }
}
