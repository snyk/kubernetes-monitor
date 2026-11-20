import type { Informer, KubernetesObject } from '@kubernetes/client-node';
import { logger } from '../../../common/logger';
import {
  getNetworkErrorCode,
  isRetryableNetworkError,
} from '../../kuberenetes-api-wrappers';
import type { IRequestError } from '../../types';

export function restartableErrorHandler(
  informer: Informer<KubernetesObject>,
  logContext: Record<string, unknown>,
) {
  return function handler(error: IRequestError): void {
    logContext.code = getNetworkErrorCode(error) || '';
    if (isRetryableNetworkError(error)) {
      logger.debug(logContext, 'informer error occurred, restarting informer');

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error(
        { ...logContext, error },
        'unexpected informer error event occurred',
      );
    }
  };
}
