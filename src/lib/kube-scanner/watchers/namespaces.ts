import * as k8s from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../../common/config');
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
  const errorMessage = error.message ? error.message : error;
  console.log(`An error occurred during Pod watch: ${errorMessage}`);
}

function deleteWatchesForNamespace(namespace: string) {
  console.log(`Stopping watching for changes to namespace ${namespace}`);

  if (watches[namespace] !== undefined) {
    try {
      watches[namespace].forEach((watch) => watch.abort());
      delete watches[namespace];
    } catch (error) {
      console.log(`Error: could not stop watch for namespace ${namespace}`);
    }
  }
}

function setupWatchesForNamespace(namespace: string) {
  console.log(`Attempting to watch for changes to namespace ${namespace}...`);
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
  console.log(`Watching for changes to namespace ${namespace}`);
}

export function beginWatchingWorkloads() {
  if (config.NAMESPACE) {
    console.log(`The kubernetes-monitor is restricted to the ${config.NAMESPACE} namespace.`);
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  const queryOptions = {};
  k8sWatch.watch(`/api/v1/namespaces`,
    queryOptions,
    (eventType: string, namespace: V1Namespace) => {
      if (namespace.metadata.name.startsWith('kube')) {
        return;
      }

      if (eventType === WatchEventType.Added) {
        setupWatchesForNamespace(namespace.metadata.name);
      } else if (eventType === WatchEventType.Deleted) {
        deleteWatchesForNamespace(namespace.metadata.name);
      }
    },
    (error) => {
      const errorMessage = error.message ? error.message : error;
      console.log(`An error occurred while watching for all namespace changes: ${errorMessage}`);
    },
  );
}
