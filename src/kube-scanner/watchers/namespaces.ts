import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../common/config');
import logger = require('../../common/logger');
import { WatchEventType, ILooseObject, ITrackedWatches } from './types';
import { IWatchHandlerOptions, WatchedKubernetesObject, IWatchSetupTracker } from './handlers/types';
import { setupDeploymentWatch, setupReplicaSetWatch, setupStatefulSetWatch,
  setupDaemonSetWatch, setupJobWatch, setupCronJobWatch, setupReplicationControllerWatch,
  setupPodWatch, setupNamespacesWatch } from './handlers';

const workloadWatchSetters: IWatchSetupTracker = {
  [WatchedKubernetesObject.Deployment]: setupDeploymentWatch,
  [WatchedKubernetesObject.ReplicaSet]: setupReplicaSetWatch,
  [WatchedKubernetesObject.StatefulSet]: setupStatefulSetWatch,
  [WatchedKubernetesObject.DaemonSet]: setupDaemonSetWatch,
  [WatchedKubernetesObject.Job]: setupJobWatch,
  [WatchedKubernetesObject.CronJob]: setupCronJobWatch,
  [WatchedKubernetesObject.ReplicationController]: setupReplicationControllerWatch,
  [WatchedKubernetesObject.Pod]: setupPodWatch,
  [WatchedKubernetesObject.AllNamespaces]: setupNamespacesWatch,
};

const trackedNamespaceWatches: ITrackedWatches = {};

function restartingWatchEndHandler(watchOptions: IWatchHandlerOptions): (err: string) => void {
  const { namespace, resourceWatched } = watchOptions;
  const logContext: ILooseObject = {namespace, resourceWatched};

  if (resourceWatched === undefined) {
    throw new Error('Missing watched resource type');
  }

  return function(optionalError) {
    const logMsg = 'watch ended';

    if (optionalError) {
      logContext.error = optionalError;
      logger.error(logContext, logMsg);
      return;
    }

    logger.info(logContext, logMsg);

    try {
      logger.info(logContext, 'attempting to restart watch');
      createAndTrackWatch(trackedNamespaceWatches, namespace, resourceWatched, watchOptions);
    } catch (error) {
      logContext.error = error;
      logger.error(logContext, 'could not restart watch');
    }
  };
}

export function namespaceWatchHandler(eventType: string, namespace: V1Namespace) {
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
}

function createAndTrackWatch(
  trackedWatches: ITrackedWatches,
  namespace: string,
  resourceWatched: WatchedKubernetesObject,
  watchOptions: IWatchHandlerOptions,
) {
  if (trackedWatches[namespace] === undefined) {
    trackedWatches[namespace] = {};
  }

  trackedWatches[namespace][resourceWatched] = workloadWatchSetters[resourceWatched](watchOptions);
}

function deleteWatchesForNamespace(namespace: string) {
  if (trackedNamespaceWatches[namespace] === undefined) {
    return;
  }

  logger.info({namespace}, 'deleting namespace watch');

  const watches = trackedNamespaceWatches[namespace];

  for (const watchKind of Object.keys(watches)) {
    const watch = watches[watchKind];
    try {
      watch.abort();
    } catch (error) {
      logger.error({ error, namespace, watchKind }, 'could not abort watch for namespace');
    }
  }

  delete trackedNamespaceWatches[namespace];
}

function setupWatchesForNamespace(namespace: string) {
  // This attempts to delete any existing watches; we want to abort & override current watches
  // if we have to set up a new one!
  deleteWatchesForNamespace(namespace);

  logger.info({namespace}, 'Setting up namespace watch');

  for (const watchKind of Object.values(WatchedKubernetesObject)) {
    const workloadKind = watchKind as WatchedKubernetesObject;

    // do not process a cluster watch
    if (workloadKind === WatchedKubernetesObject.AllNamespaces) {
      continue;
    }

    const watchHandlerOptions: IWatchHandlerOptions = {
      namespace,
      resourceWatched: workloadKind,
      watchEndHandler: restartingWatchEndHandler,
    };

    createAndTrackWatch(trackedNamespaceWatches, namespace, workloadKind, watchHandlerOptions);
  }
}

function setupWatchesForCluster() {
  const namespace = 'all namespaces';
  const resourceWatched = WatchedKubernetesObject.AllNamespaces;

  const watchHandlerOptions: IWatchHandlerOptions = {
    namespace,
    resourceWatched,
    watchEndHandler: restartingWatchEndHandler,
  };

  createAndTrackWatch(trackedNamespaceWatches, namespace, resourceWatched, watchHandlerOptions);
}

export function beginWatchingWorkloads() {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  setupWatchesForCluster();
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
