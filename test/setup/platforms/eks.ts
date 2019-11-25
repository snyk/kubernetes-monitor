export async function createCluster(imageNameAndTag: string): Promise<void> {
  exportKubeConfig('TODO');
  throw new Error('Not implemented');
  // process.env.KUBECONFIG = 'path-to-/kubeconfig-aws';
}

export async function deleteCluster(clusterName = 'kind'): Promise<void> {
  throw new Error('Not implemented');
}

async function exportKubeConfig(clusterName): Promise<void> {
  throw new Error('Not implemented');
}
