import { SpawnPromiseResult } from 'child-process-promise';
import { exec } from '../cli/process';
import logger = require('../common/logger');
import { ISkopeoTargets, SkopeoRepositoryType } from './types';
import config = require('../common/config');
import { unlink } from 'fs';

export async function pullImages(images: string[]): Promise<string[]> {
  const pulledImages: string[] = [];

  for (const image of images) {
    try {
      await copy(image);
      pulledImages.push(image);
    } catch (error) {
      logger.error({error, image}, 'Failed to pull image');
    }
  }

  return pulledImages;
}

export async function removePulledImages(images: string[]) {
  for (const image of images) {
    try {
      const { destination } = getSourceAndDestinationForImage(image);
      await new Promise((resolve) => unlink(destination, resolve));
    } catch (error) {
      logger.warn({error, image}, 'Failed to delete pulled image');
    }
  }
}

export function getSourceAndDestinationForImage(image: string): ISkopeoTargets {
  const normalisedImageName = image.replace(/\//g, '_').replace(/@/g, '_').replace(/:/g, '_');
  const destination = `${config.IMAGE_STORAGE_ROOT}/${normalisedImageName}.tar`;

  return {
    source: image,
    destination,
  };
}

export function prefixRespository(target: string, type: SkopeoRepositoryType) {
  switch (type) {
    case 'docker':
      return `${type}://${target}`;
    case 'dir':
    case 'docker-archive':
    case 'oci':
      return `${type}:${target}`;
    default:
      throw new Error(`Unhandled Skopeo repository type ${type}`);
  }
}

function copy(image: string, from: SkopeoRepositoryType = 'docker', to: SkopeoRepositoryType = 'docker-archive'):
    Promise<SpawnPromiseResult> {
  const { source, destination } = getSourceAndDestinationForImage(image);

  return exec('skopeo', 'copy', prefixRespository(source, from), prefixRespository(destination, to));
}
