/**
 * Gia-guided onboarding persistence.
 *
 * onboarding_sessions       — one walkthrough session per (user, home, flow,
 *                             subject record). Owns the active screen/task and
 *                             an optimistic-concurrency revision.
 * onboarding_step_progress  — per-step visits, user acknowledgements and
 *                             application-verified completion, kept separate.
 * onboarding_nav_requests   — server-issued navigation requests; each ack is
 *                             applied at most once and only while the session
 *                             revision matches.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("onboarding_sessions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("user_id").notNullable();
    t.string("home_id").notNullable();
    t.string("flow_id").notNullable();
    // Record-specific workflows scope the session to one record; walkthroughs
    // store an empty string so the unique index below still applies.
    t.string("subject_record_id").notNullable().defaultTo("");
    t.string("flow_version").notNullable();
    t.string("active_screen_id").nullable();
    t.string("active_task_id").nullable();
    t.integer("revision").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.unique(["user_id", "home_id", "flow_id", "subject_record_id"]);
  });

  await knex.schema.createTable("onboarding_step_progress", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("session_id")
      .notNullable()
      .references("id")
      .inTable("onboarding_sessions")
      .onDelete("CASCADE");
    t.string("step_id").notNullable();
    t.integer("visit_count").notNullable().defaultTo(0);
    t.timestamp("first_visited_at").nullable();
    t.timestamp("last_visited_at").nullable();
    // The user told us they did it — not the same as app verification.
    t.timestamp("acknowledged_at").nullable();
    // Set only by an application completion check.
    t.timestamp("verified_at").nullable();
    t.unique(["session_id", "step_id"]);
  });

  await knex.schema.createTable("onboarding_nav_requests", (t) => {
    t.string("request_id").primary();
    t.uuid("session_id")
      .notNullable()
      .references("id")
      .inTable("onboarding_sessions")
      .onDelete("CASCADE");
    t.string("step_id").notNullable();
    t.string("destination").notNullable(); // dashboard path from the registry
    t.integer("expected_revision").notNullable();
    t.string("status").notNullable().defaultTo("pending"); // pending|ok|blocked|cancelled|error
    t.timestamps(true, true);
    t.timestamp("resolved_at").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("onboarding_nav_requests");
  await knex.schema.dropTableIfExists("onboarding_step_progress");
  await knex.schema.dropTableIfExists("onboarding_sessions");
};
