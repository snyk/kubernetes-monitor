import logger = require('../common/logger');
import { pullImages, removePulledImages, getImagesWithFileSystemPath, scanImages } from './images';
import { deleteWorkload, sendDepGraph } from '../transmitter';
import { constructDeleteWorkloadPayload, constructDepGraph } from '../transmitter/payload';
import { IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { IPullableImage } from './images/types';

export = class WorkloadWorker {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async process(workloadMetadata: IWorkload[]): Promise<void> {
    const workloadName = this.name;
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    logger.info({workloadName, imageCount: allImages.length}, 'queried workloads');
    const uniqueImages = [...new Set<string>(allImages)];

    logger.info({workloadName, imageCount: uniqueImages.length}, 'pulling unique images');
    const imagesWithFileSystemPath = getImagesWithFileSystemPath(uniqueImages);
    const pulledImages = await pullImages(imagesWithFileSystemPath);
    if (pulledImages.length === 0) {
      logger.info({workloadName}, 'no images were pulled, halting scanner process.');
      return;
    }

    try {
      await this.scanImagesAndSendResults(workloadName, pulledImages, workloadMetadata);
    } finally {
      await removePulledImages(pulledImages);
    }
  }

  // TODO: should be extracted from here and moved to the supervisor
  public async delete(localWorkloadLocator: ILocalWorkloadLocator): Promise<void> {
    const deletePayload = constructDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.name, workload: localWorkloadLocator},
      'removing workloads from upstream');
    await deleteWorkload(deletePayload);
  }

  private async scanImagesAndSendResults(
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
};
