import nock from 'nock';

import { config } from '../../../src/common/config';
import { scrapeData } from '../../../src/data-scraper';
import * as transmitterTypes from '../../../src/transmitter/types';

describe('dataScraper()', () => {
  beforeAll(() => {
    config.SYSDIG_ENDPOINT = 'https://sysdig';
    config.SYSDIG_TOKEN = 'token123';
  });

  afterAll(() => {
    delete config.SYSDIG_ENDPOINT;
    delete config.SYSDIG_TOKEN;
  });

  it('correctly sends data to kubernetes-upstream', async (jestDoneCallback) => {
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

    nock('https://kubernetes-upstream.snyk.io')
      .post('/api/v1/runtime-results')
      .times(1)
      .reply(200, (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
        try {
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
                data: bodyWithToken.data,
              },
            ],
          });
        } catch (error) {
          jestDoneCallback(error);
        }
      })
      .post('/api/v1/runtime-results')
      .times(1)
      .reply(200, (uri, requestBody: transmitterTypes.IRuntimeDataPayload) => {
        try {
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
          jestDoneCallback();
        } catch (error) {
          jestDoneCallback(error);
        }
      });

    await scrapeData();
  });
});
