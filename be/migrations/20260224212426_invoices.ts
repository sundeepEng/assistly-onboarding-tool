import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.dropColumn('status');
    table.dropColumn('invoice_id');
  });

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.enum('status', ['DRAFT', 'DUE', 'PAID', 'VOID']).notNullable().defaultTo('DRAFT');
    table.string('invoice_id').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.dropColumn('status');
  });

  await knex.schema.withSchema('public').alterTable(invoiceTableName, (table) => {
    table.enum('status', ['DRAFT', 'DUE', 'OVERDUE', 'VOID']).notNullable();
  });
}
