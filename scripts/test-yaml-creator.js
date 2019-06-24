const fs = require('fs');
const YAML = require('yaml');

const file = fs.readFileSync('./snyk-monitor-deployment.yaml', 'utf8');
const parsedYAML = YAML.parse(file);
parsedYAML.spec.template.spec.containers[0].image = 'snyk-k8s-monitor:test';
parsedYAML.spec.template.spec.containers[0].imagePullPolicy = 'Never';
parsedYAML.spec.template.spec.dnsConfig = {
  options: [{ name: 'ndots', value: '1' }]
};
parsedYAML.spec.template.spec.volumes.push({
  name: 'nsswitch',
  secret: {
    secretName: 'fix',
    items: [{ key: 'nsswitch', path: 'nsswitch.conf' }]
  }
});
parsedYAML.spec.template.spec.containers[0].volumeMounts.push({
  name: 'nsswitch',
  mountPath: '/etc'
});
fs.writeFileSync('snyk-monitor-test-deployment.yaml', YAML.stringify(parsedYAML));
