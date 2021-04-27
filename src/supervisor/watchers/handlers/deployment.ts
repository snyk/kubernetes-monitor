import { V1Deployment } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';

export async function deploymentWatchHandler(
  deployment: V1Deployment,
): Promise<void> {
  if (
    !deployment.metadata ||
    !deployment.spec ||
    !deployment.spec.template.metadata ||
    !deployment.spec.template.spec ||
    !deployment.status
  ) {
    return;
  }

  const workloadName = deployment.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.Deployment,
      objectMeta: deployment.metadata,
      specMeta: deployment.spec.template.metadata,
      ownerRefs: deployment.metadata.ownerReferences,
      revision: deployment.status.observedGeneration,
      podSpec: deployment.spec.template.spec,
    },
    workloadName,
  );
}
