import { V1beta1CronJob, V1beta1CronJobList } from '@kubernetes/client-node';
import { deleteWorkload, trimWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { IncomingMessage } from 'http';
import { k8sApi } from '../../cluster';
import { paginatedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';

export async function paginatedCronJobList(namespace: string): Promise<{
  response: IncomingMessage;
  body: V1beta1CronJobList;
}> {
  const v1CronJobList = new V1beta1CronJobList();
  v1CronJobList.apiVersion = 'batch/v1beta1';
  v1CronJobList.kind = 'CronJobList';
  v1CronJobList.items = new Array<V1beta1CronJob>();

  return await paginatedList(
    namespace,
    v1CronJobList,
    k8sApi.batchUnstableClient.listNamespacedCronJob.bind(
      k8sApi.batchUnstableClient,
    ),
  );
}

export async function cronJobWatchHandler(
  cronJob: V1beta1CronJob,
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
