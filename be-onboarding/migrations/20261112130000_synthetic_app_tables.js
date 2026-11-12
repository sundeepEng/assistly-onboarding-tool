/**
 * Synthetic stand-ins for the real Assistly tables used by completion
 * verifiers in local development. Replace the queries in src/verifiers.ts
 * with the production schema once those table/column names are confirmed.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("assistly_leads", (t) => {
    t.string("id").primary();
    t.string("home_id").notNullable();
    t.string("type").notNullable().defaultTo("senior"); // senior|care|nurse
    t.boolean("onboarded").notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
  await knex.schema.createTable("assistly_clinical_residents", (t) => {
    t.string("id").primary();
    t.string("home_id").notNullable();
    t.string("lead_id").notNullable();
    t.timestamps(true, true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("assistly_clinical_residents");
  await knex.schema.dropTableIfExists("assistly_leads");
};
