import { ScanResult } from 'snyk-docker-plugin';

import { LegacyPluginResponse } from './images/docker-plugin-shim';

export interface IScanResult {
  image: string;
  imageWithDigest?: string;
  imageWithTag: string;
  /** @deprecated Will be removed once all customers have safely upgraded to newer versions. */
  pluginResult: LegacyPluginResponse;
  scanResults: ScanResult[];
}
