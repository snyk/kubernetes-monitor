import * as tap from 'tap';
import { V1Namespace } from '@kubernetes/client-node';

import namespaces = require('../../src/kube-scanner/watchers/namespaces');

tap.test('SupportedWorkloadTypes', async (t) => {
  const namespaceEmpty = {} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceEmpty),
    'extractNamespaceName throws on empty input');

  const namespaceMetadataEmpty = {metadata: {}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceMetadataEmpty),
    'extractNamespaceName throws on empty metadata');

  const namespaceNameUndefined = {metadata: {name: undefined}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceNameUndefined),
    'extractNamespaceName throws on undefined name');

  const namespaceNameFalsy = {metadata: {name: ''}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceNameFalsy),
    'extractNamespaceName throws on empty name');

  const namespaceNameExists = {metadata: {name: 'literally anything else'}} as V1Namespace;
  t.equals(namespaces.extractNamespaceName(namespaceNameExists), 'literally anything else',
    'extractNamespaceName returns namespace.metadata.name');
});
