import * as skopeo from '../../src/scanner/images/skopeo';

describe('extract index & manifest digests', () => {
  test('single arch image', async () => {
    const imageName =
      'docker://docker.io/snyk/container-registry-agent:69f4e8ef61b0f7380101e71d48dd2c0e348fbe83';

    const { indexDigest, manifestDigest } = await skopeo.extractImageDigests(
      imageName,
    );

    expect(indexDigest).toBe(undefined);
    expect(manifestDigest).toBe(
      'sha256:4b954a219312a87a3d119cbfaa015350be94175fb9b87d2e203cad68f42c50a8',
    );
  });

  test('multi-arch image', async () => {
    const imageName = 'docker://docker.io/library/ubuntu:24.04';

    const { indexDigest, manifestDigest } = await skopeo.extractImageDigests(
      imageName,
    );

    expect(indexDigest).toBe(
      'sha256:36fa0c7153804946e17ee951fdeffa6a1c67e5088438e5b90de077de5c600d4c',
    );
    expect(manifestDigest).toBe(
      'sha256:bce129bec07bab56ada102d312ebcfe70463885bdf68fb32182974bd994816e0',
    );
  });

  test('multi-arch image with no linux/amd64 manifest', async () => {
    const imageName = 'docker://docker.io/carlosedp/arm_exporter:latest';

    const { indexDigest, manifestDigest } = await skopeo.extractImageDigests(
      imageName,
    );

    expect(indexDigest).toBe(undefined);
    expect(manifestDigest).toBe(undefined);
  });
});
