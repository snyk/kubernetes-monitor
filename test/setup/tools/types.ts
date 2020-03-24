export interface IThirdPartyTool {
  readonly path: string;

  install(): Promise<void>;
  remove(): Promise<void>;
}
