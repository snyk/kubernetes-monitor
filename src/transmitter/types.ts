export interface IWorkloadLocator {
  userLocator: string;
  cluster: string;
  namespace: string;
  type: string;
  name: string;
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
  cluster: string;
  namespace: string;
  name: string;
  type: string;
  baseImageName: string;
}
