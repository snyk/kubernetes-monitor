import logger = require('../common/logger');
import { pullImages, removePulledImages, getImagesWithFileSystemPath } from '../images';
import { scanImages, IScanResult } from './image-scanner';
import { deleteHomebaseWorkload, sendDepGraph } from '../transmitter';
import { constructHomebaseDeleteWorkloadPayload, constructHomebaseDepGraphPayloads } from '../transmitter/payload';
import { IDepGraphPayload, IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { IPullableImage } from '../images/types';

const inProgressWorkloads = new Set<string>();
const deletedWorkloads = new Set<string>();

function getWorkloadKeyForDeletionTracking(namespace: string, type: string, name: string): string {
  return `${namespace}:${type}:${name}`;
}

export = class WorkloadWorker {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async process(workloadMetadata: IWorkload[]): Promise<void> {
    let pulledImages: IPullableImage[] = [];

    const { namespace, type, name } = workloadMetadata[0];
    const trackedWorkloadKey = getWorkloadKeyForDeletionTracking(namespace, type, name);
    inProgressWorkloads.add(trackedWorkloadKey);

    try {
      const workloadName = this.name;
      const allImages = workloadMetadata.map((meta) => meta.imageName);
      logger.info({workloadName, imageCount: allImages.length}, 'queried workloads');
      const uniqueImages = [...new Set<string>(allImages)];
  
      logger.info({workloadName, imageCount: uniqueImages.length}, 'pulling unique images');
      const imagesWithFileSystemPath = getImagesWithFileSystemPath(uniqueImages);
      pulledImages = await pullImages(imagesWithFileSystemPath);
      if (pulledImages.length === 0) {
        logger.info({workloadName}, 'no images were pulled, halting scanner process.');
        return;
      }

      await this.scanImagesAndSendResults(workloadName, pulledImages, workloadMetadata, trackedWorkloadKey);
    } finally {
      await removePulledImages(pulledImages);

      inProgressWorkloads.delete(trackedWorkloadKey);
      deletedWorkloads.delete(trackedWorkloadKey);
    }
  }

  public async delete(localWorkloadLocator: ILocalWorkloadLocator): Promise<void> {
    const deletePayload = constructHomebaseDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.name, workload: localWorkloadLocator},
      'removing workloads from homebase');

    const workloadKey = getWorkloadKeyForDeletionTracking(
      localWorkloadLocator.namespace,
      localWorkloadLocator.type,
      localWorkloadLocator.name,
    );

    if (inProgressWorkloads.has(workloadKey)) {
      deletedWorkloads.add(workloadKey);
    }
    
    await deleteHomebaseWorkload(deletePayload);
  }

  private async scanImagesAndSendResults(
    workloadName: string,
    pulledImages: IPullableImage[],
    workloadMetadata: IWorkload[],
    trackedWorkloadKey: string,
  ): Promise<void> {
    const scannedImages: IScanResult[] = await scanImages(pulledImages);

    if (scannedImages.length === 0) {
      logger.info({workloadName}, 'no images were scanned, halting scanner process.');
      return;
    }

    logger.info({workloadName, imageCount: scannedImages.length}, 'successfully scanned images');

    if (deletedWorkloads.has(trackedWorkloadKey)) {
      logger.info({workloadName}, 'the workload has been deleted during image scanning, skipping sending scan results');
      return;
    }

    const depGraphPayloads: IDepGraphPayload[] = constructHomebaseDepGraphPayloads(scannedImages, workloadMetadata);
    await sendDepGraph(...depGraphPayloads);

    const pulledImagesNames = pulledImages.map((image) => image.imageName);
    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImagesNames.includes(meta.imageName),
    );

    logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'processed images');
  }
};
