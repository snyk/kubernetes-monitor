import * as kind from './kind';

interface IPlatformSetup {
  // create a Kubernetes cluster
  create: (version: string) => Promise<void>;
  // loads the image so Kubernetes may run it, return the name of the image in its registry's format
  loadImage: (imageNameAndTag: string) => Promise<string>;
  // delete a Kubernetes cluster
  delete: () => Promise<void>;
  // set KUBECONFIG to point at the tested cluster
  config: () => Promise<void>;
  // clean up whatever we littered an existing cluster with
  clean: () => Promise<void>;
  // ensure the environment is configured properly for the platform setup; can throw
  validateRequiredEnvironment: () => Promise<void>;
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
  validateRequiredEnvironment: kind.validateRequiredEnvironment,
};

export function getKubernetesVersionForPlatform(testPlatform: string): string {
  switch (testPlatform) {
    default:
      return 'latest';
  }
}

export default {
  kind: kindSetup,
} as {
  [key: string]: IPlatformSetup;
};
