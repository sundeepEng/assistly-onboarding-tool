import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableName = `stripe_webhook_event_${process.env.STAGE!}`;

  const exists = await knex.schema.withSchema('public').hasTable(tableName);

  if (!exists) {
    await knex.schema.withSchema('public').createTableIfNotExists(tableName, (table) => {
      table.increments('id').primary();
      table.string('stripe_event_id').notNullable().unique();
      table.string('event_type').notNullable();
      table.boolean('processed').notNullable().defaultTo(false);
      table.timestamp('processed_at');
      table.string('related_object_id');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['processed']);
      table.index(['event_type']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {}
