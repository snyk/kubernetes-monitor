import { logger } from '../common/logger';
import {
  pullImages,
  removePulledImages,
  getImagesWithFileSystemPath,
  scanImages,
  getImageParts,
} from './images';
import { deleteWorkload, sendDepGraph, sendScanResults } from '../transmitter';
import {
  constructDeleteWorkload,
  constructDepGraph,
  constructScanResults,
} from '../transmitter/payload';
import {
  IWorkload,
  ILocalWorkloadLocator,
  Telemetry,
} from '../transmitter/types';
import { IPullableImage, IScanImage } from './images/types';

export async function processWorkload(
  workloadMetadata: IWorkload[],
  telemetry: Partial<Telemetry>,
): Promise<void> {
  // every workload metadata references the same workload name, grab it from the first one
  const workloadName = workloadMetadata[0].name;
  const uniqueImages: IScanImage[] = getUniqueImages(workloadMetadata);

  logger.info(
    { workloadName, imageCount: uniqueImages.length },
    'pulling unique images',
  );
  const imagesWithFileSystemPath = getImagesWithFileSystemPath(uniqueImages);
  const imagePullStartTimestampMs = Date.now();
  const pulledImages = await pullImages(imagesWithFileSystemPath);
  const imagePullDurationMs = Date.now() - imagePullStartTimestampMs;
  if (pulledImages.length === 0) {
    logger.info(
      { workloadName },
      'no images were pulled, halting scanner process.',
    );
    return;
  }
  telemetry.imagePullDurationMs = imagePullDurationMs;

  try {
    await scanImagesAndSendResults(
      workloadName,
      pulledImages,
      workloadMetadata,
      telemetry,
    );
  } finally {
    await removePulledImages(pulledImages);
  }
}

// TODO: should be extracted from here and moved to the supervisor
export async function sendDeleteWorkloadRequest(
  workloadName: string,
  localWorkloadLocator: ILocalWorkloadLocator,
): Promise<void> {
  const deletePayload = constructDeleteWorkload(localWorkloadLocator);
  logger.info(
    { workloadName, workload: localWorkloadLocator },
    'removing workloads from upstream',
  );
  await deleteWorkload(deletePayload);
}

export function getUniqueImages(workloadMetadata: IWorkload[]): IScanImage[] {
  const uniqueImages: { [key: string]: IScanImage } = workloadMetadata.reduce(
    (accum, meta) => {
      logger.info(
        {
          workloadName: workloadMetadata[0].name,
          name: meta.imageName,
          id: meta.imageId,
        },
        'image metadata',
      );
      // example: For DCR "redis:latest"
      // example: For GCR "gcr.io/test-dummy/redis:latest"
      // example: For ECR "291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/redis:latest"
      // meta.imageName can be different depends on CR
      const { imageName } = getImageParts(meta.imageName);
      // meta.imageId can be different depends on CR
      // example: For DCR "docker.io/library/redis@sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6"
      // example: For GCR "sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6"
      // example: For ECR "sha256:8e9f8546050da8aae393a41d65ad37166b4f0d8131d627a520c0f0451742e9d6"
      let digest: string | undefined = undefined;
      if (
        meta.imageId.lastIndexOf('@') > -1 ||
        meta.imageId.startsWith('sha')
      ) {
        digest = meta.imageId.substring(meta.imageId.lastIndexOf('@') + 1);
      }

      accum[meta.imageName] = {
        imageWithDigest: digest && `${imageName}@${digest}`,
        imageName: meta.imageName, // Image name with tag
      };

      return accum;
    },
    {},
  );

  return Object.values(uniqueImages);
}

async function scanImagesAndSendResults(
  workloadName: string,
  pulledImages: IPullableImage[],
  workloadMetadata: IWorkload[],
  telemetry: Partial<Telemetry>,
): Promise<void> {
  const imageScanStartTimestampMs = Date.now();
  const scannedImages = await scanImages(pulledImages);
  const imageScanDurationMs = Date.now() - imageScanStartTimestampMs;

  if (scannedImages.length === 0) {
    logger.info(
      { workloadName },
      'no images were scanned, halting scanner process.',
    );
    return;
  }

  telemetry.imageScanDurationMs = imageScanDurationMs;

  logger.info(
    { workloadName, imageCount: scannedImages.length },
    'successfully scanned images',
  );

  const scanResultsPayloads = constructScanResults(
    scannedImages,
    workloadMetadata,
    telemetry,
  );
  const success = await sendScanResults(scanResultsPayloads);
  if (!success) {
    const depGraphPayloads = constructDepGraph(scannedImages, workloadMetadata);
    await sendDepGraph(...depGraphPayloads);
  }

  const pulledImagesNames = pulledImages.map((image) => image.imageName);
  const pulledImageMetadata = workloadMetadata.filter((meta) =>
    pulledImagesNames.includes(meta.imageName),
  );

  logger.info(
    { workloadName, imageCount: pulledImageMetadata.length },
    'processed images',
  );
}
