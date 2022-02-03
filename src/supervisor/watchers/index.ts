import { V1Namespace } from '@kubernetes/client-node';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import { WorkloadKind } from '../types';
import { setupInformer, WATCH_WHOLE_CLUSTER } from './handlers';
import { k8sApi } from '../cluster';
import {
  kubernetesInternalNamespaces,
  openshiftInternalNamespaces,
} from './internal-namespaces';
import { state } from '../../state';

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
  for (const workloadKind of Object.values(WorkloadKind)) {
    // Disable handling events for k8s Jobs for debug purposes
    if (config.SKIP_K8S_JOBS === true && workloadKind === WorkloadKind.Job) {
      continue;
    }

    try {
      await setupInformer(WATCH_WHOLE_CLUSTER, workloadKind);
    } catch (error) {
      logger.warn({ workloadKind }, 'could not setup workload watch, skipping');
    }
  }
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
