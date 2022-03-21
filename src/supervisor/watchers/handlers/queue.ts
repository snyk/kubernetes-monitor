import * as async from 'async';
import { config } from '../../../common/config';

import { logger } from '../../../common/logger';
import { processWorkload } from '../../../scanner';
import { deleteWorkloadImagesAlreadyScanned } from '../../../state';
import type { IWorkload, Telemetry } from '../../../transmitter/types';

interface ImagesToScanQueueData {
  /** Identifies the workload in the queue. */
  key: string;
  workloadMetadata: IWorkload[];
  /** The timestamp when this workload was added to the image scan queue. */
  enqueueTimestampMs: number;
}

export const workloadsToScanQueue = async.queue<ImagesToScanQueueData>(
  queueWorkerWorkloadScan,
  config.WORKERS_COUNT,
);

export async function deleteWorkloadFromScanQueue(workload: {
  uid: string;
}): Promise<void> {
  workloadsToScanQueue.remove(
    (item) => item.data && item.data.key === workload.uid,
  );
}

workloadsToScanQueue.error(function (err, task) {
  logger.error(
    { err, task },
    'error processing a workload in the pod handler 1',
  );
});

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
