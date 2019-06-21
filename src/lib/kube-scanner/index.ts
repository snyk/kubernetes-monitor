/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import { sendDepGraph } from '../../transmitter';
import { IDepGraphPayload, IKubeImage, IScanResponse } from '../../transmitter/types';
import { pullImages } from '../images';
import { constructHomebaseWorkloadPayloads, scanImages, ScanResult } from './image-scanner';

export = class WorkloadWorker {
  public static async process(workloadMetadata: IKubeImage[]): Promise<IScanResponse> {
    const allImages = workloadMetadata.map((meta) => meta.imageName);
    console.log(`Queried ${allImages.length} workloads: ${allImages}.`);
    const uniqueImages = [...new Set<string>(allImages)];

    console.log('Begin pulling images...');
    const pulledImages = await pullImages(uniqueImages);
    console.log(`Pulled ${pulledImages.length} images: ${pulledImages}.`);

    console.log('Begin scanning images...');
    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    console.log(`Scanned ${scannedImages.length} images: ${scannedImages.map((image) => image.image)}.`);

    console.log('Begin constructing payloads...');
    const homebasePayloads: IDepGraphPayload[] = constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);
    console.log(`Constructed ${homebasePayloads.length} payloads.`);

    console.log('Sending dep-graphs to homebase...');
    await sendDepGraph(...homebasePayloads);
    console.log('Done!');

    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImages.includes(meta.imageName));
    return { imageMetadata: pulledImageMetadata };
  }
};
