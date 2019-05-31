import { DepGraphPayload } from '..';
import * as config from '../../common/config';
import { post } from '../api';

export function sendDepGraph(payload: DepGraphPayload): Promise<any> {
  return post(`${config.HOMEBASE.url}/api/v1/dependency-graph`, {
    body: payload,
  });
}
