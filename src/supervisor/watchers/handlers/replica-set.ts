import { V1ReplicaSet, V1ReplicaSetList } from '@kubernetes/client-node';
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
import { trimWorkload } from '../../workload-sanitization';

export async function paginatedNamespacedReplicaSetList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1ReplicaSetList;
}> {
  const v1ReplicaSetList = new V1ReplicaSetList();
  v1ReplicaSetList.apiVersion = 'apps/v1';
  v1ReplicaSetList.kind = 'ReplicaSetList';
  v1ReplicaSetList.items = new Array<V1ReplicaSet>();

  return await paginatedNamespacedList(
    namespace,
    v1ReplicaSetList,
    k8sApi.appsClient.listNamespacedReplicaSet.bind(k8sApi.appsClient),
  );
}

export async function paginatedClusterReplicaSetList(): Promise<{
  response: IncomingMessage;
  body: V1ReplicaSetList;
}> {
  const v1ReplicaSetList = new V1ReplicaSetList();
  v1ReplicaSetList.apiVersion = 'apps/v1';
  v1ReplicaSetList.kind = 'ReplicaSetList';
  v1ReplicaSetList.items = new Array<V1ReplicaSet>();

  return await paginatedClusterList(
    v1ReplicaSetList,
    k8sApi.appsClient.listReplicaSetForAllNamespaces.bind(k8sApi.appsClient),
  );
}

export async function replicaSetWatchHandler(
  replicaSet: V1ReplicaSet,
): Promise<void> {
  replicaSet = trimWorkload(replicaSet);

  if (
    !replicaSet.metadata ||
    !replicaSet.spec ||
    !replicaSet.spec.template ||
    !replicaSet.spec.template.metadata ||
    !replicaSet.spec.template.spec ||
    !replicaSet.status
  ) {
    return;
  }

  const workloadAlreadyScanned =
    kubernetesObjectToWorkloadAlreadyScanned(replicaSet);
  if (workloadAlreadyScanned !== undefined) {
    await Promise.all([
      deleteWorkloadAlreadyScanned(workloadAlreadyScanned),
      deleteWorkloadImagesAlreadyScanned({
        ...workloadAlreadyScanned,
        imageIds: replicaSet.spec.template.spec.containers
          .filter((container) => container.image !== undefined)
          .map((container) => container.image!),
      }),
    ]);
  }

  const workloadName = replicaSet.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.ReplicaSet,
      objectMeta: replicaSet.metadata,
      specMeta: replicaSet.spec.template.metadata,
      ownerRefs: replicaSet.metadata.ownerReferences,
      revision: replicaSet.status.observedGeneration,
      podSpec: replicaSet.spec.template.spec,
    },
    workloadName,
  );
}
