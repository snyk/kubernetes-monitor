import { globalAgent as HttpAgent } from 'http';
import { globalAgent as HttpsAgent } from 'https';

import { getProxyAgent } from '../../src/transmitter/proxy';

describe('transmitter proxy tests', () => {
  test.concurrent(
    'returns correct default agent when no proxy options are set',
    async () => {
      expect(getProxyAgent({}, 'http://example.endpoint')).toEqual(HttpAgent);
      expect(getProxyAgent({}, 'https://example.endpoint')).toEqual(HttpsAgent);
    },
  );

  test.concurrent(
    'returns correct default agent on empty PROXY values',
    async () => {
      expect(
        getProxyAgent({ HTTP_PROXY: '' }, 'http://example.endpoint'),
      ).toEqual(HttpAgent);
      expect(
        getProxyAgent({ HTTP_PROXY: '' }, 'https://example.endpoint'),
      ).toEqual(HttpsAgent);
      expect(
        getProxyAgent({ HTTPS_PROXY: '' }, 'http://example.endpoint'),
      ).toEqual(HttpAgent);
      expect(
        getProxyAgent({ HTTPS_PROXY: '' }, 'https://example.endpoint'),
      ).toEqual(HttpsAgent);
    },
  );

  test.concurrent(
    'returns the default agent when the endpoint is present in NO_PROXY',
    async () => {
      expect(
        getProxyAgent(
          { NO_PROXY: 'example.endpoint' },
          'http://example.endpoint',
        ),
      ).toEqual(HttpAgent);

      expect(
        getProxyAgent(
          { NO_PROXY: 'example.endpoint' },
          'https://example.endpoint',
        ),
      ).toEqual(HttpsAgent);
    },
  );

  test.concurrent('returns the HTTP_PROXY address for HTTP URLs', async () => {
    const agent: any = getProxyAgent(
      {
        HTTP_PROXY: 'http://should-return',
        HTTPS_PROXY: 'http://should-not-return',
      },
      'http://example.endpoint',
    );
    expect(agent.options).toEqual({
      proxy: {
        host: 'should-return',
        port: 80,
      },
    });
  });

  test.concurrent(
    'returns the HTTPS_PROXY address for HTTPS URLs',
    async () => {
      const agent: any = getProxyAgent(
        {
          HTTP_PROXY: 'https://should-not-return',
          HTTPS_PROXY: 'https://should-return',
        },
        'https://example.endpoint',
      );
      expect(agent.options).toEqual({
        proxy: {
          host: 'should-return',
          port: 443,
        },
      });
    },
  );

  test.concurrent(
    'NO_PROXY takes precedence over HTTP_PROXY or HTTPS_PROXY',
    async () => {
      expect(
        getProxyAgent(
          {
            NO_PROXY: 'example.endpoint',
            HTTP_PROXY: 'http://should-not-return',
            HTTPS_PROXY: 'http://should-not-return',
          },
          'http://example.endpoint',
        ),
      ).toEqual(HttpAgent);

      expect(
        getProxyAgent(
          {
            NO_PROXY: 'example.endpoint',
            HTTP_PROXY: 'http://should-not-return',
            HTTPS_PROXY: 'http://should-not-return',
          },
          'https://example.endpoint',
        ),
      ).toEqual(HttpsAgent);
    },
  );

  test.concurrent(
    'CIDR addresses in NO_PROXY are not yet supported',
    async () => {
      const agent: any = getProxyAgent(
        {
          NO_PROXY: '192.168.0.0/16',
          HTTP_PROXY: 'http://should-return',
        },
        'http://192.168.1.1',
      );
      expect(agent.options).toEqual({
        proxy: {
          host: 'should-return',
          port: 80,
        },
      });
    },
  );

  test.concurrent('wildcards in NO_PROXY are not yet supported', async () => {
    const agent: any = getProxyAgent(
      {
        NO_PROXY: '*.example.endpoint',
        HTTP_PROXY: 'http://should-return',
      },
      'http://test.example.endpoint',
    );
    expect(agent.options).toEqual({
      proxy: {
        host: 'should-return',
        port: 80,
      },
    });
  });

  test.concurrent('throws on providing bad URLs for HTTP/S_PROXY', async () => {
    expect(() => {
      getProxyAgent(
        {
          HTTP_PROXY: 'bad-url',
        },
        'http://test.example.endpoint',
      );
    }).toThrow();

    expect(() => {
      getProxyAgent(
        {
          HTTPS_PROXY: 'bad-url',
        },
        'https://test.example.endpoint',
      );
    }).toThrow();
  });

  test.concurrent.each([
    [
      'returns the correct port when no port defined for http',
      {
        HTTP_PROXY: 'http://should-return',
        HTTPS_PROXY: 'http://should-not-return',
      },
      80,
    ],
    [
      'returns the correct port when default port defined for http',
      {
        HTTP_PROXY: 'http://should-return:80',
        HTTPS_PROXY: 'http://should-not-return:80',
      },
      80,
    ],
    [
      'returns the correct port when non-default port defined for http',
      {
        HTTP_PROXY: 'http://should-return:8080',
        HTTPS_PROXY: 'http://should-not-return:8080',
      },
      8080,
    ],
    [
      'returns the correct port when no port defined for https',
      {
        HTTP_PROXY: 'https://should-return',
        HTTPS_PROXY: 'https://should-not-return',
      },
      443,
    ],
    [
      'returns the correct port when default port defined for https',
      {
        HTTP_PROXY: 'https://should-return:443',
        HTTPS_PROXY: 'https://should-not-return:443',
      },
      443,
    ],
    [
      'returns the correct port when non-default port defined for http',
      {
        HTTP_PROXY: 'https://should-return:8080',
        HTTPS_PROXY: 'https://should-not-return:8080',
      },
      8080,
    ],
    [
      'returns the correct port when no port defined for ftp',
      {
        HTTP_PROXY: 'ftp://should-return',
        HTTPS_PROXY: 'ftp://should-not-return',
      },
      21,
    ],
    [
      'returns the correct port when no port defined for ws',
      {
        HTTP_PROXY: 'ws://should-return',
        HTTPS_PROXY: 'ws://should-not-return',
      },
      80,
    ],
    [
      'returns the correct port when no port defined for wss',
      {
        HTTP_PROXY: 'wss://should-return',
        HTTPS_PROXY: 'wss://should-not-return',
      },
      443,
    ],
  ])('HTTP_PROXY: %s', async (_testCaseName, config, port) => {
    const agent: any = getProxyAgent(config, 'http://example.endpoint');
    expect(agent.options).toEqual({
      proxy: {
        host: 'should-return',
        port: port,
      },
    });
  });

  test.concurrent.each([
    [
      'returns the correct port when no port defined for http',
      {
        HTTP_PROXY: 'http://should-not-return',
        HTTPS_PROXY: 'http://should-return',
      },
      80,
    ],
    [
      'returns the correct port when default port defined for http',
      {
        HTTP_PROXY: 'http://should-not-not-return:80',
        HTTPS_PROXY: 'http://should-return:80',
      },
      80,
    ],
    [
      'returns the correct port when non-default port defined for http',
      {
        HTTP_PROXY: 'http://should-not-return:8080',
        HTTPS_PROXY: 'http://should-return:8080',
      },
      8080,
    ],
    [
      'returns the correct port when no port defined for https',
      {
        HTTP_PROXY: 'https://should-not-return',
        HTTPS_PROXY: 'https://should-return',
      },
      443,
    ],
    [
      'returns the correct port when default port defined for https',
      {
        HTTP_PROXY: 'https://should-not-return:443',
        HTTPS_PROXY: 'https://should-return:443',
      },
      443,
    ],
    [
      'returns the correct port when non-default port defined for http',
      {
        HTTP_PROXY: 'https://should-not-return:8080',
        HTTPS_PROXY: 'https://should-return:8080',
      },
      8080,
    ],
    [
      'returns the correct port when no port defined for ftp',
      {
        HTTP_PROXY: 'ftp://should-not-return',
        HTTPS_PROXY: 'ftp://should-return',
      },
      21,
    ],
    [
      'returns the correct port when no port defined for ws',
      {
        HTTP_PROXY: 'ws://should-not-return',
        HTTPS_PROXY: 'ws://should-return',
      },
      80,
    ],
    [
      'returns the correct port when no port defined for wss',
      {
        HTTP_PROXY: 'wss://should-not-return',
        HTTPS_PROXY: 'wss://should-return',
      },
      443,
    ],
  ])('HTTPS_PROXY: %s', async (_testCaseName, config, port) => {
    const agent: any = getProxyAgent(config, 'https://example.endpoint');
    expect(agent.options).toEqual({
      proxy: {
        host: 'should-return',
        port: port,
      },
    });
  });
});
