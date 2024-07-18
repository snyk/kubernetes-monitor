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
import { IncomingMessage } from 'http';
import sleep from 'sleep-promise';
import { logger } from '../../../common/logger';
import { storeNamespace, deleteNamespace } from '../../../state';
import { k8sApi, kubeConfig } from '../../cluster';
import {
  calculateSleepSeconds,
  retryKubernetesApiRequest,
} from '../../kuberenetes-api-wrappers';
import { IRequestError } from '../../types';
import { trimWorkloads } from '../../workload-sanitization';
import {
  RETRYABLE_NETWORK_ERROR_CODES,
  RETRYABLE_NETWORK_ERROR_MESSAGES,
} from '../types';
import { restartableErrorHandler } from './error';
import { PAGE_SIZE } from './pagination';

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
        const reply = await k8sApi.coreClient.readNamespace(namespace);
        const list = new V1NamespaceList();
        list.apiVersion = 'v1';
        list.kind = 'NamespaceList';
        list.items = new Array<V1Namespace>(reply.body);
        list.metadata = new V1ListMeta();
        return {
          response: reply.response,
          body: list,
        };
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

async function paginatedNamespaceList(): Promise<{
  response: IncomingMessage;
  body: V1NamespaceList;
}> {
  const v1NamespaceList = new V1NamespaceList();
  v1NamespaceList.apiVersion = 'v1';
  v1NamespaceList.kind = 'NamespaceList';
  v1NamespaceList.items = new Array<V1Namespace>();

  return await listPaginatedNamespaces(v1NamespaceList);
}

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
async function listPaginatedNamespaces(list: V1NamespaceList): Promise<{
  response: IncomingMessage;
  body: V1NamespaceList;
}> {
  let continueToken: string | undefined = undefined;

  const pretty = undefined;
  const allowWatchBookmarks = undefined;
  const fieldSelector = undefined;
  const labelSelector = undefined;

  let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      const listCall = await k8sApi.coreClient.listNamespace(
        pretty,
        allowWatchBookmarks,
        continueToken,
        fieldSelector,
        labelSelector,
        PAGE_SIZE,
      );
      incomingMessage = listCall.response;
      list.metadata = listCall.body.metadata;

      if (Array.isArray(listCall.body.items)) {
        const trimmedItems = trimWorkloads(listCall.body.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.body.metadata?._continue;
      if (!continueToken) {
        break;
      }
    } catch (err) {
      const error = err as IRequestError;

      if (
        RETRYABLE_NETWORK_ERROR_CODES.includes(error.code || '') ||
        RETRYABLE_NETWORK_ERROR_MESSAGES.includes(error.message || '')
      ) {
        const seconds = calculateSleepSeconds();
        await sleep(seconds);
        continue;
      }

      switch (error.response?.statusCode) {
        case 410: // Gone
          break loop;
        case 429: // Too Many Requests
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
          const seconds = calculateSleepSeconds(error.response);
          await sleep(seconds);
          continue;
        default:
          throw err;
      }
    }
  }

  if (!incomingMessage) {
    throw new Error('could not list workload');
  }

  return {
    response: incomingMessage,
    body: list,
  };
}
