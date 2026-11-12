import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(
    `user_payroll_${process.env.STAGE!}`,
    (table) => {
      table.uuid("home_id").notNullable();
    }
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(
    `user_payroll_${process.env.STAGE!}`,
    (table) => {
      table.dropColumn("home_id");
    }
  );
}
