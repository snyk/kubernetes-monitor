import { test } from 'tap';
import {
  constructStaticAnalysisOptions,
  getImageTag,
  removeTagFromImage,
} from '../../../src/kube-scanner/image-scanner';

test('constructStaticAnalysisOptions() tests', async (t) => {
  t.plan(1);

  const somePath = '/var/tmp/file.tar';
  const options = constructStaticAnalysisOptions(somePath);
  const expectedResult = {
    staticAnalysisOptions: {
      imagePath: somePath,
      imageType: 'docker-archive',
      tmpDirPath: '/var/tmp',
    },
  };

  t.deepEqual(options, expectedResult, 'returned options match expectations');
});

test('getImageTag() tests', async (t) => {
  t.plan(4);

  const imageWithSha = 'nginx@sha256:1234567890abcdef';
  const imageWithShaResult = getImageTag(imageWithSha);
  t.same(imageWithShaResult, '1234567890abcdef', 'image sha is returned');

  const imageWithTag = 'nginx:latest';
  const imageWithTagResult = getImageTag(imageWithTag);
  t.same(imageWithTagResult, 'latest', 'image tag is returned');

  const imageWithoutTag = 'nginx';
  const imageWithoutTagResult = getImageTag(imageWithoutTag);
  t.same(imageWithoutTagResult, '', 'empty tag returned when no tag is specified');

  const imageWithManySeparators = 'nginx@abc:tag@bad:reallybad';
  const imageWithManySeparatorsResult = getImageTag(imageWithManySeparators);
  t.same(imageWithManySeparatorsResult, '', 'empty tag is returned on malformed image name and tag');
});

test('removeTagFromImage() tests', async (t) => {
  t.plan(2);

  t.same(removeTagFromImage('nginx:latest'), 'nginx', 'removed image:tag');
  t.same(removeTagFromImage('nginx:@sha256:1234567890abcdef'), 'nginx', 'removed image@sha:hex');
});
