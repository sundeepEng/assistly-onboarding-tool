import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const payoutTableName = `payout_${process.env.STAGE!}`;
  const payoutItemTableName = `payout_item_${process.env.STAGE!}`;

  const payoutItemTableExists = await knex.schema
    .withSchema('public')
    .hasTable(payoutItemTableName);

  if (!payoutItemTableExists) {
    await knex.schema.withSchema('public').createTableIfNotExists(payoutItemTableName, (table) => {
      table.uuid('payout_item_id').primary();
      table
        .integer('payout_id')
        .notNullable()
        .references('id')
        .inTable(payoutTableName)
        .onDelete('CASCADE');

      table.text('description').notNullable();
      table.integer('amount_cents').notNullable();

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const payoutItemTableName = `payout_item_${process.env.STAGE!}`;
  await knex.schema.withSchema('public').dropTableIfExists(payoutItemTableName);
}
