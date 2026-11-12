import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("public")
    .hasTable(`team_conversation_messages_${process.env.STAGE!}`);

  if (!tableExists) {
    await knex.schema
      .withSchema("public")
      .createTable(
        `team_conversation_messages_${process.env.STAGE!}`,
        (table) => {
          table.uuid("message_id").primary();
          table
            .uuid("conversation_id")
            .notNullable()
            .references("conversation_id")
            .inTable(`team_conversations_${process.env.STAGE!}`)
            .onDelete("CASCADE");
          table.text("message").notNullable();
          table.uuid("sender_user_id").notNullable();
          table.timestamp("created_at").defaultTo(knex.fn.now());
        }
      );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("public")
    .dropTableIfExists(`team_conversation_messages_${process.env.STAGE!}`);
}
