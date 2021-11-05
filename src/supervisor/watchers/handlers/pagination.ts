import { IncomingMessage } from 'http';
import * as sleep from 'sleep-promise';
import type {
  KubernetesListObject,
  KubernetesObject,
} from '@kubernetes/client-node';

import { calculateSleepSeconds } from '../../kuberenetes-api-wrappers';
import { V1NamespacedList } from './types';
import type { IRequestError } from '../../types';

const PAGE_SIZE = 100;

/**
 * This function ensures that when listing workloads from the Kubernetes API, they are paginated in batches of 100.
 * The workloads collected are additionally trimmed to contain only the relevant data for vulnerability analysis.
 * The combination of both listing and trimming ensures we reduce our memory footprint and prevent overloading the API server.
 */
export async function paginatedList<
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
        const trimmedItems = trimItems(listCall.body.items);
        list.items.push(...trimmedItems);
      }

      continueToken = listCall.body.metadata?._continue;
      if (!continueToken) {
        break;
      }
    } catch (err) {
      const error = err as IRequestError;

      switch (error.code) {
        case 'ECONNRESET':
          const seconds = calculateSleepSeconds();
          await sleep(seconds);
          continue;
        default:
          break;
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
 * Pick only the minimum relevant data from the workload. Sometimes the workload
 * spec may be bloated with server-side information that is not necessary for vulnerability analysis.
 * This ensures that any data we hold in memory is minimal, which in turn allows us to hold more workloads to scan.
 */
function trimItems<
  T extends KubernetesObject & Partial<{ status: unknown; spec: unknown }>,
>(items: T[]): KubernetesObject[] {
  return items.map((item) => ({
    apiVersion: item.apiVersion,
    kind: item.kind,
    metadata: {
      name: item.metadata?.name,
      namespace: item.metadata?.namespace,
      annotations: item.metadata?.annotations,
      labels: item.metadata?.labels,
      ownerReferences: item.metadata?.ownerReferences,
      uid: item.metadata?.uid,
      resourceVersion: item.metadata?.resourceVersion,
      generation: item.metadata?.generation,
    },
    spec: item.spec,
    status: item.status,
  }));
}
