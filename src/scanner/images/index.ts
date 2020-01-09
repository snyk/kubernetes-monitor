import logger = require('../../common/logger');
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import { unlink } from 'fs';
import { IPullableImage } from './types';

export async function pullImages(images: IPullableImage[]): Promise<IPullableImage[]> {
  const pulledImages: IPullableImage[] = [];

  for (const image of images) {
    const {imageName, fileSystemPath} = image;
    try {
      await skopeoCopy(imageName, fileSystemPath);
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image: imageName}, 'failed to pull image');
    }
  }

  return pulledImages;
}

export function getImagesWithFileSystemPath(images: string[]): IPullableImage[] {
  return images.map((image) => ({ imageName: image, fileSystemPath: getDestinationForImage(image) }));
}

export async function removePulledImages(images: IPullableImage[]): Promise<void> {
  for (const {imageName, fileSystemPath} of images) {
    try {
      await new Promise((resolve) => unlink(fileSystemPath, resolve));
    } catch (error) {
      logger.warn({error, image: imageName}, 'failed to delete pulled image');
    }
  }
}
