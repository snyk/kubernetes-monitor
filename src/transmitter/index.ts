import needle = require('needle');
import * as config from '../common/config';
import { DepGraphPayload } from './types';

export async function sendDepGraph(...payloads: DepGraphPayload[]) {
  for (const payload of payloads) {
    try {
      await needle('post', `${config.HOMEBASE.url}/api/v1/dependency-graph`, payload, {
          json: true,
          compressed: true,
        },
      );
    } catch (error) {
      console.log(error.message);
    }
  }
}
