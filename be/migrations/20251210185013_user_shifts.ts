import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
      table.uuid("assigned_to_user_id").nullable().defaultTo(null);
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
      table.dropColumn("assigned_to_user_id");
    });
}
