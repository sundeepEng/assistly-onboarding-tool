import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE notification_events
      ALTER COLUMN home_id DROP NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE notification_events
      ALTER COLUMN home_id SET NOT NULL;
  `);
}
