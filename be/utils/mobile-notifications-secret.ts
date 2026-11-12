import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({
  region: process.env.CURRENT_AWS_REGION!,
});

export const getMobileNotificationsSecret = async (): Promise<any> => {
  const secretName = `MobileNotifications-${process.env.STAGE!}`;

  const command = new GetSecretValueCommand({
    SecretId: secretName,
  });

  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} does not contain a SecretString`);
  }

  const parsedSecret = JSON.parse(response.SecretString);

  return parsedSecret;
};
