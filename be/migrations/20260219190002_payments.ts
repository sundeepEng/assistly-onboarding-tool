import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const paymentTableName = `payment_${process.env.STAGE!}`;

  const paymentTableExists = await knex.schema.withSchema('public').hasTable(paymentTableName);

  if (!paymentTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(paymentTableName, (table) => {
      table.increments('id').primary();
      table.uuid('payment_id').notNullable().unique();

      table.enum('subject_type', ['INVOICE', 'PAYROLL_PAYOUT']).notNullable();
      table.integer('subject_id').notNullable();

      table.uuid('payer_user_id').notNullable();
      table.uuid('payee_user_id').notNullable();

      table.enum('provider', ['STRIPE', 'MANUAL']).notNullable();
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
        .notNullable();

      table.string('currency', 3).notNullable().defaultTo('usd');
      table.integer('amount_cents').notNullable();

      table.string('stripe_connected_account_id');
      table.string('stripe_checkout_session_id');
      table.string('stripe_payment_intent_id');
      table.string('stripe_charge_id');
      table.string('stripe_refund_id');
      table.string('stripe_payment_status');
      table.string('stripe_session_status');

      table
        .enum('manual_method', [
          'CASH',
          'CHECK',
          'BANK_TRANSFER',
          'PAYPAL',
          'ZELLE',
          'VENMO',
          'OTHER',
        ])
        .nullable();
      table.string('manual_reference');
      table.string('manual_notes');
      table.timestamp('manual_paid_at');

      table.string('idempotency_key').notNullable().unique();

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');

      table.uuid('created_by_user_id').notNullable();
      table.index(['subject_type', 'subject_id']);
      table.index(['payer_user_id']);
      table.index(['payee_user_id']);
      table.index(['stripe_payment_intent_id']);
      table.index(['stripe_checkout_session_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {}
