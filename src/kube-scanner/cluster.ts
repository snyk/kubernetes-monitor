import { KubeConfig } from '@kubernetes/client-node';
import config = require('../common/config');
import { IK8sClients, K8sClients } from './types';

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

// Gets the cluster name, passed as a config variable inside the app.
function getCurrentCluster(): string {
  return config.CLUSTER_NAME;
}

function getK8sApi(k8sConfig: KubeConfig): IK8sClients {
  return new K8sClients(k8sConfig);
}

export const kubeConfig = getKubeConfig();
export const currentClusterName = getCurrentCluster();
export const k8sApi = getK8sApi(kubeConfig);
