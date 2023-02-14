import { V1Ingress, V1IngressList } from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import { constructWorkloadMetadata } from '../../../transmitter/payload';
import { buildNonWorkloadMetadata } from '../../metadata-extractor';
import { sendWorkloadMetadata } from '../../../transmitter';
import { FALSY_WORKLOAD_NAME_MARKER } from './types';
import { deleteWorkload } from './workload';
import { WorkloadKind } from '../../types';

export async function paginatedNamespacedIngressList(
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: V1IngressList;
}> {
  const v1IngressList = new V1IngressList();
  v1IngressList.apiVersion = 'v1';
  v1IngressList.kind = 'IngressList';
  v1IngressList.items = new Array<V1Ingress>();

  return await paginatedNamespacedList(
    namespace,
    v1IngressList,
    k8sApi.networkClient.listNamespacedIngress.bind(k8sApi.coreClient),
  );
}

export async function paginatedClusterIngressList(): Promise<{
  response: IncomingMessage;
  body: V1IngressList;
}> {
  const v1IngressList = new V1IngressList();
  v1IngressList.apiVersion = 'v1';
  v1IngressList.kind = 'IngressList';
  v1IngressList.items = new Array<V1Ingress>();

  return await paginatedClusterList(
    v1IngressList,
    k8sApi.networkClient.listIngressForAllNamespaces.bind(k8sApi.coreClient),
  );
}

export async function ingressWatchHandler(ingress: V1Ingress): Promise<void> {
  const metadata = buildNonWorkloadMetadata(
    ingress.kind || WorkloadKind.Ingress,
    ingress.metadata,
    ingress.spec,
  );
  const workload = constructWorkloadMetadata(metadata);
  await sendWorkloadMetadata(workload);
  return;
}

export async function ingressDeletedHandler(ingress: V1Ingress): Promise<void> {
  if (!ingress.spec || !ingress.metadata) {
    return;
  }
  const workloadName = ingress.metadata?.name || FALSY_WORKLOAD_NAME_MARKER;
  await deleteWorkload(
    {
      kind: ingress.kind || WorkloadKind.Ingress,
      objectMeta: ingress.metadata,
      specMeta: ingress.metadata,
      ownerRefs: ingress.metadata.ownerReferences,
      podSpec: undefined,
    },
    workloadName,
  );
  return;
}
