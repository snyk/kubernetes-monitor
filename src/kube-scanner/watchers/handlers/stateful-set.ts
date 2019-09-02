import { V1StatefulSet } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function statefulSetWatchHandler(statefulSet: V1StatefulSet) {
  const logId = uuidv4().substring(0, 8);

  if (!statefulSet.metadata || !statefulSet.spec || !statefulSet.spec.template.metadata ||
      !statefulSet.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.StatefulSet,
    objectMeta: statefulSet.metadata,
    specMeta: statefulSet.spec.template.metadata,
    containers: statefulSet.spec.template.spec.containers,
    ownerRefs: statefulSet.metadata.ownerReferences,
  }, logId);
}
