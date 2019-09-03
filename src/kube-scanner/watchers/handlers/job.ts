import { V1Job } from '@kubernetes/client-node';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function jobWatchHandler(eventType: string, job: V1Job) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  if (!job.metadata || !job.spec || !job.spec.template.metadata || !job.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = job.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.Job,
    objectMeta: job.metadata,
    specMeta: job.spec.template.metadata,
    containers: job.spec.template.spec.containers,
    ownerRefs: job.metadata.ownerReferences,
  }, workloadName);
}
