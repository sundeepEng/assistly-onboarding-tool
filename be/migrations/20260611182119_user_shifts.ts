import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.boolean('isOverlap').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`user_shifts_${process.env.STAGE!}`, (table) => {
    table.dropColumn('isOverlap');
  });
}
