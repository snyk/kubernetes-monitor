import { yamlDeployer } from './yaml';
import { operatorDeployer } from './operator';
import { helmDeployer } from './helm';
import { helmWithProxyDeployer } from './helm-with-proxy';

export default {
  YAML: yamlDeployer,
  Operator: operatorDeployer,
  Helm: helmDeployer,
  Proxy: helmWithProxyDeployer,
};
