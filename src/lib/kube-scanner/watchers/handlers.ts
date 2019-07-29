import { V1Pod } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import WorkloadWorker = require('../../../lib/kube-scanner');
import { IKubeImage } from '../../../transmitter/types';
import { buildMetadataForWorkload } from '../metadata-extractor';
import { PodPhase, WatchEventType } from './types';

async function handleReadyPod(
    workloadWorker: WorkloadWorker,
    workloadMetadata: IKubeImage[],
    logId: string,
) {
  const processedImages = await workloadWorker.process(workloadMetadata);
  const processedImageNames = processedImages.imageMetadata.map((image) => image.imageName);
  console.log(`${logId}: Processed the following images: ${processedImageNames}.`);
}

async function handleRemovedPod(
  workloadWorker: WorkloadWorker,
  workloadMetadata: IKubeImage[],
  logId: string,
) {
  await workloadWorker.delete(workloadMetadata);
  console.log(`${logId}: Removed the following images: ${workloadMetadata.map((workload) => workload.imageName)}`);
}

export async function podWatchHandler(eventType: string, pod: V1Pod) {
  // This tones down the number of scans whenever a Pod is about to be scheduled by K8s
  if (eventType !== WatchEventType.Deleted && !isPodReady(pod)) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      const imageNames = pod.spec.containers.map((container) => container.image);
      console.log(`${logId}: Could not process the images for Pod ${pod.metadata.name}!` +
        `The workload is possibly unsupported. The pod's spec has the following images: ${imageNames}`);
      return;
    }

    const workloadWorker = new WorkloadWorker(logId);

    switch (eventType) {
      case WatchEventType.Deleted:
        await handleRemovedPod(workloadWorker, workloadMetadata, logId);
        break;
      case WatchEventType.Added:
      case WatchEventType.Modified:
        await handleReadyPod(workloadWorker, workloadMetadata, logId);
        break;
      case WatchEventType.Error:
        console.log(`${logId}: An error event occurred for the Pod, skipping scanning`);
        break;
      case WatchEventType.Bookmark:
        console.log(`${logId}: A bookmark event occurred for the Pod, skipping scanning`);
        break;
      default:
        console.log(`${logId}: An unknown event has occurred: ${eventType}`);
        break;
    }
  } catch (error) {
    const errorMessage = error.response
      ? `${error.response.statusCode} ${error.response.statusMessage}`
      : error.message;
    const imageNames = pod.spec.containers.map((container) => container.image);

    console.log(`${logId}: Could not build image metadata for pod ${pod.metadata.name}: ${errorMessage}`);
    console.log(`${logId}: The pod uses the following images: ${imageNames}`);
  }
}

export function isPodReady(pod: V1Pod) {
  return pod.status.phase === PodPhase.Running &&
    pod.status.containerStatuses.some((container) =>
      container.state.running !== undefined || container.state.waiting !== undefined);
}
