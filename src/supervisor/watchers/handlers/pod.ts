import { V1Pod, V1PodList } from '@kubernetes/client-node';
import { logger } from '../../../common/logger';
import { sendWorkloadMetadata } from '../../../transmitter';
import { IWorkload } from '../../../transmitter/types';
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
import { deleteWorkloadFromScanQueue, workloadsToScanQueue } from './queue';

/** Exported for testing */
export async function handleReadyPod(
  workloadMetadata: IWorkload[],
): Promise<void> {
  const workloadToScan: IWorkload[] = [];
  for (const workload of workloadMetadata) {
    const scanned = getWorkloadImageAlreadyScanned(
      workload,
      workload.imageName,
      workload.imageId,
    );
    // ImageID contains the resolved image digest.
    // ImageName may contain a tag. The image behind this tag can be mutated and can change over time.
    // We need to compare on ImageID which will reliably tell us if the image has changed.
    if (scanned === workload.imageId) {
      logger.debug(
        { workloadToScan, imageId: workload.imageId },
        'image already scanned',
      );
      continue;
    }
    logger.debug(
      { workloadToScan, imageId: workload.imageId },
      'image has not been scanned',
    );
    setWorkloadImageAlreadyScanned(
      workload,
      workload.imageName,
      workload.imageId,
    );
    workloadToScan.push(workload);
  }

  const workload = workloadToScan[0];
  if (workloadToScan.length > 0) {
    await workloadsToScanQueue.pushAsync({
      key: workload.uid,
      workloadMetadata: workloadToScan,
      enqueueTimestampMs: Date.now(),
    });
  }
}

export function isPodReady(pod: V1Pod): boolean {
  const isTerminating = pod.metadata?.deletionTimestamp !== undefined;
  const podStatusPhase = pod.status?.phase === PodPhase.Running;
  const containerReadyStatuses = Boolean(
    pod.status?.containerStatuses?.every(
      (container) => container.state?.running !== undefined,
    ),
  );

  const logContext = {
    isTerminating,
    podStatusPhase,
    containerReadyStatuses,
  };
  logger.debug(logContext, 'checking to see if pod is ready to process');
  return !isTerminating && podStatusPhase && containerReadyStatuses;
}

export async function paginatedNamespacedPodList(namespace: string): Promise<V1PodList> {
  const v1PodList = new V1PodList();
  v1PodList.apiVersion = 'v1';
  v1PodList.kind = 'PodList';
  v1PodList.items = new Array<V1Pod>();

  return await paginatedNamespacedList(
    namespace,
    v1PodList,
    k8sApi.coreClient.listNamespacedPodWithHttpInfo.bind(k8sApi.coreClient),
  );
}

export async function paginatedClusterPodList(): Promise<V1PodList> {
  const v1PodList = new V1PodList();
  v1PodList.apiVersion = 'v1';
  v1PodList.kind = 'PodList';
  v1PodList.items = new Array<V1Pod>();

  return await paginatedClusterList(
    v1PodList,
    k8sApi.coreClient.listPodForAllNamespacesWithHttpInfo.bind(k8sApi.coreClient),
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
    const scannedRevision = getWorkloadAlreadyScanned(workloadMember);
    const isRevisionDifferent =
      scannedRevision === undefined ||
      Number(workloadRevision) > Number(scannedRevision);
    if (isRevisionDifferent) {
      setWorkloadAlreadyScanned(workloadMember, workloadRevision);
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
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: pod.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
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
