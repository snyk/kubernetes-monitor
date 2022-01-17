import { makeInformer, ADD, ERROR } from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import { WorkloadKind } from '../types';
import { setupInformer } from './handlers';
import { kubeConfig, k8sApi } from '../cluster';
import * as kubernetesApiWrappers from '../kuberenetes-api-wrappers';
import {
  kubernetesInternalNamespaces,
  openshiftInternalNamespaces,
} from './internal-namespaces';
import { state } from '../../state';
import { RETRYABLE_NETWORK_ERRORS } from './types';

async function setupWatchesForNamespace(namespace: V1Namespace): Promise<void> {
  const namespaceName = extractNamespaceName(namespace);

  if (state.watchedNamespaces[namespaceName] !== undefined) {
    logger.info({ namespace }, 'already set up namespace watch, skipping');
    return;
  }
  state.watchedNamespaces[namespaceName] = namespace;

  logger.info({ namespace: namespaceName }, 'setting up namespace watch');

  for (const workloadKind of Object.values(WorkloadKind)) {
    // Disable handling events for k8s Jobs for debug purposes
    if (config.SKIP_K8S_JOBS === true && workloadKind === WorkloadKind.Job) {
      continue;
    }

    try {
      await setupInformer(namespaceName, workloadKind);
    } catch (error) {
      logger.warn(
        { namespace, workloadKind },
        'could not setup workload watch, skipping',
      );
    }
  }
}

export function extractNamespaceName(namespace: V1Namespace): string {
  if (namespace && namespace.metadata && namespace.metadata.name) {
    return namespace.metadata.name;
  }
  throw new Error('Namespace missing metadata.name');
}

export function isExcludedNamespace(namespace: string): boolean {
  return (
    (config.EXCLUDED_NAMESPACES
      ? config.EXCLUDED_NAMESPACES.includes(namespace)
      : kubernetesInternalNamespaces.has(namespace)) ||
    // always check openshift excluded namespaces
    openshiftInternalNamespaces.has(namespace)
  );
}

async function setupWatchesForCluster(): Promise<void> {
  const informer = makeInformer(kubeConfig, '/api/v1/namespaces', async () => {
    try {
      return await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        k8sApi.coreClient.listNamespace(),
      );
    } catch (err) {
      logger.error({ err }, 'error while listing namespaces');
      throw err;
    }
  });

  informer.on(ERROR, (err) => {
    // Types from client library insists that callback is of type V1Namespace
    const code = (err as any).code || '';
    if (RETRYABLE_NETWORK_ERRORS.includes(code)) {
      logger.debug(`namespace informer ${code} occurred, restarting informer`);

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error(
        { err },
        'unexpected namespace informer error event occurred',
      );
    }
  });

  informer.on(ADD, async (namespace: V1Namespace) => {
    try {
      const namespaceName = extractNamespaceName(namespace);
      if (isExcludedNamespace(namespaceName)) {
        // disregard excluded namespaces
        logger.info({ namespaceName }, 'ignoring blacklisted namespace');
        return;
      }

      await setupWatchesForNamespace(namespace);
    } catch (err) {
      logger.error({ err, namespace }, 'error handling a namespace event');
      return;
    }
  });

  await informer.start();
}

export async function beginWatchingWorkloads(): Promise<void> {
  if (config.WATCH_NAMESPACE) {
    logger.info(
      { namespace: config.WATCH_NAMESPACE },
      'kubernetes-monitor restricted to specific namespace',
    );
    const namespaceResponse = await k8sApi.coreClient.readNamespace(
      config.WATCH_NAMESPACE,
    );
    const namespace = namespaceResponse.body;
    await setupWatchesForNamespace(namespace);
    return;
  }

  await setupWatchesForCluster();
}
