import { V1Job } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function jobWatchHandler(job: V1Job) {
  const logId = uuidv4().substring(0, 8);

  if (!job.metadata || !job.spec || !job.spec.template.metadata || !job.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.Job,
    objectMeta: job.metadata,
    specMeta: job.spec.template.metadata,
    containers: job.spec.template.spec.containers,
    ownerRefs: job.metadata.ownerReferences,
  }, logId);
}
