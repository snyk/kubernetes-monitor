import { Agent as HttpsAgent } from 'https';
import { config } from '../common/config';

export function createSysdigHttpsAgent(): HttpsAgent {
  return new HttpsAgent({
    keepAlive: true,
    rejectUnauthorized: !config.SYSDIG_SKIP_TLS_VERIFY,
  });
}
