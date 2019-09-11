/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import logger = require('../common/logger');
import { scanImages, IScanResult } from './image-scanner';
import { deleteHomebaseWorkload, sendDepGraph } from '../transmitter';
import { constructHomebaseDeleteWorkloadPayload, constructHomebaseWorkloadPayloads } from '../transmitter/payload';
import { IDepGraphPayload, IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { pullImages, removePulledImages } from './skopeo';

export = class WorkloadWorker {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public async process(workloadMetadata: IWorkload[]) {
    const workloadName = this.name;
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    logger.info({workloadName, imageCount: allImages.length}, 'Queried workloads');
    const uniqueImages = [...new Set<string>(allImages)];

    logger.info({workloadName, imageCount: uniqueImages.length}, 'Pulling unique images');
    const pulledImages = await pullImages(uniqueImages);
    if (pulledImages.length === 0) {
      logger.info({}, 'No images were pulled, halting scanner process.');
      return;
    }

    try {
      logger.info({workloadName, imageCount: pulledImages.length}, 'Scanning pulled images');
      const scannedImages: IScanResult[] = await scanImages(pulledImages);
      logger.info({workloadName, imageCount: scannedImages.length}, 'Successfully scanned images');
      if (scannedImages.length === 0) {
        logger.info({}, 'No images were scanned, halting scanner process.');
        return;
      }

      const homebasePayloads: IDepGraphPayload[] = constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);
      await sendDepGraph(...homebasePayloads);

      const pulledImageMetadata = workloadMetadata.filter((meta) =>
        pulledImages.includes(meta.imageName));

      logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'Processed images');
    } finally {
      logger.info({workloadName, imageCount: pullImages.length}, 'Removing pulled images');
      await removePulledImages(pulledImages);
    }
  }

  public async delete(localWorkloadLocator: ILocalWorkloadLocator) {
    const deletePayload = constructHomebaseDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.name, workload: localWorkloadLocator},
      'Removing workloads from homebase');
    await deleteHomebaseWorkload(deletePayload);
  }
};
