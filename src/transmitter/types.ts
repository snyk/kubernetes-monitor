interface StringMap { [key: string]: string; }

export interface ILocalWorkloadLocator {
  namespace: string;
  type: string;
  name: string;
}

export interface IWorkloadLocator extends ILocalWorkloadLocator {
  userLocator: string;
  cluster: string;
}

export interface IWorkloadMetadata extends IWorkloadLocator {
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

export interface IDeleteWorkloadPayload {
  workloadLocator: IWorkloadLocator;
  agentId: string;
}

export interface IKubeImage {
  type: string;
  name: string;
  namespace: string;
  labels: StringMap | undefined;
  annotations: StringMap  | undefined;
  uid: string;
  specLabels: StringMap  | undefined;
  specAnnotations: StringMap  | undefined;
  containerName: string;
  imageName: string;
  imageId: string;
  cluster: string;
}
