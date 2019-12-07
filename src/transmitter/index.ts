import * as needle from 'needle';
import { NeedleResponse, NeedleHttpVerbs } from 'needle';
import * as sleep from 'sleep-promise';
import * as config from '../common/config';
import logger = require('../common/logger');
import { IDeleteWorkloadPayload, IDepGraphPayload, IWorkloadMetadataPayload, IResponseWithAttempts } from './types';

const upstreamUrl = config.INTEGRATION_API || config.DEFAULT_KUBERNETES_UPSTREAM_URL;

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode > 100 && statusCode < 400;
}

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
        logger.info({payload: payloadWithoutDepGraph, attempt}, 'dependency graph sent upstream successfully')
      }
    } catch (error) {
      logger.error({error, payload: payloadWithoutDepGraph}, 'could not send the dependency scan result to Homebase');
    }
  }
}

export async function sendWorkloadMetadata(payload: IWorkloadMetadataPayload): Promise<void> {
    try {
      logger.info({workloadLocator: payload.workloadLocator}, 'attempting to send workload metadata upstream')

      const {response, attempt} = await retryRequest('post', `${upstreamUrl}/api/v1/workload`, payload);
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      } else {
        logger.info({workloadLocator: payload.workloadLocator, attempt}, 'workload metadata sent upstream successfully')
      }
    } catch (error) {
      logger.error({error, workloadLocator: payload.workloadLocator}, 'could not send workload metadata to Homebase');
    }
}

export async function deleteHomebaseWorkload(payload: IDeleteWorkloadPayload): Promise<void> {
  try {
    const {response, attempt} = await retryRequest('delete', `${upstreamUrl}/api/v1/workload`, payload);
    if (response.statusCode === 404) {
      const msg = 'attempted to delete a workload Homebase could not find, maybe we are still building it?';
      logger.info({payload}, msg);
      return;
    }
    if (!isSuccessStatusCode(response.statusCode)) {
      throw new Error(`${response.statusCode} ${response.statusMessage}`);
    } else {
      logger.info({workloadLocator: payload.workloadLocator, attempt}, 'workload deleted successfully')
    }
  } catch (error) {
    logger.error({error, payload}, 'could not send workload to delete to Homebase');
  }
}

async function retryRequest(verb: NeedleHttpVerbs, url: string, payload: object): Promise<IResponseWithAttempts> {
  const retry = {
    attempts: 3,
    intervalSeconds: 2,
  }
  const options = {
    json: true,
    compressed: true,
  };

  let response: NeedleResponse;
  let attempt = 1;

  response = await needle(verb, url, payload, options);
  for (; attempt <= retry.attempts; attempt++) {
    if (response.statusCode === 502 && attempt + 1 < retry.attempts) {
      await sleep(retry.intervalSeconds * 1000);
      response = await needle(verb, url, payload, options);
    } else {
      break;
    }
  }

  return {response, attempt};
}
