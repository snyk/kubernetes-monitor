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

export interface DepGraphPayload {
  imageLocator: IImageLocator;
  agentId: string;
  dependencyGraph?: any;
}

export interface ScanResponse {
  imageMetadata: KubeImage[];
}

export interface KubeImage {
  cluster: string;
  namespace: string;
  name: string;
  type: string;
  baseImageName: string;
}
