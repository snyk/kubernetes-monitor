import nock from 'nock';
import { globalAgent } from 'https';

import { config } from '../../../src/common/config';
import { retryRequest } from '../../../src/transmitter';
import * as proxy from '../../../src/transmitter/proxy';
import { createSysdigHttpsAgent } from '../../../src/data-scraper/https-agent';

describe('Sysdig requests behind a proxy', () => {
  beforeAll(() => {
    config.HTTPS_PROXY = 'http://proxy:8080';
  });

  afterAll(() => {
    config.HTTPS_PROXY = undefined;
    jest.restoreAllMocks();
  });

  it('passes the Sysdig agent to the proxy agent', async () => {
    const getProxyAgentSpy = jest
      .spyOn(proxy, 'getProxyAgent')
      .mockReturnValue(globalAgent);
    nock('https://sysdig').get('/api').reply(200);

    const sysdigAgent = createSysdigHttpsAgent();
    await retryRequest('get', 'https://sysdig/api', {}, { agent: sysdigAgent });

    expect(getProxyAgentSpy).toHaveBeenCalledWith(
      config,
      'https://sysdig/api',
      sysdigAgent,
    );
  });
});
