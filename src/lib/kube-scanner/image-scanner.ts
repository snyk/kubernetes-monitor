import * as plugin from 'snyk-docker-plugin';
import config = require('../../common/config');
import { IDepGraphPayload, IKubeImage } from '../../transmitter/types';

export interface ScanResult {
  image: string;
  pluginResult: any;
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const scannedImages: ScanResult[] = [];

  for (const image of images) {
    try {
      const result = await plugin.inspect(image);
      if (!result || !result.package || !result.package.dependencies) {
        throw Error('Unexpected empty result from docker-plugin');
      }
      scannedImages.push({
        image,
        pluginResult: result,
      });
    } catch (error) {
      console.log(`Could not scan the image ${image}: ${error.message}`);
    }
  }

  return scannedImages;
}

export function constructPayloads(scannedImages: ScanResult[],
                                  imageMetadata: IKubeImage[]): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const metadata = imageMetadata.find((meta) => meta.baseImageName === scannedImage.image);
    if (!metadata) {
      throw Error('Unexpected missing image'); // should never happen?
    }

    const { baseImageName: image, ...workloadLocator } = metadata;

    const imageLocator = {
      userLocator: config.USER_LOCATOR,
      imageId: image,
      ...workloadLocator,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: scannedImage.pluginResult,
    } as IDepGraphPayload;
  });

  return results;
}
