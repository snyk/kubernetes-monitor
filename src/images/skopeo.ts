import { SpawnPromiseResult } from 'child-process-promise';

import { exec } from '../common/process';
import * as config from'../common/config';
import * as credentials from './credentials';
import { SkopeoRepositoryType } from '../kube-scanner/types';


function getUniqueIdentifier(): string {
  const [seconds, nanoseconds] = process.hrtime();
  return `${seconds}_${nanoseconds}`;
}

export function getDestinationForImage(image: string): string {
  const normalisedImageName = image.replace(/\W/g, '_');
  // If two workloads contain the same image and if the snyk-monitor attempts to pull the two images at the same time,
  // this can result in a problem where both actions try to work with the same file resulting in a nasty crash.
  // This is why we try to make the name of the temporary file unique for every workload analysis.
  const uniqueIdentifier = getUniqueIdentifier();
  return `${config.IMAGE_STORAGE_ROOT}/${normalisedImageName}_${uniqueIdentifier}.tar`;
}

function prefixRespository(target: string, type: SkopeoRepositoryType): string {
  switch (type) {
    case SkopeoRepositoryType.ImageRegistry:
      return `${type}://${target}`;
    case SkopeoRepositoryType.DockerArchive:
      return `${type}:${target}`;
    default:
      throw new Error(`Unhandled Skopeo repository type ${type}`);
  }
}

export async function pull(
  image: string,
  destination: string,
): Promise<SpawnPromiseResult> {
  const creds = await credentials.getSourceCredentials(image);
  const credentialsParameters = getCredentialParameters(creds);

  return exec('skopeo', 'copy', ...credentialsParameters,
    prefixRespository(image, SkopeoRepositoryType.ImageRegistry),
    prefixRespository(destination, SkopeoRepositoryType.DockerArchive),
  );
}

export function getCredentialParameters(credentials: string | undefined): Array<string> {
  const credentialsParameters: Array<string> = [];
  if (credentials) {
    credentialsParameters.push('--src-creds');
    credentialsParameters.push(credentials);
  }
  return credentialsParameters;
}
