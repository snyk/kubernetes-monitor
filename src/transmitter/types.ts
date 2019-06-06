import { Apps_v1Api, Batch_v1Api, Batch_v1beta1Api, Core_v1Api, KubeConfig } from '@kubernetes/client-node';

interface StringMap { [key: string]: string; }

export interface IWorkloadLocator {
  userLocator: string;
  cluster: string;
  namespace: string;
  kind: string;
  name: string;
  labels: StringMap | undefined;
  annotations: StringMap | undefined;
  uid: string;
}

export interface IImageLocator extends IWorkloadLocator {
  imageId: string;
}

export interface IDepGraphPayload {
  imageLocator: IImageLocator;
  agentId: string;
  dependencyGraph?: any;
}

export interface IScanResponse {
  imageMetadata: IKubeImage[];
}

export interface IKubeImage {
  kind: string;
  name: string;
  namespace: string;
  labels: StringMap | undefined;
  annotations: StringMap  | undefined;
  uid: string;
  specLabels: StringMap  | undefined;
  specAnnotations: StringMap  | undefined;
  containerName: string;
  imageName: string;
  cluster: string;
}

export interface IK8sClients {
  readonly appsClient: Apps_v1Api;
  readonly coreClient: Core_v1Api;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: Apps_v1Api;
  public readonly coreClient: Core_v1Api;
  public readonly batchClient: Batch_v1Api;
  // Keep an eye on this! We need v1beta1 API for CronJobs.
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
