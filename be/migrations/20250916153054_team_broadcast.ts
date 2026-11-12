import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("public")
    .hasTable(`team_broadcast_${process.env.STAGE!}`);

  if (!tableExists) {
    await knex.schema
      .withSchema("public")
      .createTableIfNotExists(
        `team_broadcast_${process.env.STAGE!}`,
        (table) => {
          table.increments("id").primary();
          table.uuid("home_id").notNullable();
          table.uuid("sender_user_id").notNullable();
          table.string("message").notNullable();
          table.timestamp("created_at").defaultTo(knex.fn.now());
        }
      );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .dropTableIfExists(`team_broadcast_${process.env.STAGE!}`);
}
