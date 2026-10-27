import { config } from '../../../src/common/config';
import { createSysdigHttpsAgent } from '../../../src/data-scraper/https-agent';

describe('createSysdigHttpsAgent()', () => {
  afterEach(() => {
    delete config.SYSDIG_SKIP_TLS_VERIFY;
  });

  it('verifies TLS certificates by default', () => {
    const agent = createSysdigHttpsAgent();
    expect(agent.options.rejectUnauthorized).toEqual(true);
  });

  it('skips TLS certificate verification when opted out', () => {
    config.SYSDIG_SKIP_TLS_VERIFY = true;
    const agent = createSysdigHttpsAgent();
    expect(agent.options.rejectUnauthorized).toEqual(false);
  });
});
