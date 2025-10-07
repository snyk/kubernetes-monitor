import { IncomingMessage } from 'http';
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

// another issue is if http and non-http client node api calls are wrapped in this funciton 
// both types of functions  have different return signatures that do not align with IncomingMessage

// This is the source of a lot of errors -- if we tweak this to be 1.0.0 compatible, will help alleviate a lot of the issues  
export async function paginatedNamespacedList<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(
  namespace: string,
  list: KubernetesListObject<KubernetesObject>,
  listPromise: V1NamespacedList<KubernetesListObject<T>>,
): Promise<{
  response: IncomingMessage;
  body: KubernetesListObject<KubernetesObject>;
}> {
  let continueToken: string | undefined = undefined;

  const pretty = undefined;
  const allowWatchBookmarks = undefined;
  const fieldSelector = undefined;
  const labelSelector = undefined;

  let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      const listCall: {
        response: IncomingMessage;
        body: KubernetesListObject<T>;
      } = await listPromise(
        namespace,
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

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */

// same core issue as paginatedNamespacedList 
export async function paginatedClusterList<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(
  list: KubernetesListObject<KubernetesObject>,
  listPromise: V1ClusterList<KubernetesListObject<T>>,
): Promise<{
  response: IncomingMessage;
  body: KubernetesListObject<KubernetesObject>;
}> {
  let continueToken: string | undefined = undefined;

  const allowWatchBookmarks = undefined;
  const fieldSelector = undefined;
  const labelSelector = undefined;

  let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      const listCall: {
        response: IncomingMessage;
        body: KubernetesListObject<T>;
      } = await listPromise(
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
      // the status code is no longer a property of the error object
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
