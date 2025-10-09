import sleep from 'sleep-promise';
import type {
  KubernetesListObject,
  KubernetesObject,
  HttpInfo,
} from '@kubernetes/client-node';

import { calculateSleepSeconds } from '../../kuberenetes-api-wrappers';
import { V1ClusterList, V1NamespacedList } from './types';
import { trimWorkloads } from '../../workload-sanitization';
import type { NewIRequestError } from '../../types';
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

// Assume that paginatedNamespacedList, ListPromise is using the withHTTP methods instead  
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

  //let incomingMessage: IncomingMessage | undefined = undefined;

  loop: while (true) {
    try {
      // need to remove incomingMessage and return the object directly 
      const listCall: HttpInfo<KubernetesListObject<T>> = // need to package parameters into one object 
      await listPromise({
        namespace,
        pretty,
        allowWatchBookmarks,
        _continue:continueToken,
        fieldSelector,
        labelSelector,
        limit: PAGE_SIZE,
      });

      //incomingMessage = listCall.response;
      list.metadata = listCall.data.metadata;

      if (Array.isArray(listCall.data.items)) {
        const trimmedItems = trimWorkloads(listCall.data.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.data.metadata?._continue;
      if (!continueToken) {
        break;
      }
    } catch (err) { 
      const error = err as NewIRequestError;

      if (
        RETRYABLE_NETWORK_ERROR_CODES.includes(error.code as string) ||
        RETRYABLE_NETWORK_ERROR_MESSAGES.includes(error.message || '')
      ) {
        const seconds = calculateSleepSeconds();
        await sleep(seconds);
        continue;
      }

      switch (error.code) {
        case 410: // Gone
          throw new Error('could not list workload');
        case 429: // Too Many Requests
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
          const seconds = calculateSleepSeconds(error);
          await sleep(seconds);
          continue;
        default:
          throw err;
      }
    }
  }
  // TODO: Q: Do we need to throw an error here? No longer using incomingMessage
  // if (!incomingMessage) {
  //   throw new Error('could not list workload');
  // }

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

  loop: while (true) {
    try {
      const listCall: HttpInfo<KubernetesListObject<T>> = await listPromise({
        allowWatchBookmarks,
        _continue:continueToken,
        fieldSelector,
        labelSelector,
        limit: PAGE_SIZE,
    });
      //incomingMessage = listCall.response;

      list.metadata = listCall.data.metadata;

      if (Array.isArray(listCall.data.items)) {
        const trimmedItems = trimWorkloads(listCall.data.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.data.metadata?._continue;
      if (!continueToken) {
        break;
      }
    } catch (err) {
      const error = err as NewIRequestError;

      if (
        RETRYABLE_NETWORK_ERROR_CODES.includes(error.code as string) ||
        RETRYABLE_NETWORK_ERROR_MESSAGES.includes(error.message || '')
      ) {
        const seconds = calculateSleepSeconds();
        await sleep(seconds);
        continue;
      }
      // the status code is no longer a property of the error object
      switch (error.code) {
        case 410: // Gone
          throw new Error('could not list workload');
        case 429: // Too Many Requests
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
          const seconds = calculateSleepSeconds(error);
          await sleep(seconds);
          continue;
        default:
          throw err;
      }
    }
  }
  // TODO: Q: Same question as paginatedNamespacedList - do we need to throw an error here? A: yes, but we 
  // throw an error above in the 410
  // if (!incomingMessage) {
  //   throw new Error('could not list workload');
  // }

  return list;
}
