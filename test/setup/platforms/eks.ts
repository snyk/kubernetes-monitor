export async function createCluster(imageNameAndTag: string): Promise<void> {
  exportKubeConfig();
  throw new Error('Not implemented');
  // process.env.KUBECONFIG = 'path-to-/kubeconfig-aws';
}

export async function deleteCluster(): Promise<void> {
  throw new Error('Not implemented');
}

export async function exportKubeConfig(): Promise<void> {
  throw new Error('Not implemented');
}
