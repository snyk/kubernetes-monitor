import { V1ReplicationController } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function replicationControllerWatchHandler(replicationController: V1ReplicationController): Promise<void> {
  if (!replicationController.metadata || !replicationController.spec || !replicationController.spec.template ||
      !replicationController.spec.template.metadata || !replicationController.spec.template.spec ||
      !replicationController.status) {
    return;
  }

  const workloadName = replicationController.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.ReplicationController,
    objectMeta: replicationController.metadata,
    specMeta: replicationController.spec.template.metadata,
    ownerRefs: replicationController.metadata.ownerReferences,
    revision: replicationController.status.observedGeneration,
    podSpec: replicationController.spec.template.spec,
  }, workloadName);
}
