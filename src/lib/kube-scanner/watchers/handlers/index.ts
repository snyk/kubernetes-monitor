import logger = require('../../../../common/logger');
import WorkloadWorker = require('../../../kube-scanner');
import { buildImageMetadata } from '../../metadata-extractor';
import { KubeObjectMetadata } from '../../types';

export async function deleteWorkload(kubernetesMetadata: KubeObjectMetadata, logId: string) {
  try {
    if (kubernetesMetadata.ownerRefs !== undefined && kubernetesMetadata.ownerRefs.length > 0) {
      return;
    }
    const workloadMetadata = buildImageMetadata(kubernetesMetadata);
    const workloadWorker = new WorkloadWorker(logId);
    await workloadWorker.delete(workloadMetadata);
  } catch (error) {
    logger.error({error, resourceType: kubernetesMetadata.kind, resourceName: kubernetesMetadata.objectMeta.name},
      'Could not delete workload');
  }
}
