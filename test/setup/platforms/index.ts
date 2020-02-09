import * as kind from './kind';
import * as eks from './eks';

interface IPlatformSetup {
  // create a Kubernetes cluster
  create: () => Promise<void>;
  // loads the image so Kubernetes may run it, return the name of the image in its registry's format
  loadImage: (imageNameAndTag: string) => Promise<string>;
  // delete a Kubernetes cluster
  delete: () => Promise<void>;
  // set KUBECONFIG to point at the tested cluster
  config: () => Promise<void>;
  // clean up whatever we littered an existing cluster with
  clean: () => Promise<void>;
  // set up host requirements specific to this platform
  setupTester: () => Promise<void>;
}

const kindSetup: IPlatformSetup = {
  create: kind.createCluster,
  loadImage: kind.loadImageInCluster,
  delete: kind.deleteCluster,
  config: kind.exportKubeConfig,
  clean: kind.clean,
  setupTester: kind.setupTester,
};

const eksSetup: IPlatformSetup = {
  create: eks.createCluster,
  loadImage: eks.loadImageInCluster,
  delete: eks.deleteCluster,
  config: eks.exportKubeConfig,
  clean: eks.clean,
  setupTester: eks.setupTester,
};

export default {
  kind: kindSetup,
  eks: eksSetup,
};
