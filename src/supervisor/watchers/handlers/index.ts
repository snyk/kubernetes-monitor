import {
  makeInformer,
  ADD,
  DELETE,
  ERROR,
  UPDATE,
  KubernetesObject,
  BatchV1beta1Api,
  BatchV1Api,
} from '@kubernetes/client-node';

import { logger } from '../../../common/logger';
import { WorkloadKind } from '../../types';
import {
  podWatchHandler,
  podDeletedHandler,
  paginatedNamespacedPodList,
  paginatedClusterPodList,
} from './pod';
import {
  cronJobWatchHandler,
  paginatedClusterCronJobList,
  paginatedClusterCronJobV1Beta1List,
  paginatedNamespacedCronJobList,
  paginatedNamespacedCronJobV1Beta1List,
} from './cron-job';
import {
  daemonSetWatchHandler,
  paginatedClusterDaemonSetList,
  paginatedNamespacedDaemonSetList,
} from './daemon-set';
import {
  deploymentWatchHandler,
  paginatedClusterDeploymentList,
  paginatedNamespacedDeploymentList,
} from './deployment';
import {
  jobWatchHandler,
  paginatedClusterJobList,
  paginatedNamespacedJobList,
} from './job';
import {
  paginatedClusterReplicaSetList,
  paginatedNamespacedReplicaSetList,
  replicaSetWatchHandler,
} from './replica-set';
import {
  paginatedClusterReplicationControllerList,
  paginatedNamespacedReplicationControllerList,
  replicationControllerWatchHandler,
} from './replication-controller';
import {
  paginatedClusterStatefulSetList,
  paginatedNamespacedStatefulSetList,
  statefulSetWatchHandler,
} from './stateful-set';
import {
  deploymentConfigWatchHandler,
  paginatedClusterDeploymentConfigList,
  paginatedNamespacedDeploymentConfigList,
} from './deployment-config';
import { k8sApi, kubeConfig } from '../../cluster';
import * as kubernetesApiWrappers from '../../kuberenetes-api-wrappers';
import { IWorkloadWatchMetadata, FALSY_WORKLOAD_NAME_MARKER } from './types';
import { RETRYABLE_NETWORK_ERRORS } from '../types';
import { isExcludedNamespace } from '..';

/**
 * This map is used in combination with the kubernetes-client Informer API
 * to abstract which resources to watch, what their endpoint is, how to grab
 * a list of the resources, and which watch actions to handle (e.g. a newly added resource).
 *
 * The Informer API is just a wrapper around Kubernetes watches that makes sure the watch
 * gets restarted if it dies and it also efficiently tracks changes to the watched workloads
 * by comparing their resourceVersion.
 *
 * The map is keyed by the "WorkloadKind" -- the type of resource we want to watch.
 * Legal verbs for the "handlers" are pulled from '@kubernetes/client-node'. You can
 * set a different handler for every verb.
 * (e.g. ADD-ed workloads are processed differently than DELETE-d ones)
 *
 * The "listFunc" is a callback used by the kubernetes-client to grab the watched resource
 * whenever Kubernetes fires a "workload changed" event and it uses the result to figure out
 * if the workload actually changed (by inspecting the resourceVersion).
 */
const workloadWatchMetadata: Readonly<IWorkloadWatchMetadata> = {
  [WorkloadKind.Pod]: {
    clusterEndpoint: '/api/v1/pods',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/pods',
    handlers: {
      [ADD]: podWatchHandler,
      [UPDATE]: podWatchHandler,
      [DELETE]: podDeletedHandler,
    },
    clusterListFactory: () => () => paginatedClusterPodList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedPodList(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    clusterEndpoint: '/api/v1/replicationcontrollers',
    namespacedEndpoint:
      '/api/v1/watch/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationControllerWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterReplicationControllerList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedReplicationControllerList(namespace),
  },
  [WorkloadKind.CronJob]: {
    clusterEndpoint: '/apis/batch/v1/cronjobs',
    namespacedEndpoint: '/apis/batch/v1/watch/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJobWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterCronJobList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedCronJobList(namespace),
  },
  [WorkloadKind.CronJobV1Beta1]: {
    clusterEndpoint: '/apis/batch/v1beta1/cronjobs',
    namespacedEndpoint:
      '/apis/batch/v1beta1/watch/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJobWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterCronJobV1Beta1List(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedCronJobV1Beta1List(namespace),
  },
  [WorkloadKind.Job]: {
    clusterEndpoint: '/apis/batch/v1/jobs',
    namespacedEndpoint: '/apis/batch/v1/watch/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: jobWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterJobList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedJobList(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    clusterEndpoint: '/apis/apps/v1/daemonsets',
    namespacedEndpoint: '/apis/apps/v1/watch/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSetWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterDaemonSetList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedDaemonSetList(namespace),
  },
  [WorkloadKind.Deployment]: {
    clusterEndpoint: '/apis/apps/v1/deployments',
    namespacedEndpoint:
      '/apis/apps/v1/watch/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deploymentWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterDeploymentList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedDeploymentList(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    clusterEndpoint: '/apis/apps/v1/replicasets',
    namespacedEndpoint:
      '/apis/apps/v1/watch/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSetWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterReplicaSetList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedReplicaSetList(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    clusterEndpoint: '/apis/apps/v1/statefulsets',
    namespacedEndpoint:
      '/apis/apps/v1/watch/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSetWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterStatefulSetList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedStatefulSetList(namespace),
  },
  [WorkloadKind.DeploymentConfig]: {
    clusterEndpoint: '/apis/apps.openshift.io/v1/deploymentconfigs',
    /** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
    namespacedEndpoint:
      '/apis/apps.openshift.io/v1/watch/namespaces/{namespace}/deploymentconfigs',
    handlers: {
      [DELETE]: deploymentConfigWatchHandler,
    },
    clusterListFactory: () => () => paginatedClusterDeploymentConfigList(),
    namespacedListFactory: (namespace) => () =>
      paginatedNamespacedDeploymentConfigList(namespace),
  },
};

export const WATCH_WHOLE_CLUSTER = '';

async function isSupportedNamespacedWorkload(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<boolean> {
  switch (workloadKind) {
    case WorkloadKind.DeploymentConfig:
      return await isNamespacedDeploymentConfigSupported(namespace);
    case WorkloadKind.CronJobV1Beta1:
      return await isNamespacedCronJobSupported(
        workloadKind,
        namespace,
        k8sApi.batchUnstableClient,
      );
    case WorkloadKind.CronJob:
      return await isNamespacedCronJobSupported(
        workloadKind,
        namespace,
        k8sApi.batchClient,
      );
    default:
      return true;
  }
}

async function isSupportedClusterWorkload(
  workloadKind: WorkloadKind,
): Promise<boolean> {
  switch (workloadKind) {
    case WorkloadKind.DeploymentConfig:
      return await isClusterDeploymentConfigSupported();
    case WorkloadKind.CronJobV1Beta1:
      return await isClusterCronJobSupported(
        workloadKind,
        k8sApi.batchUnstableClient,
      );
    case WorkloadKind.CronJob:
      return await isClusterCronJobSupported(workloadKind, k8sApi.batchClient);
    default:
      return true;
  }
}

async function isNamespacedCronJobSupported(
  workloadKind: WorkloadKind,
  namespace: string,
  client: BatchV1Api | BatchV1beta1Api,
): Promise<boolean> {
  try {
    const pretty = undefined;
    const allowWatchBookmarks = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const resourceVersionMatch = undefined;
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall =
      await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        client.listNamespacedCronJob(
          namespace,
          pretty,
          allowWatchBookmarks,
          continueToken,
          fieldSelector,
          labelSelector,
          limit,
          resourceVersion,
          resourceVersionMatch,
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
      { error, workloadKind: workloadKind },
      'Failed on Kubernetes API call to list CronJob or v1beta1 CronJob',
    );
    return false;
  }
}

async function isClusterCronJobSupported(
  workloadKind: WorkloadKind,
  client: BatchV1Api | BatchV1beta1Api,
): Promise<boolean> {
  try {
    const pretty = undefined;
    const allowWatchBookmarks = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const resourceVersionMatch = undefined;
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall =
      await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        client.listCronJobForAllNamespaces(
          allowWatchBookmarks,
          continueToken,
          fieldSelector,
          labelSelector,
          limit,
          pretty,
          resourceVersion,
          resourceVersionMatch,
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
      { error, workloadKind: workloadKind },
      'Failed on Kubernetes API call to list CronJob or v1beta1 CronJob',
    );
    return false;
  }
}

async function isNamespacedDeploymentConfigSupported(
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
    const attemptedApiCall =
      await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        k8sApi.customObjectsClient.listNamespacedCustomObject(
          'apps.openshift.io',
          'v1',
          namespace,
          'deploymentconfigs',
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
      { error, workloadKind: WorkloadKind.DeploymentConfig },
      'Failed on Kubernetes API call to list DeploymentConfig',
    );
    return false;
  }
}

async function isClusterDeploymentConfigSupported(): Promise<boolean> {
  try {
    const pretty = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall =
      await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        k8sApi.customObjectsClient.listClusterCustomObject(
          'apps.openshift.io',
          'v1',
          'deploymentconfigs',
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
      { error, workloadKind: WorkloadKind.DeploymentConfig },
      'Failed on Kubernetes API call to list DeploymentConfig',
    );
    return false;
  }
}

export async function setupInformer(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<void> {
  const shouldWatchCluster = namespace === WATCH_WHOLE_CLUSTER;
  const logContext: Record<string, unknown> = { namespace, workloadKind };
  const isSupported = shouldWatchCluster
    ? await isSupportedClusterWorkload(workloadKind)
    : await isSupportedNamespacedWorkload(namespace, workloadKind);
  if (!isSupported) {
    logger.debug(
      logContext,
      'The Kubernetes cluster does not support this workload',
    );
    return;
  }

  const workloadMetadata = workloadWatchMetadata[workloadKind];
  const endpoint = shouldWatchCluster
    ? workloadMetadata.clusterEndpoint
    : workloadMetadata.namespacedEndpoint.replace('{namespace}', namespace);

  const listMethod = shouldWatchCluster
    ? workloadMetadata.clusterListFactory()
    : workloadMetadata.namespacedListFactory(namespace);
  const loggedListMethod = async () => {
    try {
      return await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        listMethod(),
      );
    } catch (err) {
      logger.error(
        { ...logContext, err },
        'error while listing entities on namespace',
      );
      throw err;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    endpoint,
    loggedListMethod,
  );

  informer.on(ERROR, (err) => {
    // Types from client library insists that callback is of type KubernetesObject
    const code = (err as any).code || '';
    if (RETRYABLE_NETWORK_ERRORS.includes(code)) {
      logger.debug(
        logContext,
        `informer ${code} occurred, restarting informer`,
      );

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error(
        { ...logContext, err },
        'unexpected informer error event occurred',
      );
    }
  });

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(informerVerb, async (watchedWorkload) => {
      try {
        if (isExcludedNamespace(watchedWorkload.metadata?.namespace || '')) {
          return;
        }

        await workloadMetadata.handlers[informerVerb](watchedWorkload);
      } catch (error) {
        const name =
          (watchedWorkload.metadata && watchedWorkload.metadata.name) ||
          FALSY_WORKLOAD_NAME_MARKER;
        logger.warn(
          { ...logContext, error, name },
          'could not execute the informer handler for a workload',
        );
      }
    });
  }

  await informer.start();
}
