import { IncomingMessage } from 'http';
import {
  KubeConfig,
  V1Namespace,
  V1ObjectMeta,
  V1OwnerReference,
  V1PodSpec,
} from '@kubernetes/client-node';
import {
  AdaptedAppsV1Api,
  AdaptedBatchV1Api,
  AdaptedCoreV1Api,
  AdaptedCustomObjectsApi,
} from './k8s-api-adapter';

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
  readonly appsClient: AdaptedAppsV1Api;
  readonly coreClient: AdaptedCoreV1Api;
  readonly batchClient: AdaptedBatchV1Api;
  readonly customObjectsClient: AdaptedCustomObjectsApi;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AdaptedAppsV1Api;
  public readonly coreClient: AdaptedCoreV1Api;
  public readonly batchClient: AdaptedBatchV1Api;
  /** This client is used to access Custom Resources in the cluster, e.g. DeploymentConfig on OpenShift. */
  public readonly customObjectsClient: AdaptedCustomObjectsApi;

  constructor(config: KubeConfig) {
    // Use adapted clients that provide v0.2.3-compatible API
    this.appsClient = new AdaptedAppsV1Api(config);
    this.coreClient = new AdaptedCoreV1Api(config);
    this.batchClient = new AdaptedBatchV1Api(config);
    this.customObjectsClient = new AdaptedCustomObjectsApi(config);
  }
}

export interface NamespaceResponse {
  response: IncomingMessage;
  body: V1Namespace;
}
