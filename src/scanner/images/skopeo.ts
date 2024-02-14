import * as fs from 'fs';
import sleep from 'sleep-promise';
import crypto from 'crypto';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import * as processWrapper from '../../common/process';
import * as credentials from './credentials';
import { ImageDigests, ImageManifest, SkopeoRepositoryType } from './types';

const DEFAULT_PLATFORM_OS = 'linux';
const DEFAULT_PLATFORM_ARCH = 'amd64';

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
  skopeoRepoType: SkopeoRepositoryType,
  workloadName: string,
): Promise<ImageDigests> {
  const creds = await credentials.getSourceCredentials(image);
  const credentialsParameters = getCopyCredentialParameters(creds);
  const certificatesParameters = getCopyCertificatesParameters();

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

  const env: Record<string, string | undefined> = {
    // The Azure CR credentials helper requires these env vars:
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_FEDERATED_TOKEN_FILE: process.env.AZURE_FEDERATED_TOKEN_FILE,
    AZURE_FEDERATED_TOKEN: process.env.AZURE_FEDERATED_TOKEN,
    AZURE_AUTHORITY_HOST: process.env.AZURE_AUTHORITY_HOST,
  };
  await pullWithRetry(args, env, destination, workloadName);

  return await extractImageDigests(
    prefixRespository(image, SkopeoRepositoryType.ImageRegistry),
    env,
    creds,
  );
}

async function pullWithRetry(
  args: Array<processWrapper.IProcessArgument>,
  env: Record<string, string | undefined>,
  destination: string,
  workloadName: string,
): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const RETRY_INTERVAL_SEC = 0.2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await processWrapper.exec('skopeo', env, ...args);
      return;
    } catch (err: unknown) {
      try {
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
      } catch (deleteErr) {
        logger.warn(
          { workloadName, error: deleteErr, destination },
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

export async function extractImageDigests(
  image: string,
  env: Record<string, string | undefined> = {},
  creds?: string,
): Promise<ImageDigests> {
  let indexDigest: string | undefined = undefined;
  let manifestDigest: string | undefined = undefined;

  const args: Array<processWrapper.IProcessArgument> = [
    { body: 'inspect', sanitise: false },
    { body: '--raw', sanitise: false },
    { body: image, sanitise: false },
    ...getInspectCredentialParameters(creds),
    ...getInspectCertificatesParameters(),
  ];

  try {
    const { stdout } = await processWrapper.exec('skopeo', env, ...args);
    const manifest = JSON.parse(stdout) as ImageManifest;
    if (isIndex(manifest)) {
      manifestDigest = manifest.manifests?.find(
        (m) =>
          m.platform.os === DEFAULT_PLATFORM_OS &&
          m.platform.architecture === DEFAULT_PLATFORM_ARCH,
      )?.digest;
      indexDigest = manifestDigest ? calculateDigest(stdout) : undefined;
    } else {
      manifestDigest = calculateDigest(stdout);
    }
  } catch (error) {
    logger.warn(
      { error },
      'could not get the image digests through Skopeo inspect-raw',
    );
  }
  return { indexDigest, manifestDigest };
}

function isIndex(manifest: ImageManifest): boolean {
  return (
    manifest.mediaType.includes('vnd.oci.image.index') ||
    manifest.mediaType.includes('vnd.docker.distribution.manifest.list')
  );
}

function calculateDigest(manifest: string): string {
  return `sha256:${crypto
    .createHash('sha256')
    .update(manifest)
    .digest('hex')
    .toString()}`;
}

export function getCopyCredentialParameters(
  credentials: string | undefined,
): Array<processWrapper.IProcessArgument> {
  const credentialsParameters: Array<processWrapper.IProcessArgument> = [];
  if (credentials) {
    credentialsParameters.push({ body: '--src-creds', sanitise: true });
    credentialsParameters.push({ body: credentials, sanitise: true });
  }
  return credentialsParameters;
}

export function getInspectCredentialParameters(
  credentials?: string,
): Array<processWrapper.IProcessArgument> {
  const credentialsParameters: Array<processWrapper.IProcessArgument> = [];
  if (credentials) {
    credentialsParameters.push({ body: '--creds', sanitise: true });
    credentialsParameters.push({ body: credentials, sanitise: true });
  }
  return credentialsParameters;
}

export function getCopyCertificatesParameters(): Array<processWrapper.IProcessArgument> {
  const certificatesParameters: Array<processWrapper.IProcessArgument> = [];
  certificatesParameters.push({ body: '--src-cert-dir', sanitise: true });
  certificatesParameters.push({ body: '/srv/app/certs', sanitise: true });
  return certificatesParameters;
}

export function getInspectCertificatesParameters(): Array<processWrapper.IProcessArgument> {
  const certificatesParameters: Array<processWrapper.IProcessArgument> = [];
  certificatesParameters.push({ body: '--cert-dir', sanitise: true });
  certificatesParameters.push({ body: '/srv/app/certs', sanitise: true });
  return certificatesParameters;
}
