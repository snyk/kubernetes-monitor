import {
  KubernetesListObject,
  KubernetesObject,
  V1ListMeta,
  V1ObjectMeta,
  V1PodTemplateSpec,
} from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

type WorkloadHandlerFunc = (workload: any) => Promise<void>;

type ListNamespacedWorkloadFunctionFactory = (
  namespace: string,
) => () => Promise<{
  response: any;
  body: any;
}>;

type ListClusterWorkloadFunctionFactory = () => () => Promise<{
  response: any;
  body: any;
}>;

export interface IWorkloadWatchMetadata {
  [workloadKind: string]: {
    clusterEndpoint: string;
    namespacedEndpoint: string;
    handlers: {
      [kubernetesInformerVerb: string]: WorkloadHandlerFunc;
    };
    clusterListFactory: ListClusterWorkloadFunctionFactory;
    namespacedListFactory: ListNamespacedWorkloadFunctionFactory;
  };
}

export class V1DeploymentConfigList
  implements KubernetesListObject<V1DeploymentConfig>
{
  'apiVersion'?: string;
  'items': Array<V1DeploymentConfig>;
  'kind'?: string;
  'metadata'?: V1ListMeta;
}

export interface V1DeploymentConfig extends KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
  spec?: V1DeploymentConfigSpec;
  status?: V1DeploymentConfigStatus;
}

export interface V1DeploymentConfigSpec {
  template: V1PodTemplateSpec;
}

export interface V1DeploymentConfigStatus {
  observedGeneration?: number;
}

export class RolloutList implements KubernetesListObject<Rollout> {
  'apiVersion'?: string;
  'items': Array<Rollout>;
  'kind'?: string;
  'metadata'?: V1ListMeta;
}

export interface Rollout extends KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
  spec?: RolloutSpec;
  status?: RolloutStatus;
}

export interface RolloutSpec {
  template: V1PodTemplateSpec;
}

export interface RolloutStatus {
  observedGeneration?: number;
}

export type V1ClusterList<T> = (
  allowWatchBookmarks?: boolean,
  _continue?: string,
  fieldSelector?: string,
  labelSelector?: string,
  limit?: number,
  pretty?: string,
  resourceVersion?: string,
  resourceVersionMatch?: string,
  timeoutSeconds?: number,
  watch?: boolean,
  options?: {
    headers: {
      [name: string]: string;
    };
  },
) => Promise<{
  response: IncomingMessage;
  body: T;
}>;

export type V1NamespacedList<T> = (
  namespace: string,
  pretty?: string,
  allowWatchBookmarks?: boolean,
  _continue?: string,
  fieldSelector?: string,
  labelSelector?: string,
  limit?: number,
  resourceVersion?: string,
  resourceVersionMatch?: string,
  timeoutSeconds?: number,
  watch?: boolean,
  options?: {
    headers: {
      [name: string]: string;
    };
  },
) => Promise<{
  response: IncomingMessage;
  body: T;
}>;
