import { yamlDeployer } from './yaml';
import { helmDeployer } from './helm';
import { helmWithProxyDeployer } from './helm-with-proxy';

export default {
  YAML: yamlDeployer,
  Helm: helmDeployer,
  Proxy: helmWithProxyDeployer,
};
