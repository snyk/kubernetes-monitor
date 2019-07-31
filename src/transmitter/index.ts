import needle = require('needle');
import * as config from '../common/config';
import logger = require('../common/logger');
import { IDeleteImagePayload, IDepGraphPayload } from './types';

const homebaseUrl = config.INTEGRATION_API || config.DEFAULT_HOMEBASE_URL;

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode > 100 && statusCode < 400;
}

export async function sendDepGraph(...payloads: IDepGraphPayload[]) {
  for (const payload of payloads) {
    try {
      const result = await needle('post', `${homebaseUrl}/api/v1/dependency-graph`, payload, {
          json: true,
          compressed: true,
        },
      );

      if (!isSuccessStatusCode(result.statusCode!)) {
        throw new Error(`${result.statusCode} ${result.statusMessage}`);
      }
    } catch (error) {
      logger.error({error}, 'Could not send the dependency scan result to Homebase');
    }
  }
}

export async function deleteHomebaseWorkload(payloads: IDeleteImagePayload[]) {
  for (const payload of payloads) {
    try {
      const result = await needle('delete', `${homebaseUrl}/api/v1/image`, payload, {
          json: true,
          compressed: true,
        },
      );

      if (!isSuccessStatusCode(result.statusCode)) {
        throw new Error(`${result.statusCode} ${result.statusMessage}`);
      }
    } catch (error) {
      logger.error({error}, 'Could not send workload to delete to Homebase');
    }
  }
}
