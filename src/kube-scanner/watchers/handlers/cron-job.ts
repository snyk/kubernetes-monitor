import { V1beta1CronJob } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function cronJobWatchHandler(cronJob: V1beta1CronJob) {
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
    ownerRefs: cronJob.metadata.ownerReferences,
    podSpec: cronJob.spec.jobTemplate.spec.template.spec,
  }, workloadName);
}
