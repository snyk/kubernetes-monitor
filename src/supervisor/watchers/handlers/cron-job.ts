import { V1CronJob, V1CronJobList, BatchV1Api } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { IncomingMessage } from 'http';
import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';
import { logger } from '../../../common/logger';
import { retryKubernetesApiRequest } from '../../kuberenetes-api-wrappers';
import { trimWorkload } from '../../workload-sanitization';
import { deleteWorkloadFromScanQueue } from './queue';

export async function paginatedNamespacedCronJobList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1CronJobList;
}> {
  const v1CronJobList = new V1CronJobList();
  v1CronJobList.apiVersion = 'batch/v1';
  v1CronJobList.kind = 'CronJobList';
  v1CronJobList.items = new Array<V1CronJob>();

  return await paginatedNamespacedList(
    namespace,
    v1CronJobList,
    k8sApi.batchClient.listNamespacedCronJob.bind(k8sApi.batchClient),
  );
}

export async function paginatedClusterCronJobList(): Promise<{
  response: IncomingMessage;
  body: V1CronJobList;
}> {
  const v1CronJobList = new V1CronJobList();
  v1CronJobList.apiVersion = 'batch/v1';
  v1CronJobList.kind = 'CronJobList';
  v1CronJobList.items = new Array<V1CronJob>();

  return await paginatedClusterList(
    v1CronJobList,
    k8sApi.batchClient.listCronJobForAllNamespaces.bind(k8sApi.batchClient),
  );
}

export async function cronJobWatchHandler(cronJob: V1CronJob): Promise<void> {
  cronJob = trimWorkload(cronJob);

  if (
    !cronJob.metadata ||
    !cronJob.spec ||
    !cronJob.spec.jobTemplate.spec ||
    !cronJob.spec.jobTemplate.metadata ||
    !cronJob.spec.jobTemplate.spec.template.spec
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(cronJob);
  if (workloadAlreadyScanned !== undefined) {
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: cronJob.spec.jobTemplate.spec.template.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
  }

  const workloadName = cronJob.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.CronJob,
      objectMeta: cronJob.metadata,
      specMeta: cronJob.spec.jobTemplate.metadata,
      ownerRefs: cronJob.metadata.ownerReferences,
      podSpec: cronJob.spec.jobTemplate.spec.template.spec,
    },
    workloadName,
  );
}

async function isNamespacedCronJobSupportedWithClient(
  workloadKind: WorkloadKind,
  namespace: string,
  client: BatchV1Api,
): Promise<boolean> {
  try {
    const pretty = undefined;
    const allowWatchBookmarks = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const resourceVersionMatch = undefined;
    const sendInitialEvents = false;
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall = await retryKubernetesApiRequest(() =>
      client.listNamespacedCronJob(
        namespace,
        pretty,
        allowWatchBookmarks,
        continueToken,
        fieldSelector,
        labelSelector,
        limit,
        resourceVersion,
        resourceVersionMatch,
        sendInitialEvents,
        timeoutSeconds,
      ),
    );
    return (
      attemptedApiCall !== undefined &&
      attemptedApiCall.response !== undefined &&
      attemptedApiCall.response.statusCode !== undefined &&
      attemptedApiCall.response.statusCode >= 200 &&
      attemptedApiCall.response.statusCode < 300
    );
  } catch (error) {
    logger.debug(
      { error, workloadKind: workloadKind },
      'Failed on Kubernetes API call to list CronJob',
    );
    return false;
  }
}

export async function isNamespacedCronJobSupported(
  workloadKind: WorkloadKind,
  namespace: string,
): Promise<boolean> {
  const isSupported = await isNamespacedCronJobSupportedWithClient(
    workloadKind,
    namespace,
    k8sApi.batchClient,
  );
  if (workloadKind == WorkloadKind.CronJob) {
    return isSupported;
  }
  return false;
}

export async function isClusterCronJobSupportedWithClient(
  workloadKind: WorkloadKind,
  client: BatchV1Api,
): Promise<boolean> {
  try {
    const pretty = undefined;
    const allowWatchBookmarks = undefined;
    const continueToken = undefined;
    const fieldSelector = undefined;
    const labelSelector = undefined;
    const limit = 1; // Try to grab only a single object
    const resourceVersion = undefined; // List anything in the cluster
    const resourceVersionMatch = undefined;
    const sendInitialEvents = false;
    const timeoutSeconds = 10; // Don't block the snyk-monitor indefinitely
    const attemptedApiCall = await retryKubernetesApiRequest(() =>
      client.listCronJobForAllNamespaces(
        allowWatchBookmarks,
        continueToken,
        fieldSelector,
        labelSelector,
        limit,
        pretty,
        resourceVersion,
        resourceVersionMatch,
        sendInitialEvents,
        timeoutSeconds,
      ),
    );
    return (
      attemptedApiCall !== undefined &&
      attemptedApiCall.response !== undefined &&
      attemptedApiCall.response.statusCode !== undefined &&
      attemptedApiCall.response.statusCode >= 200 &&
      attemptedApiCall.response.statusCode < 300
    );
  } catch (error) {
    logger.debug(
      { error, workloadKind: workloadKind },
      'Failed on Kubernetes API call to list CronJob',
    );
    return false;
  }
}

export async function isClusterCronJobSupported(
  workloadKind: WorkloadKind,
): Promise<boolean> {
  const isSupported = await isClusterCronJobSupportedWithClient(
    workloadKind,
    k8sApi.batchClient,
  );
  if (workloadKind == WorkloadKind.CronJob) {
    return isSupported;
  }
  return false;
}
