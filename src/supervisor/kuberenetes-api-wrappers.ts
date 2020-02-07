import * as http from 'http';
import * as sleep from 'sleep-promise';

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
      if (!(err.response)) {
        throw err;
      }

      const response = err.response;
      if (response.statusCode !== 429) {
        throw err;
      }

      if (attempt === ATTEMPTS_MAX) {
        throw err;
      }

      const sleepSeconds = calculateSleepSeconds(response);
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
