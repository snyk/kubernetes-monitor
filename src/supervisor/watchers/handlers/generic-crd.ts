import {
  KubernetesListObject,
  KubernetesObject,
} from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

import { k8sApi } from '../../cluster';
import { paginatedClusterList, paginatedNamespacedList } from './pagination';
import { constructWorkloadMetadata } from '../../../transmitter/payload';
import { buildNonWorkloadMetadata } from '../../metadata-extractor';
import { sendWorkloadMetadata } from '../../../transmitter';
import { CrdApiDefinition, CrdList, FALSY_WORKLOAD_NAME_MARKER } from './types';
import { deleteWorkload } from './workload';

export async function paginatedNamespacedCrdList(
  crdApiDefinition: CrdApiDefinition,
  namespace: string,
): Promise<{
  response: IncomingMessage;
  body: KubernetesListObject<KubernetesObject>;
}> {
  const crdList = new CrdList();
  crdList.apiVersion = crdApiDefinition.version;
  crdList.kind = crdApiDefinition.resourceKind;
  crdList.items = new Array<KubernetesObject>();

  return await paginatedNamespacedList(
    namespace,
    crdList,
    async (
      namespace: string,
      pretty?: string,
      _allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
    ) =>
      k8sApi.customObjectsClient.listNamespacedCustomObject(
        crdApiDefinition.group,
        crdApiDefinition.version,
        namespace,
        crdApiDefinition.resourceKindPlural,
        pretty,
        false,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
      ) as any,
  );
}

export async function paginatedClusterCrdList(
  crdApiDefinition: CrdApiDefinition,
): Promise<{
  response: IncomingMessage;
  body: KubernetesListObject<KubernetesObject>;
}> {
  const crdList = new CrdList();
  crdList.apiVersion = crdApiDefinition.version;
  crdList.kind = crdApiDefinition.resourceKind;
  crdList.items = new Array<KubernetesObject>();

  return await paginatedClusterList(
    crdList,
    async (
      _allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      pretty?: string,
    ) =>
      k8sApi.customObjectsClient.listClusterCustomObject(
        crdApiDefinition.group,
        crdApiDefinition.version,
        crdApiDefinition.resourceKindPlural,
        pretty,
        false,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
      ) as any,
  );
}

export async function crdWatchHandler(
  kubeObj: KubernetesObject & any,
): Promise<void> {
  if (!kubeObj.spec) {
    return;
  }
  const metadata = buildNonWorkloadMetadata(
    kubeObj.kind,
    kubeObj.metadata,
    kubeObj.spec,
  );
  const workload = constructWorkloadMetadata(metadata);
  await sendWorkloadMetadata(workload);
  return;
}

export async function crdDeleteHandler(
  kubeObj: KubernetesObject & any,
): Promise<void> {
  if (!kubeObj.metadata) {
    return;
  }
  const workloadName = kubeObj.metadata?.name || FALSY_WORKLOAD_NAME_MARKER;
  await deleteWorkload(
    {
      kind: kubeObj.kind,
      objectMeta: kubeObj.metadata,
      specMeta: kubeObj.metadata,
      ownerRefs: kubeObj.metadata.ownerReferences,
      podSpec: undefined,
    },
    workloadName,
  );
  return;
}
