import {
  KubernetesListObject,
  KubernetesObject,
  V1ListMeta,
  V1ObjectMeta,
  V1PodTemplateSpec,
  Configuration,
} from '@kubernetes/client-node';

export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

export type KubernetesInformerVerb = 'add' | 'delete' | 'update';

type WorkloadHandlers = Partial<
  Record<KubernetesInformerVerb, WorkloadHandlerFunc>
>;

type WorkloadHandlerFunc = (workload: any) => Promise<void>;

// TODO: see if you can do better than any
type ListNamespacedWorkloadFunctionFactory = (
  namespace: string,
) => () => Promise<KubernetesListObject<KubernetesObject>>;

type ListClusterWorkloadFunctionFactory = () => () => Promise<
  KubernetesListObject<KubernetesObject>
>;

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

interface V1ClusterListParam {
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
}

export type V1ClusterList<T> = (
  param: V1ClusterListParam,
  options?: Configuration,
) => Promise<T>;

// export type V1ClusterList<T> = (
//   param?: AppsV1ApiListDeploymentForAllNamespacesRequest,
//   options?: Configuration,
// ) => Promise<T>;

interface V1NamespacedListParam {
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
}

// export type V1NamespacedList<T> = (
//   namespace: string,
//   pretty?: string,
//   allowWatchBookmarks?: boolean,
//   _continue?: string,
//   fieldSelector?: string,
//   labelSelector?: string,
//   limit?: number,
//   resourceVersion?: string,
//   resourceVersionMatch?: string,
//   sendInitialEvents?: boolean,
//   timeoutSeconds?: number,
//   watch?: boolean,
//   options?: {
//     headers: {
//       [name: string]: string;
//     };
//   },
// ) => Promise<{
//   response: IncomingMessage;
//   body: T;
// }>;

export type V1NamespacedList<T> = (
  param: V1NamespacedListParam,
  options?: Configuration,
) => Promise<T>;

// export type V1NamespacedList<T> = (
//   param: AppsV1ApiListNamespacedDeploymentRequest,
//   options?: Configuration,
// ) => Promise<T>;
