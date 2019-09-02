type WorkloadHandlerFunc = (workload: any) => Promise<void>;

type WorkloadListFactoryFunc = (namespace: string) => () => Promise<{
  response: any;
  body: any;
}>;

export interface IWorkloadWatchMetadata {
  [workloadKind: string]: {
    endpoint: string,
    handlers: {
      [kubernetesInformerVerb: string]: WorkloadHandlerFunc,
    },
    listFunc: WorkloadListFactoryFunc;
  };
}
