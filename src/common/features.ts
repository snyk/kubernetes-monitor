import * as config from './config';

export function isStaticAnalysisEnabled(): boolean {
  return config.STATIC_ANALYSIS === true;
}
