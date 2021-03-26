import { globalAgent as HttpAgent } from 'http';
import { globalAgent as HttpsAgent } from 'https';

import { getProxyAgent } from '../../src/transmitter/proxy';

test('returns correct default agent when no proxy options are set', async () => {
  expect(getProxyAgent({}, 'http://example.endpoint')).toEqual(HttpAgent);
  expect(getProxyAgent({}, 'https://example.endpoint')).toEqual(HttpsAgent);
});

test('returns correct default agent on empty PROXY values', async () => {
  expect(getProxyAgent({ HTTP_PROXY: '' }, 'http://example.endpoint')).toEqual(
    HttpAgent,
  );
  expect(getProxyAgent({ HTTP_PROXY: '' }, 'https://example.endpoint')).toEqual(
    HttpsAgent,
  );
  expect(getProxyAgent({ HTTPS_PROXY: '' }, 'http://example.endpoint')).toEqual(
    HttpAgent,
  );
  expect(
    getProxyAgent({ HTTPS_PROXY: '' }, 'https://example.endpoint'),
  ).toEqual(HttpsAgent);
});

test('returns the default agent when the endpoint is present in NO_PROXY', async () => {
  expect(
    getProxyAgent({ NO_PROXY: 'example.endpoint' }, 'http://example.endpoint'),
  ).toEqual(HttpAgent);

  expect(
    getProxyAgent({ NO_PROXY: 'example.endpoint' }, 'https://example.endpoint'),
  ).toEqual(HttpsAgent);
});

test('returns the HTTP_PROXY address for HTTP URLs', async () => {
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

test('returns the HTTPS_PROXY address for HTTPS URLs', async () => {
  const agent: any = getProxyAgent(
    {
      HTTP_PROXY: 'http://should-not-return',
      HTTPS_PROXY: 'http://should-return',
    },
    'https://example.endpoint',
  );
  expect(agent.options).toEqual({
    proxy: {
      host: 'should-return',
      port: 443,
    },
  });
});

test('NO_PROXY takes precedence over HTTP_PROXY or HTTPS_PROXY', async () => {
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
});

test('CIDR addresses in NO_PROXY are not yet supported', async () => {
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
});

test('wildcards in NO_PROXY are not yet supported', async () => {
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

test('throws on providing bad URLs for HTTP/S_PROXY', async () => {
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
