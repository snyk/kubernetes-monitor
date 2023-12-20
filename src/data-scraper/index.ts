import { logger } from '../common/logger';
import { config } from '../common/config';
import { sendRuntimeData } from '../transmitter';
import { constructRuntimeData } from '../transmitter/payload';
import { retryRequest } from '../transmitter';
import { IRuntimeImagesResponse } from '../transmitter/types';
import { NeedleOptions } from 'needle';
import { Agent as HttpsAgent } from 'https';

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  // We agreed with Sysdig to skip TLS certificates validation for HTTPS connection.
  rejectUnauthorized: false,
});

// Soon to be deprecated
function getSysdigV1Url(): string {
  return config.SYSDIG_ENDPOINT + '/v1/runtimeimages';
}
function getSysdigV1AuthHeader(): string {
  return `Bearer ${config.SYSDIG_TOKEN}`;
}

function getSysdigUrl(): string {
  return (
    'https://' +
    config.SYSDIG_REGION_URL +
    '/api/scanning/eveintegration/v2/runtimeimages'
  );
}
function getSysdigAuthHeader(): string {
  return `Bearer ${config.SYSDIG_RISK_SPOTLIGHT_TOKEN}`;
}

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
}

/** NOTE: This function can throw, so the caller should handle errors. */
export async function validateConnectivity(): Promise<void> {
  const url = getSysdigUrl();
  const header = getSysdigAuthHeader();
  const clusterName = config.SYSDIG_CLUSTER_NAME;

  const reqOptions: NeedleOptions = {
    agent: httpsAgent,
    headers: {
      authorization: header,
    },
    timeout: 10_000,
  };
  const limit: number = 1;
  const { response } = await retryRequest(
    'get',
    `${url}?clusterName=${clusterName}&limit=${limit}`,
    {},
    reqOptions,
  );
  if (!isSuccessStatusCode(response.statusCode)) {
    throw new Error(`${response.statusCode} ${response.statusMessage}`);
  }
}

export async function scrapeData(): Promise<void> {
  const url = getSysdigUrl();
  const header = getSysdigAuthHeader();
  const clusterName = config.SYSDIG_CLUSTER_NAME;
  const limit: number = 10;

  const reqOptions: NeedleOptions = {
    agent: httpsAgent,
    headers: {
      authorization: header,
    },
  };

  let cursor: string = '';
  while (true) {
    try {
      logger.info({ cursor }, 'attempting to get runtime images');

      let requestUrl: string = `${url}?clusterName=${clusterName}&limit=${limit}`;
      if (cursor) {
        requestUrl = `${requestUrl}&cursor=${cursor}`;
      }
      const { response, attempt } = await retryRequest(
        'get',
        requestUrl,
        {},
        reqOptions,
      );
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(
          `${response.statusCode} ${response.statusMessage} for ${requestUrl}`,
        );
      }

      logger.info(
        {
          attempt,
          cursor,
        },
        'runtime images received successfully',
      );

      const responseBody: IRuntimeImagesResponse | undefined = response.body;
      const runtimeDataPayload = constructRuntimeData(responseBody?.data ?? []);
      logger.info({}, 'sending runtime data upstream');
      await sendRuntimeData(runtimeDataPayload);

      cursor = responseBody?.page.next || '';
      if (!cursor) {
        break;
      }
    } catch (error) {
      logger.error(
        {
          error,
          cursor,
        },
        'could not get runtime images',
      );
      break;
    }
  }
}

/** NOTE: This function can throw, so the caller should handle errors. */
export async function validateConnectivityV1(): Promise<void> {
  const url = getSysdigV1Url();
  const header = getSysdigV1AuthHeader();
  const reqOptions: NeedleOptions = {
    agent: httpsAgent,
    headers: {
      authorization: header,
    },
    timeout: 10_000,
  };

  const limit: number = 1;
  const cursor: string = '';
  const { response } = await retryRequest(
    'get',
    `${url}?limit=${limit}&cursor=${cursor}`,
    {},
    reqOptions,
  );
  if (!isSuccessStatusCode(response.statusCode)) {
    throw new Error(`${response.statusCode} ${response.statusMessage}`);
  }
}

export async function scrapeDataV1(): Promise<void> {
  const url = getSysdigV1Url();
  const header = getSysdigV1AuthHeader();

  // limit: min 1, max 500, default 250
  const limit: number = 10;
  const reqOptions: NeedleOptions = {
    agent: httpsAgent,
    headers: {
      authorization: header,
    },
  };

  let cursor: string = '';
  while (true) {
    try {
      logger.info({ cursor }, 'attempting to get runtime images');

      const { response, attempt } = await retryRequest(
        'get',
        `${url}?limit=${limit}&cursor=${cursor}`,
        {},
        reqOptions,
      );
      if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`${response.statusCode} ${response.statusMessage}`);
      }

      logger.info(
        {
          attempt,
          cursor,
        },
        'runtime images received successfully',
      );

      const responseBody: IRuntimeImagesResponse | undefined = response.body;
      const runtimeDataPayload = constructRuntimeData(responseBody?.data ?? []);
      logger.info({}, 'sending runtime data upstream');
      await sendRuntimeData(runtimeDataPayload);

      cursor = responseBody?.page.next || '';
      if (!cursor) {
        break;
      }
    } catch (error) {
      logger.error(
        {
          error,
          cursor,
        },
        'could not get runtime images',
      );
      break;
    }
  }
}
