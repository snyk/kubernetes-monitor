import * as kind from './kind';
import * as eks from './eks';
import * as openshift3 from './openshift3';
import * as openshift4 from './openshift4';

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

// Use a kind cluster pinned to a specific Kubernetes version to mimic OS3.
const openshift3Setup: IPlatformSetup = {
  create: kind.createCluster,
  loadImage: kind.loadImageInCluster,
  delete: kind.deleteCluster,
  config: kind.exportKubeConfig,
  clean: kind.clean,
  setupTester: openshift3.setupTester,
};

const openshift4Setup: IPlatformSetup = {
  create: openshift4.createCluster,
  loadImage: openshift4.returnUnchangedImageNameAndTag,
  delete: openshift4.deleteCluster,
  config: openshift4.exportKubeConfig,
  clean: openshift4.clean,
  setupTester: openshift4.setupTester,
};

export function getKubernetesVersionForPlatform(testPlatform: string): string {
  switch (testPlatform) {
    case 'openshift3':
      return 'v1.11.10';
    default:
      return 'latest';
  }
}

export default {
  kind: kindSetup,
  eks: eksSetup,
  openshift3: openshift3Setup,
  openshift4: openshift4Setup,
};
