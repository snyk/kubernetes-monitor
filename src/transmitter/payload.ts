import config = require('../common/config');
import { ScanResult } from '../kube-scanner/image-scanner';
import { IDeleteImagePayload, IDepGraphPayload, IKubeImage } from './types';

export function constructHomebaseWorkloadPayloads(
    scannedImages: ScanResult[],
    imageMetadata: IKubeImage[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const metadata = imageMetadata.find((meta) => meta.imageName === scannedImage.image)!;

    const { imageName: image, ...workloadLocator } = metadata;

    const imageLocator = {
      ...workloadLocator,
      userLocator: config.INTEGRATION_ID,
      imageId: image,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    } as IDepGraphPayload;
  });

  return results;
}

export function constructHomebaseDeleteWorkloadPayloads(
  imageMetadata: IKubeImage[],
): IDeleteImagePayload[] {
  const results = imageMetadata.map((scannedImage) => {
    const { imageName: image, ...workloadLocator } = scannedImage;

    const imageLocator = {
      ...workloadLocator,
      imageId: image,
      userLocator: config.INTEGRATION_ID,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
    } as IDeleteImagePayload;
  });

  return results;
}
