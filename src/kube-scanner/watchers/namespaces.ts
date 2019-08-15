import * as k8s from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../common/config');
import logger = require('../../common/logger');
import { kubeConfig } from '../cluster';
import { cronJobWatchHandler } from './handlers/cron-job';
import { daemonSetWatchHandler } from './handlers/daemon-set';
import { deploymentWatchHandler } from './handlers/deployment';
import { jobWatchHandler } from './handlers/job';
import { podWatchHandler } from './handlers/pod';
import { replicaSetWatchHandler } from './handlers/replica-set';
import { replicationControllerWatchHandler } from './handlers/replication-controller';
import { statefulSetWatchHandler } from './handlers/stateful-set';
import { ILooseObject, WatchEventType } from './types';
import { WorkloadKind } from '../types';

const watches = {
};

const k8sWatch = new k8s.Watch(kubeConfig);

function deleteWatchesForNamespace(namespace: string) {
  logger.info({namespace}, 'Removing watch for namespace');

  if (watches[namespace] !== undefined) {
    try {
      watches[namespace].forEach((watch) => watch.abort());
      delete watches[namespace];
    } catch (error) {
      logger.error({error, namespace}, 'Could not stop watch for namespace');
    }
  }
}

function setupWatchesForNamespace(namespace: string) {
  logger.info({namespace}, 'Setting up namespace watch');
  const queryOptions = {};
  watches[namespace] = [
    k8sWatch.watch(`/api/v1/namespaces/${namespace}/pods`,
      queryOptions, podWatchHandler, watchEndHandler(namespace, WorkloadKind.Pod)),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/deployments`,
      queryOptions, deploymentWatchHandler, watchEndHandler(namespace, WorkloadKind.Deployment)),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/replicasets`,
      queryOptions, replicaSetWatchHandler, watchEndHandler(namespace, WorkloadKind.ReplicaSet)),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/daemonsets`,
      queryOptions, daemonSetWatchHandler, watchEndHandler(namespace, WorkloadKind.DaemonSet)),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/statefulsets`,
      queryOptions, statefulSetWatchHandler, watchEndHandler(namespace, WorkloadKind.StatefulSet)),
    k8sWatch.watch(`/apis/batch/v1beta1/watch/namespaces/${namespace}/cronjobs`,
      queryOptions, cronJobWatchHandler, watchEndHandler(namespace, WorkloadKind.CronJob)),
    k8sWatch.watch(`/apis/batch/v1/watch/namespaces/${namespace}/jobs`,
      queryOptions, jobWatchHandler, watchEndHandler(namespace, WorkloadKind.Job)),
    k8sWatch.watch(`/api/v1/watch/namespaces/${namespace}/replicationcontrollers`,
      queryOptions, replicationControllerWatchHandler, watchEndHandler(namespace, WorkloadKind.ReplicationController)),
  ];
}

export function beginWatchingWorkloads() {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  const queryOptions = {};
  k8sWatch.watch(`/api/v1/namespaces`,
    queryOptions,
    (eventType: string, namespace: V1Namespace) => {
      try {
        const namespaceName = extractNamespaceName(namespace);
        if (isKubernetesInternalNamespace(namespaceName)) {
          // disregard namespaces internal to kubernetes
          logger.info({namespaceName}, 'ignoring blacklisted namespace');
          return;
        }

        if (eventType === WatchEventType.Added) {
          setupWatchesForNamespace(namespaceName);
        } else if (eventType === WatchEventType.Deleted) {
          deleteWatchesForNamespace(namespaceName);
        }
      } catch (err) {
        logger.error({err, eventType, namespace}, 'error handling a namespace event');
      }
    },
    watchEndHandler('all namespaces', 'all namespaces'),
  );
}

function watchEndHandler(namespace: string, resourceWatched: string): (err: string) => void {
  const logContext: ILooseObject = {namespace, resourceWatched};
  return function(optionalError) {
    const logMsg = 'watch ended';
    if (optionalError) {
      logContext.error = optionalError;
      logger.error(logContext, logMsg);
      return;
    }
    logger.info(logContext, logMsg);
  };
}

export function extractNamespaceName(namespace: V1Namespace): string {
  if (namespace && namespace.metadata && namespace.metadata.name) {
    return namespace.metadata.name;
  }
  throw new Error('Namespace missing metadata.name');
}

export function isKubernetesInternalNamespace(namespace: string): boolean {
  const kubernetesInternalNamespaces = [
    'kube-node-lease',
    'kube-public',
    'kube-system',
  ];

  return kubernetesInternalNamespaces.includes(namespace);
}
