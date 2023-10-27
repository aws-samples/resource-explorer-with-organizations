import { STS, Credentials, config } from 'aws-sdk';
import { logger } from './utils';

export async function assumeRoleForAccount(account: string): Promise<void> {
  const roleTemplate = process.env.ROLE_TEMPLATE;
  const roleToAssume = roleTemplate.replace('{ACCOUNT}', account);
  logger?.info(`Role assuming ${roleToAssume}`);

  // Reset the credentials beforehand so that IAM is used if the container is reused.
  config.update({
    credentials: undefined,
  });

  const stsClient = new STS();
  try {
    const data = await stsClient
      .assumeRole({
        RoleArn: roleToAssume,
        RoleSessionName: 'AssumingForStepFns',
      })
      .promise();

    if (data && data.Credentials) {
      const stsCredentials = new Credentials({
        accessKeyId: data.Credentials.AccessKeyId,
        secretAccessKey: data.Credentials.SecretAccessKey,
        sessionToken: data.Credentials.SessionToken,
      });

      config.update({
        credentials: stsCredentials,
      });

      return;
    } else {
      throw new Error('Failed to assume the role.');
    }
  } catch (err) {
    throw new Error(`Error assuming the role: ${err.message}`);
  }
}
