import { V1StatefulSet } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function statefulSetWatchHandler(statefulSet: V1StatefulSet) {
  if (!statefulSet.metadata || !statefulSet.spec || !statefulSet.spec.template.metadata ||
      !statefulSet.spec.template.spec || !statefulSet.status) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = statefulSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.StatefulSet,
    objectMeta: statefulSet.metadata,
    specMeta: statefulSet.spec.template.metadata,
    ownerRefs: statefulSet.metadata.ownerReferences,
    revision: statefulSet.status.observedGeneration,
    podSpec: statefulSet.spec.template.spec,
  }, workloadName);
}
