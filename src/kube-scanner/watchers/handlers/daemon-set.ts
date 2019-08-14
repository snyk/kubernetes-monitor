import { V1DaemonSet } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function daemonSetWatchHandler(eventType: string, daemonSet: V1DaemonSet) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

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
  }, logId);
}
