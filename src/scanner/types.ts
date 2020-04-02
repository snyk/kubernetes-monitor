export interface IScanResult {
  image: string;
  imageWithTag: string;
  pluginResult: any;
}

export enum StaticAnalysisImageType {
  DockerArchive = 'docker-archive',
}

export interface IPluginOptions {
  staticAnalysisOptions: IStaticAnalysisOptions;
  experimental: boolean;
}

export interface IStaticAnalysisOptions {
  imagePath: string;
  imageType: StaticAnalysisImageType;
}
