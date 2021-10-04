import { V1PodSpec } from '@kubernetes/client-node';
import { NeedleResponse } from 'needle';
import { ScanResult } from 'snyk-docker-plugin';

interface StringMap {
  [key: string]: string;
}

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
  namespaceAnnotations: StringMap | undefined;
  revision: number | undefined;
  podSpec: V1PodSpec;
}

export interface IImageLocator extends IWorkloadLocator {
  imageId: string;
  imageWithDigest?: string;
}

export interface IDependencyGraphPayload {
  imageLocator: IImageLocator;
  agentId: string;
  dependencyGraph?: string;
}

export interface ScanResultsPayload {
  imageLocator: IImageLocator;
  agentId: string;
  scanResults: ScanResult[];
  telemetry: Partial<Telemetry>;
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

export interface IWorkloadEventsPolicyPayload {
  userLocator: string;
  cluster: string;
  agentId: string;
  policy: string;
}

export interface IClusterMetadataPayload {
  userLocator: string;
  cluster: string;
  agentId: string;
  version: string;
  namespace?: string;
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

export interface IResponseWithAttempts {
  response: NeedleResponse;
  attempt: number;
}

export interface IRequestError {
  code: string;
  message: string;
}

export interface Telemetry {
  enqueueDurationMs: number;
  queueSize: number;
  imagePullDurationMs: number;
  imageScanDurationMs: number;
}
