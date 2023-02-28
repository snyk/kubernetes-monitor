const sleepMock = jest
  .fn()
  .mockRejectedValue(new Error('this was called more times than expected'));
jest.mock('sleep-promise', () => sleepMock);

import nock from 'nock';
import { retryRequest } from '../../src/transmitter';
import type { IRequestError } from '../../src/transmitter/types';

class TestRequestError extends Error implements IRequestError {
  constructor(public code, message?: string) {
    super(message);
  }
}

describe('retryRequest()', () => {
  afterAll(() => {
    jest.restoreAllMocks();
    nock.restore();
  });

  it.each`
    statusCode | sleepDuration
    ${429}     | ${60000}
    ${502}     | ${2000}
    ${503}     | ${2000}
    ${504}     | ${2000}
  `(
    'retries 2 times on receiving http $statusCode',
    async ({ statusCode, sleepDuration }) => {
      sleepMock.mockResolvedValueOnce('1st').mockResolvedValueOnce('2nd');
      nock('http://mocked').post('/api').times(3).reply(statusCode);

      const { attempt } = await retryRequest('post', 'http://mocked/api', {});
      expect(attempt).toEqual(3);

      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).toHaveBeenNthCalledWith(1, sleepDuration);
      expect(sleepMock).toHaveBeenNthCalledWith(2, sleepDuration);
      expect(nock.isDone());
    },
  );

  it('does not retry on receiving an unexpected http response', async () => {
    nock('http://mocked').post('/api').times(1).reply(500);

    const { attempt } = await retryRequest('post', 'http://mocked/api', {});
    expect(attempt).toEqual(1);

    expect(sleepMock).toHaveBeenCalledTimes(0);
    expect(nock.isDone());
  });

  it.each`
    code            | message
    ${'EAI_AGAIN'}  | ${undefined}
    ${'ECONNRESET'} | ${'socket hang up'}
    ${'ECONNRESET'} | ${'Client network socket disconnected before secure TLS connection was established'}
    ${'ECONNRESET'} | ${'write ECONNRESET'}
  `('retries 2 times on error $code $message', async ({ code, message }) => {
    sleepMock.mockResolvedValueOnce('1st').mockResolvedValueOnce('2nd');
    nock('http://mocked')
      .post('/api')
      .times(3)
      .replyWithError(new TestRequestError(code, message));

    await expect(() =>
      retryRequest('post', 'http://mocked/api', {}),
    ).rejects.toThrow();

    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 2000);
    expect(nock.isDone());
  });

  it('does not retry on receiving an unexpected error', async () => {
    nock('http://mocked').post('/api').times(1).replyWithError(new Error());

    await expect(() =>
      retryRequest('post', 'http://mocked/api', {}),
    ).rejects.toThrow();

    expect(sleepMock).toHaveBeenCalledTimes(0);
    expect(nock.isDone());
  });
});
