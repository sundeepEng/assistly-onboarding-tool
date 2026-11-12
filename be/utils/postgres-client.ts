import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { knex, Knex } from 'knex';
import { types } from 'pg';

// Set up global type parser for timestamps to return ISO strings
// This must be done before any database connections are created
types.setTypeParser(1114, (val: string) => new Date(val).toISOString()); // timestamp
types.setTypeParser(1184, (val: string) => new Date(val).toISOString()); // timestamptz
types.setTypeParser(1082, (val: string) => val); // date - keep as original date string
types.setTypeParser(1083, (val: string) => val); // time - keep as original time string

let dbInstance: Knex | null = null;

const createKnexInstance = async (): Promise<Knex> => {
  const secretId = process.env.DB_SECRET_ARN;

  if (!secretId) {
    throw new Error('Missing environment variable: DB_SECRET_ARN');
  }

  const secretsClient = new SecretsManagerClient({});
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const secretResponse = await secretsClient.send(command);

  if (!secretResponse.SecretString) {
    throw new Error('SecretString not found in Secrets Manager response');
  }

  const creds = JSON.parse(secretResponse.SecretString);

  const requiredFields = ['host', 'username', 'password', 'dbname', 'port'];
  for (const field of requiredFields) {
    if (!creds[field]) {
      throw new Error(`Missing field '${field}' in database credentials`);
    }
  }

  return knex({
    client: 'pg',
    connection: {
      host: creds.host,
      user: creds.username,
      password: creds.password,
      database: creds.dbname,
      port: parseInt(creds.port, 10),
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0,
      max: 5,
      idleTimeoutMillis: 2000,
      acquireTimeoutMillis: 20000,
    },
  });
};

export const getPostgresConnection = async (): Promise<Knex> => {
  if (!dbInstance) {
    console.info('🔄 Creating new DB connection');
    dbInstance = await createKnexInstance();
  } else {
    console.info('♻️ Reusing DB connection');
  }

  return dbInstance;
};
