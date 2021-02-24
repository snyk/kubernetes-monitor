import * as needle from 'needle';
import { NeedleResponse, NeedleHttpVerbs, NeedleOptions } from 'needle';
import * as sleep from 'sleep-promise';
import { logger } from '../common/logger';
import { config } from '../common/config';
import {
  IDeleteWorkloadPayload,
  IWorkloadMetadataPayload,
  IResponseWithAttempts,
  IRequestError,
  ScanResultsPayload,
  IDependencyGraphPayload,
  WorkloadAutoImportPolicyPayload,
} from './types';
import { getProxyAgent } from './proxy';

const upstreamUrl = config.INTEGRATION_API || config.DEFAULT_KUBERNETES_UPSTREAM_URL;

export async function sendDepGraph(...payloads: IDependencyGraphPayload[]): Promise<void> {
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

export async function sendScanResults(payloads: ScanResultsPayload[]): Promise<boolean> {
  for (const payload of payloads) {
    // Intentionally removing scan results as they would be too big to log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { scanResults, ...payloadWithoutScanResults } = payload;
    try {
      const {response, attempt} = await retryRequest('post', `${upstreamUrl}/api/v1/scan-results`, payload);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info({payload: payloadWithoutScanResults, attempt}, 'scan results sent upstream successfully');
      }
    } catch (error) {
      logger.error({error, payload: payloadWithoutScanResults}, 'could not send the scan results upstream');
      return false;
    }
  }

  return true;
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

export async function sendWorkloadAutoImportPolicy(payload: WorkloadAutoImportPolicyPayload): Promise<void> {
  try {
    logger.info(
      { userLocator: payload.userLocator, cluster: payload.cluster, agentId: payload.agentId },
      'attempting to send workload auto-import policy',
    );

    const { response, attempt } = await retryRequest('post', `${upstreamUrl}/api/v1/policy`, payload);
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    }

    logger.info(
      { userLocator: payload.userLocator, cluster: payload.cluster, agentId: payload.agentId, attempt },
      'workload auto-import policy sent upstream successfully',
    );
  } catch (error) {
    logger.error(
      { error, userLocator: payload.userLocator, cluster: payload.cluster, agentId: payload.agentId },
      'could not send workload auto-import policy',
    );
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
  };
  const options: NeedleOptions = {
    json: true,
    compressed: true,
  };
  if (config.HTTP_PROXY || config.HTTPS_PROXY) {
    options.agent = getProxyAgent(config, url);
  }

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
      if (!shouldRetryRequest(err, stillHaveRetries)) {
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

function shouldRetryRequest(err: IRequestError, stillHaveRetries: boolean): boolean {
  const networkErrorMessages: string[] = [
    'socket hang up',
    'Client network socket disconnected before secure TLS connection was established',
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
