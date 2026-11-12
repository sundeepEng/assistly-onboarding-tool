import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceItemTableName, (table) => {
    table.dropColumn('item_category');
  });

  await knex.schema.withSchema('public').alterTable(invoiceItemTableName, (table) => {
    table
      .enum('item_category', [
        'CARE_FEE',
        'MONTHLY_FEE',
        'ENTERTAINMENT',
        'TRANSPORT',
        'MEDICAL',
        'MISC',
      ])
      .nullable();
  });

  await knex(invoiceItemTableName).withSchema('public').whereNull('item_category').update({
    item_category: 'MISC',
  });

  await knex.schema.withSchema('public').alterTable(invoiceItemTableName, (table) => {
    table.string('item_category').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  const invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;

  await knex.schema.withSchema('public').alterTable(invoiceItemTableName, (table) => {
    table.dropColumn('item_category');
  });

  await knex.schema.withSchema('public').alterTable(invoiceItemTableName, (table) => {
    table.enum('item_category', ['ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC']).notNullable();
  });
}
