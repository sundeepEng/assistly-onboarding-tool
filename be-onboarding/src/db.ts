import knex from "knex";

export const db = knex({
  client: "pg",
  connection:
    process.env.DATABASE_URL || "postgres://localhost:5432/assistly_onboarding",
  pool: { min: 0, max: 5 },
});
