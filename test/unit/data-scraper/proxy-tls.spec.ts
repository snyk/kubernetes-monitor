import nock from 'nock';
import { globalAgent } from 'https';

import { config } from '../../../src/common/config';
import { retryRequest } from '../../../src/transmitter';
import * as proxy from '../../../src/transmitter/proxy';
import { createSysdigHttpsAgent } from '../../../src/data-scraper/https-agent';

describe('Sysdig requests behind a proxy', () => {
  beforeAll(() => {
    config.HTTPS_PROXY = 'http://proxy:8080';
    config.SYSDIG_SKIP_TLS_VERIFY = true;
  });

  afterAll(() => {
    config.HTTPS_PROXY = undefined;
    delete config.SYSDIG_SKIP_TLS_VERIFY;
    jest.restoreAllMocks();
  });

  it('keeps the skipTlsVerify setting on the proxy agent', async () => {
    const getProxyAgentSpy = jest
      .spyOn(proxy, 'getProxyAgent')
      .mockReturnValue(globalAgent);
    nock('https://sysdig').get('/api').reply(200);

    await retryRequest(
      'get',
      'https://sysdig/api',
      {},
      { agent: createSysdigHttpsAgent() },
    );

    expect(getProxyAgentSpy).toHaveBeenCalledWith(
      config,
      'https://sysdig/api',
      { rejectUnauthorized: false },
    );
  });
});
