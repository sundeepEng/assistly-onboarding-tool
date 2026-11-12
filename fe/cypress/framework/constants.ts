/**
 * Constants mirroring the app under test. These are the contract points the
 * framework pins itself to — when the app changes them, change them here.
 *
 *   - login screen route:      pages/login/index.tsx           -> /login
 *   - sign-in endpoint:        utils/constants.ts              -> POST {BASE_URL}/signin
 *   - forgot-password endpoint:utils/constants.ts              -> PUT  {BASE_URL}/reset-password
 *   - session cookies:         services/authenticate-user.ts   -> idToken/accessToken/userId/homeId
 *   - role claim:              utils/auth.ts                   -> "custom:role"
 */

export const LOGIN_PATH = "/login";

/** Cookie names the app reads to decide a visitor is signed in. */
export const AUTH_COOKIES = {
  idToken: "idToken",
  accessToken: "accessToken",
  userId: "userId",
  homeId: "homeId",
  isSalesRequired: "isSalesRequired",
} as const;

/**
 * The signed-in user's ids. These must be real UUIDs: the app puts the current
 * user's id straight into schema-validated fields — e.g. Add Lead seeds it as
 * `isReferredByUserId`, which `CreateLeadSchema` checks with `.uuid()` — so an
 * opaque "user-123" silently fails validation and blocks the form.
 */
export const TEST_USER_ID = "22222222-2222-4222-8222-222222222222";
export const TEST_HOME_ID = "11111111-1111-4111-8111-111111111111";

/** The senior an invoice is raised against. */
export const TEST_SENIOR_ID = "55555555-5555-4555-8555-555555555555";

/** The userId of the row `buildUserRow()` produces. */
export const TEST_LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * Roles the app actually knows about (utils/roles.ts). "ADMIN" is NOT one of
 * them — do not invent it in tests.
 */
export type AppRole =
  | "PCHO"
  | "Lead"
  | "Senior"
  | "Nurse"
  | "PCG"
  | "PCGLead"
  | "NurseLead"
  | "REFERRAL"
  | "ComplianceGuest"
  | "HomeAdmin"
  // The sales roles hold a narrower CRM permission set than a PCHO, which is
  // what the CRM row-action specs use them for.
  | "SalesRepresentative"
  | "SalesDirector";

/** Where the stored token lives between commands within a spec. */
export const ID_TOKEN_ENV_KEY = "storedIdToken";
