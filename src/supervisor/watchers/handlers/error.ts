import type { Informer, KubernetesObject } from '@kubernetes/client-node';
import { logger } from '../../../common/logger';

export function restartableErrorHandler(
  informer: Informer<KubernetesObject>,
  logContext: Record<string, unknown>,
) {
  return function handler(err: KubernetesObject): void {
    logger.error(err);
    // Restart informer after 1sec
    setTimeout(async () => {
      await informer.start();
    }, 1000);
  };
}
