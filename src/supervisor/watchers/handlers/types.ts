import { V1ObjectMeta, V1PodTemplateSpec } from '@kubernetes/client-node';

export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

type WorkloadHandlerFunc = (workload: any) => Promise<void>;

type ListWorkloadFunctionFactory = (
  namespace: string,
) => () => Promise<{
  response: any;
  body: any;
}>;

export interface IWorkloadWatchMetadata {
  [workloadKind: string]: {
    endpoint: string;
    handlers: {
      [kubernetesInformerVerb: string]: WorkloadHandlerFunc;
    };
    listFactory: ListWorkloadFunctionFactory;
  };
}

export interface V1DeploymentConfig {
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
