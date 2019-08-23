/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import logger = require('../common/logger');
import { pullImages } from '../images';
import { scanImages, ScanResult } from './image-scanner';
import { deleteHomebaseWorkload, sendDepGraph } from '../transmitter';
import { constructHomebaseDeleteWorkloadPayload, constructHomebaseWorkloadPayloads } from '../transmitter/payload';
import { IDepGraphPayload, IKubeImage, ILocalWorkloadLocator } from '../transmitter/types';

export = class WorkloadWorker {
  private readonly workloadName: string;

  constructor(workloadName: string) {
    this.workloadName = workloadName;
  }

  public async process(workloadMetadata: IKubeImage[]) {
    const workloadName = this.workloadName;
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    logger.info({workloadName, imageCount: allImages.length}, 'Queried workloads');
    const uniqueImages = [...new Set<string>(allImages)];

    logger.info({workloadName, imageCount: uniqueImages.length}, 'Pulling unique images');
    const pulledImages = await pullImages(uniqueImages);
    if (pulledImages.length === 0) {
      logger.info({}, 'No images were pulled, halting scanner process.');
      return;
    }

    logger.info({workloadName, imageCount: pulledImages.length}, 'Scanning pulled images');
    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    if (scannedImages.length === 0) {
      logger.info({}, 'No images were scanned, halting scanner process.');
      return;
    }
    logger.info({workloadName, imageCount: scannedImages.length}, 'Successfully scanned images');

    const homebasePayloads: IDepGraphPayload[] = constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);
    await sendDepGraph(...homebasePayloads);

    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImages.includes(meta.imageName));

    logger.info({workloadName, imageCount: pulledImageMetadata.length}, 'Processed images');
  }

  public async delete(localWorkloadLocator: ILocalWorkloadLocator) {
    const deletePayload = constructHomebaseDeleteWorkloadPayload(localWorkloadLocator);
    logger.info({workloadName: this.workloadName, workload: localWorkloadLocator},
      'Removing workloads from homebase');
    await deleteHomebaseWorkload(deletePayload);
  }
};
