import sleep from 'sleep-promise';
import type {
  KubernetesListObject,
  KubernetesObject,
} from '@kubernetes/client-node';

import {
  calculateSleepSeconds,
  getErrorStatusCode,
  isRetryableNetworkError,
} from '../../kuberenetes-api-wrappers';
import { V1ClusterList, V1NamespacedList } from './types';
import { trimWorkloads } from '../../workload-sanitization';
import type { IRequestError } from '../../types';

export const PAGE_SIZE = 100;

type ListPage = (
  continueToken: string | undefined,
) => Promise<KubernetesListObject<KubernetesObject>>;

async function paginatedList<L extends KubernetesListObject<KubernetesObject>>(
  list: L,
  listPage: ListPage,
): Promise<L> {
  let continueToken: string | undefined = undefined;
  let listed = false;

  loop: while (true) {
    try {
      const page = await listPage(continueToken);
      listed = true;
      list.metadata = page.metadata;

      if (Array.isArray(page.items)) {
        const trimmedItems = trimWorkloads(page.items);
        list.items.push(...trimmedItems);
      }

      continueToken = page.metadata?._continue;
      if (!continueToken) {
        break;
      }
    } catch (err) {
      const error = err as IRequestError;

      if (isRetryableNetworkError(error)) {
        const seconds = calculateSleepSeconds();
        await sleep(seconds);
        continue;
      }

      switch (getErrorStatusCode(error)) {
        case 410: // Gone
          break loop;
        case 429: // Too Many Requests
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
          const seconds = calculateSleepSeconds(error.headers);
          await sleep(seconds);
          continue;
        default:
          throw err;
      }
    }
  }

  if (!listed) {
    throw new Error('could not list workload');
  }

  return list;
}

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
export async function paginatedNamespacedList<
  L extends KubernetesListObject<KubernetesObject>,
>(
  namespace: string,
  list: L,
  listPromise: V1NamespacedList<KubernetesListObject<KubernetesObject>>,
): Promise<L> {
  return paginatedList(list, (continueToken) =>
    listPromise({ namespace, _continue: continueToken, limit: PAGE_SIZE }),
  );
}

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
export async function paginatedClusterList<
  L extends KubernetesListObject<KubernetesObject>,
>(
  list: L,
  listPromise: V1ClusterList<KubernetesListObject<KubernetesObject>>,
): Promise<L> {
  return paginatedList(list, (continueToken) =>
    listPromise({ _continue: continueToken, limit: PAGE_SIZE }),
  );
}
