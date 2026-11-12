/**
 * postMessage protocol between the onboarding portal (parent window) and the
 * embedded dashboard (iframe). Both sides validate origin, source window and
 * message shape before acting on a message.
 */

export const GIA_READY = "GIA_READY";
export const GIA_PAGE_CHANGED = "GIA_PAGE_CHANGED";
export const GIA_NAVIGATE = "GIA_NAVIGATE";
export const GIA_NAVIGATION_RESULT = "GIA_NAVIGATION_RESULT";

export const GIA_RECORD_SAVED = "GIA_RECORD_SAVED";

export type GiaPageChanged = {
  type: typeof GIA_PAGE_CHANGED;
  path: string;
  screen_id: string | null;
  tab?: string | null;
  record_id?: string | null;
};

export type GiaNavigate = {
  type: typeof GIA_NAVIGATE;
  request_id: string;
  step_id: string;
};

export type GiaNavigationResult = {
  type: typeof GIA_NAVIGATION_RESULT;
  request_id: string;
  status: "ok" | "blocked" | "cancelled" | "error";
  path?: string;
  screen_id?: string | null;
  message?: string;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

export const isPageChanged = (d: unknown): d is GiaPageChanged =>
  isObj(d) &&
  d.type === GIA_PAGE_CHANGED &&
  typeof d.path === "string" &&
  (d.screen_id === null || typeof d.screen_id === "string") &&
  (d.tab === undefined || d.tab === null || typeof d.tab === "string");

export const isRecordSaved = (
  d: unknown
): d is { type: typeof GIA_RECORD_SAVED; entity: string | null; record_id: string | null } =>
  isObj(d) && d.type === GIA_RECORD_SAVED;

export const isNavigationResult = (d: unknown): d is GiaNavigationResult =>
  isObj(d) &&
  d.type === GIA_NAVIGATION_RESULT &&
  typeof d.request_id === "string" &&
  ["ok", "blocked", "cancelled", "error"].includes(d.status as string);

export const buildNavigate = (
  request_id: string,
  step_id: string
): GiaNavigate => ({ type: GIA_NAVIGATE, request_id, step_id });
