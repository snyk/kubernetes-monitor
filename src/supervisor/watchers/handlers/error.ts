import type { Informer, KubernetesObject } from '@kubernetes/client-node';
import { logger } from '../../../common/logger';
import {
  RETRYABLE_NETWORK_ERROR_CODES,
  RETRYABLE_NETWORK_ERROR_MESSAGES,
} from '../types';

type InformerError = Partial<{ code: string | number; message: string }>;

// The 1.x client refuses plain-HTTP API servers at request-creation time,
// e.g. KubeConfig.loadFromDefault()'s http://localhost:8080 fallback when no
// kubeconfig exists. The 0.x client sent the request and failed with the
// retryable ECONNREFUSED, so the informer kept restarting and its retry timer
// kept the process alive (everything else on the event loop is unref'd).
// Restart on this error too to preserve that liveness behavior.
const RESTARTABLE_CLIENT_CONFIG_ERROR_MESSAGES: readonly string[] = [
  'HTTP protocol is not allowed when skipTLSVerify is not set or false',
];

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
      RETRYABLE_NETWORK_ERROR_MESSAGES.includes(message) ||
      RESTARTABLE_CLIENT_CONFIG_ERROR_MESSAGES.includes(message)
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
