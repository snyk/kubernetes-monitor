import nock from 'nock';

import { config } from '../../../src/common/config';
import { scrapeData } from '../../../src/data-scraper';
import * as transmitterTypes from '../../../src/transmitter/types';

describe('dataScraper()', () => {
  beforeAll(() => {
    config.SYSDIG_REGION_URL = 'sysdig';
    config.SYSDIG_API_TOKEN = 'token123';
    config.SYSDIG_CLUSTER_NAME = 'test-sysdig-cluster';
  });

  afterAll(() => {
    delete config.SYSDIG_REGION_URL;
    delete config.SYSDIG_API_TOKEN;
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
      .post('/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10')
      .times(1)
      .reply(200, (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
        expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
          identity: {
            type: 'sysdig',
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
      })
      .post('/v2/kubernetes-upstream/api/v1/runtime-results?version=2023-02-10')
      .times(1)
      .reply(200, (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
        expect(requestBody).toEqual<transmitterTypes.IRuntimeDataPayload>({
          identity: {
            type: 'sysdig',
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
      });

    await scrapeData();

    try {
      expect(nock.isDone()).toBeTruthy();
    } catch (err) {
      console.error(`nock pending mocks: ${nock.pendingMocks()}`);
      throw err;
    }
  });
});
