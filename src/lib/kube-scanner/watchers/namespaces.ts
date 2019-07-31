import * as k8s from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../../common/config');
import logger = require('../../../common/logger');
import { kubeConfig } from '../cluster';
import { cronJobWatchHandler } from './handlers/cron-job';
import { daemonSetWatchHandler } from './handlers/daemon-set';
import { deploymentWatchHandler } from './handlers/deployment';
import { jobWatchHandler } from './handlers/job';
import { podWatchHandler } from './handlers/pod';
import { replicaSetWatchHandler } from './handlers/replica-set';
import { replicationControllerWatchHandler } from './handlers/replication-controller';
import { statefulSetWatchHandler } from './handlers/stateful-set';
import { WatchEventType } from './types';

const watches = {
};

const k8sWatch = new k8s.Watch(kubeConfig);

function genericErrorHandler(error) {
  logger.error({error}, 'An error occurred during Pod watch');
}

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
  // Here we register Watches for all workloads within the namespace.
  logger.info({namespace}, 'Setting up namespace watch');
  const queryOptions = {};
  watches[namespace] = [
    k8sWatch.watch(`/api/v1/namespaces/${namespace}/pods`,
      queryOptions, podWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/deployments`,
      queryOptions, deploymentWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/replicasets`,
      queryOptions, replicaSetWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/daemonsets`,
      queryOptions, daemonSetWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/apps/v1/watch/namespaces/${namespace}/statefulsets`,
      queryOptions, statefulSetWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/batch/v1beta1/watch/namespaces/${namespace}/cronjobs`,
      queryOptions, cronJobWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/apis/batch/v1/watch/namespaces/${namespace}/jobs`,
      queryOptions, jobWatchHandler, genericErrorHandler),
    k8sWatch.watch(`/api/v1/watch/namespaces/${namespace}/replicationcontrollers`,
      queryOptions, replicationControllerWatchHandler, genericErrorHandler),
  ];
}

export function beginWatchingWorkloads() {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  // The snyk-monitor is configured to listen to the whole cluster.
  // Start watching for changes to the namespaces in the cluster.
  // When a new namespace appears, attach the workload Watches to it.
  // (Also, delete the Watch once the namespace disappears)
  const queryOptions = {};
  k8sWatch.watch(`/api/v1/namespaces`,
    queryOptions,
    (eventType: string, namespace: V1Namespace) => {
      if (!namespace.metadata || namespace.metadata.name === undefined ||
          namespace.metadata.name.startsWith('kube')) {
        return;
      }

      if (eventType === WatchEventType.Added) {
        setupWatchesForNamespace(namespace.metadata.name);
      } else if (eventType === WatchEventType.Deleted) {
        deleteWatchesForNamespace(namespace.metadata.name);
      }
    },
    (error) => {
      logger.error({error}, 'An error occurred while watching for all namespace changes');
    },
  );
}
