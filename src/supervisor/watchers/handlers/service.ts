import { V1Service, V1ServiceList } from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import { buildNonWorkloadMetadata } from '../../metadata-extractor';
import { constructWorkloadMetadata } from '../../../transmitter/payload';
import { sendWorkloadMetadata } from '../../../transmitter';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';

export async function paginatedNamespacedServiceList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1ServiceList;
}> {
  const v1ServiceList = new V1ServiceList();
  v1ServiceList.apiVersion = 'v1';
  v1ServiceList.kind = 'ServiceList';
  v1ServiceList.items = new Array<V1Service>();

  return await paginatedNamespacedList(
    namespace,
    v1ServiceList,
    k8sApi.coreClient.listNamespacedService.bind(k8sApi.coreClient),
  );
}

export async function paginatedClusterServiceList(): Promise<{
  response: IncomingMessage;
  body: V1ServiceList;
}> {
  const v1ServiceList = new V1ServiceList();
  v1ServiceList.apiVersion = 'v1';
  v1ServiceList.kind = 'ServiceList';
  v1ServiceList.items = new Array<V1Service>();

  return await paginatedClusterList(
    v1ServiceList,
    k8sApi.coreClient.listServiceForAllNamespaces.bind(k8sApi.coreClient),
  );
}

export async function serviceWatchHandler(service: V1Service): Promise<void> {
  const metadata = buildNonWorkloadMetadata(
    service.kind || WorkloadKind.Service,
    service.metadata,
    service.spec,
  );
  const workload = constructWorkloadMetadata(metadata);
  await sendWorkloadMetadata(workload);
  return;
}

export async function serviceDeletedHandler(service: V1Service): Promise<void> {
  if (!service.spec || !service.metadata) {
    return;
  }
  const workloadName = service.metadata?.name || FALSY_WORKLOAD_NAME_MARKER;
  await deleteWorkload(
    {
      kind: service.kind || WorkloadKind.Service,
      objectMeta: service.metadata,
      specMeta: service.metadata,
      ownerRefs: service.metadata.ownerReferences,
      podSpec: undefined,
    },
    workloadName,
  );
  return;
}
