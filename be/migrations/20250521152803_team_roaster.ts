import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema
    .withSchema("public")
    .hasTable(`team_roaster_${process.env.STAGE!}`);
  if (!exists) {
    await knex.schema
      .withSchema("public")
      .createTable(`team_roaster_${process.env.STAGE!}`, (table) => {
        table.increments("id");
        table.uuid("user_id").primary().notNullable();
        table.decimal("pay_per_hour").notNullable();
        table.string("preferred_shift_availability");
        table.enum("work_status", ["active", "vacation"]).defaultTo("active");
        table.string("skills");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .dropTableIfExists(`team_roaster_${process.env.STAGE!}`);
}
