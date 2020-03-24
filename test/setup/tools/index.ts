import {
  path as skopeoPath,
  install as installSkopeo,
  remove as removeSkopeo,
} from './skopeo';
import { IThirdPartyTool } from './types';

type SupportedTools = 'skopeo';

export const tools: Record<SupportedTools, IThirdPartyTool> = {
  skopeo: {
    path: skopeoPath,
    install: installSkopeo,
    remove: removeSkopeo,
  },
};
