import { config } from '../common/config';
import { currentClusterName } from '../supervisor/cluster';
import { IScanResult } from '../scanner/types';
import {
  IDeleteWorkloadPayload,
  IWorkload,
  ILocalWorkloadLocator,
  IImageLocator,
  IWorkloadMetadataPayload,
  IWorkloadMetadata,
  IWorkloadLocator,
  ScanResultsPayload,
  IDependencyGraphPayload,
  IWorkloadEventsPolicyPayload,
} from './types';
import { state } from '../state';

export function constructDepGraph(
  scannedImages: IScanResult[],
  workloadMetadata: IWorkload[],
): IDependencyGraphPayload[] {
  return scannedImages.map((scannedImage): IDependencyGraphPayload => {
    // We know that .find() won't return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kubeWorkload: IWorkload = workloadMetadata.find(
      (meta) => meta.imageName === scannedImage.imageWithTag,
    )!;

    const { cluster, namespace, type, name } = kubeWorkload;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      imageWithDigest: scannedImage.imageWithDigest,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      agentVersion: config.MONITOR_VERSION,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    };
  });
}

export function constructScanResults(
  scannedImages: IScanResult[],
  workloadMetadata: IWorkload[],
): ScanResultsPayload[] {
  return scannedImages.map<ScanResultsPayload>((scannedImage) => {
    // We know that .find() won't return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kubeWorkload: IWorkload = workloadMetadata.find(
      (meta) => meta.imageName === scannedImage.imageWithTag,
    )!;

    const { cluster, namespace, type, name } = kubeWorkload;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      imageWithDigest: scannedImage.imageWithDigest,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      agentVersion: config.MONITOR_VERSION,
      scanResults: scannedImage.scanResults,
    };
  });
}

export function constructWorkloadMetadata(
  workload: IWorkload,
): IWorkloadMetadataPayload {
  if (!workload) {
    throw new Error(
      "can't build workload metadata payload for undefined workload",
    );
  }

  const workloadLocator: IWorkloadLocator = {
    userLocator: config.INTEGRATION_ID,
    cluster: workload.cluster,
    namespace: workload.namespace,
    type: workload.type,
    name: workload.name,
  };
  const workloadMetadata: IWorkloadMetadata = {
    labels: workload.labels,
    specLabels: workload.specLabels,
    annotations: workload.annotations,
    specAnnotations: workload.specAnnotations,
    namespaceAnnotations:
      state.watchedNamespaces[workload.namespace]?.metadata?.annotations,
    revision: workload.revision,
    podSpec: workload.podSpec,
  };
  return {
    workloadLocator,
    agentId: config.AGENT_ID,
    agentVersion: config.MONITOR_VERSION,
    workloadMetadata,
  };
}

export function constructDeleteWorkload(
  localWorkloadLocator: ILocalWorkloadLocator,
): IDeleteWorkloadPayload {
  return {
    workloadLocator: {
      ...localWorkloadLocator,
      userLocator: config.INTEGRATION_ID,
      cluster: currentClusterName,
    },
    agentId: config.AGENT_ID,
    agentVersion: config.MONITOR_VERSION,
  };
}

export function constructWorkloadEventsPolicy(
  policy: string,
): IWorkloadEventsPolicyPayload {
  return {
    policy,
    userLocator: config.INTEGRATION_ID,
    cluster: currentClusterName,
    agentId: config.AGENT_ID,
    agentVersion: config.MONITOR_VERSION,
  };
}
