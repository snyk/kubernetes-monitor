import { unlink } from 'fs';
import * as plugin from 'snyk-docker-plugin';

import logger = require('../../common/logger');
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import { IPullableImage, IScanImage } from './types';
import { IStaticAnalysisOptions, StaticAnalysisImageType, IScanResult, IPluginOptions } from '../types';

export async function pullImages(images: IPullableImage[]): Promise<IPullableImage[]> {
  const pulledImages: IPullableImage[] = [];

  for (const image of images) {
    const { imageName, imageWithDigest, fileSystemPath } = image;
    if (!fileSystemPath) {
      continue;
    }

    try {
      // Scan image by digest if exists, other way fallback tag
      const scanId = imageWithDigest ?? imageName;
      await skopeoCopy(scanId, fileSystemPath);
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image: imageWithDigest}, 'failed to pull image');
    }
  }

  return pulledImages;
}

export function getImagesWithFileSystemPath(images: IScanImage[]): IPullableImage[] {
  return images.map((image) => ({ ...image, fileSystemPath: getDestinationForImage(image.imageName) }));
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
export function getImageParts(imageWithTag: string) : {imageName: string, imageTag: string, imageDigest: string} {
  // we're matching pattern: <registry:port_number>(optional)/<image_name>(mandatory):<image_tag>(optional)@<tag_identifier>(optional)
  // extracted from https://github.com/docker/distribution/blob/master/reference/regexp.go
  const regex = /^((?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])(?:(?:\.(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]))+)?(?::[0-9]+)?\/)?[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?(?:(?:\/[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?)+)?)(?::([\w][\w.-]{0,127}))?(?:@([A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*[:][A-Fa-f0-9]{32,}))?$/ig;
  const groups  = regex.exec(imageWithTag);

  if(!groups){
    logger.error({image: imageWithTag}, 'Image with tag is malformed, cannot extract valid parts');
    return { imageName: imageWithTag, imageTag: '', imageDigest: '' };
  }

  const IMAGE_NAME_GROUP = 1;
  const IMAGE_TAG_GROUP = 2;
  const IMAGE_DIGEST_GROUP = 3;

  return {
    imageName: groups[IMAGE_NAME_GROUP],
    imageTag: groups[IMAGE_TAG_GROUP] || '',
    imageDigest: groups[IMAGE_DIGEST_GROUP] || '',
  };
}

// Exported for testing
export function constructStaticAnalysisOptions(
  fileSystemPath: string,
): IStaticAnalysisOptions {
  return {
    imagePath: fileSystemPath,
    imageType: StaticAnalysisImageType.DockerArchive,
  };
}

export async function scanImages(images: IPullableImage[]): Promise<IScanResult[]> {
  const scannedImages: IScanResult[] = [];

  const dockerfile = undefined;

  for (const { imageName, fileSystemPath, imageWithDigest } of images) {
    try {
      const staticAnalysisOptions = constructStaticAnalysisOptions(fileSystemPath);
      const options: IPluginOptions = {
        staticAnalysisOptions,
        experimental: true,
      };

      const result = await plugin.inspect(imageName, dockerfile, options);

      if (!result || !result.package || !result.package.dependencies) {
        throw Error('Unexpected empty result from docker-plugin');
      }

      const imageParts = getImageParts(imageName);
      const imageDigest = imageWithDigest && getImageParts(imageWithDigest).imageDigest;

      result.imageMetadata = {
        image: imageParts.imageName,
        imageTag: imageParts.imageTag,
        imageDigest,
      };

      scannedImages.push({
        image: imageParts.imageName,
        imageWithTag: imageName,
        imageWithDigest: imageWithDigest,
        pluginResult: result,
      });
    } catch (error) {
      logger.warn({error, image: imageName}, 'failed to scan image');
    }
  }

  return scannedImages;
}
