import nock from 'nock';

import { config } from '../../../src/common/config';
import { scrapeData } from '../../../src/data-scraper';
import { scrapeDataV1 } from '../../../src/data-scraper/scraping-v1';

import * as transmitterTypes from '../../../src/transmitter/types';

describe('dataScraper()', () => {
  describe('sysdig v2 env vars configured', () => {
    beforeAll(() => {
      config.SYSDIG_ENDPOINT_URL = 'sysdig';
      config.SYSDIG_RISK_SPOTLIGHT_TOKEN = 'token123';
      config.SYSDIG_CLUSTER_NAME = 'test-sysdig-cluster';
    });

    afterAll(() => {
      delete config.SYSDIG_ENDPOINT_URL;
      delete config.SYSDIG_RISK_SPOTLIGHT_TOKEN;
      delete config.SYSDIG_CLUSTER_NAME;
    });

    it('correctly sends data to kubernetes-upstream', async () => {
      const bodyWithToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: 'xxx',
        },
      };
      const bodyNoToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: '',
        },
      };
      const expectedHeader = 'Bearer token123';
      nock('https://sysdig', {
        reqheaders: { authorization: expectedHeader },
      })
        .get(
          '/api/scanning/eveintegration/v2/runtimeimages?clusterName=test-sysdig-cluster&limit=10',
        )
        .times(1)
        .reply(200, bodyWithToken);
      nock('https://sysdig', { reqheaders: { authorization: expectedHeader } })
        .get(
          '/api/scanning/eveintegration/v2/runtimeimages?clusterName=test-sysdig-cluster&limit=10&cursor=xxx',
        )
        .times(1)
        .reply(200, bodyNoToken);

      nock('https://api.snyk.io')
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 2,
              },
              target: {
                userLocator: expect.any(String),
                cluster: expect.any(String),
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyWithToken.data,
                },
              ],
            });
          },
        )
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 2,
              },
              target: {
                userLocator: expect.any(String),
                cluster: 'Default cluster',
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyNoToken.data,
                },
              ],
            });
          },
        );

      await scrapeData();

      try {
        expect(nock.isDone()).toBeTruthy();
      } catch (err) {
        console.error(`nock pending mocks: ${nock.pendingMocks()}`);
        throw err;
      }
    });
  });
  describe('when sysdig v1 and v2 env vars configured, should use v2', () => {
    beforeAll(() => {
      config.SYSDIG_ENDPOINT = 'https://sysdig';
      config.SYSDIG_TOKEN = 'token123';
      config.SYSDIG_ENDPOINT_URL = 'sysdig';
      config.SYSDIG_RISK_SPOTLIGHT_TOKEN = 'token123';
      config.SYSDIG_CLUSTER_NAME = 'test-sysdig-cluster';
    });

    afterAll(() => {
      delete config.SYSDIG_ENDPOINT;
      delete config.SYSDIG_TOKEN;
      delete config.SYSDIG_ENDPOINT_URL;
      delete config.SYSDIG_RISK_SPOTLIGHT_TOKEN;
      delete config.SYSDIG_CLUSTER_NAME;
    });

    it('correctly sends data to kubernetes-upstream', async () => {
      const bodyWithToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: 'xxx',
        },
      };
      const bodyNoToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: '',
        },
      };
      const expectedHeader = 'Bearer token123';
      nock('https://sysdig', {
        reqheaders: { authorization: expectedHeader },
      })
        .get(
          '/api/scanning/eveintegration/v2/runtimeimages?clusterName=test-sysdig-cluster&limit=10',
        )
        .times(1)
        .reply(200, bodyWithToken);
      nock('https://sysdig', { reqheaders: { authorization: expectedHeader } })
        .get(
          '/api/scanning/eveintegration/v2/runtimeimages?clusterName=test-sysdig-cluster&limit=10&cursor=xxx',
        )
        .times(1)
        .reply(200, bodyNoToken);

      nock('https://api.snyk.io')
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 2,
              },
              target: {
                userLocator: expect.any(String),
                cluster: expect.any(String),
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyWithToken.data,
                },
              ],
            });
          },
        )
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 2,
              },
              target: {
                userLocator: expect.any(String),
                cluster: 'Default cluster',
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyNoToken.data,
                },
              ],
            });
          },
        );

      await scrapeData();

      try {
        expect(nock.isDone()).toBeTruthy();
      } catch (err) {
        console.error(`nock pending mocks: ${nock.pendingMocks()}`);
        throw err;
      }
    });
  });
});

describe('dataScraperV1()', () => {
  describe('when sysdig v1 and v2 env vars configured, should use v2', () => {
    beforeAll(() => {
      config.SYSDIG_ENDPOINT = 'https://sysdig';
      config.SYSDIG_TOKEN = 'token123';
    });

    afterAll(() => {
      delete config.SYSDIG_ENDPOINT;
      delete config.SYSDIG_TOKEN;
    });

    it('correctly sends data to kubernetes-upstream', async () => {
      const bodyWithToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: 'xxx',
        },
      };
      const bodyNoToken = {
        data: [
          {
            imageID: 'something',
            namespace: 'sysdig',
            workloadName: 'workload',
            workloadKind: 'Deployment',
            container: 'box',
            packages: [],
          },
        ],
        page: {
          returned: 10,
          next: '',
        },
      };
      const expectedHeader = 'Bearer token123';
      nock('https://sysdig', { reqheaders: { authorization: expectedHeader } })
        .get('/v1/runtimeimages?limit=10&cursor=')
        .times(1)
        .reply(200, bodyWithToken);

      nock('https://sysdig', { reqheaders: { authorization: expectedHeader } })
        .get('/v1/runtimeimages?limit=10&cursor=xxx')
        .times(1)
        .reply(200, bodyNoToken);

      nock('https://api.snyk.io')
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 1,
              },
              target: {
                userLocator: expect.any(String),
                cluster: 'Default cluster',
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyWithToken.data,
                },
              ],
            });
          },
        )
        .post(
          '/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10',
        )
        .times(1)
        .reply(
          200,
          (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
            expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
              identity: {
                type: 'sysdig',
                sysdigVersion: 1,
              },
              target: {
                userLocator: expect.any(String),
                cluster: 'Default cluster',
                agentId: expect.any(String),
              },
              facts: [
                {
                  type: 'loadedPackages',
                  data: bodyNoToken.data,
                },
              ],
            });
          },
        );

      await scrapeDataV1();

      try {
        expect(nock.isDone()).toBeTruthy();
      } catch (err) {
        console.error(`nock pending mocks: ${nock.pendingMocks()}`);
        throw err;
      }
    });
  });
});
