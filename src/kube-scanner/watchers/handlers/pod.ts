import { V1Pod } from '@kubernetes/client-node';
import async = require('async');
import * as uuidv4 from 'uuid/v4';
import config = require('../../../common/config');
import logger = require('../../../common/logger');
import WorkloadWorker = require('../../../kube-scanner');
import { IKubeImage } from '../../../transmitter/types';
import { buildMetadataForWorkload } from '../../metadata-extractor';
import { PodPhase, WatchEventType } from '../types';

async function queueWorker(task, callback) {
  const {workloadWorker, workloadMetadata} = task;
  await workloadWorker.process(workloadMetadata);
}

const workloadsToScanQueue = async.queue(queueWorker, config.WORKLOADS_TO_SCAN_QUEUE_WORKER_COUNT);

async function handleReadyPod(workloadWorker: WorkloadWorker, workloadMetadata: IKubeImage[]) {
  workloadsToScanQueue.push({workloadWorker, workloadMetadata});
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
      logger.warn({logId, podName: pod.metadata!.name}, 'Could not process Pod. The workload is possibly unsupported');
      return;
    }

    const workloadWorker = new WorkloadWorker(logId);

    switch (eventType) {
      case WatchEventType.Added:
      case WatchEventType.Modified:
        await handleReadyPod(workloadWorker, workloadMetadata);
        break;
      case WatchEventType.Error:
        break;
      case WatchEventType.Bookmark:
        break;
      case WatchEventType.Deleted:
        logger.info({logId, podName: pod.metadata!.name}, 'DELETED event occurred for the Pod, skipping scanning');
        break;
      default:
        break;
    }
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
