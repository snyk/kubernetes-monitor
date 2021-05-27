import * as credentials from '../../../src/scanner/images/credentials';

describe('ECR image parsing tests', () => {
  test.concurrent('ecrRegionFromFullImageName()', async () => {
    const imageFullNameTemplate =
      'aws_account_id.dkr.ecr.region.amazonaws.com/my-web-app:latest';
    const ecrRegionTemplate = credentials.ecrRegionFromFullImageName(
      imageFullNameTemplate,
    );
    expect(ecrRegionTemplate).toEqual('region');

    const imageFullName =
      '291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/debian:10';
    const ecrRegion = credentials.ecrRegionFromFullImageName(imageFullName);
    expect(ecrRegion).toEqual('us-east-2');

    expect(() => {
      credentials.ecrRegionFromFullImageName('');
    }).toThrow();
    expect(() => {
      credentials.ecrRegionFromFullImageName(
        'dkr.ecr.region.amazonaws.com/my-web-app:latest',
      );
    }).toThrow();
    expect(() => {
      credentials.ecrRegionFromFullImageName(
        'aws_account_id.dkr.ecr.amazonaws.com/my-web-app:latest',
      );
    }).toThrow();
    expect(() => {
      credentials.ecrRegionFromFullImageName(
        'aws_account_id.dkr.ecr.region.amazonaws.com',
      );
    }).toThrow();
  });

  test.concurrent('isEcrSource()', async () => {
    const sourceCredentialsForRandomImageName =
      credentials.isEcrSource('derka');
    expect(sourceCredentialsForRandomImageName).toEqual(false);

    const sourceCredentialsForInvalidEcrImage =
      credentials.isEcrSource('derka.ecr.derka');
    expect(sourceCredentialsForInvalidEcrImage).toEqual(false);

    const sourceCredentialsForEcrImage = credentials.isEcrSource(
      'aws_account_id.dkr.ecr.region.amazonaws.com/my-web-app:latest',
    );
    expect(sourceCredentialsForEcrImage).toEqual(true);

    const sourceCredentialsForEcrImageWithRepo = credentials.isEcrSource(
      'a291964488713.dkr.ecr.us-east-2.amazonaws.com/snyk/debian:10',
    );
    expect(sourceCredentialsForEcrImageWithRepo).toEqual(true);

    const sourceCredentialsForEcrImageMixedCase = credentials.isEcrSource(
      'aws_account_id.dKr.ecR.region.amazonAWS.cOm/my-web-app:latest',
    );
    expect(sourceCredentialsForEcrImageMixedCase).toEqual(true);
  });
});
