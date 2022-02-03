import { V1Deployment, V1DeploymentList } from '@kubernetes/client-node';
import { deleteWorkload, trimWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { IncomingMessage } from 'http';
import { k8sApi } from '../../cluster';
import { paginatedNamespacedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';

export async function paginatedNamespacedDeploymentList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1DeploymentList;
}> {
  const v1DeploymentList = new V1DeploymentList();
  v1DeploymentList.apiVersion = 'apps/v1';
  v1DeploymentList.kind = 'DeploymentList';
  v1DeploymentList.items = new Array<V1Deployment>();

  k8sApi.appsClient.listDeploymentForAllNamespaces();

  return await paginatedNamespacedList(
    namespace,
    v1DeploymentList,
    k8sApi.appsClient.listNamespacedDeployment.bind(k8sApi.appsClient),
  );
}

export async function deploymentWatchHandler(
  deployment: V1Deployment,
): Promise<void> {
  deployment = trimWorkload(deployment);

  if (
    !deployment.metadata ||
    !deployment.spec ||
    !deployment.spec.template.metadata ||
    !deployment.spec.template.spec ||
    !deployment.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(deployment);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: deployment.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
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
