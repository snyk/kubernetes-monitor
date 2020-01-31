import * as kind from './kind';
import * as eks from './eks';
import * as openshift4 from './openshift4';

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
}

const kindSetup: IPlatformSetup = {
  create: kind.createCluster,
  loadImage: kind.loadImageInCluster,
  delete: kind.deleteCluster,
  config: kind.exportKubeConfig,
  clean: kind.clean,
};

const eksSetup: IPlatformSetup = {
  create: eks.createCluster,
  loadImage: eks.loadImageInCluster,
  delete: eks.deleteCluster,
  config: eks.exportKubeConfig,
  clean: eks.clean,
};

const openshift4Setup: IPlatformSetup = {
  create: openshift4.createCluster,
  loadImage: openshift4.loadImageInCluster,
  delete: openshift4.deleteCluster,
  config: openshift4.exportKubeConfig,
  clean: openshift4.clean,
};

export default {
  kind: kindSetup,
  eks: eksSetup,
  openshift4: openshift4Setup,
};
