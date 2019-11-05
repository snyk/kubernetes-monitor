import * as plugin from 'snyk-docker-plugin';
import logger = require('../common/logger');
import { IStaticAnalysisOptions, StaticAnalysisImageType } from './types';
import { IPullableImage } from '../images/types';
import config = require('../common/config');

export interface IScanResult {
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

function constructStaticAnalysisOptions(
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
