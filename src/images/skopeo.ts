import { SkopeoRepositoryType } from '../kube-scanner/types';
import { SpawnPromiseResult } from 'child-process-promise';
import { exec } from '../cli/process';
import config = require('../common/config');

export function getDestinationForImage(image: string): string {
  const normalisedImageName = image.replace(/\W/g, '_');
  return `${config.IMAGE_STORAGE_ROOT}/${normalisedImageName}.tar`;
}

function prefixRespository(target: string, type: SkopeoRepositoryType) {
  switch (type) {
    case SkopeoRepositoryType.ImageRegistry:
      return `${type}://${target}`;
    case SkopeoRepositoryType.DockerArchive:
      return `${type}:${target}`;
    default:
      throw new Error(`Unhandled Skopeo repository type ${type}`);
  }
}

export function pull(
  image: string,
): Promise<SpawnPromiseResult> {
  const source = image;
  const destination = getDestinationForImage(image);

  return exec('skopeo', 'copy',
    prefixRespository(source, SkopeoRepositoryType.ImageRegistry),
    prefixRespository(destination, SkopeoRepositoryType.DockerArchive),
  );
}
