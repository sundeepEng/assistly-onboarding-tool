import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      database: process.env.DB_NAME!,
      port: Number(process.env.DB_PORT || 5432),
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
  },
};

export default config;
