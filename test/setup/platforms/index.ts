import * as kind from './kind';
import * as eks from './eks';

interface IPlatformSetup {
  // create a Kubernetes cluster
  create: (imageNameAndTag: string) => Promise<void>;
  // delete a Kubernetes cluster
  delete: () => Promise<void>;
  // set KUBECONFIG to point at the tested cluster
  config: () => Promise<void>;
}

const kindSetup: IPlatformSetup = {
  create: kind.createCluster,
  delete: kind.deleteCluster,
  config: kind.exportKubeConfig,
};

const eksSetup: IPlatformSetup = {
  create: eks.createCluster,
  delete: eks.deleteCluster,
  config: eks.exportKubeConfig,
}

export default {
  kind: kindSetup,
  eks: eksSetup,
}
