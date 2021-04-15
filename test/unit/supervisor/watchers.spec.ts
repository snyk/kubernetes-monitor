import { V1Namespace } from '@kubernetes/client-node';

import * as watchers from '../../../src/supervisor/watchers';
import { kubernetesInternalNamespaces } from '../../../src/supervisor/watchers/internal-namespaces';

describe('extractNamespaceName() tests', () => {
  test.each([
    ['extractNamespaceName() throws on empty input', {} as V1Namespace],
    [
      'extractNamespaceName() throws on empty metadata',
      { metadata: {} } as V1Namespace,
    ],
    [
      'extractNamespaceName() throws on undefined name',
      { metadata: { name: undefined } } as V1Namespace,
    ],
    [
      'extractNamespaceName() throws on empty name',
      { metadata: { name: '' } } as V1Namespace,
    ],
  ])('%s', (_testCaseName, input) => {
    expect(() => watchers.extractNamespaceName(input)).toThrowError(
      'Namespace missing metadata.name',
    );
  });

  test('extractNamespaceName() returns namespace.metadata.name', () => {
    expect(
      watchers.extractNamespaceName({
        metadata: { name: 'literally anything else' },
      }),
    ).toEqual('literally anything else');
  });
});

describe('internal Kubernetes namespaces tests', () => {
  test('internal namespaces list against snapshot', () => {
    expect(kubernetesInternalNamespaces).toMatchSnapshot();
  });

  test('isKubernetesInternalNamespace(): internal Kubernetes namespaces are used', () => {
    for (const internalNamespace of kubernetesInternalNamespaces) {
      expect(watchers.isKubernetesInternalNamespace(internalNamespace)).toEqual(
        true,
      );
    }
  });

  test.each([
    ['kube-node-lease-'],
    ['node-lease'],
    ['snyk-monitor'],
    ['egg'],
    [''],
    [(undefined as unknown) as string],
  ])('isKubernetesInternalNamespace(%s) -> false', (input) => {
    expect(watchers.isKubernetesInternalNamespace(input)).toEqual(false);
  });
});
