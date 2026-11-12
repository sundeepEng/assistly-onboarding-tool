import { randomUUID } from "crypto";
import { Knex } from "knex";
import { db } from "./db";
import {
  SCHEMA_VERSION,
  eligibleStepIds,
  flowSteps,
  getStep,
  pathForStep,
} from "./registry";
import { runCheck } from "./verifiers";

export type SessionRow = {
  id: string;
  user_id: string;
  home_id: string;
  flow_id: string;
  subject_record_id: string;
  flow_version: string;
  active_screen_id: string | null;
  active_task_id: string | null;
  revision: number;
};

export type ProgressRow = {
  step_id: string;
  visit_count: number;
  first_visited_at: string | null;
  last_visited_at: string | null;
  acknowledged_at: string | null;
  verified_at: string | null;
};

export type SessionState = {
  session: SessionRow;
  progress: ProgressRow[];
};

const getProgress = (trx: Knex, sessionId: string): Promise<ProgressRow[]> =>
  trx("onboarding_step_progress")
    .where({ session_id: sessionId })
    .select(
      "step_id",
      "visit_count",
      "first_visited_at",
      "last_visited_at",
      "acknowledged_at",
      "verified_at"
    );

export async function getOrCreateSession(args: {
  userId: string;
  homeId: string;
  flowId: string;
  subjectRecordId?: string | null;
}): Promise<SessionState> {
  const subject = args.subjectRecordId ?? "";
  const key = {
    user_id: args.userId,
    home_id: args.homeId,
    flow_id: args.flowId,
  };
  return db.transaction(async (trx) => {
    let session: SessionRow = await trx("onboarding_sessions")
      .where({ ...key, subject_record_id: subject })
      .first();
    // A record-less lookup rejoins the user's active session for the flow
    // (e.g. one already bound to a record) instead of fragmenting progress.
    if (!session && subject === "") {
      session = await trx("onboarding_sessions")
        .where(key)
        .orderBy("updated_at", "desc")
        .first();
    }
    if (!session) {
      await trx.raw(
        `INSERT INTO onboarding_sessions
           (user_id, home_id, flow_id, subject_record_id, flow_version)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, home_id, flow_id, subject_record_id) DO NOTHING`,
        [args.userId, args.homeId, args.flowId, subject, SCHEMA_VERSION]
      );
      session = await trx("onboarding_sessions")
        .where({ ...key, subject_record_id: subject })
        .first();
    }
    return { session, progress: await getProgress(trx, session.id) };
  });
}

const loadOwnedSession = (
  trx: Knex,
  sessionId: string,
  userId: string,
  homeId: string
): Promise<SessionRow | undefined> =>
  trx("onboarding_sessions")
    .where({ id: sessionId, user_id: userId, home_id: homeId })
    .first();

/**
 * Issue a navigation request. Manual checklist clicks and Gia's
 * continue/open_step intents both come through here — the destination
 * always comes from the registry, never from the client or the agent.
 */
export async function createNavRequest(args: {
  sessionId: string;
  userId: string;
  homeId: string;
  stepId: string;
}): Promise<
  | { ok: true; request_id: string; step_id: string; path: string }
  | { ok: false; error: string }
> {
  return db.transaction(async (trx) => {
    const session = await loadOwnedSession(
      trx,
      args.sessionId,
      args.userId,
      args.homeId
    );
    if (!session) return { ok: false as const, error: "session not found" };
    const step = getStep(args.stepId);
    if (!step || !eligibleStepIds(session.flow_id).includes(args.stepId))
      return { ok: false as const, error: "step not eligible in this flow" };
    const path = pathForStep(args.stepId);
    if (!path) return { ok: false as const, error: "no route for step" };

    const requestId = `nav-${randomUUID()}`;
    await trx("onboarding_nav_requests").insert({
      request_id: requestId,
      session_id: session.id,
      step_id: args.stepId,
      destination: path,
      expected_revision: session.revision,
      status: "pending",
    });
    return { ok: true as const, request_id: requestId, step_id: args.stepId, path };
  });
}

/**
 * Re-run every unverified completion check in the session's flow against
 * application state. Marks verified_at where the check confirms; a missing
 * or unavailable check leaves the step unverified. Idempotent.
 */
export async function evaluateSession(args: {
  sessionId: string;
  userId: string;
  homeId: string;
}): Promise<SessionState | null> {
  return db.transaction(async (trx) => {
    const session = await loadOwnedSession(
      trx,
      args.sessionId,
      args.userId,
      args.homeId
    );
    if (!session) return null;
    const progress = await getProgress(trx, session.id);
    const verified = new Set(
      progress.filter((p) => p.verified_at).map((p) => p.step_id)
    );
    const ctx = {
      homeId: session.home_id,
      userId: session.user_id,
      subjectRecordId: session.subject_record_id,
    };
    for (const step of flowSteps(session.flow_id)) {
      if (verified.has(step.step_id) || !step.completion_check_key) continue;
      const result = await runCheck(step.completion_check_key, ctx);
      if (result !== true) continue;
      await trx.raw(
        `INSERT INTO onboarding_step_progress (session_id, step_id, verified_at)
         VALUES (?, ?, ?)
         ON CONFLICT (session_id, step_id) DO UPDATE SET
           verified_at = COALESCE(onboarding_step_progress.verified_at, EXCLUDED.verified_at)`,
        [session.id, step.step_id, new Date()]
      );
    }
    return { session, progress: await getProgress(trx, session.id) };
  });
}

/**
 * Bind the session to the record the user is working on (e.g. the lead
 * selected in the dashboard). Record-scoped flows get one session per record.
 */
export async function bindRecord(args: {
  sessionId: string;
  userId: string;
  homeId: string;
  recordId: string;
}): Promise<
  | { ok: true; state: SessionState }
  | { ok: false; status: "conflict" | "not_found"; message: string }
> {
  try {
    const sessionId = await db.transaction(async (trx) => {
      const session = await loadOwnedSession(
        trx,
        args.sessionId,
        args.userId,
        args.homeId
      );
      if (!session) return null;
      if (session.subject_record_id !== args.recordId) {
        await trx("onboarding_sessions")
          .where({ id: session.id })
          .update({ subject_record_id: args.recordId, updated_at: new Date() });
      }
      return session.id;
    });
    if (!sessionId)
      return { ok: false, status: "not_found", message: "session not found" };
    // A fresh bind can immediately satisfy checks (e.g. the record was
    // already in Clinical before the session picked it up).
    const state = await evaluateSession({
      sessionId,
      userId: args.userId,
      homeId: args.homeId,
    });
    return { ok: true, state: state! };
  } catch (e: any) {
    if (e?.code === "23505")
      return {
        ok: false,
        status: "conflict",
        message: "a session already exists for this record",
      };
    throw e;
  }
}

export type AckResult =
  | { ok: true; state: SessionState }
  | { ok: false; status: "stale" | "conflict" | "not_found"; message: string };

/**
 * Apply the dashboard's navigation acknowledgement in one transaction:
 * resolve the request, commit the active screen/task, record the visit and
 * bump the session revision. Requests resolve at most once, and only while
 * the session revision still matches.
 */
export async function acknowledgeNavRequest(args: {
  requestId: string;
  userId: string;
  homeId: string;
  status: "ok" | "blocked" | "cancelled" | "error";
}): Promise<AckResult> {
  return db.transaction(async (trx) => {
    const req = await trx("onboarding_nav_requests")
      .where({ request_id: args.requestId })
      .first()
      .forUpdate();
    if (!req)
      return { ok: false, status: "not_found", message: "unknown request" };
    if (req.status !== "pending")
      return { ok: false, status: "stale", message: "request already resolved" };

    const session = await loadOwnedSession(
      trx,
      req.session_id,
      args.userId,
      args.homeId
    );
    if (!session)
      return { ok: false, status: "not_found", message: "session not found" };
    if (session.revision !== req.expected_revision)
      return {
        ok: false,
        status: "stale",
        message: "session moved on since the request was issued",
      };

    const now = new Date();
    if (args.status !== "ok") {
      await trx("onboarding_nav_requests")
        .where({ request_id: args.requestId })
        .update({ status: args.status, resolved_at: now });
      return {
        ok: true,
        state: { session, progress: await getProgress(trx, session.id) },
      };
    }

    const step = getStep(req.step_id);
    if (!step)
      return { ok: false, status: "conflict", message: "step no longer valid" };

    await trx("onboarding_nav_requests")
      .where({ request_id: args.requestId })
      .update({ status: "ok", resolved_at: now });

    await trx("onboarding_sessions").where({ id: session.id }).update({
      active_screen_id: step.screen_id,
      active_task_id: step.step_id,
      revision: session.revision + 1,
      updated_at: now,
    });

    await trx.raw(
      `INSERT INTO onboarding_step_progress
         (session_id, step_id, visit_count, first_visited_at, last_visited_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (session_id, step_id) DO UPDATE SET
         visit_count = onboarding_step_progress.visit_count + 1,
         last_visited_at = EXCLUDED.last_visited_at`,
      [session.id, step.step_id, now, now]
    );

    const fresh = await trx("onboarding_sessions")
      .where({ id: session.id })
      .first();
    return {
      ok: true,
      state: { session: fresh, progress: await getProgress(trx, session.id) },
    };
  });
}
