import { unlink } from 'fs';
import * as plugin from 'snyk-docker-plugin';

import logger = require('../../common/logger');
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import config = require('../../common/config');
import { IPullableImage } from './types';
import { IStaticAnalysisOptions, StaticAnalysisImageType, IScanResult } from '../types';

export async function pullImages(images: IPullableImage[]): Promise<IPullableImage[]> {
  const pulledImages: IPullableImage[] = [];

  for (const image of images) {
    const {imageName, fileSystemPath} = image;
    if (!fileSystemPath) {
      continue;
    }

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

// Exported for testing
export function removeTagFromImage(imageWithTag: string): string {
  return imageWithTag.split('@')[0].split(':')[0];
}

// Exported for testing
export function getImageTag(imageWithTag: string): string {
  const imageParts: string[] = imageWithTag.split(':');
  if (imageParts.length === 2) { // image@sha256:hash or image:tag
    return imageParts[1];
  }

  return '';
}

// Exported for testing
export function constructStaticAnalysisOptions(
  fileSystemPath: string,
): { staticAnalysisOptions: IStaticAnalysisOptions } {
  return {
    staticAnalysisOptions: {
      imagePath: fileSystemPath,
      imageType: StaticAnalysisImageType.DockerArchive,
      tmpDirPath: config.IMAGE_STORAGE_ROOT,
    },
  };
}

export async function scanImages(images: IPullableImage[]): Promise<IScanResult[]> {
  const scannedImages: IScanResult[] = [];

  const dockerfile = undefined;

  for (const {imageName, fileSystemPath} of images) {
    try {
      const options = constructStaticAnalysisOptions(fileSystemPath);

      const result = await plugin.inspect(imageName, dockerfile, options);

      if (!result || !result.package || !result.package.dependencies) {
        throw Error('Unexpected empty result from docker-plugin');
      }

      result.imageMetadata = {
        image: removeTagFromImage(imageName),
        imageTag: getImageTag(imageName),
      };

      scannedImages.push({
        image: removeTagFromImage(imageName),
        imageWithTag: imageName,
        pluginResult: result,
      });
    } catch (error) {
      logger.warn({error, image: imageName}, 'failed to scan image');
    }
  }

  return scannedImages;
}
