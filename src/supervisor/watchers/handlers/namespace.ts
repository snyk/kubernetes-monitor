import {
  ADD,
  DELETE,
  ERROR,
  KubernetesObject,
  makeInformer,
  UPDATE,
  V1Namespace,
  V1NamespaceList,
  V1ListMeta,
} from '@kubernetes/client-node';
import { logger } from '../../../common/logger';
import { storeNamespace, deleteNamespace } from '../../../state';
import { k8sApi, kubeConfig } from '../../cluster';
import { retryKubernetesApiRequest } from '../../kuberenetes-api-wrappers';
import { restartableErrorHandler } from './error';
import { paginatedClusterList } from './pagination';

/**
 * We need to track all namespaces in the cluster so that we can detect usage of the namespaced annotated import.
 * For this feature there will be a special annotation on the namespace, which indicates that all workloads
 * in that namespace should be automatically imported.
 *
 * This function tracks changes to all namespaces in the cluster.
 *
 * @deprecated We prefer customers to move to workload auto-import with Rego policy.
 * This feature should be removed at some point!
 */
export async function trackNamespaces(): Promise<void> {
  const logContext: Record<string, unknown> = {};
  const endpoint = '/api/v1/namespaces';

  const loggedListMethod = async () => {
    try {
      return await retryKubernetesApiRequest(() => paginatedNamespaceList());
    } catch (error) {
      logger.error(
        { ...logContext, error },
        'error while listing namespaces in cluster',
      );
      throw error;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    endpoint,
    loggedListMethod,
  );

  informer.on(ADD, storeNamespace);
  informer.on(UPDATE, storeNamespace);
  informer.on(DELETE, deleteNamespace);
  informer.on(ERROR, restartableErrorHandler(informer, logContext));

  await informer.start();
}

/**
 * We need to track all namespaces in the cluster so that we can detect usage of the namespaced annotated import.
 * For this feature there will be a special annotation on the namespace, which indicates that all workloads
 * in that namespace should be automatically imported.
 *
 * This function tracks just a single namespace. It's used when the snyk-monitor is deployed to monitor
 * just a single namespace.
 *
 * @deprecated We prefer customers to move to workload auto-import with Rego policy.
 * This feature should be removed at some point!
 */
export async function trackNamespace(namespace: string): Promise<void> {
  const logContext: Record<string, unknown> = {};
  const endpoint = `/api/v1/watch/namespaces/${namespace}`;

  const loggedListMethod = async () => {
    try {
      return await retryKubernetesApiRequest(async () => {
        logger.info({}, 'retrying k8s api request');
        const reply = await k8sApi.coreClient.readNamespace({
          name: namespace,
        });
        const list = new V1NamespaceList();
        list.apiVersion = 'v1';
        list.kind = 'NamespaceList';
        list.items = new Array<V1Namespace>(reply);
        list.metadata = new V1ListMeta();
        return list;
      });
    } catch (error) {
      logger.error({ ...logContext, error }, 'error while listing namespace');
      throw error;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    endpoint,
    loggedListMethod,
  );

  informer.on(ADD, storeNamespace);
  informer.on(UPDATE, storeNamespace);
  informer.on(DELETE, deleteNamespace);
  informer.on(ERROR, restartableErrorHandler(informer, logContext));

  await informer.start();
}

async function paginatedNamespaceList(): Promise<V1NamespaceList> {
  const v1NamespaceList = new V1NamespaceList();
  v1NamespaceList.apiVersion = 'v1';
  v1NamespaceList.kind = 'NamespaceList';
  v1NamespaceList.items = new Array<V1Namespace>();

  return await paginatedClusterList(
    v1NamespaceList,
    k8sApi.coreClient.listNamespace.bind(k8sApi.coreClient),
  );
}
