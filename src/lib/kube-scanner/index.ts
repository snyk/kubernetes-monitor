/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import { deleteHomebaseWorkload, sendDepGraph } from '../../transmitter';
import { constructHomebaseDeleteWorkloadPayloads, constructHomebaseWorkloadPayloads } from '../../transmitter/payload';
import { IDepGraphPayload, IKubeImage, IScanResponse } from '../../transmitter/types';
import { pullImages } from '../images';
import { scanImages, ScanResult } from './image-scanner';

export = class WorkloadWorker {
  private readonly logId: string;

  constructor(logId: string) {
    this.logId = logId;
  }

  public async process(workloadMetadata: IKubeImage[]): Promise<IScanResponse> {
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    console.log(`${this.logId}: Queried ${allImages.length} workloads: ${allImages}.`);
    const uniqueImages = [...new Set<string>(allImages)];

    console.log(`${this.logId}: Begin pulling images...`);
    const pulledImages = await pullImages(uniqueImages);
    console.log(`${this.logId}: Pulled ${pulledImages.length} images: ${pulledImages}.`);

    console.log(`${this.logId}: Begin scanning images...`);
    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    console.log(`${this.logId}: Scanned ${scannedImages.length} images: ${scannedImages.map((image) => image.image)}.`);

    console.log(`${this.logId}: Begin constructing payloads...`);
    const homebasePayloads: IDepGraphPayload[] = constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);
    console.log(`${this.logId}: Constructed ${homebasePayloads.length} payloads.`);

    console.log(`${this.logId}: Sending dep-graphs to homebase...`);
    await sendDepGraph(...homebasePayloads);
    console.log(`${this.logId}: Done!`);

    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImages.includes(meta.imageName));
    return { imageMetadata: pulledImageMetadata };
  }

  public async delete(workloadMetadata: IKubeImage[]) {
    const deletePayloads = constructHomebaseDeleteWorkloadPayloads(workloadMetadata);
    await deleteHomebaseWorkload(deletePayloads);
  }
};
