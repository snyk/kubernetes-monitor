import needle = require('needle');
import * as config from '../common/config';
import { IDeleteImagePayload, IDepGraphPayload } from './types';

function isSuccessStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode > 100 && statusCode < 400;
}

export async function sendDepGraph(...payloads: IDepGraphPayload[]) {
  for (const payload of payloads) {
    try {
      const result = await needle('post', `${config.HOMEBASE_URL}/api/v1/dependency-graph`, payload, {
          json: true,
          compressed: true,
        },
      );

      if (!isSuccessStatusCode(result.statusCode!)) {
        const httpErrorText = `Server error: ${result.statusCode} ${result.statusMessage}.`;
        const payloadText = `Payload: ${JSON.stringify(payload)}`;
        throw new Error(`${httpErrorText} ${payloadText}`);      }
    } catch (error) {
      const errorMessage = error.message ? error.message : error;
      console.log(`Could not send the dependency scan result to Homebase: ${errorMessage}`);
    }
  }
}

export async function deleteHomebaseWorkload(payloads: IDeleteImagePayload[]) {
  for (const payload of payloads) {
    try {
      const result = await needle('delete', `${config.HOMEBASE_URL}/api/v1/image`, payload, {
          json: true,
          compressed: true,
        },
      );

      if (!isSuccessStatusCode(result.statusCode)) {
        const httpErrorText = `Server error: ${result.statusCode} ${result.statusMessage}.`;
        const payloadText = `Payload: ${JSON.stringify(payload)}`;
        throw new Error(`${httpErrorText} ${payloadText}`);
      }
    } catch (error) {
      const errorMessage = error.message ? error.message : error;
      console.log(`Could not send workload to delete to Homebase: ${errorMessage}`);
    }
  }
}
