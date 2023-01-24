import { KubernetesObject, V1ObjectMeta } from '@kubernetes/client-node';
import { logger } from '../common/logger';

export function trimWorkloads<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(items: T[]): KubernetesObject[] {
  return items.map(trimWorkload);
}

/**
 * Pick only the minimum relevant data from the workload. Sometimes the workload
 * spec may be bloated with server-side information that is not necessary for vulnerability analysis.
 * This ensures that any data we hold in memory is minimal, which in turn allows us to hold more workloads to scan.
 */
export function trimWorkload<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(workload: T): T & { metadata: V1ObjectMeta } {
  logger.debug(
    { workloadMetadata: workload.metadata },
    'workload metadata state before trimming',
  );
  return {
    apiVersion: workload.apiVersion,
    kind: workload.kind,
    metadata: trimMetadata(workload.metadata),
    spec: workload.spec,
    status: workload.status,
  } as T & { metadata: V1ObjectMeta };
}

export function trimMetadata(metadata?: V1ObjectMeta): V1ObjectMeta {
  const trimmedMetadata = {
    name: metadata?.name,
    namespace: metadata?.namespace,
    annotations: metadata?.annotations,
    labels: metadata?.labels,
    ownerReferences: metadata?.ownerReferences,
    uid: metadata?.uid,
    resourceVersion: metadata?.resourceVersion,
    generation: metadata?.generation,
  };
  logger.debug(trimmedMetadata, 'workload metadata state after trimming');
  return trimmedMetadata;
}
