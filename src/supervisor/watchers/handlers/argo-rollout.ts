import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import {
  FALSY_WORKLOAD_NAME_MARKER,
  V1alpha1Rollout,
  V1alpha1RolloutList,
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

export async function paginatedNamespacedArgoRolloutList(
  namespace: string,
): Promise<V1alpha1RolloutList> {
  const rolloutList = new V1alpha1RolloutList();
  rolloutList.apiVersion = 'argoproj.io/v1alpha1';
  rolloutList.kind = 'RolloutList';
  rolloutList.items = new Array<V1alpha1Rollout>();

  return await paginatedNamespacedList(
    namespace,
    rolloutList,
    async (batchRequest: {
      namespace: string;
      pretty?: string;
      _allowWatchBookmarks?: boolean;
      _continue?: string;
      fieldSelector?: string;
      labelSelector?: string;
      limit?: number;
    }) =>
      k8sApi.customObjectsClient.listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: namespace,
        plural: 'rollouts',
        pretty: batchRequest.pretty,
        allowWatchBookmarks: false,
        _continue: batchRequest._continue,
        fieldSelector: batchRequest.fieldSelector,
        labelSelector: batchRequest.labelSelector,
        limit: batchRequest.limit,
        /**
         * The K8s client's listNamespacedCustomObject() doesn't allow to specify
         * the type of the response body and returns the generic "object" type,
         * but with how we declared our types we expect it to return a "KubernetesListObject" type.
         *
         * Not using "any" results in a similar error (highlighting the "body" property):
         * Type 'Promise<{ response: IncomingMessage; ***body: object;*** }>' is not assignable to type
         * 'Promise<{ response: IncomingMessage; ***body: KubernetesListObject<...>;*** }>'
         */
      }) as any,
  );
}

export async function paginatedClusterArgoRolloutList(): Promise<V1alpha1RolloutList> {
  const rolloutList = new V1alpha1RolloutList();
  rolloutList.apiVersion = 'argoproj.io/v1';
  rolloutList.kind = 'RolloutList';
  rolloutList.items = new Array<V1alpha1Rollout>();

  return await paginatedClusterList(
    rolloutList,
    async (clusterRequest: {
      _allowWatchBookmarks?: boolean;
      _continue?: string;
      fieldSelector?: string;
      labelSelector?: string;
      limit?: number;
      pretty?: string;
    }) =>
      k8sApi.customObjectsClient.listClusterCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        plural: 'rollouts',
        pretty: clusterRequest.pretty,
        allowWatchBookmarks: false,
        _continue: clusterRequest._continue,
        fieldSelector: clusterRequest.fieldSelector,
        labelSelector: clusterRequest.labelSelector,
        limit: clusterRequest.limit,
      }) as any,
  );
}

export async function argoRolloutWatchHandler(
  rollout: V1alpha1Rollout,
): Promise<void> {
  if (rollout.spec?.workloadRef && rollout.metadata?.namespace) {
    // Attempt to load workloadRef if a template is not directly defined
    const workloadName = rollout.spec.workloadRef.name;
    const namespace = rollout.metadata.namespace;
    switch (rollout.spec.workloadRef.kind) {
      // Perform lookup for known supported kinds: https://github.com/argoproj/argo-rollouts/blob/master/rollout/templateref.go#L40-L52
      case 'Deployment': {
        const deployResult = await retryKubernetesApiRequest(() =>
          k8sApi.appsClient.readNamespacedDeployment({
            name: workloadName,
            namespace,
          }),
        );
        rollout.spec.template = deployResult.spec?.template;
        break;
      }
      case 'ReplicaSet': {
        const replicaSetResult = await retryKubernetesApiRequest(() =>
          k8sApi.appsClient.readNamespacedReplicaSet({
            name: workloadName,
            namespace,
          }),
        );
        rollout.spec.template = replicaSetResult.spec?.template;
        break;
      }
      case 'PodTemplate': {
        const podTemplateResult = await retryKubernetesApiRequest(() =>
          k8sApi.coreClient.readNamespacedPodTemplate({
            name: workloadName,
            namespace,
          }),
        );
        rollout.spec.template = podTemplateResult.template;
        break;
      }
      default:
        logger.debug(
          { workloadKind: WorkloadKind.ArgoRollout },
          'Unsupported workloadRef kind specified',
        );
    }
  }
  rollout = trimWorkload(rollout);

  if (
    !rollout.metadata ||
    !rollout.spec?.template?.metadata ||
    !rollout.spec?.template?.spec ||
    !rollout.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(rollout);
  if (workloadAlreadyScanned !== undefined) {
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: rollout.spec.template.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
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
      k8sApi.customObjectsClient.listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: namespace,
        plural: 'rollouts',
        pretty: pretty,
        allowWatchBookmarks: false,
        _continue: continueToken,
        fieldSelector: fieldSelector,
        labelSelector: labelSelector,
        limit: limit,
        resourceVersion: resourceVersion,
        timeoutSeconds: timeoutSeconds,
      }),
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
      k8sApi.customObjectsClient.listClusterCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        plural: 'rollouts',
        pretty: pretty,
        allowWatchBookmarks: false,
        _continue: continueToken,
        fieldSelector: fieldSelector,
        labelSelector: labelSelector,
        limit: limit,
        resourceVersion: resourceVersion,
        timeoutSeconds: timeoutSeconds,
      }),
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
