export interface IImageOptions {
  nameAndTag: string;
  pullPolicy: 'Never' | 'Always' | 'IfPresent';
}

export interface IDeployer {
  deploy: (imageOptions: IImageOptions) => Promise<void>;
}
