import { V1Pod } from '@kubernetes/client-node';
import WorkloadWorker = require('../../../lib/kube-scanner');
import { buildMetadataForWorkload } from '../metadata-extractor';
import { WatchEventType } from './types';

export async function podWatchHandler(eventType: string, pod: V1Pod) {
  if (eventType === WatchEventType.Deleted) {
    return;
  }

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      const imageNames = pod.spec.containers.map((container) => container.image);
      console.log(`Could not process the images for Pod ${pod.metadata.name}! The workload is possibly unsupported.` +
        `The pod's spec has the following images: ${imageNames}`);
      return;
    }

    const processedImages = await WorkloadWorker.process(workloadMetadata);

    const processedImageNames = processedImages.imageMetadata.map((image) => image.imageName);
    console.log(`Processed the following images: ${processedImageNames}.`);
  } catch (error) {
    const errorMessage = error.response
      ? `${error.response.statusCode} ${error.response.statusMessage}`
      : error.message;
    const imageNames = pod.spec.containers.map((container) => container.image);

    console.log(`Could not build image metadata for pod ${pod.metadata.name}: ${errorMessage}`);
    console.log(`The pod uses the following images: ${imageNames}`);
  }
}
