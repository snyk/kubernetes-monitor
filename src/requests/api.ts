import request = require('request-promise-native');
import { ApiOptions } from '.';

export function get(url: string, userOptions: ApiOptions) {
  return call(url, 'GET', userOptions);
}

export function post(url: string, userOptions: ApiOptions) {
  return call(url, 'POST', userOptions);
}

function call(url: string, method: string | undefined, userOptions: ApiOptions): Promise<any> {
  const options = {
    uri: url,
    qs: userOptions.query,
    method: method || 'GET',
    body: userOptions.body || undefined,
    simple: true, // reject if not 2xx
    json: true, // send and receive JSON objects (parse response body)
    gzip: true, // yes! send me compressed data
  };
  return request(options).catch((error) => {
    const reportedError = new Error('Request to vulndb-service failed') as any;
    reportedError.failedReqOptions = options;
    reportedError.innerError = error;
    return Promise.reject(reportedError);
  });
}
