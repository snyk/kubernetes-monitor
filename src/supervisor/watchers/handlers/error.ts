import type { Informer, KubernetesObject } from '@kubernetes/client-node';
import { logger } from '../../../common/logger';
import {
  RETRYABLE_NETWORK_ERROR_CODES,
  RETRYABLE_NETWORK_ERROR_MESSAGES,
} from '../types';

type InformerError = Partial<{ code: string | number; message: string }>;

export function restartableErrorHandler(
  informer: Informer<KubernetesObject>,
  logContext: Record<string, unknown>,
) {
  return function handler(error: InformerError): void {
    const code = typeof error.code === 'string' ? error.code : '';
    const message = error.message || '';
    logContext.code = error.code ?? '';
    if (
      RETRYABLE_NETWORK_ERROR_CODES.includes(code) ||
      RETRYABLE_NETWORK_ERROR_MESSAGES.includes(message)
    ) {
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
