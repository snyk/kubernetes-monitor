// Runs inside a built image: node /tmp/check-image-trust.js
// Fails if the image runs a Node.js affected by CVE-2026-111497, or if Node or the
// OS trust store still trusts an emSign root removed after the eMudhra CA compromise.
const fs = require('fs');
const tls = require('tls');
const { X509Certificate } = require('crypto');

const MIN_NODE_VERSION = [22, 23, 4];
const REMOVED_ROOTS = [
  'emSign ECC Root CA - G3',
  'emSign Root CA - C1',
  'emSign ECC Root CA - C3',
];
const OS_BUNDLES = [
  '/etc/ssl/certs/ca-certificates.crt',
  '/etc/pki/tls/certs/ca-bundle.crt',
];

function isOlderThan(version, minimum) {
  const parts = version.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < minimum.length; i++) {
    if (parts[i] !== minimum[i]) {
      return parts[i] < minimum[i];
    }
  }
  return false;
}

function commonNames(pems) {
  return pems.map((pem) => {
    const subject = new X509Certificate(pem).subject.split('\n');
    const cn = subject.find((field) => field.startsWith('CN='));
    return cn ? cn.slice('CN='.length) : '';
  });
}

function readBundle(path) {
  const pem = fs.readFileSync(path, 'utf8');
  return (
    pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    ) || []
  );
}

const failures = [];

if (isOlderThan(process.version, MIN_NODE_VERSION)) {
  failures.push(
    `Node.js ${process.version} is older than ${MIN_NODE_VERSION.join('.')}`,
  );
}

const nodeRoots = commonNames(tls.rootCertificates);
const osBundle = OS_BUNDLES.find((path) => fs.existsSync(path));
if (!osBundle) {
  failures.push(`no OS trust bundle found in ${OS_BUNDLES.join(', ')}`);
}
const osRoots = osBundle ? commonNames(readBundle(osBundle)) : [];

for (const root of REMOVED_ROOTS) {
  if (nodeRoots.includes(root)) {
    failures.push(`Node trusts removed root "${root}"`);
  }
  if (osRoots.includes(root)) {
    failures.push(`${osBundle} contains removed root "${root}"`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Node.js ${process.version}, ${nodeRoots.length} Node roots, ${osRoots.length} roots in ${osBundle}: no removed emSign roots`,
);
