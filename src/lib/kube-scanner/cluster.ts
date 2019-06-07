import { KubeConfig } from '@kubernetes/client-node';
import { IK8sClients, K8sClients } from './types';

const kubeConfig = getKubeConfig();

function getKubeConfig(): KubeConfig {
  const kc = new KubeConfig();
  // TODO(ivanstanev): We may need to change this to loadFromClusterAndUser()
  // and pass the cluster and user from somewhere (e.g. env vars).
  // By default, these would be (as taken from the k8s client source):
  // { name: 'cluster', server: 'http://localhost:8080' } as Cluster,
  // { name: 'user' } as User
  // We need to identify what the implications of this are, and whether
  // our customers would want to configure this. Keep an eye on this!
  kc.loadFromDefault();
  return kc;
}

function getCurrentCluster(k8sConfig: KubeConfig): string {
  const cluster = k8sConfig.getCurrentCluster();
  if (cluster === null) {
    throw new Error(`Couldnt connect to current cluster info`);
  }
  return cluster.name;
}

function getK8sApi(k8sConfig: KubeConfig): IK8sClients {
  return new K8sClients(k8sConfig);
}

export const currentClusterName = getCurrentCluster(kubeConfig);
export const k8sApi = getK8sApi(kubeConfig);
