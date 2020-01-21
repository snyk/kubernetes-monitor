import { makeInformer, ADD, DELETE, UPDATE, ERROR, KubernetesObject } from '@kubernetes/client-node';
import logger = require('../../../common/logger');
import { WorkloadKind } from '../../types';
import { k8sApi, kubeConfig } from '../../cluster';
import { IWorkloadWatchMetadata, FALSY_WORKLOAD_NAME_MARKER } from './types';

import { podWatchHandler, podDeletedHandler, podErrorHandler } from './pod';
import { cronJobWatchHandler, cronJobErrorHandler } from './cron-job';
import { daemonSetWatchHandler, daemonSetErrorHandler } from './daemon-set';
import { deploymentWatchHandler, deploymentErrorHandler } from './deployment';
import { jobWatchHandler, jobErrorHandler } from './job';
import { replicaSetWatchHandler, replicaSetErrorHandler } from './replica-set';
import { replicationControllerWatchHandler, replicationControllerErrorHandler } from './replication-controller';
import { statefulSetWatchHandler, statefulSetErrorHandler } from './stateful-set';

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
      [ERROR]: podErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.coreClient.listNamespacedPod(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    endpoint: '/api/v1/watch/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationControllerWatchHandler,
      [ERROR]: replicationControllerErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.coreClient.listNamespacedReplicationController(namespace),
  },
  [WorkloadKind.CronJob]: {
    endpoint: '/apis/batch/v1beta1/watch/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJobWatchHandler,
      [ERROR]: cronJobErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.batchUnstableClient.listNamespacedCronJob(namespace),
  },
  [WorkloadKind.Job]: {
    endpoint: '/apis/batch/v1/watch/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: jobWatchHandler,
      [ERROR]: jobErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.batchClient.listNamespacedJob(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSetWatchHandler,
      [ERROR]: daemonSetErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.appsClient.listNamespacedDaemonSet(namespace),
  },
  [WorkloadKind.Deployment]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deploymentWatchHandler,
      [ERROR]: deploymentErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.appsClient.listNamespacedDeployment(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSetWatchHandler,
      [ERROR]: replicaSetErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.appsClient.listNamespacedReplicaSet(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    endpoint: '/apis/apps/v1/watch/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSetWatchHandler,
      [ERROR]: statefulSetErrorHandler,
    },
    listFactory: (namespace) => () => k8sApi.appsClient.listNamespacedStatefulSet(namespace),
  },
};

export function setupInformer(namespace: string, workloadKind: WorkloadKind) {
  const workloadMetadata = workloadWatchMetadata[workloadKind];
  const namespacedEndpoint = workloadMetadata.endpoint.replace('{namespace}', namespace);

  const informer = makeInformer<KubernetesObject>(kubeConfig, namespacedEndpoint,
    workloadMetadata.listFactory(namespace));

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(informerVerb, async (watchedWorkload) => {
      try {
        await workloadMetadata.handlers[informerVerb](watchedWorkload);
      } catch (error) {
        const name = watchedWorkload.metadata && watchedWorkload.metadata.name || FALSY_WORKLOAD_NAME_MARKER;
        logger.warn({error, namespace, name, workloadKind}, 'could not execute the informer handler for a workload');
      }
    });
  }

  informer.start();
}
