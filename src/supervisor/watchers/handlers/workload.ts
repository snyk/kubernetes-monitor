import { IKubeObjectMetadata } from '../../types';
import { buildWorkloadMetadata } from '../../metadata-extractor';
import { sendDeleteWorkloadRequest } from '../../../scanner';
import logger = require('../../../common/logger');

export async function deleteWorkload(kubernetesMetadata: IKubeObjectMetadata, workloadName: string): Promise<void> {
  try {
    if (kubernetesMetadata.ownerRefs !== undefined && kubernetesMetadata.ownerRefs.length > 0) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);
    await sendDeleteWorkloadRequest(workloadName, localWorkloadLocator);
  } catch (error) {
    logger.error({error, resourceType: kubernetesMetadata.kind, resourceName: kubernetesMetadata.objectMeta.name},
      'could not delete workload');
  }
}
