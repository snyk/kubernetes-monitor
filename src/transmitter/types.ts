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

export interface IDeleteWorkloadParams {
  workloadLocator: IWorkloadLocator;
  agentId: string;
}

export interface IWorkloadEventsPolicyPayload {
  userLocator: string;
  cluster: string;
  agentId: string;
  policy: string;
}

export interface IRuntimeOSPackage {
  purl: string;
  name: string;
  version: string;
  installedViaPackageManager: boolean;
  osFamily: string;
  osVersion: string;
  arch: string;
}

export interface IRuntimeAppPackage {
  purl: string;
  name: string;
  version: string;
  installedViaPackageManager: boolean;
  type: string;
}

export type IRuntimePackage = IRuntimeOSPackage | IRuntimeAppPackage;

/**
 * Metadata of an image for which there are running containers.
 * It is uniquely identified by the tuple [imageID, namespace, workloadName, workloadKind, container].
 */
export interface IRuntimeImage {
  imageID: string;
  namespace: string;
  workloadName: string;
  workloadKind: string;
  container: string;
  packages: IRuntimePackage[];
}

export interface IRuntimeImagesResponse {
  page: {
    /**
     * The number of runtime images returned.
     * This number is always less or equal to the limit specified in the request.
     */
    returned: number;
    /**
     * The cursor that can be used to fetch the next set of runtime images.
     * If this value is unset, then there are no other runtime images to be returned.
     */
    next?: string;
  };
  data?: IRuntimeImage[];
}

export type RuntimeDataType = 'sysdig';

export interface IRuntimeDataTarget {
  userLocator: string;
  cluster: string;
  agentId: string;
}

export interface IRuntimeDataFact {
  type: 'loadedPackages';
  data: IRuntimeImage[];
}

export interface IRuntimeDataPayload extends Omit<ScanResult, 'target'> {
  identity: {
    type: RuntimeDataType;
    legacy: boolean;
  };
  target: IRuntimeDataTarget;
  facts: [IRuntimeDataFact];
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
  /** This metric captures the total duration to pull all images of a workload. */
  imagePullDurationMs: number;
  /** This metric captures the total duration to scan all images of a workload. */
  imageScanDurationMs: number;
  /** This metric captures the combined size of all images of a workload. */
  imageSizeBytes: number;
}
