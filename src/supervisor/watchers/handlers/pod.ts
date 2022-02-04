import { V1Pod, V1PodList } from '@kubernetes/client-node';
import { IncomingMessage } from 'http';
import * as async from 'async';

import { logger } from '../../../common/logger';
import { config } from '../../../common/config';
import { processWorkload } from '../../../scanner';
import { sendWorkloadMetadata } from '../../../transmitter';
import { IWorkload, Telemetry } from '../../../transmitter/types';
import { constructWorkloadMetadata } from '../../../transmitter/payload';
import { buildMetadataForWorkload } from '../../metadata-extractor';
import { PodPhase } from '../types';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  getWorkloadAlreadyScanned,
  getWorkloadImageAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
  setWorkloadAlreadyScanned,
  setWorkloadImageAlreadyScanned,
} from '../../../state';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { WorkloadKind } from '../../types';
import { deleteWorkload } from './workload';
import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import { trimWorkload } from '../../workload-sanitization';

export interface ImagesToScanQueueData {
  workloadMetadata: IWorkload[];
  /** The timestamp when this workload was added to the image scan queue. */
  enqueueTimestampMs: number;
}

async function queueWorkerWorkloadScan(
  task: ImagesToScanQueueData,
  callback,
): Promise<void> {
  const { workloadMetadata, enqueueTimestampMs } = task;
  /** Represents how long this workload spent waiting in the queue to be processed. */
  const enqueueDurationMs = Date.now() - enqueueTimestampMs;
  const telemetry: Partial<Telemetry> = {
    enqueueDurationMs,
    queueSize: workloadsToScanQueue.length(),
  };
  try {
    await processWorkload(workloadMetadata, telemetry);
  } catch (err) {
    logger.error(
      { err, task },
      'error processing a workload in the pod handler 2',
    );
    const imageIds = workloadMetadata.map((workload) => workload.imageId);
    const workload = {
      // every workload metadata references the same workload, grab it from the first one
      ...workloadMetadata[0],
      imageIds,
    };
    await deleteWorkloadImagesAlreadyScanned(workload);
  }
}

const workloadsToScanQueue = async.queue<ImagesToScanQueueData>(
  queueWorkerWorkloadScan,
  config.WORKERS_COUNT,
);

workloadsToScanQueue.error(function (err, task) {
  logger.error(
    { err, task },
    'error processing a workload in the pod handler 1',
  );
});

function reportQueueSize(): void {
  try {
    const queueDataToReport: { [key: string]: any } = {};
    queueDataToReport.workloadsToScanLength = workloadsToScanQueue.length();
    logger.debug(queueDataToReport, 'queue sizes report');
  } catch (err) {
    logger.debug({ err }, 'failed logging queue sizes');
  }
}

// Report the queue size shortly after the snyk-monitor starts.
setTimeout(reportQueueSize, 1 * 60 * 1000).unref();
// Additionally, periodically report every X minutes.
setInterval(
  reportQueueSize,
  config.QUEUE_LENGTH_LOG_FREQUENCY_MINUTES * 60 * 1000,
).unref();

async function handleReadyPod(workloadMetadata: IWorkload[]): Promise<void> {
  const workloadToScan: IWorkload[] = [];
  for (const workload of workloadMetadata) {
    const scanned = await getWorkloadImageAlreadyScanned(
      workload,
      workload.imageId,
    );
    if (scanned !== undefined) {
      continue;
    }
    await setWorkloadImageAlreadyScanned(workload, workload.imageId, ''); // empty string takes zero bytes and is !== undefined
    workloadToScan.push(workload);
  }

  if (workloadToScan.length > 0) {
    workloadsToScanQueue.push({
      workloadMetadata: workloadToScan,
      enqueueTimestampMs: Date.now(),
    });
  }
}

export function isPodReady(pod: V1Pod): boolean {
  return (
    pod.status !== undefined &&
    pod.status.phase === PodPhase.Running &&
    pod.status.containerStatuses !== undefined &&
    pod.status.containerStatuses.some(
      (container) =>
        container.state !== undefined &&
        (container.state.running !== undefined ||
          container.state.waiting !== undefined),
    )
  );
}

export async function paginatedNamespacedPodList(namespace: string): Promise<{
  response: IncomingMessage;
  body: V1PodList;
}> {
  const v1PodList = new V1PodList();
  v1PodList.apiVersion = 'v1';
  v1PodList.kind = 'PodList';
  v1PodList.items = new Array<V1Pod>();

  return await paginatedNamespacedList(
    namespace,
    v1PodList,
    k8sApi.coreClient.listNamespacedPod.bind(k8sApi.coreClient),
  );
}

export async function paginatedClusterPodList(): Promise<{
  response: IncomingMessage;
  body: V1PodList;
}> {
  const v1PodList = new V1PodList();
  v1PodList.apiVersion = 'v1';
  v1PodList.kind = 'PodList';
  v1PodList.items = new Array<V1Pod>();

  return await paginatedClusterList(
    v1PodList,
    k8sApi.coreClient.listPodForAllNamespaces.bind(k8sApi.coreClient),
  );
}

export async function podWatchHandler(pod: V1Pod): Promise<void> {
  // This tones down the number of scans whenever a Pod is about to be scheduled by K8s
  if (!isPodReady(pod)) {
    return;
  }

  pod = trimWorkload(pod);

  const podName =
    pod.metadata && pod.metadata.name
      ? pod.metadata.name
      : FALSY_WORKLOAD_NAME_MARKER;

  try {
    const workloadMetadata = await buildMetadataForWorkload(pod);

    if (workloadMetadata === undefined || workloadMetadata.length === 0) {
      logger.warn(
        { podName },
        'could not process pod, the workload is possibly unsupported or deleted',
      );
      return;
    }

    // every element contains the workload information, so we can get it from the first one
    const workloadMember = workloadMetadata[0];
    const workloadMetadataPayload = constructWorkloadMetadata(workloadMember);
    // this is actually the observed generation
    const workloadRevision = workloadMember.revision
      ? workloadMember.revision.toString()
      : '';
    const scanned = await getWorkloadAlreadyScanned(workloadMember);
    if (scanned !== workloadRevision) {
      // either not exists or different
      await setWorkloadAlreadyScanned(workloadMember, workloadRevision);
      await sendWorkloadMetadata(workloadMetadataPayload);
    }

    await handleReadyPod(workloadMetadata);
  } catch (error) {
    logger.error({ error, podName }, 'could not build image metadata for pod');
  }
}

export async function podDeletedHandler(pod: V1Pod): Promise<void> {
  if (!pod.metadata || !pod.spec) {
    return;
  }

  const workloadAlreadyScanned = kubernetesObjectToWorkloadAlreadyScanned(pod);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: pod.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
  }

  const workloadName = pod.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.Pod,
      objectMeta: pod.metadata,
      specMeta: pod.metadata,
      ownerRefs: pod.metadata.ownerReferences,
      podSpec: pod.spec,
    },
    workloadName,
  );
}
