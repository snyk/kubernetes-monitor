import { V1Deployment, V1DeploymentList } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';
import { trimWorkload } from '../../workload-sanitization';
import { deleteWorkloadFromScanQueue } from './queue';

export async function paginatedNamespacedDeploymentList(
  namespace: string,
): Promise<V1DeploymentList> {
  const v1DeploymentList = new V1DeploymentList();
  v1DeploymentList.apiVersion = 'apps/v1';
  v1DeploymentList.kind = 'DeploymentList';
  v1DeploymentList.items = new Array<V1Deployment>();

  return await paginatedNamespacedList(
    namespace,
    v1DeploymentList,
    k8sApi.appsClient.listNamespacedDeployment.bind(k8sApi.appsClient),
  );
}

export async function paginatedClusterDeploymentList(): Promise<V1DeploymentList> {
  const v1DeploymentList = new V1DeploymentList();
  v1DeploymentList.apiVersion = 'apps/v1';
  v1DeploymentList.kind = 'DeploymentList';
  v1DeploymentList.items = new Array<V1Deployment>();

  return await paginatedClusterList(
    v1DeploymentList,
    k8sApi.appsClient.listDeploymentForAllNamespaces.bind(k8sApi.appsClient),
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
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: deployment.spec.template.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
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
