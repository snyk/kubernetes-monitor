import { LegacyPluginResponse } from './images/docker-plugin-shim';

export interface IScanResult {
  image: string;
  imageWithDigest?: string;
  imageWithTag: string;
  pluginResult: LegacyPluginResponse;
}
