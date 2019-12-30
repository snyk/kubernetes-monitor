import * as tap from 'tap';

import * as credentials from '../../src/images/credentials';

tap.test('ecrRegionFromFullImageName()', async (t) => {
  const imageFullNameTemplate = 'aws_account_id.dkr.ecr.region.amazonaws.com/my-web-app:latest';
  const ecrRegionTemplate = credentials.ecrRegionFromFullImageName(imageFullNameTemplate);
  t.equals(ecrRegionTemplate, 'region', 'extracts region from the image full name template');

  const imageFullName = '291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/debian:10';
  const ecrRegion = credentials.ecrRegionFromFullImageName(imageFullName);
  t.equals(ecrRegion, 'us-east-2', 'extracts region from the image full name fixture');

  t.throws(() => {credentials.ecrRegionFromFullImageName('');}, 'throws on badly formatted images');
  t.throws(() => {credentials.ecrRegionFromFullImageName('dkr.ecr.region.amazonaws.com/my-web-app:latest');}, 'throws on badly formatted images');
  t.throws(() => {credentials.ecrRegionFromFullImageName('aws_account_id.dkr.ecr.amazonaws.com/my-web-app:latest');}, 'throws on badly formatted images');
  t.throws(() => {credentials.ecrRegionFromFullImageName('aws_account_id.dkr.ecr.region.amazonaws.com');}, 'throws on badly formatted images');
});
