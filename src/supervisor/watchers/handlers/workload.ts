import { logger } from '../../../common/logger';
import { config } from '../../../common/config';
import { IKubeObjectMetadata } from '../../types';
import { buildWorkloadMetadata } from '../../metadata-extractor';
import { sendDeleteWorkloadRequest } from '../../../scanner';
import {
  addPendingDelete,
  getGracePeriodAnnotation,
} from '../../pending-deletes';

export async function deleteWorkload(
  kubernetesMetadata: IKubeObjectMetadata,
  workloadName: string,
): Promise<void> {
  try {
    if (
      kubernetesMetadata.ownerRefs !== undefined &&
      kubernetesMetadata.ownerRefs.length > 0
    ) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);

    if (config.DELETE_GRACE_PERIOD_ENABLED) {
      const annotation = getGracePeriodAnnotation(
        kubernetesMetadata.objectMeta.annotations,
      );
      if (annotation) {
        const deferred = addPendingDelete(localWorkloadLocator, workloadName, annotation);
        if (deferred) {
          return;
        }
      }
    }

    await sendDeleteWorkloadRequest(workloadName, localWorkloadLocator);
  } catch (error) {
    logger.error(
      {
        error,
        resourceType: kubernetesMetadata.kind,
        resourceName: kubernetesMetadata.objectMeta.name,
      },
      'could not delete workload',
    );
  }
}
