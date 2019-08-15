import { AppsV1Api, BatchV1Api, BatchV1beta1Api, CoreV1Api, KubeConfig,
  V1Container, V1ObjectMeta, V1OwnerReference } from '@kubernetes/client-node';

export enum WorkloadKind {
  Deployment = 'Deployment',
  ReplicaSet = 'ReplicaSet',
  StatefulSet = 'StatefulSet',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  CronJob = 'CronJob',
  ReplicationController = 'ReplicationController',
  Pod = 'Pod',
}

export interface KubeObjectMetadata {
  kind: string;
  objectMeta: V1ObjectMeta;
  specMeta: V1ObjectMeta;
  containers: V1Container[];
  ownerRefs: V1OwnerReference[] | undefined;
}

export interface IK8sClients {
  readonly appsClient: AppsV1Api;
  readonly coreClient: CoreV1Api;
  readonly batchClient: BatchV1Api;
  readonly batchUnstableClient: BatchV1beta1Api;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AppsV1Api;
  public readonly coreClient: CoreV1Api;
  public readonly batchClient: BatchV1Api;
  // TODO: Keep an eye on this! We need v1beta1 API for CronJobs.
  // https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
  // CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
  public readonly batchUnstableClient: BatchV1beta1Api;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(AppsV1Api);
    this.coreClient = config.makeApiClient(CoreV1Api);
    this.batchClient = config.makeApiClient(BatchV1Api);
    this.batchUnstableClient = config.makeApiClient(BatchV1beta1Api);
  }
}
