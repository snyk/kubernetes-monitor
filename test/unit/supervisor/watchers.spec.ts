import { V1Namespace } from '@kubernetes/client-node';
import { config } from '../../../src/common/config';

import {
  extractNamespaceName,
  isExcludedNamespace,
  kubernetesInternalNamespaces,
  openshiftInternalNamespaces,
} from '../../../src/supervisor/watchers/internal-namespaces';

describe('extractNamespaceName()', () => {
  test.each([
    ['empty input', {} as V1Namespace],
    ['empty metadata', { metadata: {} } as V1Namespace],
    ['undefined name', { metadata: { name: undefined } } as V1Namespace],
    ['empty name', { metadata: { name: '' } } as V1Namespace],
  ])('throws on %s', (_testCaseName, input) => {
    expect(() => extractNamespaceName(input)).toThrowError(
      'Namespace missing metadata.name',
    );
  });

  test('returns namespace.metadata.name', () => {
    expect(
      extractNamespaceName({
        metadata: { name: 'literally anything else' },
      }),
    ).toEqual('literally anything else');
  });
});

describe('isExcludedNamespace() internal Kubernetes namespaces', () => {
  test('list against snapshot', () => {
    expect(kubernetesInternalNamespaces).toMatchSnapshot();
  });

  for (const internalNamespace of kubernetesInternalNamespaces) {
    test(`isExcludedNamespace(${internalNamespace}) -> true`, () => {
      expect(isExcludedNamespace(internalNamespace)).toEqual(true);
    });
  }

  test.each([
    ['kube-node-lease-'],
    ['node-lease'],
    ['snyk-monitor'],
    ['egg'],
    [''],
    [undefined as unknown as string],
  ])('isExcludedNamespace(%s) -> false', (input) => {
    expect(isExcludedNamespace(input)).toEqual(false);
  });
});

describe('isExcludedNamespace() openshift internal namespaces', () => {
  test('list against snapshot', () => {
    expect(openshiftInternalNamespaces).toMatchSnapshot();
  });

  for (const internalNamespace of openshiftInternalNamespaces) {
    test(`isExcludedNamespace(${internalNamespace}) -> true`, () => {
      expect(isExcludedNamespace(internalNamespace)).toEqual(true);
    });
  }

  test.each([
    ['openshif'],
    ['openshift-'],
    ['egg'],
    [''],
    [undefined as unknown as string],
  ])('isExcludedNamespace(%s) -> false', (input) => {
    expect(isExcludedNamespace(input)).toEqual(false);
  });
});

describe('isExcludedNamespace() excluded namespaces from config', () => {
  const excludedNamespacesFromConfig = ['one', 'two', 'three'];
  beforeAll(() => {
    config.EXCLUDED_NAMESPACES = excludedNamespacesFromConfig;
  });

  afterAll(() => {
    config.EXCLUDED_NAMESPACES = null;
  });

  excludedNamespacesFromConfig.forEach((namespace) => {
    test(`[excluded namespaces from config] isExcludedNamespace(${namespace}) -> true`, () => {
      expect(isExcludedNamespace(namespace)).toEqual(true);
    });
  });

  for (const internalNamespace of openshiftInternalNamespaces) {
    test(`[openshift internal namespaces] isExcludedNamespace(${internalNamespace}) -> true`, () => {
      expect(isExcludedNamespace(internalNamespace)).toEqual(true);
    });
  }

  test.each([['kube-system']['egg'], [''], [undefined as unknown as string]])(
    'isExcludedNamespace(%s) -> false',
    (input) => {
      expect(isExcludedNamespace(input)).toEqual(false);
    },
  );
});

describe('isExcludedNamespace() included namespaces from config', () => {
  const includedNamespacesFromConfig = ['one', 'two', 'three'];
  beforeAll(() => {
    config.INCLUDED_NAMESPACES = includedNamespacesFromConfig;
  });

  afterAll(() => {
    config.INCLUDED_NAMESPACES = null;
  });

  includedNamespacesFromConfig.forEach((namespace) => {
    test(`[excluded namespaces from config] isExcludedNamespace(${namespace}) -> false`, () => {
      expect(isExcludedNamespace(namespace)).toEqual(false);
    });
  });

  for (const internalNamespace of openshiftInternalNamespaces) {
    test(`[openshift internal namespaces] isExcludedNamespace(${internalNamespace}) -> true`, () => {
      expect(isExcludedNamespace(internalNamespace)).toEqual(true);
    });
  }

  test.each([['kube-system']['egg'], [''], [undefined as unknown as string]])(
    'isExcludedNamespace(%s) -> true',
    (input) => {
      expect(isExcludedNamespace(input)).toEqual(true);
    },
  );
});
