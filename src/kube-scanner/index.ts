import logger = require('../common/logger');
import { pullImages, removePulledImages, getImagesWithFileSystemPath } from '../images';
import { scanImages, IScanResult } from './image-scanner';
import { deleteHomebaseWorkload, sendDepGraph } from '../transmitter';
import { constructHomebaseDeleteWorkloadPayload, constructDepGraph } from '../transmitter/payload';
import { IDepGraphPayload, IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { IPullableImage } from '../images/types';

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

  public async delete(localWorkloadLocator: ILocalWorkloadLocator): Promise<void> {
    const deletePayload = constructHomebaseDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.name, workload: localWorkloadLocator},
      'removing workloads from homebase');
    await deleteHomebaseWorkload(deletePayload);
  }

  private async scanImagesAndSendResults(
    workloadName: string,
    pulledImages: IPullableImage[],
    workloadMetadata: IWorkload[],
  ): Promise<void> {
    const scannedImages: IScanResult[] = await scanImages(pulledImages);

    if (scannedImages.length === 0) {
      logger.info({workloadName}, 'no images were scanned, halting scanner process.');
      return;
    }

    logger.info({workloadName, imageCount: scannedImages.length}, 'successfully scanned images');

    const depGraphPayloads: IDepGraphPayload[] = constructDepGraph(scannedImages, workloadMetadata);
    await sendDepGraph(...depGraphPayloads);

    const pulledImagesNames = pulledImages.map((image) => image.imageName);
    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImagesNames.includes(meta.imageName),
    );

    logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'processed images');
  }
};
