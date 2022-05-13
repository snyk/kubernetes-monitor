import { IncomingMessage } from 'http';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER, Rollout, RolloutList } from './types';
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

export async function paginatedNamespacedArgoRolloutList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: RolloutList;
}> {
  const rolloutList = new RolloutList();
  rolloutList.apiVersion = 'argoproj.io/v1alpha1';
  rolloutList.kind = 'RolloutList';
  rolloutList.items = new Array<Rollout>();

  return await paginatedNamespacedList(
    namespace,
    rolloutList,
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
        'argoproj.io',
        'v1alpha1',
        namespace,
        'rollouts',
        pretty,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
        // TODO: Why any?
      ) as any,
  );
}

export async function paginatedClusterArgoRolloutList(): Promise<{
  response: IncomingMessage;
  body: RolloutList;
}> {
  const rolloutList = new RolloutList();
  rolloutList.apiVersion = 'argoproj.io/v1';
  rolloutList.kind = 'RolloutList';
  rolloutList.items = new Array<Rollout>();

  return await paginatedClusterList(
    rolloutList,
    async (
      _allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      pretty?: string,
    ) =>
      k8sApi.customObjectsClient.listClusterCustomObject(
        'argoproj.io',
        'v1alpha1',
        'rollouts',
        pretty,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
      ) as any,
  );
}

export async function ArgoRolloutWatchHandler(rollout: Rollout): Promise<void> {
  rollout = trimWorkload(rollout);

  if (
    !rollout.metadata ||
    !rollout.spec ||
    !rollout.spec.template.metadata ||
    !rollout.spec.template.spec ||
    !rollout.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(rollout);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: rollout.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
      deleteWorkloadFromScanQueue(workloadAlreadyScanned),
    ]);
  }

  const workloadName = rollout.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.ArgoRollout,
      objectMeta: rollout.metadata,
      specMeta: rollout.spec.template.metadata,
      ownerRefs: rollout.metadata.ownerReferences,
      revision: rollout.status.observedGeneration,
      podSpec: rollout.spec.template.spec,
    },
    workloadName,
  );
}

export async function isNamespacedArgoRolloutSupported(
  namespace: string,
): Promise<boolean> {
  try {
    const pretty = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall = await retryKubernetesApiRequest(() =>
      k8sApi.customObjectsClient.listNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'rollouts',
        pretty,
        continueToken,
        fieldSelector,
        labelSelector,
        limit,
        resourceVersion,
        timeoutSeconds,
      ),
    );
    return (
      attemptedApiCall !== undefined &&
      attemptedApiCall.response !== undefined &&
      attemptedApiCall.response.statusCode !== undefined &&
      attemptedApiCall.response.statusCode >= 200 &&
      attemptedApiCall.response.statusCode < 300
    );
  } catch (error) {
    logger.debug(
      { error, workloadKind: WorkloadKind.ArgoRollout },
      'Failed on Kubernetes API call to list namespaced argoproj.io/Rollout',
    );
    return false;
  }
}

export async function isClusterArgoRolloutSupported(): Promise<boolean> {
  try {
    const pretty = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall = await retryKubernetesApiRequest(() =>
      k8sApi.customObjectsClient.listClusterCustomObject(
        'argoproj.io',
        'v1alpha1',
        'rollouts',
        pretty,
        continueToken,
        fieldSelector,
        labelSelector,
        limit,
        resourceVersion,
        timeoutSeconds,
      ),
    );
    return (
      attemptedApiCall !== undefined &&
      attemptedApiCall.response !== undefined &&
      attemptedApiCall.response.statusCode !== undefined &&
      attemptedApiCall.response.statusCode >= 200 &&
      attemptedApiCall.response.statusCode < 300
    );
  } catch (error) {
    logger.debug(
      { error, workloadKind: WorkloadKind.ArgoRollout },
      'Failed on Kubernetes API call to list cluster argoproj.io/Rollout',
    );
    return false;
  }
}
