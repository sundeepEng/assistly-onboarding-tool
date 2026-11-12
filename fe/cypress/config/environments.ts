/**
 * Environment matrix — the single source of truth for where the suite can run.
 *
 * One entry per deployed environment of the app under test. Keep `apiBaseUrl`
 * in step with the NEXT_PUBLIC_BASE_URL the app was built with (the services
 * layer reads it at build time, see services/authenticate-user.ts).
 *
 * Credentials live outside this file: dev carries a committed throwaway
 * account (safe — dev is not public data), while stg and main deliberately
 * have none. Their logins reach live deployments, so they come from
 * cypress.env.json (gitignored) or CYPRESS_-prefixed CI secrets.
 * See resolveCredential() and cypress.env.example.json.
 */

export type EnvName = "dev" | "stg" | "main";

export interface EnvironmentTarget {
  /** Origin the specs navigate against (cy.visit). */
  baseUrl: string;
  /** Origin the app's services call — id-token propagation is asserted here. */
  apiBaseUrl: string;
  /**
   * Committed fallback test account, used only when nothing more specific
   * supplies credentials for this environment. Never commit stg/main accounts.
   */
  userEmail?: string;
  userPassword?: string;
}

export const TARGETS: Record<EnvName, EnvironmentTarget> = {
  dev: {
    baseUrl: "https://dev.assistly.live",
    apiBaseUrl: "https://fp3wkr66eg.execute-api.us-east-1.amazonaws.com/dev",
    userEmail: "testingdevs@yopmail.com",
    userPassword: "Test@1234",
  },
  stg: {
    // `stg.` — the apex and www hosts are not served for this environment.
    baseUrl: "https://stg.assistly.live",
    apiBaseUrl: "https://8cp7ba7h30.execute-api.us-east-1.amazonaws.com/stg",
  },
  main: {
    // `www.` is required — https://assistly.live does not respond.
    baseUrl: "https://www.assistly.live",
    apiBaseUrl: "https://f0meh16xih.execute-api.us-east-1.amazonaws.com/main",
  },
};

export const DEFAULT_ENV: EnvName = "dev";

export const resolveEnvName = (raw: unknown): EnvName => {
  const name = String(raw ?? DEFAULT_ENV).toLowerCase();
  // Accept the aliases people actually type for the `main` deployment.
  const alias = name === "prod" || name === "production" ? "main" : name;
  if (alias in TARGETS) return alias as EnvName;
  throw new Error(
    `Unknown Cypress environment "${raw}". Expected one of: ${Object.keys(
      TARGETS
    ).join(", ")}.`
  );
};

/**
 * Resolve one credential for the selected environment, most specific first:
 *
 *   1. `TEST_USER_EMAIL`      — `--env TEST_USER_EMAIL=…` / `CYPRESS_TEST_USER_EMAIL`.
 *                               Applies to whichever environment is running; use
 *                               it to point a single run at a different account.
 *   2. `<ENV>_USER_EMAIL`     — `STG_USER_EMAIL`, `MAIN_USER_EMAIL`, … Lets one
 *                               CI job define all three environments' accounts
 *                               at once; the right pair is picked automatically.
 *   3. `target.userEmail`     — committed fallback, dev only.
 *
 * Throws rather than falling through to a wrong account: signing into stg with
 * the dev user fails in a way that looks like a broken login test.
 */
export const resolveCredential = (
  env: Record<string, unknown>,
  envName: EnvName,
  field: "EMAIL" | "PASSWORD",
  fallback?: string
): string => {
  const specific = `${envName.toUpperCase()}_USER_${field}`;
  const value = env[`TEST_USER_${field}`] ?? env[specific] ?? fallback;

  if (typeof value === "string" && value.length > 0) return value;

  throw new Error(
    `No ${field.toLowerCase()} configured for the "${envName}" Cypress ` +
      `environment.\n` +
      `Set CYPRESS_${specific} in the shell or CI secrets, or add ` +
      `"${specific}" to cypress.env.json (gitignored).\n` +
      `See cypress.env.example.json for the full shape.`
  );
};
