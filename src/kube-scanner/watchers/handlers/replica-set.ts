import { V1ReplicaSet } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function replicaSetWatchHandler(replicaSet: V1ReplicaSet) {
  const logId = uuidv4().substring(0, 8);

  if (!replicaSet.metadata || !replicaSet.spec || !replicaSet.spec.template ||
      !replicaSet.spec.template.metadata || !replicaSet.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.ReplicaSet,
    objectMeta: replicaSet.metadata,
    specMeta: replicaSet.spec.template.metadata,
    containers: replicaSet.spec.template.spec.containers,
    ownerRefs: replicaSet.metadata.ownerReferences,
  }, logId);
}
