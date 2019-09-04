import { V1ReplicaSet } from '@kubernetes/client-node';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function replicaSetWatchHandler(replicaSet: V1ReplicaSet) {
  if (!replicaSet.metadata || !replicaSet.spec || !replicaSet.spec.template ||
      !replicaSet.spec.template.metadata || !replicaSet.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = replicaSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.ReplicaSet,
    objectMeta: replicaSet.metadata,
    specMeta: replicaSet.spec.template.metadata,
    containers: replicaSet.spec.template.spec.containers,
    ownerRefs: replicaSet.metadata.ownerReferences,
  }, workloadName);
}
