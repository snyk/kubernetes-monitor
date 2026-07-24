import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import {
  FALSY_WORKLOAD_NAME_MARKER,
  V1DeploymentConfig,
  V1DeploymentConfigList,
} from './types';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import { k8sApi } from '../../cluster';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';
import { retryKubernetesApiRequest } from '../../kuberenetes-api-wrappers';
import { logger } from '../../../common/logger';
import { deleteWorkloadFromScanQueue } from './queue';
import { trimWorkload } from '../../workload-sanitization';

export async function paginatedNamespacedDeploymentConfigList(
  namespace: string,
): Promise<V1DeploymentConfigList> {
  const v1DeploymentConfigList = new V1DeploymentConfigList();
  v1DeploymentConfigList.apiVersion = 'apps.openshift.io/v1';
  v1DeploymentConfigList.kind = 'DeploymentConfigList';
  v1DeploymentConfigList.items = new Array<V1DeploymentConfig>();

  return await paginatedNamespacedList(
    namespace,
    v1DeploymentConfigList,
    (args) =>
      k8sApi.customObjectsClient.listNamespacedCustomObject({
        group: 'apps.openshift.io',
        version: 'v1',
        plural: 'deploymentconfigs',
        namespace: args.namespace,
        _continue: args._continue,
        limit: args.limit,
      }) as unknown as Promise<V1DeploymentConfigList>,
  );
}

export async function paginatedClusterDeploymentConfigList(): Promise<V1DeploymentConfigList> {
  const v1DeploymentConfigList = new V1DeploymentConfigList();
  v1DeploymentConfigList.apiVersion = 'apps.openshift.io/v1';
  v1DeploymentConfigList.kind = 'DeploymentConfigList';
  v1DeploymentConfigList.items = new Array<V1DeploymentConfig>();

  return await paginatedClusterList(
    v1DeploymentConfigList,
    (args) =>
      k8sApi.customObjectsClient.listClusterCustomObject({
        group: 'apps.openshift.io',
        version: 'v1',
        plural: 'deploymentconfigs',
        _continue: args._continue,
        limit: args.limit,
      }) as unknown as Promise<V1DeploymentConfigList>,
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
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: deploymentConfig.spec.template.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
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

export async function isNamespacedDeploymentConfigSupported(
  namespace: string,
): Promise<boolean> {
  try {
    await retryKubernetesApiRequest(() =>
      k8sApi.customObjectsClient.listNamespacedCustomObject({
        group: 'apps.openshift.io',
        version: 'v1',
        namespace,
        plural: 'deploymentconfigs',
        limit: 1, // Try to grab only a single object
        timeoutSeconds: 10, // Don't block the snyk-monitor indefinitely
      }),
    );
    return true;
  } catch (error) {
    logger.debug(
      { error, workloadKind: WorkloadKind.DeploymentConfig },
      'Failed on Kubernetes API call to list namespaced DeploymentConfig',
    );
    return false;
  }
}

export async function isClusterDeploymentConfigSupported(): Promise<boolean> {
  try {
    await retryKubernetesApiRequest(() =>
      k8sApi.customObjectsClient.listClusterCustomObject({
        group: 'apps.openshift.io',
        version: 'v1',
        plural: 'deploymentconfigs',
        limit: 1, // Try to grab only a single object
        timeoutSeconds: 10, // Don't block the snyk-monitor indefinitely
      }),
    );
    return true;
  } catch (error) {
    logger.debug(
      { error, workloadKind: WorkloadKind.DeploymentConfig },
      'Failed on Kubernetes API call to list cluster DeploymentConfig',
    );
    return false;
  }
}
