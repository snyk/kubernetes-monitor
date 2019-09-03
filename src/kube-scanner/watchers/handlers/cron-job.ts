import { V1beta1CronJob } from '@kubernetes/client-node';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function cronJobWatchHandler(eventType: string, cronJob: V1beta1CronJob) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  if (!cronJob.metadata || !cronJob.spec || !cronJob.spec.jobTemplate.spec ||
      !cronJob.spec.jobTemplate.metadata || !cronJob.spec.jobTemplate.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = cronJob.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.CronJob,
    objectMeta: cronJob.metadata,
    specMeta: cronJob.spec.jobTemplate.metadata,
    containers: cronJob.spec.jobTemplate.spec.template.spec.containers,
    ownerRefs: cronJob.metadata.ownerReferences,
  }, workloadName);
}
