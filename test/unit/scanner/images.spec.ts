import {
  IPullableImage,
  IScanImage,
  SkopeoRepositoryType,
} from '../../../src/scanner/images/types';
import { config } from '../../../src/common/config';
import * as scannerImages from '../../../src/scanner/images';

describe('getImagesWithFileSystemPath()', () => {
  it('correctly maps an empty array', () => {
    const noImages: IScanImage[] = [];
    const noImagesResult = scannerImages.getImagesWithFileSystemPath(noImages);
    expect(noImagesResult).toEqual([]);
  });

  it('correctly returns an image without a file system path', () => {
    const image: IScanImage[] = [
      {
        imageName: 'nginx:latest',
        imageWithDigest:
          'nginx@sha256:4949aa7259aa6f827450207db5ad94cabaa9248277c6d736d5e1975d200c7e43',
        skopeoRepoType: SkopeoRepositoryType.DockerArchive,
      },
    ];
    const imageResult = scannerImages.getImagesWithFileSystemPath(image);
    expect(imageResult.length).toEqual(1);
    const resultWithExpectedPath = imageResult[0];
    expect(resultWithExpectedPath.imageName).toEqual('nginx:latest');
    const fileSystemPath = resultWithExpectedPath.fileSystemPath;
    expect(fileSystemPath).toBeTruthy();
    expect(fileSystemPath.endsWith('.tar')).toBeTruthy();

    const expectedPattern =
      fileSystemPath.indexOf(`${config.IMAGE_STORAGE_ROOT}/nginx_latest_`) !==
      -1;
    expect(expectedPattern).toBeTruthy();
  });

  it('ensure that two consecutive calls do not return the same file system path', () => {
    const someImage = [
      {
        imageName: 'centos:latest',
        imageWithDigest:
          'centos@sha256:fc4a234b91cc4b542bac8a6ad23b2ddcee60ae68fc4dbd4a52efb5f1b0baad71',
        skopeoRepoType: SkopeoRepositoryType.DockerArchive,
      },
    ];
    const firstCallResult =
      scannerImages.getImagesWithFileSystemPath(someImage)[0];
    const secondCallResult =
      scannerImages.getImagesWithFileSystemPath(someImage)[0];
    expect(
      firstCallResult.fileSystemPath !== secondCallResult.fileSystemPath,
    ).toBeTruthy();
  });
});

describe('pullImages()', () => {
  it('skips on missing file system path', async () => {
    const badImage = [{ imageName: 'nginx:latest' }];
    const workloadName = 'workload';
    const result = await scannerImages.pullImages(
      badImage as IPullableImage[],
      workloadName,
    );
    expect(result).toEqual([]);
  });
});

describe('sanitizeSkopeoErrorForLogging()', () => {
  it('strips message (which may contain --src-creds) when error has stderr', () => {
    const skopeoError = {
      name: 'ChildProcessError',
      message:
        'Command failed: skopeo copy --src-creds user:supersecret docker://example/image:tag docker-archive:/tmp/x.tar',
      stderr:
        'time="2025-01-01" level=fatal msg="unable to retrieve auth token"',
      stdout: '',
      childProcess: { pid: 1234 },
      stack: 'Error: Command failed\n    at ...',
      exitCode: 1,
    };
    const originalMessage = skopeoError.message;

    const result = scannerImages.sanitizeSkopeoErrorForLogging(
      skopeoError,
    ) as Record<string, unknown>;

    expect(result).not.toBe(skopeoError);
    expect(result.message).toBeUndefined();
    expect(result.childProcess).toBeUndefined();
    expect(result.stack).toBeUndefined();
    expect(result.stderr).toEqual(skopeoError.stderr);
    expect(result.exitCode).toEqual(1);
    expect(result.name).toEqual('ChildProcessError');
    expect(JSON.stringify(result)).not.toContain('--src-creds');
    expect(JSON.stringify(result)).not.toContain('supersecret');
    // original error is not mutated
    expect(skopeoError.message).toEqual(originalMessage);
    expect(skopeoError.childProcess).toBeDefined();
  });

  it('preserves message for non-skopeo errors (no stderr field)', () => {
    const credentialError = new Error('ECR token fetch failed');

    const result = scannerImages.sanitizeSkopeoErrorForLogging(
      credentialError,
    ) as Record<string, unknown>;

    expect(result.message).toEqual('ECR token fetch failed');
    expect(result.stack).toBeUndefined();
    expect(result.childProcess).toBeUndefined();
  });

  it('preserves message when stderr is present but empty', () => {
    const error = {
      message: 'something exploded before skopeo ran',
      stderr: '',
      childProcess: { pid: 1 },
      stack: 'stack trace',
    };

    const result = scannerImages.sanitizeSkopeoErrorForLogging(error) as Record<
      string,
      unknown
    >;

    expect(result.message).toEqual('something exploded before skopeo ran');
    expect(result.childProcess).toBeUndefined();
    expect(result.stack).toBeUndefined();
  });

  it('handles non-object errors safely', () => {
    expect(scannerImages.sanitizeSkopeoErrorForLogging('boom')).toEqual({
      error: 'boom',
    });
    expect(scannerImages.sanitizeSkopeoErrorForLogging(null)).toEqual({
      error: null,
    });
  });
});

describe('getImageParts()', () => {
  it('image digest is returned', () => {
    const imageWithSha =
      'nginx@sha256:45b23dee08af5e43a7fea6c4cf9c25ccf269ee113168c19722f87876677c5cb2';
    const imageWithShaResult = scannerImages.getImageParts(imageWithSha);
    expect(imageWithShaResult.imageTag).toEqual('');
    expect(imageWithShaResult.imageDigest).toEqual(
      'sha256:45b23dee08af5e43a7fea6c4cf9c25ccf269ee113168c19722f87876677c5cb2',
    );
  });
  it('image tag is returned', () => {
    const imageWithTag = 'nginx:latest';
    const imageWithTagResult = scannerImages.getImageParts(imageWithTag);
    expect(imageWithTagResult.imageTag).toEqual('latest');
  });
  it('image tag is returned when full repo specified', () => {
    const imageWithFullRepository = 'kind-registry:5000/nginx:latest';
    const imageWithFullRepositoryResult = scannerImages.getImageParts(
      imageWithFullRepository,
    );
    expect(imageWithFullRepositoryResult.imageTag).toEqual('latest');
  });
  it('empty tag returned when no tag is specified', () => {
    const imageWithoutTag = 'nginx';
    const imageWithoutTagResult = scannerImages.getImageParts(imageWithoutTag);
    expect(imageWithoutTagResult.imageTag).toEqual('');
  });
  it('empty tag is returned on malformed image name and tag', () => {
    const imageWithManySeparators = 'nginx@abc:tag@bad:reallybad';
    const imageWithManySeparatorsResult = scannerImages.getImageParts(
      imageWithManySeparators,
    );
    expect(imageWithManySeparatorsResult.imageTag).toEqual('');
  });
  it('empty tag is returned on malformed image name and tag with full repo', () => {
    const imageWithFullRepoAndManySeparators =
      'kind-registry:5000/nginx@abc:tag@bad:reallybad';
    const imageWithFullRepoAndManySeparatorsResult =
      scannerImages.getImageParts(imageWithFullRepoAndManySeparators);
    expect(imageWithFullRepoAndManySeparatorsResult.imageTag).toEqual('');
  });
  describe('extracted image name tests', () => {
    it('removed image:tag', () => {
      expect(scannerImages.getImageParts('nginx:latest').imageName).toEqual(
        'nginx',
      );
    });
    it('removed image@sha:hex', () => {
      expect(
        scannerImages.getImageParts(
          'node@sha256:215a9fbef4df2c1ceb7c79481d3cfd94ad8f1f0105bade39f3be907bf386c5e1',
        ).imageName,
      ).toEqual('node');
    });
    it('removed repository/image:tag', () => {
      expect(
        scannerImages.getImageParts('kind-registry:5000/python:rc-buster')
          .imageName,
      ).toEqual('kind-registry:5000/python');
    });
    it('removed repository/image:tag containing dashes', () => {
      expect(
        scannerImages.getImageParts('kind-registry:5000/python-27:rc-buster')
          .imageName,
      ).toEqual('kind-registry:5000/python-27');
    });
    it('removed repository/image:tag continuing dashes', () => {
      expect(
        scannerImages.getImageParts(
          'kind-registry:5000/test/python-27:rc-buster',
        ).imageName,
      ).toEqual('kind-registry:5000/test/python-27');
    });
  });
});
