import needle = require('needle');
import * as config from '../common/config';
import { IDepGraphPayload } from './types';

export async function sendDepGraph(...payloads: IDepGraphPayload[]) {
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
