import {
  KubernetesListObject,
  KubernetesObject,
  V1ListMeta,
  V1ObjectMeta,
  V1PodTemplateSpec,
} from '@kubernetes/client-node';

export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

export type KubernetesInformerVerb = string;
type WorkloadHandlers = Partial<
  Record<KubernetesInformerVerb, WorkloadHandlerFunc>
>;

type WorkloadHandlerFunc = (workload: any) => Promise<void>;

type ListNamespacedWorkloadFunctionFactory = (
  namespace: string,
) => () => Promise<any>;

type ListClusterWorkloadFunctionFactory = () => () => Promise<any>;

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

export type V1ClusterList<T> = (clusterRequest: {
  allowWatchBookmarks?: boolean;
  _continue?: string;
  fieldSelector?: string;
  labelSelector?: string;
  limit?: number;
  pretty?: string;
  resourceVersion?: string;
  resourceVersionMatch?: string;
  sendInitialEvents?: boolean;
  timeoutSeconds?: number;
  watch?: boolean;
  options?: {
    headers: {
      [name: string]: string;
    };
  };
}) => Promise<T>;

export type V1NamespacedList<T> = (batchRequst: {
  namespace: string;
  pretty?: string;
  allowWatchBookmarks?: boolean;
  _continue?: string;
  fieldSelector?: string;
  labelSelector?: string;
  limit?: number;
  resourceVersion?: string;
  resourceVersionMatch?: string;
  sendInitialEvents?: boolean;
  timeoutSeconds?: number;
  watch?: boolean;
  options?: {
    headers: {
      [name: string]: string;
    };
  };
}) => Promise<T>;
