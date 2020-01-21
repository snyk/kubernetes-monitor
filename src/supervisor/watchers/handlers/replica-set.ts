import { V1ReplicaSet } from '@kubernetes/client-node';

import * as logger from '../../../common/logger';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function replicaSetWatchHandler(replicaSet: V1ReplicaSet): Promise<void> {
  if (!replicaSet.metadata || !replicaSet.spec || !replicaSet.spec.template ||
      !replicaSet.spec.template.metadata || !replicaSet.spec.template.spec || !replicaSet.status) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = replicaSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.ReplicaSet,
    objectMeta: replicaSet.metadata,
    specMeta: replicaSet.spec.template.metadata,
    ownerRefs: replicaSet.metadata.ownerReferences,
    revision: replicaSet.status.observedGeneration,
    podSpec: replicaSet.spec.template.spec,
  }, workloadName);
}

export async function replicaSetErrorHandler(replicaSet: V1ReplicaSet): Promise<void> {
  logger.error({replicaSet, kind: 'replicaSet'}, 'Informer error on replicaSet');
}
