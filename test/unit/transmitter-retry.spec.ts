const sleepMock = jest
  .fn()
  .mockRejectedValue(new Error('this was called more times than expected'));
jest.mock('sleep-promise', () => sleepMock);

import nock from 'nock';
import { retryRequest } from '../../src/transmitter';

describe('retryRequest()', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  it.each([[429], [502], [503], [504]])(
    'retries more than 3 times on receiving http %s',
    async (statusCode) => {
      sleepMock
        .mockResolvedValueOnce('1st')
        .mockResolvedValueOnce('2nd')
        .mockResolvedValueOnce('3rd');
      nock('http://mocked').post('/api').times(3).reply(statusCode);
      nock('http://mocked').post('/api').times(1).reply(500);

      const { attempt } = await retryRequest('post', 'http://mocked/api', {});
      expect(attempt).toEqual(4);

      expect(sleepMock).toHaveBeenCalledTimes(3);
      expect(nock.isDone());
    },
  );

  it('retries only 3 times on receiving an unexpected error', async () => {
    nock('http://mocked').post('/api').times(3).reply(500);
    sleepMock.mockResolvedValueOnce('1st').mockResolvedValueOnce('2nd');

    const { attempt } = await retryRequest('post', 'http://mocked/api', {});
    expect(attempt).toEqual(3);

    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(nock.isDone());
  });
});
