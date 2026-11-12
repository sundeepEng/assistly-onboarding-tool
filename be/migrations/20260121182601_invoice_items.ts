import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;
  const invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;

  const invoiceItemTableExists = await knex.schema
    .withSchema('public')
    .hasTable(invoiceItemTableName);

  if (!invoiceItemTableExists) {
    await knex.schema.withSchema('public').createTable(invoiceItemTableName, (table) => {
      table.uuid('invoice_item_id').primary();
      table
        .integer('invoice_id')
        .notNullable()
        .references('id')
        .inTable(invoiceTableName)
        .onDelete('CASCADE');
      table.enum('item_category', ['ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC']).notNullable();
      table.text('description').notNullable();
      table.decimal('amount').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;
  await knex.schema.withSchema('public').dropTableIfExists(invoiceItemTableName);
}
