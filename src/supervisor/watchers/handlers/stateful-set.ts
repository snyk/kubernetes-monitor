import { V1StatefulSet, V1StatefulSetList } from '@kubernetes/client-node';
import { deleteWorkload, trimWorkload } from './workload';
import { WorkloadKind } from '../../types';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { IncomingMessage } from 'http';
import { k8sApi } from '../../cluster';
import { paginatedNamespacedList } from './pagination';
import {
  deleteWorkloadAlreadyScanned,
  deleteWorkloadImagesAlreadyScanned,
  kubernetesObjectToWorkloadAlreadyScanned,
} from '../../../state';

export async function paginatedNamespacedStatefulSetList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1StatefulSetList;
}> {
  const v1StatefulSetList = new V1StatefulSetList();
  v1StatefulSetList.apiVersion = 'apps/v1';
  v1StatefulSetList.kind = 'StatefulSetList';
  v1StatefulSetList.items = new Array<V1StatefulSet>();

  return await paginatedNamespacedList(
    namespace,
    v1StatefulSetList,
    k8sApi.appsClient.listNamespacedStatefulSet.bind(k8sApi.appsClient),
  );
}

export async function statefulSetWatchHandler(
  statefulSet: V1StatefulSet,
): Promise<void> {
  statefulSet = trimWorkload(statefulSet);

  if (
    !statefulSet.metadata ||
    !statefulSet.spec ||
    !statefulSet.spec.template.metadata ||
    !statefulSet.spec.template.spec ||
    !statefulSet.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(statefulSet);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: statefulSet.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
  }

  const workloadName = statefulSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.StatefulSet,
      objectMeta: statefulSet.metadata,
      specMeta: statefulSet.spec.template.metadata,
      ownerRefs: statefulSet.metadata.ownerReferences,
      revision: statefulSet.status.observedGeneration,
      podSpec: statefulSet.spec.template.spec,
    },
    workloadName,
  );
}
