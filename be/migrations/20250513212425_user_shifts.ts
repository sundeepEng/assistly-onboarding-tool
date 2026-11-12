import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("public")
    .hasTable(`user_shifts_${process.env.STAGE!}`);

  if (!tableExists) {
    await knex.schema
      .withSchema("public")
      .createTableIfNotExists(`user_shifts_${process.env.STAGE!}`, (table) => {
        table.increments("id").primary();
        table.uuid("user_id").notNullable();
        table
          .enum("shift_status", ["available", "timeoff", "vacation"])
          .notNullable();
        table.timestamp("shift_start_time", { useTz: false }).notNullable();
        table.timestamp("shift_end_time", { useTz: false }).notNullable();
        table.boolean("is_unavailability_approved");
        table.string("unavailability_reason");
        table.decimal("pay_per_hour").notNullable();
        table.string("notes").checkLength("<=", 500);
        table.dateTime("clock_in_timestamp");
        table.dateTime("clock_out_timestamp");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at");
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .dropTableIfExists(`user_shifts_${process.env.STAGE!}`);
}
