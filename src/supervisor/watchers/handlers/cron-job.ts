import { V1CronJob, V1CronJobList } from '@kubernetes/client-node';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';
import { trimWorkload } from '../../workload-sanitization';
import { deleteWorkloadFromScanQueue } from './queue';

export async function paginatedNamespacedCronJobList(
  namespace: string,
): Promise<V1CronJobList> {
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

export async function paginatedClusterCronJobList(): Promise<V1CronJobList> {
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
