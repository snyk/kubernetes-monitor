import * as tap from 'tap';
import { globalAgent as HttpAgent } from 'http';
import { globalAgent as HttpsAgent } from 'https';

import { getProxyAgent } from '../../src/transmitter/proxy';

tap.test(
  'returns correct default agent when no proxy options are set',
  async (t) => {
    t.equal(
      getProxyAgent({}, 'http://example.endpoint'),
      HttpAgent,
      'should return HTTP agent for HTTP endpoints and missing PROXY properties',
    );

    t.equal(
      getProxyAgent({}, 'https://example.endpoint'),
      HttpsAgent,
      'should return HTTPS agent for HTTPS endpoints and missing PROXY properties',
    );
  },
);

tap.test('returns correct default agent on empty PROXY values', async (t) => {
  t.equal(
    getProxyAgent({ HTTP_PROXY: '' }, 'http://example.endpoint'),
    HttpAgent,
    'should return HTTP agent on empty HTTP_PROXY',
  );

  t.equal(
    getProxyAgent({ HTTP_PROXY: '' }, 'https://example.endpoint'),
    HttpsAgent,
    'should return HTTPS agent on empty HTTP_PROXY',
  );

  t.equal(
    getProxyAgent({ HTTPS_PROXY: '' }, 'http://example.endpoint'),
    HttpAgent,
    'should return HTTP agent on empty HTTPS_PROXY',
  );

  t.equal(
    getProxyAgent({ HTTPS_PROXY: '' }, 'https://example.endpoint'),
    HttpsAgent,
    'should return HTTPS agent on empty HTTPS_PROXY',
  );
});

tap.test(
  'returns the default agent when the endpoint is present in NO_PROXY',
  async (t) => {
    t.equal(
      getProxyAgent(
        { NO_PROXY: 'example.endpoint' },
        'http://example.endpoint',
      ),
      HttpAgent,
      'should return the default HTTP agent on URL appearing in NO_PROXY',
    );

    t.equal(
      getProxyAgent(
        { NO_PROXY: 'example.endpoint' },
        'https://example.endpoint',
      ),
      HttpsAgent,
      'should return the default HTTPS on URL appearing in NO_PROXY',
    );
  },
);

tap.test('returns the HTTP_PROXY address for HTTP URLs', async (t) => {
  const agent: any = getProxyAgent(
    {
      HTTP_PROXY: 'http://should-return',
      HTTPS_PROXY: 'http://should-not-return',
    },
    'http://example.endpoint',
  );
  t.same(
    agent.options,
    {
      proxy: {
        host: 'should-return',
        port: 80,
      },
    },
    'returns the value passed in HTTP_PROXY for HTTP endpoints',
  );
});

tap.test('returns the HTTPS_PROXY address for HTTPS URLs', async (t) => {
  const agent: any = getProxyAgent(
    {
      HTTP_PROXY: 'http://should-not-return',
      HTTPS_PROXY: 'http://should-return',
    },
    'https://example.endpoint',
  );
  t.same(
    agent.options,
    {
      proxy: {
        host: 'should-return',
        port: 443,
      },
    },
    'returns the value passed in HTTPS_PROXY for HTTPS endpoints',
  );
});

tap.test(
  'NO_PROXY takes precedence over HTTP_PROXY or HTTPS_PROXY',
  async (t) => {
    t.equal(
      getProxyAgent(
        {
          NO_PROXY: 'example.endpoint',
          HTTP_PROXY: 'http://should-not-return',
          HTTPS_PROXY: 'http://should-not-return',
        },
        'http://example.endpoint',
      ),
      HttpAgent,
      'NO_PROXY should override HTTP/S_PROXY',
    );

    t.equal(
      getProxyAgent(
        {
          NO_PROXY: 'example.endpoint',
          HTTP_PROXY: 'http://should-not-return',
          HTTPS_PROXY: 'http://should-not-return',
        },
        'https://example.endpoint',
      ),
      HttpsAgent,
      'NO_PROXY should override HTTP/S_PROXY',
    );
  },
);

tap.test('CIDR addresses in NO_PROXY are not yet supported', async (t) => {
  const agent: any = getProxyAgent(
    {
      NO_PROXY: '192.168.0.0/16',
      HTTP_PROXY: 'http://should-return',
    },
    'http://192.168.1.1',
  );
  t.same(
    agent.options,
    {
      proxy: {
        host: 'should-return',
        port: 80,
      },
    },
    'CIDR addresses should not be supported',
  );
});

tap.test('wildcards in NO_PROXY are not yet supported', async (t) => {
  const agent: any = getProxyAgent(
    {
      NO_PROXY: '*.example.endpoint',
      HTTP_PROXY: 'http://should-return',
    },
    'http://test.example.endpoint',
  );
  t.same(
    agent.options,
    {
      proxy: {
        host: 'should-return',
        port: 80,
      },
    },
    'wildcards should not be supported',
  );
});

tap.test('throws on providing bad URLs for HTTP/S_PROXY', async (t) => {
  t.throws(
    () => {
      getProxyAgent(
        {
          HTTP_PROXY: 'bad-url',
        },
        'http://test.example.endpoint',
      );
    },
    {},
    'throws on bad URL used in HTTP_PROXY',
  );

  t.throws(
    () => {
      getProxyAgent(
        {
          HTTPS_PROXY: 'bad-url',
        },
        'https://test.example.endpoint',
      );
    },
    {},
    'throws on bad URL used in HTTPS_PROXY',
  );
});
