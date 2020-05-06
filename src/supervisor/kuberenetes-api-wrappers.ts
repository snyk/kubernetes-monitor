import * as http from 'http';
import * as sleep from 'sleep-promise';
import { IRequestError } from './types';

export const ATTEMPTS_MAX = 3;
export const DEFAULT_SLEEP_SEC = 1;
export const MAX_SLEEP_SEC = 5;
type IKubernetesApiFunction<ResponseType> = () => Promise<ResponseType>;

export async function retryKubernetesApiRequest<ResponseType>(
  func: IKubernetesApiFunction<ResponseType>
): Promise<ResponseType> {
  for (let attempt = 1; attempt <= ATTEMPTS_MAX; attempt++) {
    try {
      return await func();
    } catch (err) {
      if (!shouldRetryRequest(err, attempt)) {
        throw err;
      }

      const sleepSeconds = calculateSleepSeconds(err.response);
      await sleep(sleepSeconds * 1000);
    }
  }

  throw new Error('Could not receive a response from the Kubernetes API');
}

export function calculateSleepSeconds(httpResponse: http.IncomingMessage): number {
  let sleepSeconds = DEFAULT_SLEEP_SEC;
  if (httpResponse && httpResponse.headers && httpResponse.headers['Retry-After']) {
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

  if (err.code === 'ECONNREFUSED') {
    return true;
  }

  if (err.code === 'ETIMEDOUT') {
    return true;
  }

  if (!(err.response)) {
    return false;
  }

  if (err.response.statusCode === 429) {
    return true;
  }

  return false;
}
