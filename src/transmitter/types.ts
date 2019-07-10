interface StringMap { [key: string]: string; }

export interface IWorkloadLocator {
  userLocator: string;
  cluster: string;
  namespace: string;
  type: string;
  name: string;
  labels: StringMap | undefined;
  annotations: StringMap | undefined;
  uid: string;
}

export interface IWorkloadInfo extends IWorkloadLocator {
  apiGroup: string;
}

export interface IImageLocator extends IWorkloadLocator {
  imageId: string;
}

export interface IDepGraphPayload {
  imageLocator: IImageLocator;
  agentId: string;
  dependencyGraph?: any;
}

export interface IDeleteImagePayload {
  imageLocator: IImageLocator;
  agentId: string;
}

export interface IScanResponse {
  imageMetadata: IKubeImage[];
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
  cluster: string;
  apiGroup: string;
}
