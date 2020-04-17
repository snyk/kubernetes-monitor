import * as needle from 'needle';
import { NeedleResponse, NeedleHttpVerbs } from 'needle';
import * as sleep from 'sleep-promise';
import { URL } from 'url';
import * as config from '../common/config';
import logger = require('../common/logger');
import { IDeleteWorkloadPayload, IDepGraphPayload, IWorkloadMetadataPayload, IResponseWithAttempts } from './types';

const upstreamUrl = config.INTEGRATION_API || config.DEFAULT_KUBERNETES_UPSTREAM_URL;

export async function sendDepGraph(...payloads: IDepGraphPayload[]): Promise<void> {
  for (const payload of payloads) {
    // Intentionally removing dependencyGraph as it would be too big to log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dependencyGraph, ...payloadWithoutDepGraph } = payload;
    try {
      const {response, attempt} = await retryRequest('post', `${upstreamUrl}/api/v1/dependency-graph`, payload);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info({payload: payloadWithoutDepGraph, attempt}, 'dependency graph sent upstream successfully');
      }
    } catch (error) {
      logger.error({error, payload: payloadWithoutDepGraph}, 'could not send the dependency scan result upstream');
    }
  }
}

export async function sendWorkloadMetadata(payload: IWorkloadMetadataPayload): Promise<void> {
    try {
      logger.info({workloadLocator: payload.workloadLocator}, 'attempting to send workload metadata upstream');

      const {response, attempt} = await retryRequest('post', `${upstreamUrl}/api/v1/workload`, payload);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info({workloadLocator: payload.workloadLocator, attempt}, 'workload metadata sent upstream successfully');
      }
    } catch (error) {
      logger.error({error, workloadLocator: payload.workloadLocator}, 'could not send workload metadata upstream');
    }
}

export async function deleteWorkload(payload: IDeleteWorkloadPayload): Promise<void> {
  try {
    const {response, attempt} = await retryRequest('delete', `${upstreamUrl}/api/v1/workload`, payload);
    if (response.statusCode === 404) {
      // TODO: maybe we're still building it?
      const msg = 'attempted to delete a workload the Upstream service could not find';
      logger.info({payload}, msg);
      return;
    }
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    } else {
      logger.info({workloadLocator: payload.workloadLocator, attempt}, 'workload deleted successfully');
    }
  } catch (error) {
    logger.error({error, payload}, 'could not send delete a workload from the upstream');
  }
}

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode > 100 && statusCode < 400;
}

async function retryRequest(verb: NeedleHttpVerbs, url: string, payload: object): Promise<IResponseWithAttempts> {
  const retry = {
    attempts: 3,
    intervalSeconds: 2,
    networkErrorMessages: [
      'socket hang up',
      'Client network socket disconnected before secure TLS connection was established',
    ],
  };
  const options = {
    json: true,
    compressed: true,
    proxy: getProxy(config, url),
  };

  let response: NeedleResponse | undefined;
  let attempt: number;

  for (attempt = 1; attempt <= retry.attempts; attempt++) {
    const stillHaveRetries = attempt + 1 <= retry.attempts;
    try {
      response = await needle(verb, url, payload, options);
      if (!(response.statusCode === 502 && stillHaveRetries)) {
        break;
      }
    } catch (err) {
      if (!(
        err.code === 'ECONNRESET' &&
        retry.networkErrorMessages.includes(err.message) &&
        stillHaveRetries
      )) {
        throw err;
      }
    }
    await sleep(retry.intervalSeconds * 1000);
  }

  if (response === undefined) {
    throw new Error('failed sending a request upstream');
  }

  return {response, attempt};
}

/**
 * Exported for testing
 */
export function getProxy(
  config: Record<string, any>,
  endpoint: string
): string | undefined | never {
  const url = new URL(endpoint);

  // Check if the address is explicitly marked not to be proxied.
  if (config.NO_PROXY) {
    const hosts = config.NO_PROXY.split(',').map((host) => host.toLowerCase());
    
    if (hosts.includes(url.hostname.toLowerCase())) {
      return undefined;
    }

    // CIDR ranges are not supported, e.g. NO_PROXY=192.168.0.0/16.
    // Wildcards are also not supported, e.g. NO_PROXY=*.mydomain.local
  }

  switch (url.protocol) {
    case 'http:':
      return config.HTTP_PROXY || undefined;

    case 'https:':
      return config.HTTPS_PROXY || undefined;

    default:
      const errorMessage = 'Unsupported protocol for proxying';
      logger.error(errorMessage, { url, endpoint });
      throw new Error(errorMessage);
  }
}
