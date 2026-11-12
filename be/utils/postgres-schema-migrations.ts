import knexConfig from "../knexfile";
import { knex } from "knex";

export const postgresDB = knex(knexConfig.production);

postgresDB.migrate
  .latest()
  .then(() => {
    console.info("Migrations completed successfully.");
    return postgresDB.destroy();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    return postgresDB.destroy().then(() => process.exit(1));
  });
