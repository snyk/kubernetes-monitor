import { ADD, DELETE, UPDATE } from '@kubernetes/client-node';

import { WorkloadKind } from '../../types';
import * as pod from './pod';
import * as cronJob from './cron-job';
import * as daemonSet from './daemon-set';
import * as deployment from './deployment';
import * as job from './job';
import * as replicaSet from './replica-set';
import * as replicationController from './replication-controller';
import * as statefulSet from './stateful-set';
import * as deploymentConfig from './deployment-config';
import * as rollout from './argo-rollout';
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
    clusterEndpoint: '/api/v1/pods',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/pods',
    handlers: {
      [ADD]: pod.podWatchHandler,
      [DELETE]: pod.podDeletedHandler,
      [UPDATE]: pod.podWatchHandler,
    },
    clusterListFactory: () => () => pod.paginatedClusterPodList(),
    namespacedListFactory: (namespace) => () =>
      pod.paginatedNamespacedPodList(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    clusterEndpoint: '/api/v1/replicationcontrollers',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationController.replicationControllerWatchHandler,
    },
    clusterListFactory: () => () =>
      replicationController.paginatedClusterReplicationControllerList(),
    namespacedListFactory: (namespace) => () =>
      replicationController.paginatedNamespacedReplicationControllerList(
        namespace,
      ),
  },
  [WorkloadKind.CronJob]: {
    clusterEndpoint: '/apis/batch/v1/cronjobs',
    namespacedEndpoint: '/apis/batch/v1/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJob.cronJobWatchHandler,
    },
    clusterListFactory: () => () => cronJob.paginatedClusterCronJobList(),
    namespacedListFactory: (namespace) => () =>
      cronJob.paginatedNamespacedCronJobList(namespace),
  },
  [WorkloadKind.Job]: {
    clusterEndpoint: '/apis/batch/v1/jobs',
    namespacedEndpoint: '/apis/batch/v1/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: job.jobWatchHandler,
    },
    clusterListFactory: () => () => job.paginatedClusterJobList(),
    namespacedListFactory: (namespace) => () =>
      job.paginatedNamespacedJobList(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    clusterEndpoint: '/apis/apps/v1/daemonsets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSet.daemonSetWatchHandler,
    },
    clusterListFactory: () => () => daemonSet.paginatedClusterDaemonSetList(),
    namespacedListFactory: (namespace) => () =>
      daemonSet.paginatedNamespacedDaemonSetList(namespace),
  },
  [WorkloadKind.Deployment]: {
    clusterEndpoint: '/apis/apps/v1/deployments',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deployment.deploymentWatchHandler,
    },
    clusterListFactory: () => () => deployment.paginatedClusterDeploymentList(),
    namespacedListFactory: (namespace) => () =>
      deployment.paginatedNamespacedDeploymentList(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    clusterEndpoint: '/apis/apps/v1/replicasets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSet.replicaSetWatchHandler,
    },
    clusterListFactory: () => () => replicaSet.paginatedClusterReplicaSetList(),
    namespacedListFactory: (namespace) => () =>
      replicaSet.paginatedNamespacedReplicaSetList(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    clusterEndpoint: '/apis/apps/v1/statefulsets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSet.statefulSetWatchHandler,
    },
    clusterListFactory: () => () =>
      statefulSet.paginatedClusterStatefulSetList(),
    namespacedListFactory: (namespace) => () =>
      statefulSet.paginatedNamespacedStatefulSetList(namespace),
  },
  [WorkloadKind.DeploymentConfig]: {
    clusterEndpoint: '/apis/apps.openshift.io/v1/deploymentconfigs',
    /** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
    namespacedEndpoint:
      '/apis/apps.openshift.io/v1/namespaces/{namespace}/deploymentconfigs',
    handlers: {
      [DELETE]: deploymentConfig.deploymentConfigWatchHandler,
    },
    clusterListFactory: () => () =>
      deploymentConfig.paginatedClusterDeploymentConfigList(),
    namespacedListFactory: (namespace) => () =>
      deploymentConfig.paginatedNamespacedDeploymentConfigList(namespace),
  },
  [WorkloadKind.ArgoRollout]: {
    clusterEndpoint: '/apis/argoproj.io/v1alpha1/rollouts',
    namespacedEndpoint:
      '/apis/argoproj.io/v1alpha1/namespaces/{namespace}/rollouts',
    handlers: {
      [DELETE]: rollout.argoRolloutWatchHandler,
    },
    clusterListFactory: () => () => rollout.paginatedClusterArgoRolloutList(),
    namespacedListFactory: (namespace) => () =>
      rollout.paginatedNamespacedArgoRolloutList(namespace),
  },
};
