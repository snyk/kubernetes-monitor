import {
  makeInformer,
  ADD,
  DELETE,
  ERROR,
  UPDATE,
  KubernetesObject,
} from '@kubernetes/client-node';

import { logger } from '../../../common/logger';
import { WorkloadKind } from '../../types';
import { podWatchHandler, podDeletedHandler, paginatedPodList } from './pod';
import { cronJobWatchHandler, paginatedCronJobList } from './cron-job';
import { daemonSetWatchHandler, paginatedDaemonSetList } from './daemon-set';
import { deploymentWatchHandler, paginatedDeploymentList } from './deployment';
import { jobWatchHandler, paginatedJobList } from './job';
import { paginatedReplicaSetList, replicaSetWatchHandler } from './replica-set';
import {
  paginatedReplicationControllerList,
  replicationControllerWatchHandler,
} from './replication-controller';
import {
  paginatedStatefulSetList,
  statefulSetWatchHandler,
} from './stateful-set';
import {
  deploymentConfigWatchHandler,
  paginatedDeploymentConfigList,
} from './deployment-config';
import { k8sApi, kubeConfig } from '../../cluster';
import * as kubernetesApiWrappers from '../../kuberenetes-api-wrappers';
import { IWorkloadWatchMetadata, FALSY_WORKLOAD_NAME_MARKER } from './types';
import { ECONNRESET_ERROR_CODE } from '../types';

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
    endpoint: '/api/v1/namespaces/{namespace}/pods',
    handlers: {
      [ADD]: podWatchHandler,
      [UPDATE]: podWatchHandler,
      [DELETE]: podDeletedHandler,
    },
    listFactory: (namespace) => () => paginatedPodList(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    endpoint: '/api/v1/watch/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationControllerWatchHandler,
    },
    listFactory: (namespace) => () =>
      paginatedReplicationControllerList(namespace),
  },
  [WorkloadKind.CronJob]: {
    endpoint: '/apis/batch/v1beta1/watch/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJobWatchHandler,
    },
    listFactory: (namespace) => () => paginatedCronJobList(namespace),
  },
  [WorkloadKind.Job]: {
    endpoint: '/apis/batch/v1/watch/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: jobWatchHandler,
    },
    listFactory: (namespace) => () => paginatedJobList(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSetWatchHandler,
    },
    listFactory: (namespace) => () => paginatedDaemonSetList(namespace),
  },
  [WorkloadKind.Deployment]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deploymentWatchHandler,
    },
    listFactory: (namespace) => () => paginatedDeploymentList(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSetWatchHandler,
    },
    listFactory: (namespace) => () => paginatedReplicaSetList(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSetWatchHandler,
    },
    listFactory: (namespace) => () => paginatedStatefulSetList(namespace),
  },
  [WorkloadKind.DeploymentConfig]: {
    /** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
    endpoint:
      '/apis/apps.openshift.io/v1/watch/namespaces/{namespace}/deploymentconfigs',
    handlers: {
      [DELETE]: deploymentConfigWatchHandler,
    },
    listFactory: (namespace) => () => paginatedDeploymentConfigList(namespace),
  },
};

async function isSupportedWorkload(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<boolean> {
  if (workloadKind !== WorkloadKind.DeploymentConfig) {
    return true;
  }

  try {
    const pretty = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const allowWatchBookmarks = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const resourceVersionMatch = undefined;
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall =
      await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        k8sApi.customObjectsClient.listNamespacedCustomObject(
          'apps.openshift.io',
          'v1',
          namespace,
          'deploymentconfigs',
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
    logger.info(
      { error, workloadKind },
      'Failed on Kubernetes API call to list DeploymentConfig',
    );
    return false;
  }
}

export async function setupInformer(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<void> {
  const isSupported = await isSupportedWorkload(namespace, workloadKind);
  if (!isSupported) {
    logger.info(
      { namespace, workloadKind },
      'The Kubernetes cluster does not support this workload',
    );
    return;
  }

  const workloadMetadata = workloadWatchMetadata[workloadKind];
  const namespacedEndpoint = workloadMetadata.endpoint.replace(
    '{namespace}',
    namespace,
  );

  const listMethod = workloadMetadata.listFactory(namespace);
  const loggedListMethod = async () => {
    try {
      return await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        listMethod(),
      );
    } catch (err) {
      logger.error(
        { err, namespace, workloadKind },
        'error while listing entities on namespace',
      );
      throw err;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    namespacedEndpoint,
    loggedListMethod,
  );

  informer.on(ERROR, (err) => {
    // Types from client library insists that callback is of type KubernetesObject
    if ((err as any).code === ECONNRESET_ERROR_CODE) {
      logger.debug(
        {},
        `informer ${ECONNRESET_ERROR_CODE} occurred, restarting informer`,
      );

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error({ err }, 'unexpected informer error event occurred');
    }
  });

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(informerVerb, async (watchedWorkload) => {
      try {
        await workloadMetadata.handlers[informerVerb](watchedWorkload);
      } catch (error) {
        const name =
          (watchedWorkload.metadata && watchedWorkload.metadata.name) ||
          FALSY_WORKLOAD_NAME_MARKER;
        logger.warn(
          { error, namespace, name, workloadKind },
          'could not execute the informer handler for a workload',
        );
      }
    });
  }

  await informer.start();
}
