import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("public")
    .hasTable(`user_payroll_${process.env.STAGE!}`);

  if (!tableExists) {
    await knex.schema
      .withSchema("public")
      .createTableIfNotExists(`user_payroll_${process.env.STAGE!}`, (table) => {
        table.increments("id").primary();
        table.string("user_id").notNullable();
        table.date("pay_period_start_date").notNullable();
        table.date("pay_period_end_date").notNullable();
        table.decimal("total_hours", 10, 2).notNullable();
        table.decimal("gross_pay", 10, 2).notNullable();
        table.decimal("deductions", 10, 2).notNullable();
        table.decimal("net_pay", 10, 2).notNullable();
        table.dateTime("pay_date").notNullable();
        table.string("payment_method").notNullable();
        table.dateTime("created_at").defaultTo(knex.fn.now());
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(`user_payroll_${process.env.STAGE!}`);
}
