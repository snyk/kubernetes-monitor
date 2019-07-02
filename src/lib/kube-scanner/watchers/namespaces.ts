import * as k8s from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../../common/config');
import { kubeConfig } from '../cluster';
import { podWatchHandler } from './handlers';
import { WatchEventType } from './types';

const watches = {
};

const k8sWatch = new k8s.Watch(kubeConfig);

function deleteWatchesForNamespace(namespace: string) {
  console.log(`Stopping watching for changes to namespace ${namespace}`);

  if (watches[namespace] !== undefined) {
    try {
      watches[namespace].abort();
      delete watches[namespace];
    } catch (error) {
      console.log(`Error: could not stop watch for namespace ${namespace}`);
    }
  }
}

function setupWatchesForNamespace(namespace: string) {
  console.log(`Attempting to watch for changes to namespace ${namespace}...`);
  const queryOptions = {};
  watches[namespace] = k8sWatch.watch(`/api/v1/namespaces/${namespace}/pods`,
    queryOptions, podWatchHandler, (error) => {
      const errorMessage = error.message ? error.message : error;
      console.log(`An error occurred during Pod watch: ${errorMessage}`);
    });
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
