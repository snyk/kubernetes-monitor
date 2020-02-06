import * as kind from './kind';
import * as eks from './eks';

interface IPlatformSetup {
  // create a Kubernetes cluster
  create: () => Promise<void>;
  // return the name of the image in its registry's format
  targetImageName: (imageNameAndTag: string) => Promise<string>
  // loads the image so Kubernetes may run it
  loadImage: (targeImageName: string) => Promise<void>;
  // delete a Kubernetes cluster
  delete: () => Promise<void>;
  // set KUBECONFIG to point at the tested cluster
  config: () => Promise<void>;
  // clean up whatever we littered an existing cluster with
  clean: () => Promise<void>;
  // deployment configuration adjustment for a platform
  deploymentFileConfig: (deployment) => Promise<void>;
}

const kindSetup: IPlatformSetup = {
  create: kind.createCluster,
  targetImageName: kind.targetImageName,
  loadImage: kind.loadImageInCluster,
  delete: kind.deleteCluster,
  config: kind.exportKubeConfig,
  clean: kind.clean,
  deploymentFileConfig: kind.deploymentFileConfig,
};

const eksSetup: IPlatformSetup = {
  create: eks.createCluster,
  targetImageName: eks.targetImageName,
  loadImage: eks.loadImageInCluster,
  delete: eks.deleteCluster,
  config: eks.exportKubeConfig,
  clean: eks.clean,
  deploymentFileConfig: eks.deploymentFileConfig,
};

export default {
  kind: kindSetup,
  eks: eksSetup,
};
