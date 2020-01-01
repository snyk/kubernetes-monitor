export const FALSY_WORKLOAD_NAME_MARKER = 'falsy workload name';

type WorkloadHandlerFunc = (workload: any) => Promise<void>;

type ListWorkloadFunctionFactory = (namespace: string) => () => Promise<{
  response: any;
  body: any;
}>;

export interface IWorkloadWatchMetadata {
  [workloadKind: string]: {
    endpoint: string,
    handlers: {
      [kubernetesInformerVerb: string]: WorkloadHandlerFunc,
    },
    listFactory: ListWorkloadFunctionFactory;
  };
}
