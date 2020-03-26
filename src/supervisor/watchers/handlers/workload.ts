import { IKubeObjectMetadata } from '../../types';
import { buildWorkloadMetadata } from '../../metadata-extractor';
import WorkloadWorker = require('../../../scanner');
import logger = require('../../../common/logger');

export async function deleteWorkload(kubernetesMetadata: IKubeObjectMetadata, workloadName: string): Promise<void> {
  try {
    if (kubernetesMetadata.ownerRefs !== undefined && kubernetesMetadata.ownerRefs.length > 0) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);
    const workloadWorker = new WorkloadWorker(workloadName);
    await workloadWorker.delete(localWorkloadLocator);
  } catch (error) {
    logger.error({error, resourceType: kubernetesMetadata.kind, resourceName: kubernetesMetadata.objectMeta.name},
      'could not delete workload');
  }
}
