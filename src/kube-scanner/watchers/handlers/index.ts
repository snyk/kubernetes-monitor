import { makeInformer, Informer, ADD, DELETE, UPDATE, KubernetesObject } from '@kubernetes/client-node';
import logger = require('../../../common/logger');
import WorkloadWorker = require('../../../kube-scanner');
import { buildWorkloadMetadata } from '../../metadata-extractor';
import { KubeObjectMetadata, WorkloadKind } from '../../types';
import { podWatchHandler } from './pod';
import { cronJobWatchHandler } from './cron-job';
import { daemonSetWatchHandler } from './daemon-set';
import { deploymentWatchHandler } from './deployment';
import { jobWatchHandler } from './job';
import { replicaSetWatchHandler } from './replica-set';
import { replicationControllerWatchHandler } from './replication-controller';
import { statefulSetWatchHandler } from './stateful-set';
import { k8sApi, kubeConfig } from '../../cluster';
import { IWorkloadWatchMetadata } from './types';

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
export const workloadWatchMetadata: Readonly<IWorkloadWatchMetadata> = {
  [WorkloadKind.Pod]: {
    endpoint: '/api/v1/namespaces/{namespace}/pods',
    handlers: {
      [ADD]: podWatchHandler,
      [UPDATE]: podWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.coreClient.listNamespacedPod(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    endpoint: '/api/v1/watch/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationControllerWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.coreClient.listNamespacedReplicationController(namespace),
  },
  [WorkloadKind.CronJob]: {
    endpoint: '/apis/batch/v1beta1/watch/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJobWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.batchUnstableClient.listNamespacedCronJob(namespace),
  },
  [WorkloadKind.Job]: {
    endpoint: '/apis/batch/v1/watch/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: jobWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.batchClient.listNamespacedJob(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSetWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.appsClient.listNamespacedDaemonSet(namespace),
  },
  [WorkloadKind.Deployment]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deploymentWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.appsClient.listNamespacedDeployment(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSetWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.appsClient.listNamespacedReplicaSet(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSetWatchHandler,
    },
    listFunc: (namespace) => () => k8sApi.appsClient.listNamespacedStatefulSet(namespace),
  },
};

export function setupInformer<T extends KubernetesObject>(
    namespace: string, workloadKind: WorkloadKind,
): Informer<T> | undefined {
  const workloadMetadata = workloadWatchMetadata[workloadKind];
  const namespacedEndpoint = workloadMetadata.endpoint.replace('{namespace}', namespace);
  const informer = makeInformer<T>(kubeConfig, namespacedEndpoint, workloadMetadata.listFunc(namespace));

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(informerVerb, async (watchedWorkload) => {
      try {
        await workloadMetadata.handlers[informerVerb](watchedWorkload);
      } catch (error) {
        logger.warn({error, namespace, workloadKind}, 'could not execute the informer handler for a workload');
      }
    });
  }

  informer.start();

  return informer;
}

export async function deleteWorkload(kubernetesMetadata: KubeObjectMetadata, logId: string) {
  try {
    if (kubernetesMetadata.ownerRefs !== undefined && kubernetesMetadata.ownerRefs.length > 0) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);
    const workloadWorker = new WorkloadWorker(logId);
    await workloadWorker.delete(localWorkloadLocator);
  } catch (error) {
    logger.error({error, resourceType: kubernetesMetadata.kind, resourceName: kubernetesMetadata.objectMeta.name},
      'Could not delete workload');
  }
}
