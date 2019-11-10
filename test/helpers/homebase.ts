import needle = require('needle');
import sleep = require('sleep-promise');
import setup = require('../setup');
import {
  IWorkloadLocator,
  IWorkloadMetadata,
} from '../../src/transmitter/types';
import { WorkloadLocatorValidator, WorkloadMetadataValidator } from './types';
import config = require('../../src/common/config');

const toneDownFactor = 5;
const maxPodChecks =
  setup.KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS / toneDownFactor;

export async function getHomebaseResponseBody(
  relativeUrl: string,
): Promise<any> {
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@homebase-int.dev.snyk.io/${relativeUrl}`;
  const homebaseResponse = await needle('get', url, null);
  const responseBody = homebaseResponse.body;
  return responseBody;
}

export async function validateHomebaseStoredData(
  validatorFn: WorkloadLocatorValidator,
  relativeUrl: string,
  remainingChecks: number = maxPodChecks,
): Promise<boolean> {
  while (remainingChecks > 0) {
    const responseBody = await getHomebaseResponseBody(relativeUrl);
    const workloads: IWorkloadLocator[] | undefined = responseBody.workloads;
    const result = validatorFn(workloads);
    if (result) {
      return true;
    }
    await sleep(1000 * toneDownFactor);
    remainingChecks--;
  }
  return false;
}

export async function validateHomebaseStoredMetadata(
  validatorFn: WorkloadMetadataValidator,
  relativeUrl: string,
  remainingChecks: number = maxPodChecks,
): Promise<boolean> {
  while (remainingChecks > 0) {
    const responseBody = await getHomebaseResponseBody(relativeUrl);
    const workloadInfo: IWorkloadMetadata | undefined =
      responseBody.workloadInfo;
    const result = validatorFn(workloadInfo);
    if (result) {
      return true;
    }
    await sleep(1000 * toneDownFactor);
    remainingChecks--;
  }
  return false;
}
