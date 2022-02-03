import { IncomingMessage } from 'http';
import { deleteWorkload, trimWorkload } from './workload';
import { WorkloadKind } from '../../types';
import {
  FALSY_WORKLOAD_NAME_MARKER,
  V1DeploymentConfig,
  V1DeploymentConfigList,
} from './types';
import { paginatedNamespacedList } from './pagination';
import { k8sApi } from '../../cluster';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';

export async function paginatedNamespacedDeploymentConfigList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1DeploymentConfigList;
}> {
  const v1DeploymentConfigList = new V1DeploymentConfigList();
  v1DeploymentConfigList.apiVersion = 'apps.openshift.io/v1';
  v1DeploymentConfigList.kind = 'DeploymentConfigList';
  v1DeploymentConfigList.items = new Array<V1DeploymentConfig>();

  return await paginatedNamespacedList(
    namespace,
    v1DeploymentConfigList,
    async (
      namespace: string,
      pretty?: string,
      _allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
    ) =>
      k8sApi.customObjectsClient.listNamespacedCustomObject(
        'apps.openshift.io',
        'v1',
        namespace,
        'deploymentconfigs',
        pretty,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
      ) as any,
  );
}

export async function deploymentConfigWatchHandler(
  deploymentConfig: V1DeploymentConfig,
): Promise<void> {
  deploymentConfig = trimWorkload(deploymentConfig);

  if (
    !deploymentConfig.metadata ||
    !deploymentConfig.spec ||
    !deploymentConfig.spec.template.metadata ||
    !deploymentConfig.spec.template.spec ||
    !deploymentConfig.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(deploymentConfig);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: deploymentConfig.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
  }

  const workloadName =
    deploymentConfig.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.DeploymentConfig,
      objectMeta: deploymentConfig.metadata,
      specMeta: deploymentConfig.spec.template.metadata,
      ownerRefs: deploymentConfig.metadata.ownerReferences,
      revision: deploymentConfig.status.observedGeneration,
      podSpec: deploymentConfig.spec.template.spec,
    },
    workloadName,
  );
}
