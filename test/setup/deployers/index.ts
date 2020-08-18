import { yamlDeployer } from './yaml';
import { operatorDeployer as operatorOLM } from './operator-olm';
import { operatorDeployer as operatorOS } from './operator-openshift';
import { helmDeployer } from './helm';
import { helmWithProxyDeployer } from './helm-with-proxy';

export default {
  YAML: yamlDeployer,
  OperatorOLM: operatorOLM,
  OperatorOS: operatorOS,
  Helm: helmDeployer,
  Proxy: helmWithProxyDeployer,
};
