import { V1DaemonSet } from '@kubernetes/client-node';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function daemonSetWatchHandler(daemonSet: V1DaemonSet) {
  if (!daemonSet.metadata || !daemonSet.spec || !daemonSet.spec.template.metadata ||
      !daemonSet.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = daemonSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.DaemonSet,
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    containers: daemonSet.spec.template.spec.containers,
    ownerRefs: daemonSet.metadata.ownerReferences,
  }, workloadName);
}
