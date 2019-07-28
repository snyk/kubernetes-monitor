import logger = require('../../common/logger');
import { pull } from './docker';

export async function pullImages(images: string[]): Promise<string[]> {
  const pulledImages: string[] = [];

  for (const image of images) {
    try {
      await pull(image);
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image}, 'Failed to pull image');
    }
  }

  return pulledImages;
}
