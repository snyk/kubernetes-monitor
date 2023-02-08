export interface IImageOptions {
  nameAndTag: string;
  pullPolicy: 'Never' | 'Always' | 'IfPresent';
}

export interface IDeployOptions {
  clusterName: string;
}

export interface IDeployer {
  deploy: (
    imageOptions: IImageOptions,
    deployOptions: IDeployOptions,
  ) => Promise<void>;
}
