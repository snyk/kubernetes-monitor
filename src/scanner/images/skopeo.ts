import * as fs from 'fs';
import sleep from 'sleep-promise';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import * as processWrapper from '../../common/process';
import * as credentials from './credentials';
import { SkopeoRepositoryType } from './types';

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
    case SkopeoRepositoryType.OciArchive:
      return `${type}:${target}`;
    default:
      throw new Error(`Unhandled Skopeo repository type ${type}`);
  }
}

export async function pull(
  image: string,
  destination: string,
  skopeoRepoType: SkopeoRepositoryType,
): Promise<void> {
  const creds = await credentials.getSourceCredentials(image);
  const credentialsParameters = getCredentialParameters(creds);
  const certificatesParameters = getCertificatesParameters();

  const args: Array<processWrapper.IProcessArgument> = [];
  args.push({ body: 'copy', sanitise: false });
  args.push({ body: '--dest-compress-level', sanitise: false });
  args.push({ body: `${config.SKOPEO_COMPRESSION_LEVEL}`, sanitise: false });
  args.push(...credentialsParameters);
  args.push(...certificatesParameters);
  args.push({
    body: prefixRespository(image, SkopeoRepositoryType.ImageRegistry),
    sanitise: false,
  });
  args.push({
    body: prefixRespository(destination, skopeoRepoType),
    sanitise: false,
  });

  await pullWithRetry(args, destination);
}

async function pullWithRetry(
  args: Array<processWrapper.IProcessArgument>,
  destination: string,
): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const RETRY_INTERVAL_SEC = 0.2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await processWrapper.exec('skopeo', ...args);
      return;
    } catch (err) {
      try {
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
      } catch (deleteErr) {
        logger.warn(
          { error: deleteErr, destination },
          'could not clean up the Skopeo-copy archive',
        );
      }
      if (attempt + 1 > MAX_ATTEMPTS) {
        throw err;
      }
      await sleep(RETRY_INTERVAL_SEC * 1000);
    }
  }
}

export function getCredentialParameters(
  credentials: string | undefined,
): Array<processWrapper.IProcessArgument> {
  const credentialsParameters: Array<processWrapper.IProcessArgument> = [];
  if (credentials) {
    credentialsParameters.push({ body: '--src-creds', sanitise: true });
    credentialsParameters.push({ body: credentials, sanitise: true });
  }
  return credentialsParameters;
}

export function getCertificatesParameters(): Array<processWrapper.IProcessArgument> {
  const certificatesParameters: Array<processWrapper.IProcessArgument> = [];
  certificatesParameters.push({ body: '--src-cert-dir', sanitise: true });
  certificatesParameters.push({ body: '/srv/app/certs', sanitise: true });
  return certificatesParameters;
}
