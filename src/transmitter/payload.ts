import config = require('../common/config');
import { currentClusterName } from '../kube-scanner/cluster';
import { IScanResult } from '../kube-scanner/image-scanner';
import { IDeleteWorkloadPayload, IDepGraphPayload, IWorkload, ILocalWorkloadLocator, IImageLocator } from './types';

export function constructHomebaseWorkloadPayloads(
    scannedImages: IScanResult[],
    workloadMetadata: IWorkload[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
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
