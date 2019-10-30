import * as tap from 'tap';
import { getImagesWithFileSystemPath, pullImages } from '../../src/images';
import { IPullableImage } from '../../src/images/types';
const config = require('../../src/common/config');

tap.test('getImagesWithFileSystemPath()', async (t) => {
  const noImages: string[] = [];
  const noImagesResult = getImagesWithFileSystemPath(noImages);
  t.same(noImagesResult, [], 'correctly maps an empty array');

  const image = ['nginx:latest'];
  const imageResult = getImagesWithFileSystemPath(image);
  t.same(imageResult.length, 1, 'expected 1 item');

  const resultWithExpectedPath = imageResult[0];
  t.same(
    resultWithExpectedPath.imageName,
    'nginx:latest',
    'correctly returns an image without a file system path',
  );
  const fileSystemPath = resultWithExpectedPath.fileSystemPath!;
  t.ok(fileSystemPath, 'file system path exists on the result');
  t.ok(fileSystemPath.endsWith('.tar'), 'file system path ends in .tar');

  const expectedPattern = fileSystemPath.indexOf(`${config.IMAGE_STORAGE_ROOT}/nginx_latest_`) !== -1;
  t.ok(expectedPattern, 'the file system path starts with an expected pattern');

  // Ensure that two consecutive calls do not return the same file system path
  const someImage = ['centos:latest'];
  const firstCallResult = getImagesWithFileSystemPath(someImage)[0];
  const secondCallResult = getImagesWithFileSystemPath(someImage)[0];
  t.ok(
    firstCallResult.fileSystemPath !== secondCallResult.fileSystemPath,
    'consecutive calls to the function with the same data return different file system paths',
  );
});

tap.test('pullImages() skips on missing file system path', async (t) => {
  const badImage = [{imageName: 'nginx:latest'}];
  const result = await pullImages(badImage as IPullableImage[]);
  t.same(result, [], 'expect to skip images missing file system path');
});
