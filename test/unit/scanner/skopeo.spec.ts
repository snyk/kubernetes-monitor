import * as skopeo from '../../../src/scanner/images/skopeo';

describe('skopeo module tests', () => {
  test.concurrent('getCredentialParameters()', async () => {
    const noCredentials = undefined;
    const credentialParametersForNoCredentials =
      skopeo.getCopyCredentialParameters(noCredentials);
    expect(credentialParametersForNoCredentials).toEqual([]);

    const emptyCredentials = '';
    const credentialParametersForEmptyCredentials =
      skopeo.getCopyCredentialParameters(emptyCredentials);
    expect(credentialParametersForEmptyCredentials).toEqual([]);

    const someCredentials = 'secret-things-happening';
    const credentialParametersForSomeCredentials =
      skopeo.getCopyCredentialParameters(someCredentials);
    expect(credentialParametersForSomeCredentials).toEqual([
      { body: '--src-creds', sanitise: true },
      { body: someCredentials, sanitise: true },
    ]);
    const certificatesParameters = skopeo.getCopyCertificatesParameters();
    expect(certificatesParameters).toEqual([
      { body: '--src-cert-dir', sanitise: true },
      { body: '/srv/app/certs', sanitise: true },
    ]);
  });
});
