import config = require('../common/config');
import { ScanResult } from '../lib/kube-scanner/image-scanner';
import { IDepGraphPayload, IKubeImage } from './types';

export function constructHomebaseWorkloadPayloads(
    scannedImages: ScanResult[],
    imageMetadata: IKubeImage[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const metadata = imageMetadata.find((meta) => meta.imageName === scannedImage.image)!;

    const { imageName: image, ...workloadLocator } = metadata;

    const imageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: image,
      ...workloadLocator,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    } as IDepGraphPayload;
  });

  return results;
}
