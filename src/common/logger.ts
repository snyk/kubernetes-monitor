import * as log from '@snyk/log';
import * as config from './config';
import * as sentry from './sentry';

export const Logger = log(config.LOGGING, sentry);
export const logger = Logger('main');

export function loggingFunc(logContext: any, label: string = 'Reply sent'): void {
  if (!logContext.status || logContext.status === 200) {
    logger.info(logContext, label);
  } else if (logContext.status < 500) {
    logger.warn(logContext, label);
  } else {
    logger.error(logContext, label);
  }
}
