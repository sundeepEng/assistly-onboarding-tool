import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.string("shift_color").notNullable().defaultTo("#3b82f6");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.dropColumn("shift_color");
  });
}
