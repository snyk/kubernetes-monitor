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
