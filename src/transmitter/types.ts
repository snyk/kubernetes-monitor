import { V1PodSpec } from '@kubernetes/client-node';

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

export interface IWorkloadMetadata {
  labels: StringMap | undefined;
  specLabels: StringMap | undefined;
  annotations: StringMap | undefined;
  specAnnotations: StringMap | undefined;
  revision: number | undefined;
  podSpec: V1PodSpec;
}

export interface IImageLocator extends IWorkloadLocator {
  imageId: string;
}

export interface IKubernetesMonitorMetadata {
  agentId: string;
  version?: string;
  namespace?: string;
  kubernetesDistribution: string;
  kubernetesApiVersion?: string;
}

export interface IDepGraphPayload {
  imageLocator: IImageLocator;
  agentId: string; // TODO: make sure we send it only as part of the metadata
  dependencyGraph?: any;
  metadata: IKubernetesMonitorMetadata;
}

export interface IWorkloadMetadataPayload {
  workloadLocator: IWorkloadLocator;
  agentId: string;
  workloadMetadata: IWorkloadMetadata;
}

export interface IDeleteWorkloadPayload {
  workloadLocator: IWorkloadLocator;
  agentId: string;
}

export interface IWorkload {
  type: string;
  name: string;
  namespace: string;
  labels: StringMap | undefined;
  annotations: StringMap | undefined;
  uid: string;
  revision: number | undefined;
  specLabels: StringMap | undefined;
  specAnnotations: StringMap | undefined;
  containerName: string;
  imageName: string;
  imageId: string;
  cluster: string;
  podSpec: V1PodSpec;
}
