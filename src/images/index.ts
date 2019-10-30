import logger = require('../common/logger');
import { pull as dockerPull } from './docker';
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import { unlink } from 'fs';
import { isStaticAnalysisEnabled } from '../common/features';
import { IPullableImage } from './types';

export async function pullImages(images: IPullableImage[]): Promise<IPullableImage[]> {
  const pulledImages: IPullableImage[] = [];

  for (const image of images) {
    const {imageName, fileSystemPath} = image;
    try {
      if (isStaticAnalysisEnabled()) {
        if (!fileSystemPath) {
          throw new Error('Missing required parameter fileSystemPath for static analysis');
        }
        await skopeoCopy(imageName, fileSystemPath);
      } else {
        await dockerPull(imageName);
      }
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image: imageName}, 'failed to pull image');
    }
  }

  return pulledImages;
}

/**
 * TODO: For Docker (dynamic scanning) it returns the image but with an empty file system path
 * (because Docker does not pull images to a temporary directory). This will no longer be true
 * when static analysis becomes the only option, but worth nothing it here to avoid confusion!
 * @param images a list of images for which to generate a file system path
 */
export function getImagesWithFileSystemPath(images: string[]): IPullableImage[] {
  return isStaticAnalysisEnabled()
    ? images.map((image) => ({ imageName: image, fileSystemPath: getDestinationForImage(image) }))
    : images.map((image) => ({ imageName: image }));
}

export async function removePulledImages(images: IPullableImage[]) {
  if (!isStaticAnalysisEnabled()) {
    return;
  }

  for (const {imageName, fileSystemPath} of images) {
    try {
      if (!fileSystemPath) {
        throw new Error('Missing required parameter fileSystemPath for static analysis');
      }
      await new Promise((resolve) => unlink(fileSystemPath, resolve));
    } catch (error) {
      logger.warn({error, image: imageName}, 'failed to delete pulled image');
    }
  }
}
