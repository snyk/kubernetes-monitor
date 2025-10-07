import * as http from 'http'; // no longer used in client-node1.0.0 (move away from request library and now use node-fetch)
import * as kubernetesApiWrappers from '../../../src/supervisor/kuberenetes-api-wrappers';

describe('kubernetes api wrappers', () => {
  test.concurrent('calculateSleepSeconds', async () => {
    const responseWithoutHeaders = {};
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithoutHeaders as http.IncomingMessage,
      ),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);

    const responseWithNegativeSeconds = { headers: { 'Retry-After': -3 } };
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithNegativeSeconds as unknown as http.IncomingMessage,
      ),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);

    const responseWithZeroSeconds = { headers: { 'Retry-After': 0 } };
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithZeroSeconds as unknown as http.IncomingMessage,
      ),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);

    const responseWithDate = {
      headers: { 'Retry-After': 'Fri, 31 Dec 1999 23:59:59 GMT' },
    };
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithDate as unknown as http.IncomingMessage,
      ),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);

    const responseWithHighSecondsMock = { headers: { 'Retry-After': 55 } };
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithHighSecondsMock as unknown as http.IncomingMessage,
      ),
    ).toEqual(kubernetesApiWrappers.MAX_SLEEP_SEC);

    const responseWithSecondsMock = { headers: { 'Retry-After': 4 } };
    expect(
      kubernetesApiWrappers.calculateSleepSeconds(
        responseWithSecondsMock as unknown as http.IncomingMessage,
      ),
    ).toEqual(4);
  });

  test.concurrent(
    'retryKubernetesApiRequest for ECONNREFUSED error',
    async () => {
      const retryableErrorResponse = { code: 'ECONNREFUSED' };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(() =>
          Promise.reject(retryableErrorResponse),
        ),
      ).rejects.toEqual({ code: 'ECONNREFUSED' });

      let failures = 0;
      const functionThatFailsJustEnoughTimes = () => {
        if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
          failures += 1;
          return Promise.reject(retryableErrorResponse);
        }
        return Promise.resolve('egg');
      };

      const successfulResponse =
        await kubernetesApiWrappers.retryKubernetesApiRequest(
          functionThatFailsJustEnoughTimes,
        );
      expect(successfulResponse).toEqual('egg');

      failures = 0;
      const functionThatFailsOneTooManyTimes = () => {
        if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
          failures += 1;
          return Promise.reject(retryableErrorResponse);
        }
        return Promise.resolve('egg');
      };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(
          functionThatFailsOneTooManyTimes,
        ),
      ).rejects.toEqual({ code: 'ECONNREFUSED' });
    },
  );

  test.concurrent('retryKubernetesApiRequest for ETIMEDOUT error', async () => {
    const retryableErrorResponse = { code: 'ETIMEDOUT' };

    await expect(async () =>
      kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        Promise.reject(retryableErrorResponse),
      ),
    ).rejects.toEqual({ code: 'ETIMEDOUT' });

    let failures = 0;
    const functionThatFailsJustEnoughTimes = () => {
      if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
        failures += 1;
        return Promise.reject(retryableErrorResponse);
      }
      return Promise.resolve('egg');
    };

    const successfulResponse =
      await kubernetesApiWrappers.retryKubernetesApiRequest(
        functionThatFailsJustEnoughTimes,
      );
    expect(successfulResponse).toEqual('egg');

    failures = 0;
    const functionThatFailsOneTooManyTimes = () => {
      if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
        failures += 1;
        return Promise.reject(retryableErrorResponse);
      }
      return Promise.resolve('egg');
    };

    await expect(async () =>
      kubernetesApiWrappers.retryKubernetesApiRequest(
        functionThatFailsOneTooManyTimes,
      ),
    ).rejects.toEqual({ code: 'ETIMEDOUT' });
  });

  test.concurrent(
    'retryKubernetesApiRequest for retryable errors',
    async () => {
      const retryableErrorResponse = { response: { statusCode: 429 } };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(() =>
          Promise.reject(retryableErrorResponse),
        ),
      ).rejects.toEqual({ response: { statusCode: 429 } });

      let failures = 0;
      const functionThatFailsJustEnoughTimes = () => {
        if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
          failures += 1;
          return Promise.reject(retryableErrorResponse);
        }
        return Promise.resolve('egg');
      };

      const successfulResponse =
        await kubernetesApiWrappers.retryKubernetesApiRequest(
          functionThatFailsJustEnoughTimes,
        );
      expect(successfulResponse).toEqual('egg');

      failures = 0;
      const functionThatFailsOneTooManyTimes = () => {
        if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
          failures += 1;
          return Promise.reject(retryableErrorResponse);
        }
        return Promise.resolve('egg');
      };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(
          functionThatFailsOneTooManyTimes,
        ),
      ).rejects.toEqual({ response: { statusCode: 429 } });
    },
  );

  test.concurrent(
    'retryKubernetesApiRequest for non-retryable errors',
    async () => {
      const nonRetryableErrorResponse = { response: { statusCode: 500 } };

      let failures = 0;
      const functionThatFails = () => {
        failures += 1;
        return Promise.reject(nonRetryableErrorResponse);
      };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFails),
      ).rejects.toEqual({ response: { statusCode: 500 } });
      expect(failures).toEqual(1);
    },
  );

  test.concurrent(
    'retryKubernetesApiRequest for errors without response',
    async () => {
      const errorWithoutResponse = "there's butter on my face!";

      let failures = 0;
      const functionThatFails = () => {
        failures += 1;
        return Promise.reject(new Error(errorWithoutResponse));
      };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFails),
      ).rejects.toThrow(new Error(errorWithoutResponse));
      expect(failures).toEqual(1);
    },
  );
});
