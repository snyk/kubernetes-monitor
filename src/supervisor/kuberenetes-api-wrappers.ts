import * as fastq from 'fastq';
import * as http from 'http';
import sleep from 'sleep-promise';
import { config } from '../common/config';

import { logger } from '../common/logger';
import { IRequestError } from './types';
import {
  RETRYABLE_NETWORK_ERROR_CODES,
  RETRYABLE_NETWORK_ERROR_MESSAGES,
} from './watchers/types';

import type { queueAsPromised } from 'fastq';

export const ATTEMPTS_MAX = 3;
export const DEFAULT_SLEEP_SEC = 1;
export const MAX_SLEEP_SEC = 5;
type IKubernetesApiFunction<ResponseType> = () => Promise<ResponseType>;

const reqQueue: queueAsPromised<unknown> = fastq.promise(async function (
  promise: IKubernetesApiFunction<unknown>,
) {
  return await promise();
},
config.REQUEST_QUEUE_LENGTH);

// TODO - IncomingMessage is no longer a supported type in 1.0.0 (move away from request library and now use node-fetch)
// Error handling here will need to be updated to handle the new response type
export async function retryKubernetesApiRequest<ResponseType>(
  func: IKubernetesApiFunction<ResponseType>,
): Promise<ResponseType> {
  for (let attempt = 1; attempt <= ATTEMPTS_MAX; attempt++) {
    try {
      return await reqQueue.push(func);
    } catch (err: any) {
      if (!shouldRetryRequest(err, attempt)) {
        throw err;
      }

      const sleepSeconds = calculateSleepSeconds(err.response);
      await sleep(sleepSeconds * 1000);
    }
  }

  throw new Error('Could not receive a response from the Kubernetes API');
}

/**
 * This function retries requests to the Kubernetes API indefinitely. We use this
 * function when starting the Kubernetes Monitor to ensure the agentId is correctly
 * set to the deployment ID.
 *
 * @param func function to retry
 * @param maxSleepDuration maximum sleep duration in seconds (e.g. 300)
 * @returns Promise<ResponseType>
 */
export async function retryKubernetesApiRequestIndefinitely<ResponseType>(
  func: IKubernetesApiFunction<ResponseType>,
  maxSleepDuration: number,
): Promise<ResponseType> {
  let attempts: number = 1;

  while (true) {
    try {
      return await reqQueue.push(func);
    } catch (err: any) {
      if (!shouldRetryRequest(err, 1)) {
        throw err;
      }

      const backoff = Math.pow(2, attempts);
      const sleepSeconds = Math.min(backoff, maxSleepDuration);
      logger.error(
        { error: err, attempts },
        'connection to kubernetes API failed, retrying',
      );

      await sleep(sleepSeconds * 1000);
      attempts++;
    }
  }
}
// TODO httpResponse is no longer a supported type in 1.0.0 (move away from request library and now use node-fetch)
export function calculateSleepSeconds(
  httpResponse?: http.IncomingMessage,
): number {
  let sleepSeconds = DEFAULT_SLEEP_SEC;
  if (
    httpResponse &&
    httpResponse.headers &&
    httpResponse.headers['Retry-After']
  ) {
    try {
      sleepSeconds = Number(httpResponse.headers['Retry-After']);
      if (isNaN(sleepSeconds) || sleepSeconds <= 0) {
        sleepSeconds = DEFAULT_SLEEP_SEC;
      }
    } catch (err) {
      sleepSeconds = DEFAULT_SLEEP_SEC;
    }
  }
  return Math.min(sleepSeconds, MAX_SLEEP_SEC);
}

function shouldRetryRequest(err: IRequestError, attempt: number): boolean {
  if (attempt >= ATTEMPTS_MAX) {
    return false;
  }

  if (err.code && RETRYABLE_NETWORK_ERROR_CODES.includes(err.code)) {
    return true;
  }

  if (err.message && RETRYABLE_NETWORK_ERROR_MESSAGES.includes(err.message)) {
    return true;
  }
  // err.response = IncomingMessage
  // TODO - IncomingMessage is no longer a supported type in 1.0.0 (move away from request library and now use node-fetch)
  if (!err.response) {
    return false;
  }
  // TODO - IncomingMessage is no longer a supported type in 1.0.0 (move away from request library and now use node-fetch)
  if (err.response.statusCode === 429) {
    return true;
  }

  return false;
}
