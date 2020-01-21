import { V1DaemonSet } from '@kubernetes/client-node';

import * as logger from '../../../common/logger';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function daemonSetWatchHandler(daemonSet: V1DaemonSet): Promise<void> {
  if (!daemonSet.metadata || !daemonSet.spec || !daemonSet.spec.template.metadata ||
      !daemonSet.spec.template.spec || !daemonSet.status) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = daemonSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.DaemonSet,
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    ownerRefs: daemonSet.metadata.ownerReferences,
    revision: daemonSet.status.observedGeneration,
    podSpec: daemonSet.spec.template.spec,
  }, workloadName);
}

export async function daemonSetErrorHandler(daemonSet: V1DaemonSet): Promise<void> {
  logger.error({daemonSet, kind: 'daemonSet'}, 'Informer error on daemonSet');
}
