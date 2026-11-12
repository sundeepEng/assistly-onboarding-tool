import knex from "knex";

/**
 * Completion verifiers. Each `completion_check_key` from the shared context
 * file maps to a check that confirms the fact in the application's own data —
 * a dashboard save event can *trigger* evaluation but can never mark a step
 * verified by itself. A missing key or an unavailable check leaves the step
 * unverified.
 *
 * The queries run against ASSISTLY_DATABASE_URL — the real Assistly database.
 * For local development it defaults to DATABASE_URL and the synthetic
 * `assistly_leads` / `assistly_clinical_residents` tables (see
 * migrations/20261112130000_synthetic_app_tables.js), standing in for the
 * production schema until the real table/column names are mapped.
 */
const appDb = knex({
  client: "pg",
  connection:
    process.env.ASSISTLY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://localhost:5432/assistly_onboarding",
  pool: { min: 0, max: 2 },
});

export type VerifyContext = {
  homeId: string;
  userId: string;
  subjectRecordId: string;
};

type Verifier = (ctx: VerifyContext) => Promise<boolean>;

const VERIFIERS: Record<string, Verifier> = {
  // A lead exists for this home — the bound record, or any lead created
  // during the session when nothing is bound yet.
  lead_exists: async ({ homeId, subjectRecordId }) => {
    const q = appDb("assistly_leads").where({ home_id: homeId });
    if (subjectRecordId) q.andWhere({ id: subjectRecordId });
    return !!(await q.first());
  },

  // The bound lead has been invited/onboarded to the portal.
  lead_onboarded: async ({ homeId, subjectRecordId }) => {
    if (!subjectRecordId) return false;
    const row = await appDb("assistly_leads")
      .where({ id: subjectRecordId, home_id: homeId })
      .first();
    return !!row?.onboarded;
  },

  // The bound record now exists in the Clinical seniors list.
  record_in_clinical: async ({ homeId, subjectRecordId }) => {
    if (!subjectRecordId) return false;
    return !!(await appDb("assistly_clinical_residents")
      .where({ lead_id: subjectRecordId, home_id: homeId })
      .first());
  },
};

/** Returns true/false, or null when the check isn't configured/available. */
export async function runCheck(
  key: string | null,
  ctx: VerifyContext
): Promise<boolean | null> {
  if (!key) return null;
  const verifier = VERIFIERS[key];
  if (!verifier) return null;
  try {
    return await verifier(ctx);
  } catch (e) {
    console.warn(`verifier ${key} unavailable:`, (e as Error).message);
    return null;
  }
}
