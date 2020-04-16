import * as tap from 'tap';

import { getProxy } from '../../src/transmitter/';

tap.test('returns undefined when nothing is set', async (t) => {
  t.equals(
    getProxy({}, 'https://example.endpoint'),
    undefined,
    'should return undefined on missing PROXY properties',
  );
});

tap.test('returns undefined on empty PROXY values', async (t) => {
  t.equals(
    getProxy({ HTTP_PROXY: '' }, 'https://example.endpoint'),
    undefined,
    'should return undefined on empty HTTP_PROXY',
  );
  t.equals(
    getProxy({ HTTPS_PROXY: '' }, 'https://example.endpoint'),
    undefined,
    'should return undefined on empty HTTPS_PROXY',
  );
});

tap.test(
  'returns undefined on when the endpoint is present in NO_PROXY',
  async (t) => {
    t.equals(
      getProxy({ NO_PROXY: 'example.endpoint' }, 'https://example.endpoint'),
      undefined,
      'should return undefined on URL appearing in NO_PROXY',
    );
  },
);

tap.test('returns the HTTP_PROXY address for HTTP URLs', async (t) => {
  t.equals(
    getProxy(
      { HTTP_PROXY: 'should-return', HTTPS_PROXY: 'should-not-return' },
      'http://example.endpoint',
    ),
    'should-return',
    'returns the value passed in HTTP_PROXY for HTTP endpoints',
  );
});

tap.test('returns the HTTP_PROXY address for HTTP URLs', async (t) => {
  t.equals(
    getProxy(
      { HTTP_PROXY: 'should-not-return', HTTPS_PROXY: 'should-return' },
      'https://example.endpoint',
    ),
    'should-return',
    'returns the value passed in HTTP_PROXY for HTTP endpoints',
  );
});

tap.test(
  'NO_PROXY takes precedence over HTTP_PROXY or HTTPS_PROXY',
  async (t) => {
    t.equals(
      getProxy(
        {
          NO_PROXY: 'example.endpoint',
          HTTP_PROXY: 'should-not-return',
          HTTPS_PROXY: 'should-not-return',
        },
        'https://example.endpoint',
      ),
      undefined,
      'NO_PROXY should override HTTP/S_PROXY',
    );
  },
);

tap.test('CIDR addresses in NO_PROXY are not yet supported', async (t) => {
  t.equals(
    getProxy(
      {
        NO_PROXY: '192.168.0.0/16',
        HTTP_PROXY: 'should-return',
      },
      'http://192.168.1.1',
    ),
    'should-return',
    'CIDR addresses should not be supported',
  );
});

tap.test('wildcards in NO_PROXY are not yet supported', async (t) => {
  t.equals(
    getProxy(
      {
        NO_PROXY: '*.example.endpoint',
        HTTP_PROXY: 'should-return',
      },
      'http://test.example.endpoint',
    ),
    'should-return',
    'wildcards should not be supported',
  );
});
