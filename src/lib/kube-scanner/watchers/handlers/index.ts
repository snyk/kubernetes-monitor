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
    console.log(`${logId}: Removed the following images: ${workloadMetadata.map((workload) => workload.imageName)}`);
  } catch (error) {
    console.log(`${logId}: Could not delete the ${kubernetesMetadata.kind} ${kubernetesMetadata.objectMeta.name}: ` +
      JSON.stringify(error));
  }
}
