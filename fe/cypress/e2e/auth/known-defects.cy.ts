/**
 * Auth — known defects.
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE. Each asserts the behaviour the
 * app SHOULD have against code that does something else — an executable bug
 * report. Gating jobs skip these via `grepTags=-@defect` (or the whole file
 * via SKIP_KNOWN_DEFECTS=true).
 *
 * A test turning green means the fix shipped: move it into login.cy.ts or
 * forgot-password.cy.ts rather than deleting it.
 */

import { loginPage } from "../../framework/pages/login.page";
import { AUTH_COOKIES, LOGIN_PATH } from "../../framework/constants";
import { buildMockIdToken } from "../../framework/factories";
import { Routes } from "../../framework/utils/routes";
import { Tags } from "../../framework/utils/tags";

const VALID_EMAIL = Cypress.env("TEST_USER_EMAIL") as string;
const VALID_PASSWORD = Cypress.env("TEST_USER_PASSWORD") as string;

describe("Auth known defects — stale session cleanup", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("wipes the stale cookies when the id token has expired", () => {
    // utils/auth.ts:checkAndCleanExpiredTokens is supposed to clear idToken /
    // accessToken / userId on mount (and every 5s after, via useCookieListener
    // in desktop-login.tsx) once the token's `exp` claim is in the past. On the
    // app it never clears them: the expired cookies below are still present
    // after the login page has fully mounted, so a visitor is neither
    // authenticated nor cleanly anonymous.
    cy.clearAuthSession();
    cy.setCookie(AUTH_COOKIES.idToken, buildMockIdToken("PCHO", { exp: 1000000000 }));
    cy.setCookie(AUTH_COOKIES.accessToken, "mock-access-token");
    cy.setCookie(AUTH_COOKIES.userId, "22222222-2222-4222-8222-222222222222");

    cy.visit(LOGIN_PATH);
    loginPage.emailInput.should("be.visible");

    cy.getCookie(AUTH_COOKIES.idToken).should("be.null");
    cy.getCookie(AUTH_COOKIES.accessToken).should("be.null");
    cy.getCookie(AUTH_COOKIES.userId).should("be.null");
  });
});

describe("Auth known defects — silent session failure", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("surfaces an error when the sign-in 200 carries no session payload", () => {
    // services/authenticate-user.ts only persists when `response.data.cookies`
    // exists. When it doesn't, the success handler still runs — but no token
    // means no role, so getInitialRoute yields "" and router.push("") is a
    // no-op. Observed: portal stays empty, no redirect, no home lookup — the
    // user clicks Sign in, the request returns 200, and NOTHING happens. A
    // silent dead-end is worse than an error message; the user retries a
    // "working" button forever.
    cy.intercept("POST", "**/signin", {
      statusCode: 200,
      body: { userType: "PCHO" }, // 200 but no `cookies` — nothing to persist
    }).as("loginRequest");

    loginPage.visit();
    loginPage.signIn(VALID_EMAIL, VALID_PASSWORD);
    cy.wait("@loginRequest");

    // Desired: the user is told sign-in FAILED. Non-empty alone isn't enough —
    // a "Login Successful!" popover here would be the same defect wearing a
    // worse disguise (false success on a session-less sign-in).
    cy.get("#popover-portal", { timeout: 5000 })
      .should("not.be.empty")
      .and("not.contain.text", "Login Successful");
  });
});

describe("Auth known defects — activation error fallback", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("shows a fallback message when activate-account returns an empty error body", { tags: [Tags.PCG] }, () => {
    // components/activate-account.tsx: `errMsg = error ? error?.error :
    // "Failed to activate account"`. The service throws
    // `error.response?.data || error`; an empty body is a truthy `{}` — so
    // errMsg is `undefined`, the fallback is unreachable, and the popover
    // opens blank. A failed activation leaves the user staring at an empty
    // error box.
    const inviteToken = buildMockIdToken("PCG", {
      email: "newjoiner@assistly.com",
    });
    cy.intercept("POST", "**/activate-account", {
      statusCode: 500,
      body: {},
    }).as("activate");

    cy.clearAuthSession();
    cy.visit(`/activate-account?token=${inviteToken}`);

    // Both desktop and mobile copies render; filter to the visible one. The
    // Form remounts via key={decodedEmail} once the invite token decodes —
    // wait for the read-only email to be populated so we never type into the
    // pre-decode (disabled) copy.
    cy.contains("h2:visible", /Activate (Your )?Account/).should("be.visible");
    cy.get('input[name="email"]:visible').should(
      "have.value",
      "newjoiner@assistly.com"
    );
    cy.get('input[name="password"]:visible').type("Passw0rd!");
    cy.get('input[name="confirmPassword"]:visible').type("Passw0rd!");
    cy.get("button:visible").contains("Activate Account").click();

    cy.wait("@activate");
    cy.contains("Failed to activate account", { timeout: 10000 }).should(
      "be.visible"
    );
  });
});
