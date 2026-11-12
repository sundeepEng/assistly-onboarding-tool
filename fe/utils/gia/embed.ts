import Cookies from "js-cookie";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "../constants";

export const ONBOARDING_ORIGIN =
  process.env.NEXT_PUBLIC_ONBOARDING_ORIGIN || "http://localhost:3000";

const EMBED_FLAG = "gia_embed";
export const AUTH_MESSAGE_TYPE = "ASSISTLY_AUTH";

export const GIA_READY = "GIA_READY";
export const GIA_PAGE_CHANGED = "GIA_PAGE_CHANGED";
export const GIA_NAVIGATE = "GIA_NAVIGATE";
export const GIA_NAVIGATION_RESULT = "GIA_NAVIGATION_RESULT";

export type GiaNavigateMsg = {
  type: typeof GIA_NAVIGATE;
  request_id: string;
  step_id: string;
};

export const isGiaNavigate = (d: unknown): d is GiaNavigateMsg =>
  !!d &&
  typeof d === "object" &&
  (d as any).type === GIA_NAVIGATE &&
  typeof (d as any).request_id === "string" &&
  typeof (d as any).step_id === "string";

/** True while the app is running inside the onboarding portal iframe. */
export const isEmbedded = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("embed") === "1") {
      sessionStorage.setItem(EMBED_FLAG, "1");
      return true;
    }
    return sessionStorage.getItem(EMBED_FLAG) === "1";
  } catch {
    return false;
  }
};

const setCookie = (name: string, value?: string | null) => {
  if (value) Cookies.set(name, value);
};

/** Apply tokens coming from the portal (URL hash or postMessage). */
export const applyAuthTokens = (t: {
  idToken?: string | null;
  accessToken?: string | null;
  userId?: string | null;
  homeId?: string | null;
}) => {
  setCookie(ID_TOKEN, t.idToken);
  setCookie(ACCESS_TOKEN, t.accessToken);
  setCookie(USER_ID, t.userId);
  setCookie("homeId", t.homeId);
};

/** Read `?embed=1#idToken=...` style bootstrap credentials. */
export const tokensFromHash = () => {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.get("idToken")) return null;
  return {
    idToken: params.get("idToken"),
    accessToken: params.get("accessToken"),
    userId: params.get("userId"),
    homeId: params.get("homeId"),
  };
};

export const postToPortal = (msg: object) => {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(msg, ONBOARDING_ORIGIN);
};
