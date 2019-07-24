import needle = require('needle');
import * as config from '../common/config';
import { IDepGraphPayload } from './types';

function isSuccessStatusCode(statusCode: number) {
  return statusCode > 100 && statusCode < 400;
}

export async function sendDepGraph(...payloads: IDepGraphPayload[]) {
  for (const payload of payloads) {
    try {
      const result = await needle('post', `${config.HOMEBASE.url}/api/v1/dependency-graph`, payload, {
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
