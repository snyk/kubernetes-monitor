import * as tap from 'tap';
import * as http from 'http';
import * as kubernetesApiWrappers from '../../../src/supervisor/kuberenetes-api-wrappers';

tap.test('calculateSleepSeconds', async (t) => {
  const responseWithoutHeaders = {};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithoutHeaders as http.IncomingMessage),
    kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    'returns the default value for a response without headers',
  );

  const responseWithNegativeSeconds = {headers: {'Retry-After': -3}};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithNegativeSeconds as unknown as http.IncomingMessage),
    kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    'returns the default value for a response with negative retry',
  );

  const responseWithZeroSeconds = {headers: {'Retry-After': 0}};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithZeroSeconds as unknown as http.IncomingMessage),
    kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    'returns the default value for a response with zero retry',
  );

  const responseWithDate = {headers: {'Retry-After': 'Fri, 31 Dec 1999 23:59:59 GMT'}};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithDate as unknown as http.IncomingMessage),
    kubernetesApiWrappers.DEFAULT_SLEEP_SEC,
    'returns the default value for a response with a date',
  );

  const responseWithHighSecondsMock = {headers: {'Retry-After': 55}};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithHighSecondsMock as unknown as http.IncomingMessage),
    kubernetesApiWrappers.MAX_SLEEP_SEC,
    'returns a value limited for high retry values',
  );

  const responseWithSecondsMock = {headers: {'Retry-After': 4}};
  t.equals(
    kubernetesApiWrappers.calculateSleepSeconds(responseWithSecondsMock as unknown as http.IncomingMessage),
    4,
    'returns the retry-after value if numeric, positive and not too high',
  );
});

tap.test('retryKubernetesApiRequest for ECONNREFUSED error', async (t) => {
  const retryableErrorResponse = {code: 'ECONNREFUSED'};

  await t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(() => Promise.reject(retryableErrorResponse)),
    'eventually throws on repeated retryable error responses',
  );

  let failures = 0;
  const functionThatFailsJustEnoughTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  const successfulResponse = await kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsJustEnoughTimes);
  t.equals(
    successfulResponse,
    'egg',
    'keeps retrying on ECONNREFUSED as long as we don\'t cross max attempts',
  );

  failures = 0;
  const functionThatFailsOneTooManyTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  await t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsOneTooManyTimes),
    'failure more than the maximum, rejects, even for a retryable error response',
  );
});

tap.test('retryKubernetesApiRequest for ETIMEDOUT error', async (t) => {
  const retryableErrorResponse = {code: 'ETIMEDOUT'};

  await t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(() => Promise.reject(retryableErrorResponse)),
    'eventually throws on repeated retryable error responses',
  );

  let failures = 0;
  const functionThatFailsJustEnoughTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  const successfulResponse = await kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsJustEnoughTimes);
  t.equals(
    successfulResponse,
    'egg',
    'keeps retrying on ETIMEDOUT as long as we don\'t cross max attempts',
  );

  failures = 0;
  const functionThatFailsOneTooManyTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  await t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsOneTooManyTimes),
    'failure more than the maximum, rejects, even for a retryable error response',
  );
});

tap.test('retryKubernetesApiRequest for retryable errors', async (t) => {
  const retryableErrorResponse = {response: {statusCode: 429}};

  t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(() => Promise.reject(retryableErrorResponse)),
    'eventually throws on repeated retryable error responses',
  );

  let failures = 0;
  const functionThatFailsJustEnoughTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX - 1) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  const successfulResponse = await kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsJustEnoughTimes);
  t.equals(
    successfulResponse,
    'egg',
    'keeps retrying on 429 as long as we don\'t cross max attempts',
  );

  failures = 0;
  const functionThatFailsOneTooManyTimes = () => {
    if (failures < kubernetesApiWrappers.ATTEMPTS_MAX) {
      failures +=1;
      return Promise.reject(retryableErrorResponse);
    }
    return Promise.resolve('egg');
  };

  t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFailsOneTooManyTimes),
    'failure more than the maximum, rejects, even for a retryable error response',
  );
});

tap.test('retryKubernetesApiRequest for non-retryable errors', async (t) => {
  const nonRetryableErrorResponse = {response: {statusCode: 500}};

  let failures = 0;
  const functionThatFails = () => {
    failures +=1;
    return Promise.reject(nonRetryableErrorResponse);
  };

  t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFails),
    'failure more than the maximum, rejects, even for a retryable error response',
  );
  t.equals(failures, 1, 'did not retry even once for non-retryable error code');
});

tap.test('retryKubernetesApiRequest for errors without response', async (t) => {
  const errorWithoutResponse = 'there\'s butter on my face!';

  let failures = 0;
  const functionThatFails = () => {
    failures +=1;
    return Promise.reject(new Error(errorWithoutResponse));
  };

  t.rejects(
    () => kubernetesApiWrappers.retryKubernetesApiRequest(functionThatFails),
    new Error(errorWithoutResponse),
    'errors without a response property are immediately rethrown',
  );
  t.equals(failures, 1, 'did not retry even once for non-retryable error code');
});
