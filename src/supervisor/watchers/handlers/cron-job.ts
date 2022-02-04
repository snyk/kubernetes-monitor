import {
  V1CronJob,
  V1CronJobList,
  V1beta1CronJob,
  V1beta1CronJobList,
  BatchV1Api,
  BatchV1beta1Api,
} from '@kubernetes/client-node';
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

export async function paginatedNamespacedCronJobV1Beta1List(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1beta1CronJobList;
}> {
  const cronJobList = new V1beta1CronJobList();
  cronJobList.apiVersion = 'batch/v1beta1';
  cronJobList.kind = 'CronJobList';
  cronJobList.items = new Array<V1beta1CronJob>();

  return await paginatedNamespacedList(
    namespace,
    cronJobList,
    k8sApi.batchUnstableClient.listNamespacedCronJob.bind(
      k8sApi.batchUnstableClient,
    ),
  );
}

export async function paginatedClusterCronJobV1Beta1List(): Promise<{
  response: IncomingMessage;
  body: V1beta1CronJobList;
}> {
  const cronJobList = new V1beta1CronJobList();
  cronJobList.apiVersion = 'batch/v1beta1';
  cronJobList.kind = 'CronJobList';
  cronJobList.items = new Array<V1beta1CronJob>();

  return await paginatedClusterList(
    cronJobList,
    k8sApi.batchUnstableClient.listCronJobForAllNamespaces.bind(
      k8sApi.batchUnstableClient,
    ),
  );
}

export async function cronJobWatchHandler(
  cronJob: V1CronJob | V1beta1CronJob,
): Promise<void> {
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
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: cronJob.spec.jobTemplate.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
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

export async function isNamespacedCronJobSupported(
  workloadKind: WorkloadKind,
  namespace: string,
  client: BatchV1Api | BatchV1beta1Api,
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
      'Failed on Kubernetes API call to list CronJob or v1beta1 CronJob',
    );
    return false;
  }
}

export async function isClusterCronJobSupported(
  workloadKind: WorkloadKind,
  client: BatchV1Api | BatchV1beta1Api,
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
      'Failed on Kubernetes API call to list CronJob or v1beta1 CronJob',
    );
    return false;
  }
}
