import { V1Namespace } from '@kubernetes/client-node';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import { WorkloadKind } from '../types';
import { setupNamespacedInformer, setupClusterInformer } from './handlers';
import { k8sApi } from '../cluster';
import { extractNamespaceName } from './internal-namespaces';
import { trackNamespace, trackNamespaces } from './handlers/namespace';

async function setupWatchesForNamespace(namespace: V1Namespace): Promise<void> {
  const namespaceName = extractNamespaceName(namespace);

  logger.info({ namespace: namespaceName }, 'setting up namespaced informers');

  await trackNamespace(namespaceName);

  for (const workloadKind of Object.values(WorkloadKind)) {
    // Disable handling events for k8s Jobs for debug purposes
    if (config.SKIP_K8S_JOBS === true && workloadKind === WorkloadKind.Job) {
      continue;
    }

    try {
      await setupNamespacedInformer(namespaceName, workloadKind);
    } catch (error) {
      logger.warn(
        { namespace, workloadKind },
        'could not setup namespaced workload informer, skipping',
      );
    }
  }
}

async function setupWatchesForCluster(): Promise<void> {
  logger.info({}, 'setting up cluster informers');

  await trackNamespaces();

  for (const workloadKind of Object.values(WorkloadKind)) {
    // Disable handling events for k8s Jobs for debug purposes
    if (config.SKIP_K8S_JOBS === true && workloadKind === WorkloadKind.Job) {
      continue;
    }

    try {
      await setupClusterInformer(workloadKind);
    } catch (error) {
      logger.warn(
        { workloadKind },
        'could not setup cluster workload informer, skipping',
      );
    }
  }
}

export async function beginWatchingWorkloads(): Promise<void> {
  if (config.WATCH_NAMESPACE) {
    logger.info(
      { namespace: config.WATCH_NAMESPACE },
      'kubernetes-monitor restricted to specific namespace',
    );
    let namespaceResponse: V1Namespace | undefined;
    try {
      namespaceResponse = await k8sApi.coreClient.readNamespace({
        name: config.WATCH_NAMESPACE,
      });
    } catch (err) {
      logger.error(
        { watchedNamespace: config.WATCH_NAMESPACE, err },
        'failed to read the namespace',
      );
      return;
    }
    await setupWatchesForNamespace(namespaceResponse);
    return;
  }

  await setupWatchesForCluster();
}
