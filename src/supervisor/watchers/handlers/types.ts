import {
  KubernetesListObject,
  KubernetesObject,
  V1ListMeta,
  V1ObjectMeta,
  V1PodTemplateSpec,
  ADD,
  DELETE,
  UPDATE,
} from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

export type KubernetesInformerVerb = ADD | DELETE | UPDATE;

type WorkloadHandlers = Partial<
  Record<KubernetesInformerVerb, WorkloadHandlerFunc>
>;

type WorkloadHandlerFunc = (workload: any) => Promise<void>;


// TODO might want to consider creating a new response type that is more 1.0.0 compatible
type ListNamespacedWorkloadFunctionFactory = (
  namespace: string,
) => () => Promise<{
  response: any;
  body: any;
}>;
// TODO might want to consider creating a new response type that is more 1.0.0 compatible
type ListClusterWorkloadFunctionFactory = () => () => Promise<{
  response: any;
  body: any;
}>;

export interface IWorkloadWatchMetadata {
  [workloadKind: string]: {
    clusterEndpoint: string;
    namespacedEndpoint: string;
    handlers: WorkloadHandlers;
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

export class V1alpha1RolloutList
  implements KubernetesListObject<V1alpha1Rollout>
{
  'apiVersion'?: string;
  'items': Array<V1alpha1Rollout>;
  'kind'?: string;
  'metadata'?: V1ListMeta;
}

export interface V1alpha1Rollout extends KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
  spec?: V1alpha1RolloutSpec;
  status?: V1alpha1RolloutStatus;
}

export interface V1alpha1RolloutSpec {
  template?: V1PodTemplateSpec;
  workloadRef?: V1alpha1RolloutWorkloadRef;
}

export interface V1alpha1RolloutStatus {
  observedGeneration?: number;
}

export interface V1alpha1RolloutWorkloadRef {
  apiVersion: string;
  kind: string;
  name: string;
}

// TODO this might need to change to remove IncomingMessage 
export type V1ClusterList<T> = (
  allowWatchBookmarks?: boolean,
  _continue?: string,
  fieldSelector?: string,
  labelSelector?: string,
  limit?: number,
  pretty?: string,
  resourceVersion?: string,
  resourceVersionMatch?: string,
  sendInitialEvents?: boolean,
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
// TODO this might need to change to remove IncomingMessage 
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
  sendInitialEvents?: boolean,
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
