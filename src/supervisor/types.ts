import { IncomingMessage } from 'http';
import {
  AppsV1Api,
  BatchV1Api,
  BatchV1beta1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  V1ObjectMeta,
  V1OwnerReference,
  V1PodSpec,
} from '@kubernetes/client-node';

export enum WorkloadKind {
  Deployment = 'Deployment',
  ReplicaSet = 'ReplicaSet',
  StatefulSet = 'StatefulSet',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  CronJob = 'CronJob',
  ReplicationController = 'ReplicationController',
  Pod = 'Pod',
  DeploymentConfig = 'DeploymentConfig',
}

export interface IRequestError {
  code?: string;
  response?: IncomingMessage;
}

export interface IKubeObjectMetadata {
  kind: string;
  objectMeta: V1ObjectMeta;
  specMeta: V1ObjectMeta;
  podSpec: V1PodSpec;
  ownerRefs: V1OwnerReference[] | undefined;
  revision?: number;
}

export interface IK8sClients {
  readonly appsClient: AppsV1Api;
  readonly coreClient: CoreV1Api;
  readonly batchClient: BatchV1Api;
  readonly batchUnstableClient: BatchV1beta1Api;
  readonly customObjectsClient: CustomObjectsApi;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AppsV1Api;
  public readonly coreClient: CoreV1Api;
  public readonly batchClient: BatchV1Api;
  // TODO: Keep an eye on this! We need v1beta1 API for CronJobs.
  // https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
  // CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
  // TODO: https://kubernetes.io/blog/2021/04/09/kubernetes-release-1.21-cronjob-ga/
  // CronJobs are now GA in Kubernetes 1.21 in the batch/v1 API, we should add support for it!
  public readonly batchUnstableClient: BatchV1beta1Api;
  /** This client is used to access Custom Resources in the cluster, e.g. DeploymentConfig on OpenShift. */
  public readonly customObjectsClient: CustomObjectsApi;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(AppsV1Api);
    this.coreClient = config.makeApiClient(CoreV1Api);
    this.batchClient = config.makeApiClient(BatchV1Api);
    this.batchUnstableClient = config.makeApiClient(BatchV1beta1Api);
    this.customObjectsClient = config.makeApiClient(CustomObjectsApi);
  }
}
