import * as kubernetesApiWrappers from '../../../src/supervisor/kuberenetes-api-wrappers';

describe('kubernetes api wrappers', () => {
  test.concurrent('calculateSleepSeconds', async () => {
    expect(kubernetesApiWrappers.calculateSleepSeconds()).toEqual(
      kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    );
    expect(kubernetesApiWrappers.calculateSleepSeconds({})).toEqual(
      kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    );
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({ 'retry-after': '-3' }),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({ 'retry-after': '0' }),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({
        'retry-after': 'Fri, 31 Dec 1999 23:59:59 GMT',
      }),
    ).toEqual(kubernetesApiWrappers.DEFAULT_SLEEP_SEC);
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({ 'retry-after': '55' }),
    ).toEqual(kubernetesApiWrappers.MAX_SLEEP_SEC);
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({ 'retry-after': '4' }),
    ).toEqual(4);
    expect(
      kubernetesApiWrappers.calculateSleepSeconds({ 'Retry-After': '4' }),
    ).toEqual(4);
  });

  test.concurrent('getErrorStatusCode', async () => {
    // ApiException from generated API clients
    expect(kubernetesApiWrappers.getErrorStatusCode({ code: 404 })).toEqual(
      404,
    );
    // watch errors
    expect(
      kubernetesApiWrappers.getErrorStatusCode({ statusCode: 410 }),
    ).toEqual(410);
    expect(
      kubernetesApiWrappers.getErrorStatusCode({ code: 'ECONNRESET' }),
    ).toBeUndefined();
  });

  test.concurrent('isRetryableNetworkError', async () => {
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({ code: 'ECONNRESET' }),
    ).toEqual(true);
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({
        message: 'fetch failed',
        cause: { code: 'ECONNREFUSED' },
      }),
    ).toEqual(true);
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({
        message: 'terminated',
        cause: { code: 'UND_ERR_SOCKET' },
      }),
    ).toEqual(true);
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({
        message: 'Too Many Requests',
      }),
    ).toEqual(true);
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({ code: 'EPIPE' }),
    ).toEqual(false);
    expect(
      kubernetesApiWrappers.isRetryableNetworkError({ code: 500 }),
    ).toEqual(false);
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
      const retryableErrorResponse = { code: 429 };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(() =>
          Promise.reject(retryableErrorResponse),
        ),
      ).rejects.toEqual({ code: 429 });

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
      ).rejects.toEqual({ code: 429 });
    },
  );

  test.concurrent(
    'retryKubernetesApiRequest for non-retryable errors',
    async () => {
      const nonRetryableErrorResponse = { code: 500 };

      let failures = 0;
      const functionThatFails = () => {
        failures += 1;
        return Promise.reject(nonRetryableErrorResponse);
      };

      await expect(async () =>
        kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFails),
      ).rejects.toEqual({ code: 500 });
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
