import * as kind from './kind';
import * as eks from './eks';
import * as openshift4 from './openshift4';

export async function doNothingAsync(): Promise<void> {}

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
  clean: doNothingAsync,
  setupTester: kind.setupTester,
};

const eksSetup: IPlatformSetup = {
  create: doNothingAsync,
  loadImage: eks.loadImageInCluster,
  delete: doNothingAsync,
  config: eks.exportKubeConfig,
  clean: eks.clean,
  setupTester: eks.setupTester,
};

const openshift4Setup: IPlatformSetup = {
  create: doNothingAsync,
  loadImage: openshift4.returnUnchangedImageNameAndTag,
  delete: doNothingAsync,
  config: openshift4.exportKubeConfig,
  clean: openshift4.clean,
  setupTester: openshift4.setupTester,
};

export default {
  kind: kindSetup,
  eks: eksSetup,
  openshift4: openshift4Setup,
};
