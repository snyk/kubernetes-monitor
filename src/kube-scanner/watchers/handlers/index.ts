import logger = require('../../../common/logger');
import WorkloadWorker = require('../../../kube-scanner');
import { buildWorkloadMetadata } from '../../metadata-extractor';
import { KubeObjectMetadata } from '../../types';

export async function deleteWorkload(kubernetesMetadata: KubeObjectMetadata, workloadName: string) {
  try {
    if (kubernetesMetadata.ownerRefs !== undefined && kubernetesMetadata.ownerRefs.length > 0) {
      return;
    }

    const localWorkloadLocator = buildWorkloadMetadata(kubernetesMetadata);
    const workloadWorker = new WorkloadWorker(workloadName);
    await workloadWorker.delete(localWorkloadLocator);
  } catch (error) {
    logger.error({error, resourceType: kubernetesMetadata.kind, resourceName: kubernetesMetadata.objectMeta.name},
      'Could not delete workload');
  }
}
