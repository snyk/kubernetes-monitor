import { V1Pod } from '@kubernetes/client-node';
import * as async from 'async';
import { logger } from '../../../common/logger';
import { config } from '../../../common/config';
import { processWorkload } from '../../../scanner';
import { sendWorkloadMetadata } from '../../../transmitter';
import { IWorkload, IWorkloadMetadataPayload } from '../../../transmitter/types';
import { constructWorkloadMetadata } from '../../../transmitter/payload';
import { buildMetadataForWorkload } from '../../metadata-extractor';
import { PodPhase } from '../types';
import { state } from '../../../state';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { WorkloadKind } from '../../types';
import { deleteWorkload } from './workload';

type WorkloadToScan = { workloadMetadata: IWorkload[]; imageKeys: string[] };
type MetadataToSend = { workloadMetadataPayload: IWorkloadMetadataPayload };

function deleteFailedKeysFromState(keys: string[]): void {
  try {
    for (const key of keys) {
      try {
        state.imagesAlreadyScanned.del(key);
      } catch (delError) {
        logger.error({ delError, key }, 'failed deleting a key of an unsuccessfully scanned image');
      }
    }
  } catch (delError) {
    logger.error(
      { delError, keys },
      'failed deleting all keys of an unsuccessfully scanned workload',
    );
  }
}

async function queueWorkerWorkloadScan(task: WorkloadToScan, callback): Promise<void> {
  const { workloadMetadata, imageKeys } = task;
  try {
    logger.info(
      {
        scanQueueSize: workloadsToScanQueue.length(),
        metadataQueueSize: metadataToSendQueue.length(),
        imagesAlreadyScannedLength: state.imagesAlreadyScanned.length,
        imagesAlreadyScannedItemCount: state.imagesAlreadyScanned.itemCount,
        workloadsAlreadyScannedLength: state.workloadsAlreadyScanned.length,
        workloadsAlreadyScannedItemCount: state.workloadsAlreadyScanned.itemCount,
      },
      'begin processing workload',
    );
    await processWorkload(workloadMetadata);
  } catch (err) {
    logger.error({ err, task }, 'error processing a workload in the pod handler 2');
    deleteFailedKeysFromState(imageKeys);
  }
}

const workloadsToScanQueue = async.queue<WorkloadToScan>(
  queueWorkerWorkloadScan,
  config.WORKLOADS_TO_SCAN_QUEUE_WORKER_COUNT,
);

async function queueWorkerMetadataSender(task: MetadataToSend, callback): Promise<void> {
  const { workloadMetadataPayload } = task;
  await sendWorkloadMetadata(workloadMetadataPayload);
}

const metadataToSendQueue = async.queue<MetadataToSend>(
  queueWorkerMetadataSender,
  config.METADATA_TO_SEND_QUEUE_WORKER_COUNT,
);

workloadsToScanQueue.error(function(err, task) {
  logger.error({err, task}, 'error processing a workload in the pod handler 1');
});

metadataToSendQueue.error(function(err, task) {
  logger.error({err, task}, 'error processing a workload metadata send task');
});

/** Enqueue the workload's images to be scanned if they have not yet been processed. */
function handleReadyPod(workloadMetadata: IWorkload[]): void {
  const imagesToScan: IWorkload[] = [];
  const imageKeys: string[] = [];
  for (const image of workloadMetadata) {
    const imageKey = `${image.namespace}/${image.type}/${image.name}/${image.imageId}`;
    if (state.imagesAlreadyScanned.get(imageKey) !== undefined) {
      continue;
    }
    state.imagesAlreadyScanned.set(imageKey, ''); // empty string takes zero bytes and is !== undefined
    imagesToScan.push(image);
    imageKeys.push(imageKey);
  }

  if (imagesToScan.length > 0) {
    workloadsToScanQueue.push({workloadMetadata: imagesToScan, imageKeys});
  }
}

export function isPodReady(pod: V1Pod): boolean {
  return pod.status !== undefined && pod.status.phase === PodPhase.Running &&
    pod.status.containerStatuses !== undefined && pod.status.containerStatuses.some((container) =>
      container.state !== undefined &&
      (container.state.running !== undefined || container.state.waiting !== undefined));
}

export async function podWatchHandler(pod: V1Pod): Promise<void> {
  // This tones down the number of scans whenever a Pod is about to be scheduled by K8s
  if (!isPodReady(pod)) {
    return;
  }

  const podName = pod.metadata && pod.metadata.name ? pod.metadata.name : FALSY_WORKLOAD_NAME_MARKER;

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      logger.warn({podName}, 'could not process pod, the workload is possibly unsupported or deleted');
      return;
    }

    handleWorkloadMetadata(workloadMetadata);
    handleReadyPod(workloadMetadata);
  } catch (error) {
    logger.error({error, podName}, 'could not build image metadata for pod');
  }
}

/** Enqueue the workload meta for sending to the upstream if the workload has not yet been processed. */
function handleWorkloadMetadata(workloadMetadata: IWorkload[]): void {
  // every element contains the workload information, so we can get it from the first one
  const workloadMember = workloadMetadata[0];
  const workloadMetadataPayload = constructWorkloadMetadata(workloadMember);
  const workloadLocator = workloadMetadataPayload.workloadLocator;
  const workloadKey = `${workloadLocator.namespace}/${workloadLocator.type}/${workloadLocator.name}`;
  const workloadRevision = workloadMember.revision ? workloadMember.revision.toString() : ''; // this is actually the observed generation
  if (state.workloadsAlreadyScanned.get(workloadKey) !== workloadRevision) { // either not exists or different
    state.workloadsAlreadyScanned.set(workloadKey, workloadRevision); // empty string takes zero bytes and is !== undefined
    metadataToSendQueue.push({ workloadMetadataPayload });
  }
}

export async function podDeletedHandler(pod: V1Pod): Promise<void> {
  if (!pod.metadata || !pod.spec) {
    return;
  }

  const workloadName = pod.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload({
    kind: WorkloadKind.Pod,
    objectMeta: pod.metadata,
    specMeta: pod.metadata,
    ownerRefs: pod.metadata.ownerReferences,
    podSpec: pod.spec,
  }, workloadName);
}
