import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.uuid('created_by_user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.dropColumn('created_by_user_id');
  });
}
