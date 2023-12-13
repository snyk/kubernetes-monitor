import { IncomingMessage } from 'http';
import {
  AppsV1Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  V1Namespace,
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
  ArgoRollout = 'Rollout',
}

export interface IRequestError {
  message?: string;
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

export type IKubeObjectMetadataWithoutPodSpec = Omit<
  IKubeObjectMetadata,
  'podSpec'
>;

export interface IK8sClients {
  readonly appsClient: AppsV1Api;
  readonly coreClient: CoreV1Api;
  readonly batchClient: BatchV1Api;
  readonly customObjectsClient: CustomObjectsApi;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AppsV1Api;
  public readonly coreClient: CoreV1Api;
  public readonly batchClient: BatchV1Api;
  /** This client is used to access Custom Resources in the cluster, e.g. DeploymentConfig on OpenShift. */
  public readonly customObjectsClient: CustomObjectsApi;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(AppsV1Api);
    this.coreClient = config.makeApiClient(CoreV1Api);
    this.batchClient = config.makeApiClient(BatchV1Api);
    this.customObjectsClient = config.makeApiClient(CustomObjectsApi);
  }
}

export interface NamespaceResponse {
  response: IncomingMessage;
  body: V1Namespace;
}
