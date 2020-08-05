import { unlink } from 'fs';
import * as plugin from 'snyk-docker-plugin';

import logger = require('../../common/logger');
import { pull as skopeoCopy, getDestinationForImage } from './skopeo';
import { IPullableImage } from './types';
import { IStaticAnalysisOptions, StaticAnalysisImageType, IScanResult, IPluginOptions } from '../types';

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
export function getImageParts(imageWithTag: string) : {imageName: string, imageTag: string} {
  // we're matching pattern: <registry:port_number>(optional)/<image_name>(mandatory)@<tag_identifier>(optional):<image_tag>(optional)
  const regex = /((?:.*(:\d{4})?\/)?(?:[a-z0-9-]+))([@|:].+)?/ig;
  const groups  = regex.exec(imageWithTag);
  
  if(!groups){
    logger.error({image: imageWithTag}, 'Image with tag is malformed, cannot extract valid parts');
    return {imageName: imageWithTag, imageTag: ''};
  }

  return {
    imageName: groups[1],
    imageTag: validateAndExtractImageTag(groups[3])
  };
}

function validateAndExtractImageTag(imageTagGroup: string | undefined): string {
  if(imageTagGroup === undefined){
    return '';
  }

  const imageTagParts: string[]= imageTagGroup.split(':');

  //valid formats: image@sha256:hash or image:tag
  return imageTagParts.length === 2 ? imageTagParts[1] : '';
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

  for (const {imageName, fileSystemPath} of images) {
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

      const imageParts: {imageName: string, imageTag: string} = getImageParts(imageName);

      result.imageMetadata = {
        image: imageParts.imageName,
        imageTag: imageParts.imageTag,
      };

      scannedImages.push({
        image: imageParts.imageName,
        imageWithTag: imageName,
        pluginResult: result,
      });
    } catch (error) {
      logger.warn({error, image: imageName}, 'failed to scan image');
    }
  }

  return scannedImages;
}
