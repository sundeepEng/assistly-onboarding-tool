import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
      table.renameColumn("pay_per_hour", "pay_rate");
    });
}

export async function down(knex: Knex): Promise<void> {}
