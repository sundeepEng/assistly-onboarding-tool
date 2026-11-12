import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
      table.enum("pay_frequency", ["Hourly", "Monthly"]).defaultTo("Hourly");
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
      table.dropColumn("pay_frequency");
    });
}
