import needle = require('needle');
import * as config from '../common/config';
import logger = require('../common/logger');
import { IDeleteWorkloadPayload, IDepGraphPayload, IWorkloadMetadataPayload } from './types';

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
      logger.error({error}, 'could not send the dependency scan result to Homebase');
    }
  }
}

export async function sendWorkloadMetadata(payload: IWorkloadMetadataPayload) {
    try {
      const result = await needle('post', `${homebaseUrl}/api/v1/workload`, payload, {
          json: true,
          compressed: true,
        },
      );

      if (!isSuccessStatusCode(result.statusCode)) {
        throw new Error(`${result.statusCode} ${result.statusMessage}`);
      }
    } catch (error) {
      logger.error({error}, 'could not send workload metadata to Homebase');
    }
}

export async function deleteHomebaseWorkload(payload: IDeleteWorkloadPayload) {
  try {
    const result = await needle('delete', `${homebaseUrl}/api/v1/workload`, payload, {
        json: true,
        compressed: true,
      },
    );

    if (result.statusCode === 404) {
      const msg = 'attempted to delete a workload Homebase could not find, maybe we are still building it?';
      logger.info({payload}, msg);
      return;
    }

    if (!isSuccessStatusCode(result.statusCode)) {
      throw new Error(`${result.statusCode} ${result.statusMessage}`);
    }
  } catch (error) {
    logger.error({error, payload}, 'could not send workload to delete to Homebase');
  }
}
