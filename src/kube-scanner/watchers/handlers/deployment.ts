import { V1Deployment } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';

export async function deploymentWatchHandler(deployment: V1Deployment) {
  const logId = uuidv4().substring(0, 8);

  if (!deployment.metadata || !deployment.spec || !deployment.spec.template.metadata ||
      !deployment.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: WorkloadKind.Deployment,
    objectMeta: deployment.metadata,
    specMeta: deployment.spec.template.metadata,
    containers: deployment.spec.template.spec.containers,
    ownerRefs: deployment.metadata.ownerReferences,
  }, logId);
}
