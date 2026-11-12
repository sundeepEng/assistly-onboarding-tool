import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`team_roaster_${process.env.STAGE!}`, (table) => {
      table.enum("pay_frequency", ["Hourly", "Monthly"]).defaultTo("Hourly");
      table.renameColumn("pay_per_hour", "pay_rate");
    });
}

export async function down(knex: Knex): Promise<void> {}
