import { V1Pod } from '@kubernetes/client-node';
import async = require('async');
import config = require('../../../common/config');
import logger = require('../../../common/logger');
import WorkloadWorker = require('../../../scanner');
import { sendWorkloadMetadata } from '../../../transmitter';
import { IWorkload } from '../../../transmitter/types';
import { constructWorkloadMetadataPayload } from '../../../transmitter/payload';
import { buildMetadataForWorkload } from '../../metadata-extractor';
import { PodPhase } from '../types';
import state = require('../../../state');
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { WorkloadKind } from '../../types';
import { deleteWorkload } from './workload';

function deleteFailedKeysFromState(keys): void {
  try {
    for (const key of keys) {
      try {
        state.imagesAlreadyScanned.del(key);
      } catch (delError) {
        logger.error({delError, key}, 'failed deleting a key of an unsuccessfully scanned image');
      }
    }
  } catch (delError) {
    logger.error({delError, keys}, 'failed deleting all keys of an unsuccessfully scanned workload');
  }
}

async function queueWorkerWorkloadScan(task, callback): Promise<void> {
  const {workloadWorker, workloadMetadata, imageKeys} = task;
  try {
    await workloadWorker.process(workloadMetadata);
  } catch (err) {
    logger.error({err, task}, 'error processing a workload in the pod handler 2');
    deleteFailedKeysFromState(imageKeys);
  }
}

const workloadsToScanQueue = async.queue(queueWorkerWorkloadScan, config.WORKLOADS_TO_SCAN_QUEUE_WORKER_COUNT);

async function queueWorkerMetadataSender(task, callback): Promise<void> {
  const {workloadMetadataPayload} = task;
  await sendWorkloadMetadata(workloadMetadataPayload);
}

const metadataToSendQueue = async.queue(queueWorkerMetadataSender, config.METADATA_TO_SEND_QUEUE_WORKER_COUNT);

workloadsToScanQueue.error(function(err, task) {
  logger.error({err, task}, 'error processing a workload in the pod handler 1');
});

metadataToSendQueue.error(function(err, task) {
  logger.error({err, task}, 'error processing a workload metadata send task');
});

function handleReadyPod(workloadWorker: WorkloadWorker, workloadMetadata: IWorkload[]): void {
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
    workloadsToScanQueue.push({workloadWorker, workloadMetadata: imagesToScan, imageKeys});
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

    // every element contains the workload information, so we can get it from the first one
    const workloadMember = workloadMetadata[0];
    const workloadMetadataPayload = constructWorkloadMetadataPayload(workloadMember);
    const workloadLocator = workloadMetadataPayload.workloadLocator;
    const workloadKey = `${workloadLocator.namespace}/${workloadLocator.type}/${workloadLocator.name}`;
    const workloadRevision = workloadMember.revision ? workloadMember.revision.toString() : ''; // this is actually the observed generation
    if (state.workloadsAlreadyScanned.get(workloadKey) !== workloadRevision) { // either not exists or different
      state.workloadsAlreadyScanned.set(workloadKey, workloadRevision); // empty string takes zero bytes and is !== undefined
      metadataToSendQueue.push({workloadMetadataPayload});
    }

    const workloadName = workloadMember.name;
    const workloadWorker = new WorkloadWorker(workloadName);
    handleReadyPod(workloadWorker, workloadMetadata);
  } catch (error) {
    logger.error({error, podName}, 'could not build image metadata for pod');
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
