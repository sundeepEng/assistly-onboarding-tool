import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const paymentTableName = `payment_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(paymentTableName, (table) => {
    table.dropColumn('status');
  });

  await knex.schema.withSchema('public').alterTable(paymentTableName, (table) => {
    table
      .enum('status', [
        'CREATED',
        'PENDING',
        'PENDING_APPROVAL',
        'PAID',
        'FAILED',
        'CANCELLED',
        'EXPIRED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
        'VOID',
      ])
      .defaultTo('CREATED');
  });
}

export async function down(knex: Knex): Promise<void> {
  const paymentTableName = `payment_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(paymentTableName, (table) => {
    table.dropColumn('status');
  });

  await knex.schema.withSchema('public').alterTable(paymentTableName, (table) => {
    table
      .enum('status', [
        'CREATED',
        'PENDING',
        'PAID',
        'FAILED',
        'CANCELLED',
        'EXPIRED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
        'VOID',
      ])
      .defaultTo('CREATED');
  });
}
