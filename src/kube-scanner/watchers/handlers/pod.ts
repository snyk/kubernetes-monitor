import { V1Pod } from '@kubernetes/client-node';
import async = require('async');
import * as uuidv4 from 'uuid/v4';
import config = require('../../../common/config');
import logger = require('../../../common/logger');
import WorkloadWorker = require('../../../kube-scanner');
import { IKubeImage } from '../../../transmitter/types';
import { buildMetadataForWorkload } from '../../metadata-extractor';
import { PodPhase } from '../types';
import state = require('../../../state');

async function queueWorker(task, callback) {
  const {workloadWorker, workloadMetadata, imageKeys} = task;
  try {
    await workloadWorker.process(workloadMetadata);
  } catch (err) {
    logger.error({err, task}, 'error processing a workload in the pod handler 2');
    deleteFailedKeysFromState(imageKeys);
  }
}

const workloadsToScanQueue = async.queue(queueWorker, config.WORKLOADS_TO_SCAN_QUEUE_WORKER_COUNT);

workloadsToScanQueue.error(function(err, task) {
  logger.error({err, task}, 'error processing a workload in the pod handler 1');
});

async function handleReadyPod(workloadWorker: WorkloadWorker, workloadMetadata: IKubeImage[]) {
  const imagesToScan: IKubeImage[] = [];
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

export async function podWatchHandler(pod: V1Pod) {
  // This tones down the number of scans whenever a Pod is about to be scheduled by K8s
  if (!isPodReady(pod)) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      logger.warn({logId, podName: pod.metadata!.name}, 'Could not process Pod. The workload is possibly unsupported');
      return;
    }

    const workloadWorker = new WorkloadWorker(logId);
    await handleReadyPod(workloadWorker, workloadMetadata);
  } catch (error) {
    logger.error({error, logId, podName: pod.metadata!.name}, 'Could not build image metadata for pod');
  }
}

export function isPodReady(pod: V1Pod) {
  return pod.status !== undefined && pod.status.phase === PodPhase.Running &&
    pod.status.containerStatuses !== undefined && pod.status.containerStatuses.some((container) =>
      container.state !== undefined &&
      (container.state.running !== undefined || container.state.waiting !== undefined));
}

function deleteFailedKeysFromState(keys) {
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
