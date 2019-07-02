import { V1Pod } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import WorkloadWorker = require('../../../lib/kube-scanner');
import { buildMetadataForWorkload } from '../metadata-extractor';
import { WatchEventType } from './types';

export async function podWatchHandler(eventType: string, pod: V1Pod) {
  const logId = uuidv4().substring(0, 8);

  if (eventType === WatchEventType.Deleted) {
    return;
  }

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      const imageNames = pod.spec.containers.map((container) => container.image);
      console.log(`${logId}: Could not process the images for Pod ${pod.metadata.name}!` +
        `The workload is possibly unsupported. The pod's spec has the following images: ${imageNames}`);
      return;
    }

    const workloadWorker = new WorkloadWorker(logId);
    const processedImages = await workloadWorker.process(workloadMetadata);

    const processedImageNames = processedImages.imageMetadata.map((image) => image.imageName);
    console.log(`${logId}: Processed the following images: ${processedImageNames}.`);
  } catch (error) {
    const errorMessage = error.response
      ? `${error.response.statusCode} ${error.response.statusMessage}`
      : error.message;
    const imageNames = pod.spec.containers.map((container) => container.image);

    console.log(`${logId}: Could not build image metadata for pod ${pod.metadata.name}: ${errorMessage}`);
    console.log(`${logId}: The pod uses the following images: ${imageNames}`);
  }
}
