import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const taskTableName = `tasks_${process.env.STAGE!}`;
  const trackingTableName = `task_daily_tracking_${process.env.STAGE!}`;

  const taskTableExists = await knex.schema.withSchema('public').hasTable(taskTableName);
  const trackingTableExists = await knex.schema.withSchema('public').hasTable(trackingTableName);

  if (!taskTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(taskTableName, (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.uuid('home_id').notNullable();
      table.string('title').notNullable();

      table
        .string('type', 20)
        .notNullable()
        .checkIn([
          'Cleaning',
          'Kitchen',
          'Laundry',
          'Medication',
          'Inventory',
          'Security',
          'Outdoor',
          'Other',
        ]);

      table
        .string('shift', 20)
        .notNullable()
        .defaultTo('morning')
        .checkIn(['morning', 'afternoon', 'evening']);

      table.text('shift_notes').nullable();

      table.jsonb('days_of_week').notNullable().defaultTo(knex.raw("'[]'::jsonb"));

      table.uuid('assigned_to_user_id').nullable();
      table.boolean('is_deleted').notNullable().defaultTo(false);
      table.uuid('created_by_user_id').notNullable();

      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true });

      table.index(['home_id', 'is_deleted']);
      table.index(['home_id', 'assigned_to_user_id']);
    });

    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_${taskTableName}_days_of_week_gin
      ON ${taskTableName} USING GIN (days_of_week);
    `);
  }

  if (!trackingTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(trackingTableName, (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table
        .uuid('task_id')
        .notNullable()
        .references('id')
        .inTable(taskTableName)
        .onDelete('CASCADE');

      table.uuid('updated_by_user_id').notNullable();

      table
        .string('status', 20)
        .notNullable()
        .defaultTo('pending')
        .checkIn(['pending', 'completed']);

      table.jsonb('comments').notNullable().defaultTo(knex.raw("'[]'::jsonb"));

      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const taskTableName = `tasks_${process.env.STAGE!}`;
  const trackingTableName = `task_daily_tracking_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').dropTableIfExists(trackingTableName);
  await knex.schema.withSchema('public').dropTableIfExists(taskTableName);
}
