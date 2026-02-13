import sleep from 'sleep-promise';
import type {
  KubernetesListObject,
  KubernetesObject,
} from '@kubernetes/client-node';

import { calculateSleepSeconds } from '../../kuberenetes-api-wrappers';
import { V1ClusterList, V1NamespacedList } from './types';
import { trimWorkloads } from '../../workload-sanitization';
import type { IRequestError } from '../../types';
import {
  RETRYABLE_NETWORK_ERROR_CODES,
  RETRYABLE_NETWORK_ERROR_MESSAGES,
} from '../types';

export const PAGE_SIZE = 100;

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
export async function paginatedNamespacedList<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(
  namespace: string,
  list: KubernetesListObject<KubernetesObject>,
  listPromise: V1NamespacedList<KubernetesListObject<T>>,
): Promise<KubernetesListObject<KubernetesObject>> {
  let continueToken: string | undefined = undefined;

  const pretty = undefined;
  const allowWatchBookmarks = undefined;
  const fieldSelector = undefined;
  const labelSelector = undefined;

  // let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      const listCall = await listPromise({
        namespace,
        pretty,
        allowWatchBookmarks,
        _continue: continueToken,
        fieldSelector,
        labelSelector,
        limit: PAGE_SIZE,
      });
      // TODO: Resolve this type issue here and below
      // incomingMessage = listCall.response;
      list.metadata = listCall.metadata;

      if (Array.isArray(listCall.items)) {
        const trimmedItems = trimWorkloads(listCall.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.metadata?._continue;
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

  // if (!incomingMessage) {
  //   throw new Error('could not list workload');
  // }

  // return {
  //   response: incomingMessage,
  //   body: list,
  // };
  return list;
}

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
export async function paginatedClusterList<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(
  list: KubernetesListObject<KubernetesObject>,
  listPromise: V1ClusterList<KubernetesListObject<T>>,
): Promise<KubernetesListObject<KubernetesObject>> {
  let continueToken: string | undefined = undefined;

  const allowWatchBookmarks = undefined;
  const fieldSelector = undefined;
  const labelSelector = undefined;

  // let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      const listCall = await listPromise({
        allowWatchBookmarks,
        _continue: continueToken,
        fieldSelector,
        labelSelector,
        limit: PAGE_SIZE,
      });
      // incomingMessage = listCall;
      list.metadata = listCall.metadata;

      if (Array.isArray(listCall.items)) {
        const trimmedItems = trimWorkloads(listCall.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.metadata?._continue;
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

  // if (!incomingMessage) {
  //   throw new Error('could not list workload');
  // }

  return list;
}
