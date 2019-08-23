import { V1DaemonSet } from '@kubernetes/client-node';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function daemonSetWatchHandler(eventType: string, daemonSet: V1DaemonSet) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  if (!daemonSet.metadata || !daemonSet.spec || !daemonSet.spec.template.metadata ||
      !daemonSet.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.DaemonSet,
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    containers: daemonSet.spec.template.spec.containers,
    ownerRefs: daemonSet.metadata.ownerReferences,
  });
}
