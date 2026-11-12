import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.withSchema('public').hasTable('notification_events');

  if (!tableExists) {
    await knex.schema
      .withSchema('public')
      .createTableIfNotExists('notification_events', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        // end-to-end tracing id, copied from the queue payload
        table.uuid('correlation_id').notNullable();
        // 'web' for API-triggered notifications, 'cron' for scheduled jobs
        table.string('type', 10).notNullable();
        // queued, picked, sent, failed, dlq
        table.string('status', 20).notNullable().defaultTo('queued');
        // target home, for quick lookups and indexing
        table.uuid('home_id').notNullable();
        // shift_id, broadcast_id, etc. Kept as VARCHAR because not all entity ids are UUIDs
        // (e.g. user_shifts.id is a serial integer).
        table.string('entity_id', 255);
        // { service_name, action, old_data, new_data, userId }
        table.jsonb('trigger').notNullable();
        // Worker-resolved before send; array of { user_id, role? }
        table.jsonb('recipients');
        // final FCM title/body/data and per-recipient status map
        table.jsonb('payload');
        // SQS ApproximateReceiveCount (or 0 until first picked)
        table.integer('attempt').notNullable().defaultTo(0);
        // number of internal send attempts the worker made
        table.integer('retry_count').notNullable().defaultTo(0);
        table.text('error_message');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('picked_at', { useTz: true });
        table.timestamp('sent_at', { useTz: true });
        table.timestamp('dlq_at', { useTz: true });

        table.index('status', 'idx_notification_events_status');
        table.index('type', 'idx_notification_events_type');
        table.index('home_id', 'idx_notification_events_home_id');
        table.index('entity_id', 'idx_notification_events_entity_id');
        table.index('correlation_id', 'idx_notification_events_correlation_id');
        table.index('created_at', 'idx_notification_events_created_at');
      });

    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_notification_events_recipients_gin
      ON notification_events USING GIN (recipients jsonb_path_ops);
    `);

    await knex.raw(`
      ALTER TABLE notification_events
        ADD CONSTRAINT chk_notification_events_type
          CHECK (type IN ('web', 'cron')),
        ADD CONSTRAINT chk_notification_events_status
          CHECK (status IN ('queued', 'picked', 'sent', 'failed', 'dlq'));
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('public').dropTableIfExists('notification_events');
}
