import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({
  region: process.env.CURRENT_AWS_REGION!,
});

const ACCOUNT_ACTIVATION_SECRET_NAME = "AccountActivationJWTSecret";

export const getAccountActivationSecret = async (): Promise<string> => {
  const command = new GetSecretValueCommand({
    SecretId: ACCOUNT_ACTIVATION_SECRET_NAME,
  });

  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(
      `Secret ${ACCOUNT_ACTIVATION_SECRET_NAME} does not contain a SecretString`
    );
  }

  try {
    const parsedSecret = JSON.parse(response.SecretString).value;

    return parsedSecret;
  } catch {
    throw new Error(
      `Secret ${ACCOUNT_ACTIVATION_SECRET_NAME} is missing the 'value' key or plain text value`
    );
  }
};
