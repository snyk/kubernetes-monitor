import * as tap from 'tap';

import {IPullableImage, IScanImage} from '../../../src/scanner/images/types';
import config = require('../../../src/common/config');
import * as scannerImages from '../../../src/scanner/images';

tap.test('getImagesWithFileSystemPath()', async (t) => {
  const noImages: IScanImage[] = [];
  const noImagesResult = scannerImages.getImagesWithFileSystemPath(noImages);
  t.same(noImagesResult, [], 'correctly maps an empty array');

  const image: IScanImage[] = [{
    imageName: 'nginx:latest',
    imageWithDigest: 'nginx@sha256:4949aa7259aa6f827450207db5ad94cabaa9248277c6d736d5e1975d200c7e43',
  }];
  const imageResult = scannerImages.getImagesWithFileSystemPath(image);
  t.same(imageResult.length, 1, 'expected 1 item');

  const resultWithExpectedPath = imageResult[0];
  t.same(
    resultWithExpectedPath.imageName,
    'nginx:latest',
    'correctly returns an image without a file system path',
  );
  const fileSystemPath = resultWithExpectedPath.fileSystemPath;
  t.ok(fileSystemPath, 'file system path exists on the result');
  t.ok(fileSystemPath.endsWith('.tar'), 'file system path ends in .tar');

  const expectedPattern = fileSystemPath.indexOf(`${config.IMAGE_STORAGE_ROOT}/nginx_latest_`) !== -1;
  t.ok(expectedPattern, 'the file system path starts with an expected pattern');

  // Ensure that two consecutive calls do not return the same file system path
  const someImage = [{
    imageName: 'centos:latest',
    imageWithDigest: 'centos@sha256:fc4a234b91cc4b542bac8a6ad23b2ddcee60ae68fc4dbd4a52efb5f1b0baad71',
  }];
  const firstCallResult = scannerImages.getImagesWithFileSystemPath(someImage)[0];
  const secondCallResult = scannerImages.getImagesWithFileSystemPath(someImage)[0];
  t.ok(
    firstCallResult.fileSystemPath !== secondCallResult.fileSystemPath,
    'consecutive calls to the function with the same data return different file system paths',
  );
});

tap.test('pullImages() skips on missing file system path', async (t) => {
  const badImage = [{imageName: 'nginx:latest'}];
  const result = await scannerImages.pullImages(badImage as IPullableImage[]);
  t.same(result, [], 'expect to skip images missing file system path');
});

tap.test('constructStaticAnalysisOptions() tests', async (t) => {
  const somePath = '/var/tmp/file.tar';
  const options = scannerImages.constructStaticAnalysisOptions(somePath);
  const expectedResult = {
    imagePath: somePath,
    imageType: 'docker-archive',
  };

  t.deepEqual(options, expectedResult, 'returned options match expectations');
});

tap.test('extracted image tag tests', async (t) => {
  const imageWithSha = 'nginx@sha256:45b23dee08af5e43a7fea6c4cf9c25ccf269ee113168c19722f87876677c5cb2';
  const imageWithShaResult = scannerImages.getImageParts(imageWithSha);
  t.same(imageWithShaResult.imageTag, '', 'image tag is empty');
  t.same(imageWithShaResult.imageDigest, 'sha256:45b23dee08af5e43a7fea6c4cf9c25ccf269ee113168c19722f87876677c5cb2', 'image digest is returned');

  const imageWithTag = 'nginx:latest';
  const imageWithTagResult = scannerImages.getImageParts(imageWithTag);
  t.same(imageWithTagResult.imageTag, 'latest', 'image tag is returned');

  const imageWithFullRepository = 'kind-registry:5000/nginx:latest';
  const imageWithFullRepositoryResult = scannerImages.getImageParts(imageWithFullRepository);
  t.same(imageWithFullRepositoryResult.imageTag, 'latest', 'image tag is returned when full repo specified');

  const imageWithoutTag = 'nginx';
  const imageWithoutTagResult = scannerImages.getImageParts(imageWithoutTag);
  t.same(imageWithoutTagResult.imageTag, '', 'empty tag returned when no tag is specified');

  const imageWithManySeparators = 'nginx@abc:tag@bad:reallybad';
  const imageWithManySeparatorsResult = scannerImages.getImageParts(imageWithManySeparators);
  t.same(imageWithManySeparatorsResult.imageTag, '', 'empty tag is returned on malformed image name and tag');

  const imageWithFullRepoAndManySeparators = 'kind-registry:5000/nginx@abc:tag@bad:reallybad';
  const imageWithFullRepoAndManySeparatorsResult = scannerImages.getImageParts(imageWithFullRepoAndManySeparators);
  t.same(imageWithFullRepoAndManySeparatorsResult.imageTag, '', 'empty tag is returned on malformed image name and tag with full repo');
});

tap.test('extracted image name tests', async (t) => {
  t.same(scannerImages.getImageParts('nginx:latest').imageName, 'nginx', 'removed image:tag');
  t.same(scannerImages.getImageParts('node@sha256:215a9fbef4df2c1ceb7c79481d3cfd94ad8f1f0105bade39f3be907bf386c5e1').imageName, 'node', 'removed image@sha:hex');
  t.same(scannerImages.getImageParts('kind-registry:5000/python:rc-buster').imageName, 'kind-registry:5000/python', 'removed repository/image:tag');
  // Verify support on image names that contain dashes
  t.same(scannerImages.getImageParts('kind-registry:5000/python-27:rc-buster').imageName, 'kind-registry:5000/python-27', 'removed repository/image:tag');
  t.same(scannerImages.getImageParts('kind-registry:5000/test/python-27:rc-buster').imageName, 'kind-registry:5000/test/python-27', 'removed repository/image:tag');
});
