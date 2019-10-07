import logger = require('../common/logger');
import { pull as dockerPull } from './docker';
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import { unlink } from 'fs';
import { isStaticAnalysisEnabled } from '../common/features';

export { getDestinationForImage };

export async function pullImages(images: string[]): Promise<string[]> {
  const pulledImages: string[] = [];

  for (const image of images) {
    try {
      if (isStaticAnalysisEnabled()) {
        await skopeoCopy(image);
      } else {
        await dockerPull(image);
      }
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image}, 'failed to pull image');
    }
  }

  return pulledImages;
}

export async function removePulledImages(images: string[]) {
  if (!isStaticAnalysisEnabled()) {
    return;
  }

  for (const image of images) {
    try {
      const destination = getDestinationForImage(image);
      await new Promise((resolve) => unlink(destination, resolve));
    } catch (error) {
      logger.warn({error, image}, 'failed to delete pulled image');
    }
  }
}
