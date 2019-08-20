import { Request } from 'request';

export type WatchHandlerFunc = (eventType: string, resource: any) => Promise<void>;

export type WatchEndHandlerFunc = (workloadMetadata: IWatchHandlerOptions) => (err: string) => void;

export interface IWatchHandlerOptions {
  readonly namespace: string;
  readonly resourceWatched: WatchedKubernetesObject;
  readonly watchEndHandler: WatchEndHandlerFunc;
}

export interface IWatchHandlerTracker {
  [watchedKubernetesObject: string]: WatchHandlerFunc;
}

export interface IWatchSetupTracker {
  [watchedKubernetesObject: string]: (watchOptions: IWatchHandlerOptions) => Request;
}

export enum WatchedKubernetesObject {
  Deployment = 'Deployment',
  ReplicaSet = 'ReplicaSet',
  StatefulSet = 'StatefulSet',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  CronJob = 'CronJob',
  ReplicationController = 'ReplicationController',
  Pod = 'Pod',

  AllNamespaces = 'all namespaces',
}
