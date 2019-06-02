import { DepGraphPayload } from '..';
import * as config from '../../common/config';
import { post } from '../api';

export async function sendDepGraph(...payloads: DepGraphPayload[]) {
  for (const payload of payloads) {
    await post(`${config.HOMEBASE.url}/api/v1/dependency-graph`, {
      body: payload,
    });
  }
}
