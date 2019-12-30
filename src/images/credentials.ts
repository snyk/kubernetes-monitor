import * as aws from 'aws-sdk';

export async function getSourceCredentials(imageSource: string): Promise<string | undefined> {
  // TODO is this the best way we can determine the image's source?
  if (imageSource.indexOf('.ecr.') !== -1) {
    return getEcrCredentials();
  }
  return undefined;
}

function getEcrCredentials(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // TODO grab region... from...? ask users to provide it?
    const ecr = new aws.ECR({region: 'us-east-2'});
    return ecr.getAuthorizationToken({}, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!(
        data &&
        data.authorizationData &&
        Array.isArray(data.authorizationData) &&
        data.authorizationData.length > 0
      )) {
        return reject('unexpected data format from ecr.getAuthorizationToken');
      }

      const authorizationTokenBase64 = data.authorizationData[0].authorizationToken;

      if (!authorizationTokenBase64) {
        return reject('empty authorization token from ecr.getAuthorizationToken');
      }

      const buff = new Buffer(authorizationTokenBase64, 'base64');
      const userColonPassword = buff.toString('utf-8');
      return resolve(userColonPassword);
    });
  });
}
