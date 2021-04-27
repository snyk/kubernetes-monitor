import { V1DaemonSet } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function daemonSetWatchHandler(
  daemonSet: V1DaemonSet,
): Promise<void> {
  if (
    !daemonSet.metadata ||
    !daemonSet.spec ||
    !daemonSet.spec.template.metadata ||
    !daemonSet.spec.template.spec ||
    !daemonSet.status
  ) {
    return;
  }

  const workloadName = daemonSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.DaemonSet,
      objectMeta: daemonSet.metadata,
      specMeta: daemonSet.spec.template.metadata,
      ownerRefs: daemonSet.metadata.ownerReferences,
      revision: daemonSet.status.observedGeneration,
      podSpec: daemonSet.spec.template.spec,
    },
    workloadName,
  );
}
