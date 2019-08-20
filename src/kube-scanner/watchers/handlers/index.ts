import { deleteWorkload, WorkloadWorker } from '../../index';
import { IWatchHandlerTracker, WatchedKubernetesObject, IWatchHandlerOptions } from './types';
import { cronJobWatchHandler } from './cron-job';
import { jobWatchHandler } from './job';
import { statefulSetWatchHandler } from './stateful-set';
import { replicaSetWatchHandler } from './replica-set';
import { replicationControllerWatchHandler } from './replication-controller';
import { podWatchHandler } from './pod';
import { deploymentWatchHandler } from './deployment';
import { daemonSetWatchHandler } from './daemon-set';
import { namespaceWatchHandler } from '../namespaces';
import { Watch, KubeConfig } from '@kubernetes/client-node';
import { Request } from 'request';

const watchHandlers: IWatchHandlerTracker = {
  [WatchedKubernetesObject.CronJob]: cronJobWatchHandler,
  [WatchedKubernetesObject.Job]: jobWatchHandler,
  [WatchedKubernetesObject.StatefulSet]: statefulSetWatchHandler,
  [WatchedKubernetesObject.ReplicaSet]: replicaSetWatchHandler,
  [WatchedKubernetesObject.ReplicationController]: replicationControllerWatchHandler,
  [WatchedKubernetesObject.Pod]: podWatchHandler,
  [WatchedKubernetesObject.Deployment]: deploymentWatchHandler,
  [WatchedKubernetesObject.DaemonSet]: daemonSetWatchHandler,
};

export function setupCronJobWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/batch/v1beta1/watch/namespaces/${namespace}/cronjobs`,
    WatchedKubernetesObject.CronJob, watchOptions);
}

export function setupDaemonSetWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/apps/v1/watch/namespaces/${namespace}/daemonsets`,
    WatchedKubernetesObject.DaemonSet, watchOptions);
}

export function setupDeploymentWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/apps/v1/watch/namespaces/${namespace}/deployments`,
    WatchedKubernetesObject.Deployment, watchOptions);
}

export function setupJobWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/batch/v1/watch/namespaces/${namespace}/jobs`,
    WatchedKubernetesObject.Job, watchOptions);
}

export function setupPodWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/api/v1/namespaces/${namespace}/pods`,
    WatchedKubernetesObject.Pod, watchOptions);
}

export function setupReplicaSetWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/apps/v1/watch/namespaces/${namespace}/replicasets`,
    WatchedKubernetesObject.ReplicaSet, watchOptions);
}

export function setupReplicationControllerWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/api/v1/watch/namespaces/${namespace}/replicationcontrollers`,
    WatchedKubernetesObject.ReplicationController, watchOptions);
}

export function setupStatefulSetWatch(watchOptions: IWatchHandlerOptions): Request {
  const { namespace } = watchOptions;
  return setupWatch(`/apis/apps/v1/watch/namespaces/${namespace}/statefulsets`,
    WatchedKubernetesObject.StatefulSet, watchOptions);
}

export function setupNamespacesWatch(watchOptions: IWatchHandlerOptions): Request {
  const queryOptions = {};
  const resourceWatched = WatchedKubernetesObject.AllNamespaces;
  const k8sWatch = getK8sWatch();

  const { watchEndHandler } = watchOptions;

  return k8sWatch.watch(`/api/v1/namespaces`,
    queryOptions,
    namespaceWatchHandler,
    watchEndHandler({
      ...watchOptions,
      resourceWatched,
    }),
  );
}

function getK8sWatch(): Watch {
  const k8sConfig = new KubeConfig();
  k8sConfig.loadFromDefault();
  return new Watch(k8sConfig);
}

// For the return type of .watch(), please note:
// https://github.com/kubernetes-client/javascript/blob/2cd82e3ad18c978bd022172396a41df570b4e607/src/watch.ts#L60
// Underneath, the K8s client API currently uses the "request" library.
//
// TODO(ivanstanev): Please note the documentation says "request" is used "for now":
// tslint:disable-next-line: max-line-length
// https://github.com/kubernetes-client/javascript/commit/65861f8c8af89c5e7babadce1952996bfdb7c000#diff-04c6e90faac2675aa89e2176d2eec7d8L8
function setupWatch(
  endpoint: string,
  resourceWatched: WatchedKubernetesObject,
  watchOptions: IWatchHandlerOptions,
): Request {
  const { watchEndHandler } = watchOptions;

  const queryOptions = {};
  const k8sWatch = getK8sWatch();

  return k8sWatch.watch(endpoint,
    queryOptions,
    watchHandlers[resourceWatched],
    watchEndHandler({
      ...watchOptions,
      resourceWatched,
    }),
  );
}

export { deleteWorkload, WorkloadWorker };
