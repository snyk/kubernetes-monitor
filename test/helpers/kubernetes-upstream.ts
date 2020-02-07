import needle = require('needle');
import sleep = require('sleep-promise');
import {
  IWorkloadLocator,
  IWorkloadMetadata,
} from '../../src/transmitter/types';
import { WorkloadLocatorValidator, WorkloadMetadataValidator } from './types';
import config = require('../../src/common/config');

const toneDownFactor = 5;
const maxPodChecks = 600 / toneDownFactor;

export async function getUpstreamResponseBody(
  relativeUrl: string,
): Promise<any> {
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@kubernetes-upstream-int.dev.snyk.io/${relativeUrl}`;
  const upstreamResponse = await needle('get', url, null);
  const responseBody = upstreamResponse.body;
  return responseBody;
}

export async function validateUpstreamStoredData(
  validatorFn: WorkloadLocatorValidator,
  relativeUrl: string,
  remainingChecks: number = maxPodChecks,
): Promise<boolean> {
  while (remainingChecks > 0) {
    console.log(`Pinging upstream for existing data (${remainingChecks} checks remaining)...`);
    const responseBody = await getUpstreamResponseBody(relativeUrl);
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

export async function validateUpstreamStoredMetadata(
  validatorFn: WorkloadMetadataValidator,
  relativeUrl: string,
  remainingChecks: number = maxPodChecks,
): Promise<boolean> {
  while (remainingChecks > 0) {
    console.log(`Pinging upstream for existing metadata (${remainingChecks} checks remaining)...`);
    const responseBody = await getUpstreamResponseBody(relativeUrl);
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
