import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;

  const invoiceTableExists = await knex.schema.withSchema('public').hasTable(invoiceTableName);

  if (!invoiceTableExists) {
    await knex.schema.withSchema('public').createTable(invoiceTableName, (table) => {
      table.increments('id').primary();
      table.string('invoice_id').notNullable();
      table.uuid('home_id').notNullable();
      table.uuid('user_id').notNullable();
      table.string('billing_period').notNullable();
      table.enum('status', ['DRAFT', 'FINALIZED', 'PAID', 'VOID']).notNullable();
      table.decimal('total_amount').notNullable();
      table
        .integer('parent_invoice_id')
        .nullable()
        .references('id')
        .inTable(invoiceTableName)
        .onDelete('CASCADE');
      table.date('due_date').notNullable();
      table.string('notes', 1001).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const invoiceTableName = `invoice_${process.env.STAGE!}`;
  await knex.schema.withSchema('public').dropTableIfExists(invoiceTableName);
}
