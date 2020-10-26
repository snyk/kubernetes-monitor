import logger = require('../common/logger');
import { pullImages, removePulledImages, getImagesWithFileSystemPath, scanImages } from './images';
import { deleteWorkload, sendDepGraph } from '../transmitter';
import { constructDeleteWorkload, constructDepGraph } from '../transmitter/payload';
import { IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { IPullableImage, IScanImage } from './images/types';

export async function processWorkload(workloadMetadata: IWorkload[]): Promise<void> {
  // every workload metadata references the same workload name, grab it from the first one
  const workloadName = workloadMetadata[0].name;
  const uniqueImages: { [key: string]: IScanImage } = workloadMetadata.reduce((accum, meta) => {
    // example: "docker.io/library/redis@sha256:33ca074e6019b451235735772a9c3e7216f014aae8eb0580d7e94834fe23efb3"
    const imageWithDigest = meta.imageId.substring(meta.imageId.lastIndexOf('/') + 1);

    accum[meta.imageName] = {
      imageName: meta.imageName,
      imageWithDigest,
    };

    return accum;
  }, {});

  logger.info({workloadName, imageCount: Object.values(uniqueImages).length}, 'pulling unique images');
  const imagesWithFileSystemPath = getImagesWithFileSystemPath(Object.values(uniqueImages));
  const pulledImages = await pullImages(imagesWithFileSystemPath);
  if (pulledImages.length === 0) {
    logger.info({workloadName}, 'no images were pulled, halting scanner process.');
    return;
  }

  try {
    await scanImagesAndSendResults(workloadName, pulledImages, workloadMetadata);
  } finally {
    await removePulledImages(pulledImages);
  }
}

// TODO: should be extracted from here and moved to the supervisor
export async function sendDeleteWorkloadRequest(workloadName: string, localWorkloadLocator: ILocalWorkloadLocator): Promise<void> {
  const deletePayload = constructDeleteWorkload(localWorkloadLocator);
  logger.info({workloadName, workload: localWorkloadLocator},
    'removing workloads from upstream');
  await deleteWorkload(deletePayload);
}

async function scanImagesAndSendResults(
  workloadName: string,
  pulledImages: IPullableImage[],
  workloadMetadata: IWorkload[],
): Promise<void> {
  const scannedImages = await scanImages(pulledImages);

  if (scannedImages.length === 0) {
    logger.info({workloadName}, 'no images were scanned, halting scanner process.');
    return;
  }

  logger.info({workloadName, imageCount: scannedImages.length}, 'successfully scanned images');

  const depGraphPayloads = constructDepGraph(scannedImages, workloadMetadata);
  await sendDepGraph(...depGraphPayloads);

  const pulledImagesNames = pulledImages.map((image) => image.imageName);
  const pulledImageMetadata = workloadMetadata.filter((meta) =>
    pulledImagesNames.includes(meta.imageName),
  );

  logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'processed images');
}

