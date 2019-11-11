import config = require('../common/config');
import { currentClusterName } from '../kube-scanner/cluster';
import { IScanResult } from '../kube-scanner/image-scanner';
import {
  IDeleteWorkloadPayload,
  IDepGraphPayload,
  IWorkload,
  ILocalWorkloadLocator,
  IImageLocator,
  IWorkloadMetadataPayload,
  IWorkloadMetadata,
  IWorkloadLocator,
} from './types';

export function constructHomebaseDepGraphPayloads(
    scannedImages: IScanResult[],
    workloadMetadata: IWorkload[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    // We know that .find() won't return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kubeWorkload: IWorkload = workloadMetadata.find((meta) => meta.imageName === scannedImage.imageWithTag)!;

    const { cluster, namespace, type, name } = kubeWorkload;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    } as IDepGraphPayload;
  });

  return results;
}

export function constructHomebaseWorkloadMetadataPayload(workload: IWorkload): IWorkloadMetadataPayload {
  if (!workload) {
    throw new Error('can\'t build workload metadata payload for undefined workload');
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

export function constructHomebaseDeleteWorkloadPayload(
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
