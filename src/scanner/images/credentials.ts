import { Buffer } from 'buffer';
import { ECR } from '@aws-sdk/client-ecr';

import { logger } from '../../common/logger';

export async function getSourceCredentials(
  imageSource: string,
): Promise<string | undefined> {
  if (isEcrSource(imageSource)) {
    const ecrRegion = ecrRegionFromFullImageName(imageSource);
    return getEcrCredentials(ecrRegion);
  }
  return undefined;
}

export function isEcrSource(imageSource: string): boolean {
  // this regex tests the image source against the template:
  // <SOMETHING>.dkr.ecr.<SOMETHING>.amazonaws.com/<SOMETHING>
  const ecrImageRegex = new RegExp('.dkr.ecr..*.amazonaws.com/', 'i');
  return ecrImageRegex.test(imageSource);
}

function getEcrCredentials(region: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const ecr = new ECR({
      region,
    });
    return ecr.getAuthorizationToken({}, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (
        !(
          data &&
          data.authorizationData &&
          Array.isArray(data.authorizationData) &&
          data.authorizationData.length > 0
        )
      ) {
        return reject('unexpected data format from ecr.getAuthorizationToken');
      }

      const authorizationTokenBase64 =
        data.authorizationData[0].authorizationToken;

      if (!authorizationTokenBase64) {
        return reject(
          'empty authorization token from ecr.getAuthorizationToken',
        );
      }

      const buff = Buffer.from(authorizationTokenBase64, 'base64');
      const userColonPassword = buff.toString('utf-8');
      return resolve(userColonPassword);
    });
  });
}

export function ecrRegionFromFullImageName(imageFullName: string): string {
  // should look like this
  // aws_account_id.dkr.ecr.region.amazonaws.com/my-web-app:latest
  // https://docs.aws.amazon.com/AmazonECR/latest/userguide/ECR_on_EKS.html
  try {
    const [registry, repository] = imageFullName.split('/');
    if (!repository) {
      throw new Error('ECR image full name missing repository');
    }

    const parts = registry.split('.');
    if (
      !(
        parts.length === 6 &&
        parts[1] === 'dkr' &&
        parts[2] === 'ecr' &&
        parts[4] === 'amazonaws'
      )
    ) {
      throw new Error('ECR image full name in unexpected format');
    }
    return parts[3];
  } catch (error) {
    logger.error(
      { error, imageFullName },
      'failed extracting ECR region from image full name',
    );
    throw error;
  }
}
