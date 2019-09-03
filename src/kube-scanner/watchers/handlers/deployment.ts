import { V1Deployment } from '@kubernetes/client-node';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function deploymentWatchHandler(eventType: string, deployment: V1Deployment) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  if (!deployment.metadata || !deployment.spec || !deployment.spec.template.metadata ||
      !deployment.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  const workloadName = deployment.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.Deployment,
    objectMeta: deployment.metadata,
    specMeta: deployment.spec.template.metadata,
    containers: deployment.spec.template.spec.containers,
    ownerRefs: deployment.metadata.ownerReferences,
  }, workloadName);
}
