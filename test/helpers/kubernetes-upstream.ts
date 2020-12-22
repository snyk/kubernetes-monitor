import * as needle from 'needle';
import * as sleep from 'sleep-promise';
import {
  IWorkloadLocator,
  IWorkloadMetadata,
} from '../../src/transmitter/types';
import {
  WorkloadLocatorValidator,
  WorkloadMetadataValidator,
  DepGraphsValidator,
} from './types';
import { config } from '../../src/common/config';

const UPSTREAM_POLLING_CONFIGURATION = {
  WAIT_BETWEEN_REQUESTS_MS: 5000,
  MAXIMUM_REQUESTS: 120,
};

export async function getUpstreamResponseBody(
  relativeUrl: string,
): Promise<any> {
  const url = `https://${config.INTERNAL_PROXY_CREDENTIALS}@kubernetes-upstream-int.dev.snyk.io/${relativeUrl}`;
  const upstreamResponse = await needle('get', url, null);
  const responseBody = upstreamResponse.body;
  return responseBody;
}

export async function validateUpstreamStoredDepGraphs(
  validatorFn: DepGraphsValidator,
  relativeUrl: string,
  remainingChecks: number = UPSTREAM_POLLING_CONFIGURATION.MAXIMUM_REQUESTS,
): Promise<boolean> {
  while (remainingChecks > 0) {
    console.log(`Pinging upstream for existing data (${remainingChecks} checks remaining)...`);
    const responseBody = await getUpstreamResponseBody(relativeUrl);
    const depGraphs = responseBody?.dependencyGraphResults;
    const result = validatorFn(depGraphs);
    if (result) {
      return true;
    }
    await sleep(UPSTREAM_POLLING_CONFIGURATION.WAIT_BETWEEN_REQUESTS_MS);
    remainingChecks--;
  }
  return false;
}

export async function validateUpstreamStoredData(
  validatorFn: WorkloadLocatorValidator,
  relativeUrl: string,
  remainingChecks: number = UPSTREAM_POLLING_CONFIGURATION.MAXIMUM_REQUESTS,
): Promise<boolean> {
  while (remainingChecks > 0) {
    console.log(`Pinging upstream for existing data (${remainingChecks} checks remaining)...`);
    const responseBody = await getUpstreamResponseBody(relativeUrl);
    const workloads: IWorkloadLocator[] | undefined = responseBody.workloads;
    const result = validatorFn(workloads);
    if (result) {
      return true;
    }
    await sleep(UPSTREAM_POLLING_CONFIGURATION.WAIT_BETWEEN_REQUESTS_MS);
    remainingChecks--;
  }
  return false;
}

export async function validateUpstreamStoredMetadata(
  validatorFn: WorkloadMetadataValidator,
  relativeUrl: string,
  remainingChecks: number = UPSTREAM_POLLING_CONFIGURATION.MAXIMUM_REQUESTS,
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
    await sleep(UPSTREAM_POLLING_CONFIGURATION.WAIT_BETWEEN_REQUESTS_MS);
    remainingChecks--;
  }
  return false;
}
