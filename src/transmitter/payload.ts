import config = require('../common/config');
import { currentClusterName } from '../kube-scanner/cluster';
import { ScanResult } from '../kube-scanner/image-scanner';
import { IDeleteWorkloadPayload, IDepGraphPayload, IKubeImage, ILocalWorkloadLocator } from './types';

export function constructHomebaseWorkloadPayloads(
    scannedImages: ScanResult[],
    imageMetadata: IKubeImage[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const metadata = imageMetadata.find((meta) => meta.imageName === scannedImage.imageWithTag)!;

    const { imageName: image, ...workloadLocator } = metadata;

    const imageLocator = {
      ...workloadLocator,
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
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
