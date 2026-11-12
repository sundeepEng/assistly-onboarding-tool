import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .alterTable(`team_roaster_${process.env.STAGE!}`, (table) => {
      table.dropColumn("id");
    });
}

export async function down(knex: Knex): Promise<void> {}
