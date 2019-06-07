import { KubeConfig } from '@kubernetes/client-node';
import { K8sClients } from '../../transmitter/types';

function getCurrentCluster(k8sConfig: KubeConfig): string {
  const cluster = k8sConfig.getCurrentCluster();
  if (cluster === null) {
    throw new Error(`Couldnt connect to current cluster info`);
  }
  return cluster.name;
}

const kc = new KubeConfig();
// should be: kc.loadFromCluster;
kc.loadFromDefault();

export const currentClusterName = getCurrentCluster(kc);
export const k8sApi = new K8sClients(kc);
