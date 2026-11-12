import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema('public')
    .alterTable(`task_daily_tracking_${process.env.STAGE!}`, (table) => {
      table.uuid('home_id').notNullable();
      table.date('date').notNullable();
      table.index(['home_id', 'date']);
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema('public')
    .alterTable(`task_daily_tracking_${process.env.STAGE!}`, (table) => {
      table.dropIndex(['home_id', 'date']);
      table.dropColumn('home_id');
      table.dropColumn('date');
    });
}
