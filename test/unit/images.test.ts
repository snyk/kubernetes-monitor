import * as tap from 'tap';
import { getImagesWithFileSystemPath, pullImages } from '../../src/images';
const config = require('../../src/common/config');

tap.test('getImagesWithFileSystemPath()', async (t) => {
  const noImages: string[] = [];
  const noImagesResult = getImagesWithFileSystemPath(noImages);
  t.same(noImagesResult, [], 'correctly maps an empty array');

  // Cache the last value of STATIC_ANALYSIS, we return it back to normal once the test completes
  const lastStaticAnalysisValue = config.STATIC_ANALYSIS;

  // First try without static analysis set
  config.STATIC_ANALYSIS = false;
  const imageWithoutStaticAnalysis = ['redis:latest'];
  const imageWithoutStaticAnalysisResult = getImagesWithFileSystemPath(imageWithoutStaticAnalysis);
  t.same(
    imageWithoutStaticAnalysisResult,
    [{ imageName: 'redis:latest' }],
    'correctly returns an image without a file system path',
  );

  // Next try with static analysis set
  config.STATIC_ANALYSIS = true;
  const imageWithStaticAnalysis = ['nginx:latest'];
  const imageWithStaticAnalysisResult = getImagesWithFileSystemPath(imageWithStaticAnalysis);
  t.same(imageWithStaticAnalysisResult.length, 1, 'expected 1 item');

  const resultWithExpectedPath = imageWithStaticAnalysisResult[0];
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

  // Finally ensure that two consecutive calls do not return the same file system path
  config.STATIC_ANALYSIS = true;
  const someImage = ['centos:latest'];
  const firstCallResult = getImagesWithFileSystemPath(someImage)[0];
  const secondCallResult = getImagesWithFileSystemPath(someImage)[0];
  t.ok(
    firstCallResult.fileSystemPath !== secondCallResult.fileSystemPath,
    'consecutive calls to the function with the same data return different file system paths',
  );

  // Restore the old value
  config.STATIC_ANALYSIS = lastStaticAnalysisValue;
});

tap.test('pullImages() skips on missing file system path in static analysis', async (t) => {
  // Cache the last value of STATIC_ANALYSIS, we return it back to normal once the test completes
  const lastStaticAnalysisValue = config.STATIC_ANALYSIS;

  config.STATIC_ANALYSIS = true;
  const badStaticAnalysisImage = [
    {
      imageName: 'nginx:latest',
    },
  ];
  const result = await pullImages(badStaticAnalysisImage);
  t.same(result, [], 'expect to skip images on static analysis set but missing file system path');

  // Restore the old value
  config.STATIC_ANALYSIS = lastStaticAnalysisValue;
});
