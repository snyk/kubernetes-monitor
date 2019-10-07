/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import logger = require('../common/logger');
import { pullImages, removePulledImages } from '../images';
import { scanImages, IScanResult } from './image-scanner';
import { deleteHomebaseWorkload, sendDepGraph } from '../transmitter';
import { constructHomebaseDeleteWorkloadPayload, constructHomebaseDepGraphPayloads } from '../transmitter/payload';
import { IDepGraphPayload, IWorkload, ILocalWorkloadLocator } from '../transmitter/types';

export = class WorkloadWorker {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async process(workloadMetadata: IWorkload[]) {
    const workloadName = this.name;
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    logger.info({workloadName, imageCount: allImages.length}, 'queried workloads');
    const uniqueImages = [...new Set<string>(allImages)];

    logger.info({workloadName, imageCount: uniqueImages.length}, 'pulling unique images');
    const pulledImages = await pullImages(uniqueImages);
    if (pulledImages.length === 0) {
      logger.info({}, 'no images were pulled, halting scanner process.');
      return;
    }

    try {
      await this.scanImagesAndSendResults(workloadName, pulledImages, workloadMetadata);
    } finally {
      await removePulledImages(pulledImages);
    }
  }

  public async delete(localWorkloadLocator: ILocalWorkloadLocator) {
    const deletePayload = constructHomebaseDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.name, workload: localWorkloadLocator},
      'removing workloads from homebase');
    await deleteHomebaseWorkload(deletePayload);
  }

  private async scanImagesAndSendResults(
    workloadName: string,
    pulledImages: string[],
    workloadMetadata: IWorkload[],
  ): Promise<void> {
    const scannedImages: IScanResult[] = await scanImages(pulledImages);

    logger.info({workloadName, imageCount: scannedImages.length}, 'successfully scanned images');
    if (scannedImages.length === 0) {
      logger.info({}, 'no images were scanned, halting scanner process.');
      return;
    }

    const depGraphPayloads: IDepGraphPayload[] = constructHomebaseDepGraphPayloads(scannedImages, workloadMetadata);
    await sendDepGraph(...depGraphPayloads);

    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImages.includes(meta.imageName));

    logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'processed images');
  }
};
