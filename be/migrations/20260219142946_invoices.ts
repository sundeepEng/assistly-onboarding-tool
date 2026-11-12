import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.dropColumn('status');
  });

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.enum('status', ['DRAFT', 'DUE', 'OVERDUE', 'VOID']).notNullable().defaultTo('DRAFT');
  });
}

export async function down(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.dropColumn('status');
  });

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.enum('status', ['DRAFT', 'FINALIZED', 'PAID', 'VOID']).notNullable();
  });
}
