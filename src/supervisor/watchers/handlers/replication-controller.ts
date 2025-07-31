import {
  V1ReplicationController,
  V1ReplicationControllerList,
} from '@kubernetes/client-node';
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

export async function paginatedNamespacedReplicationControllerList(
  namespace: string,
): Promise<V1ReplicationControllerList> {
  const v1ReplicationControllerList = new V1ReplicationControllerList();
  v1ReplicationControllerList.apiVersion = 'v1';
  v1ReplicationControllerList.kind = 'ReplicationControllerList';
  v1ReplicationControllerList.items = new Array<V1ReplicationController>();

  return await paginatedNamespacedList(
    namespace,
    v1ReplicationControllerList,
    k8sApi.coreClient.listNamespacedReplicationController.bind(
      k8sApi.coreClient,
    ),
  );
}

export async function paginatedClusterReplicationControllerList(): Promise<V1ReplicationControllerList> {
  const v1ReplicationControllerList = new V1ReplicationControllerList();
  v1ReplicationControllerList.apiVersion = 'v1';
  v1ReplicationControllerList.kind = 'ReplicationControllerList';
  v1ReplicationControllerList.items = new Array<V1ReplicationController>();

  return await paginatedClusterList(
    v1ReplicationControllerList,
    k8sApi.coreClient.listReplicationControllerForAllNamespaces.bind(
      k8sApi.coreClient,
    ),
  );
}

export async function replicationControllerWatchHandler(
  replicationController: V1ReplicationController,
): Promise<void> {
  replicationController = trimWorkload(replicationController);

  if (
    !replicationController.metadata ||
    !replicationController.spec ||
    !replicationController.spec.template ||
    !replicationController.spec.template.metadata ||
    !replicationController.spec.template.spec ||
    !replicationController.status
  ) {
    return;
  }

  const workloadAlreadyScanned = kubernetesObjectToWorkloadAlreadyScanned(
    replicationController,
  );
  if (workloadAlreadyScanned !== undefined) {
    deleteWorkloadAlreadyScanned(workloadAlreadyScanned);
    deleteWorkloadImagesAlreadyScanned({
      ...workloadAlreadyScanned,
      imageIds: replicationController.spec.template.spec.containers
        .filter((container) => container.image !== undefined)
        .map((container) => container.image!),
    });
    deleteWorkloadFromScanQueue(workloadAlreadyScanned);
  }

  const workloadName =
    replicationController.metadata.name || FALSY_WORKLOAD_NAME_MARKER;

  await deleteWorkload(
    {
      kind: WorkloadKind.ReplicationController,
      objectMeta: replicationController.metadata,
      specMeta: replicationController.spec.template.metadata,
      ownerRefs: replicationController.metadata.ownerReferences,
      revision: replicationController.status.observedGeneration,
      podSpec: replicationController.spec.template.spec,
    },
    workloadName,
  );
}
