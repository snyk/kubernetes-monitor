import * as tap from 'tap';

import * as credentials from '../../../src/scanner/images/credentials';

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

tap.test('isEcrSource()', async (t) => {
  const sourceCredentialsForRandomImageName = credentials.isEcrSource('derka');
  t.equals(sourceCredentialsForRandomImageName, false, 'unidentified image source is not ECR');

  const sourceCredentialsForInvalidEcrImage = credentials.isEcrSource('derka.ecr.derka');
  t.equals(sourceCredentialsForInvalidEcrImage, false, 'image just with .ecr. is not considered from ECR');

  const sourceCredentialsForEcrImage = credentials.isEcrSource('aws_account_id.dkr.ecr.region.amazonaws.com/my-web-app:latest');
  t.equals(sourceCredentialsForEcrImage, true, 'correct ECR template');

  const sourceCredentialsForEcrImageWithRepo = credentials.isEcrSource('a291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/debian:10');
  t.equals(sourceCredentialsForEcrImageWithRepo, true, 'correct ECR template');

  const sourceCredentialsForEcrImageMixedCase = credentials.isEcrSource('aws_account_id.dKr.ecR.region.amazonAWS.cOm/my-web-app:latest');
  t.equals(sourceCredentialsForEcrImageMixedCase, true, 'correct ECR template');
});
