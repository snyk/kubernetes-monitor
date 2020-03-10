export interface IDeployer {
  deploy: (
    integrationId: string,
    imageOpts: {
      imageNameAndTag: string;
      imagePullPolicy: string;
    },
  ) => Promise<void>;
}
