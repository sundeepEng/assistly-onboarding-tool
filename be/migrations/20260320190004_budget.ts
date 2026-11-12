import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const budgetTableName = `budget_${process.env.STAGE!}`;

  const budgetTableExists = await knex.schema.withSchema('public').hasTable(budgetTableName);

  if (!budgetTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(budgetTableName, (table) => {
      table.increments('id').primary();

      table.enum('transaction_type', ['income', 'expense']).notNullable();
      table
        .enum('category_type', [
          'CARE_FEE',
          'MONTHLY_FEE',
          'GROCERIES',
          'UTILITIES',
          'ENTERTAINMENT',
          'TRANSPORT',
          'MEDICAL',
          'MISC',
        ])
        .notNullable();
      table.uuid('home_id').notNullable();
      table.integer('amount_cents').notNullable();
      table.date('transaction_date').notNullable();
      table.uuid('created_by_user_id').notNullable();
      table.string('description').notNullable();
      table.enum('entry_mode', ['one_time', 'recurring']).notNullable();
      table.string('notes').nullable();
      table.string('receipt_url').nullable();

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');

      table.index(['home_id']);
      table.index(['transaction_date']);
      table.index(['transaction_type']);
      table.index(['category_type']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const budgetTableName = `budget_${process.env.STAGE!}`;
  await knex.schema.withSchema('public').dropTableIfExists(budgetTableName);
}
