import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.uuid("created_by_user_id").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.dropColumn("created_by_user_id");
  });
}
