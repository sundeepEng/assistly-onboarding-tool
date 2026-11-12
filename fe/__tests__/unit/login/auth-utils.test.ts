/**
 * Session utilities — utils/auth.ts
 *
 * Everything downstream of login depends on these: the Authorization header each
 * service sends, the role the router picks, and the cleanup that logs a user out
 * when their token expires.
 */

import Cookies from "js-cookie";

import {
  checkAndCleanExpiredTokens,
  decodeJwtToken,
  getHomeIdFromToken,
  getIdToken,
  getUserEmailFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
  isTokenExpired,
} from "../../../utils/auth";
import {
  buildIdToken,
  clearAuthSession,
  FUTURE_EXP,
  PAST_EXP,
  setAuthSession,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../test-utils/auth";

beforeEach(() => {
  clearAuthSession();
});

describe("decodeJwtToken", () => {
  it("returns the payload claims of a well-formed token", () => {
    const token = buildIdToken("Nurse", { email: "nina@assistly.com" });
    expect(decodeJwtToken(token)).toMatchObject({
      email: "nina@assistly.com",
      "custom:role": "Nurse",
      exp: FUTURE_EXP,
    });
  });

  it("decodes base64url payloads (- and _ instead of + and /)", () => {
    // Real Cognito tokens are base64url; a decoder that only handles standard
    // base64 throws on roughly one token in four.
    const token = buildIdToken("PCHO", { email: "a+b~c/d@assistly.com" });
    expect(decodeJwtToken(token).email).toBe("a+b~c/d@assistly.com");
  });

  it("returns null instead of throwing for a non-JWT string", () => {
    expect(decodeJwtToken("not-a-jwt")).toBeNull();
  });

  it("returns null for an empty token", () => {
    expect(decodeJwtToken("")).toBeNull();
  });

  it("returns null when the payload segment is not valid JSON", () => {
    expect(decodeJwtToken("header.bm90LWpzb24.sig")).toBeNull();
  });
});

describe("getIdToken", () => {
  it("returns undefined when no session cookie is set", () => {
    expect(getIdToken()).toBeUndefined();
  });

  it("returns the stored id token", () => {
    const token = setAuthSession("PCHO");
    expect(getIdToken()).toBe(token);
  });
});

describe("isTokenExpired", () => {
  it("treats a missing token as expired", () => {
    expect(isTokenExpired()).toBe(true);
  });

  it("returns false for a token whose exp is in the future", () => {
    setAuthSession("PCHO");
    expect(isTokenExpired()).toBe(false);
  });

  it("returns true for a token whose exp has passed", () => {
    setAuthSession("PCHO", { exp: PAST_EXP });
    expect(isTokenExpired()).toBe(true);
  });

  it("treats a token with no exp claim as expired", () => {
    Cookies.set("idToken", "header.eyJlbWFpbCI6ImFAYi5jb20ifQ.sig");
    expect(isTokenExpired()).toBe(true);
  });

  it("treats an undecodable token as expired", () => {
    Cookies.set("idToken", "garbage");
    expect(isTokenExpired()).toBe(true);
  });
});

describe("checkAndCleanExpiredTokens", () => {
  it("keeps a live session and reports it valid", () => {
    const idToken = setAuthSession("PCHO");
    expect(checkAndCleanExpiredTokens()).toBe(true);
    expect(Cookies.get("idToken")).toBe(idToken);
    expect(Cookies.get("accessToken")).toBe("test-access-token");
    expect(Cookies.get("userId")).toBe(TEST_USER_ID);
  });

  it("wipes every session cookie once the id token has expired", () => {
    setAuthSession("PCHO", { exp: PAST_EXP });
    Cookies.set("role", "PCHO");

    expect(checkAndCleanExpiredTokens()).toBe(false);

    ["idToken", "accessToken", "userId", "homeId", "role"].forEach((name) =>
      expect(Cookies.get(name)).toBeUndefined()
    );
  });

  it("reports invalid when there is no session at all", () => {
    expect(checkAndCleanExpiredTokens()).toBe(false);
  });

  it("clears a stale session even when the other cookies still look healthy", () => {
    // The expired id token is the single source of truth — a lingering
    // accessToken must not keep the user signed in.
    Cookies.set("idToken", buildIdToken("PCHO", { exp: PAST_EXP }));
    Cookies.set("accessToken", "still-here");

    checkAndCleanExpiredTokens();

    expect(Cookies.get("accessToken")).toBeUndefined();
  });
});

describe("getUserRoleFromToken", () => {
  it("returns null when there is no id token", () => {
    expect(getUserRoleFromToken()).toBeNull();
  });

  it.each([
    "PCHO",
    "Lead",
    "Senior",
    "Nurse",
    "PCG",
    "PCGLead",
    "NurseLead",
    "REFERRAL",
    "ComplianceGuest",
    "HomeAdmin",
  ])("reads the 'custom:role' claim for %s", (role) => {
    setAuthSession(role);
    expect(getUserRoleFromToken()).toBe(role);
  });

  it("returns null when the token carries no role claim", () => {
    // {"email":"a@b.com"} — a token without "custom:role".
    Cookies.set("idToken", "header.eyJlbWFpbCI6ImFAYi5jb20ifQ.sig");
    expect(getUserRoleFromToken()).toBeNull();
  });
});

describe("getUserIdFromToken / getHomeIdFromToken", () => {
  it("both return null without a session", () => {
    expect(getUserIdFromToken()).toBeNull();
    expect(getHomeIdFromToken()).toBeNull();
  });

  it("read the ids from their cookies, not from the token payload", () => {
    setAuthSession("PCHO", { userId: "user-abc", homeId: "home-xyz" });
    expect(getUserIdFromToken()).toBe("user-abc");
    expect(getHomeIdFromToken()).toBe("home-xyz");
  });

  it("returns the seeded ids for the default session", () => {
    setAuthSession("PCHO");
    expect(getUserIdFromToken()).toBe(TEST_USER_ID);
    expect(getHomeIdFromToken()).toBe(TEST_HOME_ID);
  });
});

describe("getUserEmailFromToken", () => {
  it("returns null without a session", () => {
    expect(getUserEmailFromToken()).toBeNull();
  });

  it("prefers the 'email' claim", () => {
    Cookies.set("idToken", buildIdToken("PCHO", { email: "primary@assistly.com" }));
    expect(getUserEmailFromToken()).toBe("primary@assistly.com");
  });

  it("falls back to 'cognito:username' when 'email' is absent", () => {
    // {"cognito:username":"fallback@assistly.com"}
    const payload = Buffer.from(
      JSON.stringify({ "cognito:username": "fallback@assistly.com" })
    )
      .toString("base64")
      .replace(/=+$/, "");
    Cookies.set("idToken", `header.${payload}.sig`);
    expect(getUserEmailFromToken()).toBe("fallback@assistly.com");
  });
});
