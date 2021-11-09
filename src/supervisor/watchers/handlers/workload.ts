import { V1ObjectMeta } from '@kubernetes/client-node';
import type { KubernetesObject } from '@kubernetes/client-node';

import { logger } from '../../../common/logger';
import { IKubeObjectMetadata } from '../../types';
import { buildWorkloadMetadata } from '../../metadata-extractor';
import { sendDeleteWorkloadRequest } from '../../../scanner';

export async function deleteWorkload(
  kubernetesMetadata: IKubeObjectMetadata,
  workloadName: string,
): Promise<void> {
  try {
    if (
      kubernetesMetadata.ownerRefs !== undefined &&
      kubernetesMetadata.ownerRefs.length > 0
    ) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);
    await sendDeleteWorkloadRequest(workloadName, localWorkloadLocator);
  } catch (error) {
    logger.error(
      {
        error,
        resourceType: kubernetesMetadata.kind,
        resourceName: kubernetesMetadata.objectMeta.name,
      },
      'could not delete workload',
    );
  }
}

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
  return {
    apiVersion: workload.apiVersion,
    kind: workload.kind,
    metadata: trimMetadata(workload.metadata),
    spec: workload.spec,
    status: workload.status,
  } as T & { metadata: V1ObjectMeta };
}

export function trimMetadata(metadata?: V1ObjectMeta): V1ObjectMeta {
  return {
    name: metadata?.name,
    namespace: metadata?.namespace,
    annotations: metadata?.annotations,
    labels: metadata?.labels,
    ownerReferences: metadata?.ownerReferences,
    uid: metadata?.uid,
    resourceVersion: metadata?.resourceVersion,
    generation: metadata?.generation,
  };
}
