require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection:
      process.env.DATABASE_URL ||
      "postgres://localhost:5432/assistly_onboarding",
    migrations: { directory: "./migrations", extension: "js" },
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./migrations", extension: "js" },
  },
};
