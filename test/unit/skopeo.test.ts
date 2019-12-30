import * as tap from 'tap';

import * as skopeo from '../../src/images/skopeo';

tap.test('getCredentialParameters()', async (t) => {
  const noCredentials = undefined;
  const credentialParametersForNoCredentials = skopeo.getCredentialParameters(noCredentials);
  t.same(credentialParametersForNoCredentials, [], 'returns an empty array for no credentials');

  const emptyCredentials = '';
  const credentialParametersForEmptyCredentials = skopeo.getCredentialParameters(emptyCredentials);
  t.same(credentialParametersForEmptyCredentials, [], 'returns an empty array for empty credentials');

  const someCredentials = 'secret-things-happening';
  const credentialParametersForSomeCredentials = skopeo.getCredentialParameters(someCredentials);
  t.same(
    credentialParametersForSomeCredentials,
    ['--src-creds', someCredentials],
    'returns Skopeo\'s args for source credentials',
  );
});
