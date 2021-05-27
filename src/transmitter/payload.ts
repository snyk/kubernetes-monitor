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
  IKubernetesMonitorMetadata,
  ScanResultsPayload,
  IDependencyGraphPayload,
  WorkloadAutoImportPolicyPayload,
} from './types';

export function constructDepGraph(
  scannedImages: IScanResult[],
  workloadMetadata: IWorkload[],
): IDependencyGraphPayload[] {
  const results = scannedImages.map((scannedImage): IDependencyGraphPayload => {
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

    const monitorMetadata: IKubernetesMonitorMetadata = {
      agentId: config.AGENT_ID,
      namespace: config.NAMESPACE,
      version: config.MONITOR_VERSION,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
      metadata: monitorMetadata,
    };
  });

  return results;
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

    const monitorMetadata: IKubernetesMonitorMetadata = {
      agentId: config.AGENT_ID,
      namespace: config.NAMESPACE,
      version: config.MONITOR_VERSION,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      scanResults: scannedImage.scanResults,
      metadata: monitorMetadata,
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
    revision: workload.revision,
    podSpec: workload.podSpec,
  };
  return { workloadLocator, agentId: config.AGENT_ID, workloadMetadata };
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
  };
}

export function constructWorkloadAutoImportPolicy(
  policy: string,
): WorkloadAutoImportPolicyPayload {
  return {
    policy,
    userLocator: config.INTEGRATION_ID,
    cluster: currentClusterName,
    agentId: config.AGENT_ID,
  };
}
