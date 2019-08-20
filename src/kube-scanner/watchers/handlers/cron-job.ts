import { V1beta1CronJob } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { WatchEventType } from '../types';
import { WorkloadKind } from '../../types';
import { deleteWorkload } from './index';

export async function cronJobWatchHandler(eventType: string, cronJob: V1beta1CronJob) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

  if (!cronJob.metadata || !cronJob.spec || !cronJob.spec.jobTemplate.spec ||
      !cronJob.spec.jobTemplate.metadata || !cronJob.spec.jobTemplate.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.CronJob,
    objectMeta: cronJob.metadata,
    specMeta: cronJob.spec.jobTemplate.metadata,
    containers: cronJob.spec.jobTemplate.spec.template.spec.containers,
    ownerRefs: cronJob.metadata.ownerReferences,
  }, logId);
}
