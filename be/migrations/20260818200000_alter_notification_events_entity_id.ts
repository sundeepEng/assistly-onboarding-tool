import type { Knex } from 'knex';

// entity_id was originally typed as UUID, but not all entities that trigger
// notifications use UUID primary keys (e.g. user_shifts.id is a serial integer).
// Widen the column to VARCHAR so it can store any entity's string-cast id.
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.withSchema('public').hasTable('notification_events');

  if (tableExists) {
    await knex.raw(`
      ALTER TABLE notification_events
        ALTER COLUMN entity_id TYPE VARCHAR(255) USING entity_id::VARCHAR(255);
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.withSchema('public').hasTable('notification_events');

  if (tableExists) {
    await knex.raw(`
      ALTER TABLE notification_events
        ALTER COLUMN entity_id TYPE UUID USING entity_id::UUID;
    `);
  }
}
