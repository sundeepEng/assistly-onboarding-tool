import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const payoutTableName = `payout_${process.env.STAGE!}`;

  const payoutTableExists = await knex.schema.withSchema('public').hasTable(payoutTableName);

  if (!payoutTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(payoutTableName, (table) => {
      table.increments('id').primary();
      table.string('payroll_payout_id').notNullable();

      table.uuid('home_id').notNullable();
      table.uuid('pcho_user_id').notNullable();
      table.uuid('pcg_user_id').notNullable();

      table.enum('period_type', ['BIWEEKLY', 'MONTHLY']).notNullable();
      table.string('period_label');
      table.date('period_start_date').notNullable();
      table.date('period_end_date').notNullable();

      table.integer('hours_worked_minutes');
      table.integer('hourly_rate_cents');

      table.integer('base_amount_cents').notNullable();
      table.integer('total_amount_cents').notNullable();

      table.enum('status', ['DRAFT', 'FINALIZED', 'PAID', 'VOID']).notNullable();

      table.string('notes');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');

      table.uuid('updated_by_user_id').notNullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const payoutTableName = `payout_${process.env.STAGE!}`;
  await knex.schema.withSchema('public').dropTableIfExists(payoutTableName);
}
