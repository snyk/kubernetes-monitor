import { Apps_v1Api, Batch_v1Api, Batch_v1beta1Api, Core_v1Api, KubeConfig,
  V1Container, V1ObjectMeta, V1OwnerReference } from '@kubernetes/client-node';

export interface KubeObjectMetadata {
  kind: string;
  group: string;
  objectMeta: V1ObjectMeta;
  specMeta: V1ObjectMeta;
  containers: V1Container[];
  ownerRefs: V1OwnerReference[];
}

export interface IK8sClients {
  readonly appsClient: Apps_v1Api;
  readonly coreClient: Core_v1Api;
  readonly batchClient: Batch_v1Api;
  readonly batchUnstableClient: Batch_v1beta1Api;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: Apps_v1Api;
  public readonly coreClient: Core_v1Api;
  public readonly batchClient: Batch_v1Api;
  // TODO: Keep an eye on this! We need v1beta1 API for CronJobs.
  // https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
  // CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
  public readonly batchUnstableClient: Batch_v1beta1Api;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(Apps_v1Api);
    this.coreClient = config.makeApiClient(Core_v1Api);
    this.batchClient = config.makeApiClient(Batch_v1Api);
    this.batchUnstableClient = config.makeApiClient(Batch_v1beta1Api);
  }
}
