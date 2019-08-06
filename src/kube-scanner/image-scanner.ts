import * as plugin from 'snyk-docker-plugin';
import logger = require('../common/logger');

export interface ScanResult {
  image: string;
  imageWithTag: string;
  pluginResult: any;
}

function removeTagFromImage(imageWithTag: string): string {
  return imageWithTag.split('@')[0].split(':')[0];
}

function getImageTag(imageWithTag: string): string {
  const imageParts: string[] = imageWithTag.split(':');
  if (imageParts.length === 2) { // image@sha256:hash or image:tag
    return imageParts[1];
  }

  return '';
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const scannedImages: ScanResult[] = [];

  for (const image of images) {
    try {
      const result = await plugin.inspect(image);
      if (!result || !result.package || !result.package.dependencies) {
        throw Error('Unexpected empty result from docker-plugin');
      }

      result.imageMetadata = {
        image: removeTagFromImage(image),
        imageTag: getImageTag(image),
      };

      scannedImages.push({
        image: removeTagFromImage(image),
        imageWithTag: image,
        pluginResult: result,
      });
    } catch (error) {
      logger.warn({error, image}, 'Failed to scan image');
    }
  }

  return scannedImages;
}
