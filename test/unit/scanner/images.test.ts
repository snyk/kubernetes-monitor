import * as tap from 'tap';

import { IPullableImage } from '../../../src/scanner/images/types';
import config = require('../../../src/common/config');
import * as scannerImages from '../../../src/scanner/images';


tap.test('getImagesWithFileSystemPath()', async (t) => {
  const noImages: string[] = [];
  const noImagesResult = scannerImages.getImagesWithFileSystemPath(noImages);
  t.same(noImagesResult, [], 'correctly maps an empty array');

  const image = ['nginx:latest'];
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
  const someImage = ['centos:latest'];
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
  t.plan(1);

  const somePath = '/var/tmp/file.tar';
  const options = scannerImages.constructStaticAnalysisOptions(somePath);
  const expectedResult = {
    imagePath: somePath,
    imageType: 'docker-archive',
  };

  t.deepEqual(options, expectedResult, 'returned options match expectations');
});

tap.test('getImageTag() tests', async (t) => {
  t.plan(4);

  const imageWithSha = 'nginx@sha256:1234567890abcdef';
  const imageWithShaResult = scannerImages.getImageTag(imageWithSha);
  t.same(imageWithShaResult, '1234567890abcdef', 'image sha is returned');

  const imageWithTag = 'nginx:latest';
  const imageWithTagResult = scannerImages.getImageTag(imageWithTag);
  t.same(imageWithTagResult, 'latest', 'image tag is returned');

  const imageWithoutTag = 'nginx';
  const imageWithoutTagResult = scannerImages.getImageTag(imageWithoutTag);
  t.same(imageWithoutTagResult, '', 'empty tag returned when no tag is specified');

  const imageWithManySeparators = 'nginx@abc:tag@bad:reallybad';
  const imageWithManySeparatorsResult = scannerImages.getImageTag(imageWithManySeparators);
  t.same(imageWithManySeparatorsResult, '', 'empty tag is returned on malformed image name and tag');
});

tap.test('removeTagFromImage() tests', async (t) => {
  t.plan(2);

  t.same(scannerImages.removeTagFromImage('nginx:latest'), 'nginx', 'removed image:tag');
  t.same(scannerImages.removeTagFromImage('nginx:@sha256:1234567890abcdef'), 'nginx', 'removed image@sha:hex');
});
