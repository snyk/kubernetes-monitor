import * as fastq from 'fastq';
import needle from 'needle';
import sleep from 'sleep-promise';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { NeedleResponse, NeedleHttpVerbs, NeedleOptions } from 'needle';

import { logger } from '../common/logger';
import { config } from '../common/config';
import {
  IDeleteWorkloadPayload,
  IWorkloadMetadataPayload,
  IResponseWithAttempts,
  IRequestError,
  ScanResultsPayload,
  IDependencyGraphPayload,
  IWorkloadEventsPolicyPayload,
  IClusterMetadataPayload,
  IRuntimeDataPayload,
} from './types';
import { getProxyAgent } from './proxy';

import type { queueAsPromised } from 'fastq';

interface KubernetesUpstreamRequest {
  method: NeedleHttpVerbs;
  url: string;
  payload:
    | IDependencyGraphPayload
    | ScanResultsPayload
    | IWorkloadMetadataPayload
    | IDeleteWorkloadPayload
    | IClusterMetadataPayload
    | IRuntimeDataPayload;
}

const upstreamUrl =
  config.INTEGRATION_API || config.DEFAULT_KUBERNETES_UPSTREAM_URL;

let httpAgent = new HttpAgent({
  keepAlive: config.USE_KEEPALIVE,
});

let httpsAgent = new HttpsAgent({
  keepAlive: config.USE_KEEPALIVE,
});

function getAgent(u: string): HttpAgent {
  const url = new URL(u);
  return url.protocol === 'https:' ? httpsAgent : httpAgent;
}

// Async queue wraps around the call to retryRequest in order to limit
// the number of requests in flight to kubernetes upstream at any one time.
const reqQueue: queueAsPromised<unknown> = fastq.promise(async function (
  req: KubernetesUpstreamRequest,
) {
  return await retryRequest(req.method, req.url, req.payload);
},
config.REQUEST_QUEUE_LENGTH);

export async function sendDepGraph(
  ...payloads: IDependencyGraphPayload[]
): Promise<void> {
  for (const payload of payloads) {
    // Intentionally removing dependencyGraph as it would be too big to log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dependencyGraph, ...payloadWithoutDepGraph } = payload;
    try {
      const request: KubernetesUpstreamRequest = {
        method: 'post',
        url: `${upstreamUrl}/api/v1/dependency-graph`,
        payload,
      };

      const { response, attempt } = await reqQueue.push(request);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info(
          { payload: payloadWithoutDepGraph, attempt },
          'dependency graph sent upstream successfully',
        );
      }
    } catch (error) {
      logger.error(
        { error, payload: payloadWithoutDepGraph },
        'could not send the dependency scan result upstream',
      );
    }
  }
}

export async function sendScanResults(
  payloads: ScanResultsPayload[],
): Promise<boolean> {
  for (const payload of payloads) {
    // Intentionally removing scan results as they would be too big to log
    const payloadWithoutScanResults = { ...payload, scanResults: undefined };
    try {
      const request: KubernetesUpstreamRequest = {
        method: 'post',
        url: `${upstreamUrl}/api/v1/scan-results`,
        payload,
      };

      const { response, attempt } = await reqQueue.push(request);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info(
          { payload: payloadWithoutScanResults, attempt },
          'scan results sent upstream successfully',
        );
      }
    } catch (error) {
      logger.error(
        { error, payload: payloadWithoutScanResults },
        'could not send the scan results upstream',
      );
      return false;
    }
  }

  return true;
}

export async function sendWorkloadMetadata(
  payload: IWorkloadMetadataPayload,
): Promise<void> {
  try {
    logger.info(
      { workloadLocator: payload.workloadLocator },
      'attempting to send workload metadata upstream',
    );

    const request: KubernetesUpstreamRequest = {
      method: 'post',
      url: `${upstreamUrl}/api/v1/workload`,
      payload,
    };

    const { response, attempt } = await reqQueue.push(request);
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    } else {
      logger.info(
        { workloadLocator: payload.workloadLocator, attempt },
        'workload metadata sent upstream successfully',
      );
    }
  } catch (error) {
    logger.error(
      { error, workloadLocator: payload.workloadLocator },
      'could not send workload metadata upstream',
    );
  }
}

export async function sendWorkloadEventsPolicy(
  payload: IWorkloadEventsPolicyPayload,
): Promise<void> {
  try {
    logger.info(
      {
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
      },
      'attempting to send workload auto-import policy',
    );

    const { response, attempt } = await retryRequest(
      'post',
      `${upstreamUrl}/api/v1/policy`,
      payload,
    );
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    }

    logger.info(
      {
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
        attempt,
      },
      'workload auto-import policy sent upstream successfully',
    );
  } catch (error) {
    logger.error(
      {
        error,
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
      },
      'could not send workload auto-import policy',
    );
  }
}

export async function deleteWorkload(
  payload: IDeleteWorkloadPayload,
): Promise<void> {
  try {
    const { workloadLocator, agentId } = payload;
    const { userLocator, cluster, namespace, type, name } = workloadLocator;
    const query = `userLocator=${userLocator}&cluster=${cluster}&namespace=${namespace}&type=${type}&name=${name}&agentId=${agentId}`;
    const request: KubernetesUpstreamRequest = {
      method: 'delete',
      url: `${upstreamUrl}/api/v1/workload?${query}`,
      payload,
    };

    const { response, attempt } = await reqQueue.push(request);
    // TODO: Remove this check, the upstream no longer returns 404 in such cases
    if (response.statusCode === 404) {
      logger.info(
        { payload },
        'attempted to delete a workload the Upstream service could not find',
      );
      return;
    }
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    } else {
      logger.info(
        { workloadLocator: payload.workloadLocator, attempt },
        'workload deleted successfully',
      );
    }
  } catch (error) {
    logger.error(
      { error, payload },
      'could not send delete a workload from the upstream',
    );
  }
}

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode > 100 && statusCode < 400;
}

export async function retryRequest(
  verb: NeedleHttpVerbs,
  url: string,
  payload: object,
  reqOptions: NeedleOptions = {},
): Promise<IResponseWithAttempts> {
  const retry = {
    attempts: 3,
    rateLimitIntervalSeconds: 60,
    transientIntervalSeconds: 2,
  };
  const options: NeedleOptions = {
    json: true,
    compressed: true,
    agent: getAgent(url),
    ...reqOptions,
  };

  if (config.HTTP_PROXY || config.HTTPS_PROXY) {
    options.agent = getProxyAgent(config, url);
  }

  let response: NeedleResponse | undefined;
  let attempt: number;

  for (attempt = 1; attempt <= retry.attempts; attempt++) {
    const stillHaveRetries = attempt + 1 <= retry.attempts;
    let statusCode: number | undefined = undefined;

    try {
      response = await needle(verb, url, payload, options);
      statusCode = response.statusCode;

      if (
        ![429, 502, 503, 504].includes(response.statusCode || 0) ||
        !stillHaveRetries
      ) {
        break;
      }
    } catch (err: any) {
      if (!shouldRetryRequest(err, stillHaveRetries)) {
        throw err;
      }
    }

    if (statusCode === 429) {
      await sleep(retry.rateLimitIntervalSeconds * 1000);
    } else {
      await sleep(retry.transientIntervalSeconds * 1000);
    }
  }

  if (response === undefined) {
    throw new Error('failed sending a request upstream');
  }

  return { response, attempt };
}

function shouldRetryRequest(
  err: IRequestError,
  stillHaveRetries: boolean,
): boolean {
  const networkErrorMessages: string[] = [
    'socket hang up',
    'Client network socket disconnected before secure TLS connection was established',
    'write ECONNRESET', // May happen due to Keep-Alive race condition - https://code-examples.net/en/q/28a8069
  ];

  if (!stillHaveRetries) {
    return false;
  }

  if (err.code === 'ECONNRESET' && networkErrorMessages.includes(err.message)) {
    return true;
  }

  if (err.code === 'EAI_AGAIN') {
    return true;
  }

  return false;
}

export async function sendClusterMetadata(): Promise<void> {
  const payload: IClusterMetadataPayload = {
    userLocator: config.INTEGRATION_ID,
    cluster: config.CLUSTER_NAME,
    agentId: config.AGENT_ID,
    version: config.MONITOR_VERSION,
    namespace: config.NAMESPACE,
  };

  try {
    logger.info(
      {
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
      },
      'attempting to send cluster metadata',
    );

    const request: KubernetesUpstreamRequest = {
      method: 'post',
      url: `${upstreamUrl}/api/v1/cluster`,
      payload,
    };

    const { response, attempt } = await reqQueue.push(request);
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    }

    logger.info(
      {
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
        attempt,
      },
      'cluster metadata sent upstream successfully',
    );
  } catch (error) {
    logger.error(
      {
        error,
        userLocator: payload.userLocator,
        cluster: payload.cluster,
        agentId: payload.agentId,
      },
      'could not send cluster metadata',
    );
  }
}

export async function sendRuntimeData(
  payload: IRuntimeDataPayload,
): Promise<void> {
  const logContext = {
    userLocator: payload.target.userLocator,
    cluster: payload.target.cluster,
    agentId: payload.target.agentId,
    identity: payload.identity,
  };

  try {
    logger.info(logContext, 'attempting to send runtime data');

    const request: KubernetesUpstreamRequest = {
      method: 'post',
      url: `${upstreamUrl}/api/v1/runtime-results`,
      payload,
    };

    const { response, attempt } = await reqQueue.push(request);

    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    }

    logger.info(
      {
        attempt,
        ...logContext,
      },
      'runtime data sent upstream successfully',
    );
  } catch (error) {
    logger.error(
      {
        error,
        ...logContext,
      },
      'could not send runtime data',
    );
  }
}
