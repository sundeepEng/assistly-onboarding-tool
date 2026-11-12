import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.withSchema('public').hasTable('notification_devices');

  if (!tableExists) {
    await knex.schema.withSchema('public').createTable('notification_devices', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable();
      table.uuid('device_id').notNullable();
      table.text('device_token').notNullable();
      table.string('platform', 10).notNullable().checkIn(['ios', 'android']);
      table.string('timezone', 50).notNullable().defaultTo('UTC');
      table.string('app_version', 50);
      table.jsonb('metadata');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('last_seen_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['user_id', 'device_id']);

      table.index('user_id', 'idx_notification_devices_user_id');
      table.index('is_active', 'idx_notification_devices_active');
      table.index('last_seen_at', 'idx_notification_devices_last_seen_at');
      table.index('updated_at', 'idx_notification_devices_updated_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('public').dropTableIfExists('notification_devices');
}
