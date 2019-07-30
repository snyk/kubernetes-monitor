import * as plugin from 'snyk-docker-plugin';
import logger = require('../../common/logger');

export interface ScanResult {
  image: string;
  pluginResult: any;
}

// Given a list of image names, run the Snyk Docker plugin on them and collect the results.
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
      logger.error({error, image}, 'Failed to scan image');
    }
  }

  return scannedImages;
}
