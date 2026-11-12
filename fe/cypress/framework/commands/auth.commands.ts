/// <reference types="cypress" />

/**
 * Authentication commands — the two session strategies every spec chooses from.
 *
 * 1. `cy.setAuthSession(role)` — STUBBED session. Writes the same four cookies
 *    the sign-in response would, so the app boots straight into the module
 *    under test. Every endpoint stays stubbed by the spec itself; nothing
 *    talks to a real API. This is the default for module/regression specs:
 *    fast, deterministic, offline-friendly.
 *
 * 2. `cy.login(email?, password?)` — REAL session. Drives an actual
 *    POST {API_BASE_URL}/signin and persists the returned cookies through
 *    `cy.session`, so the first spec pays the sign-in cost and later specs
 *    reuse the restored session. Use for @smoke and live-environment checks
 *    where a stubbed login would prove nothing.
 *
 * Cookie names mirror services/authenticate-user.ts; the role claim the app
 * routes on is "custom:role" inside the id token (utils/auth.ts).
 */

import {
  AppRole,
  AUTH_COOKIES,
  ID_TOKEN_ENV_KEY,
  LOGIN_PATH,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../constants";
import { buildMockIdToken } from "../factories";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Write session cookies so the app treats the visitor as logged in. */
      setAuthSession(role?: AppRole): Chainable<void>;

      /** Write session cookies whose id token has already expired. */
      setExpiredAuthSession(role?: AppRole): Chainable<void>;

      /** Clear cookies + storage between tests. */
      clearAuthSession(): Chainable<void>;

      /**
       * Real sign-in against the environment's API, cached via cy.session.
       * Defaults to the configured TEST_USER_EMAIL / TEST_USER_PASSWORD.
       * After it resolves, the app treats the browser as authenticated.
       */
      login(email?: string, password?: string): Chainable<void>;

      /**
       * Full stubbed happy-path login: stub the 200 and the home lookup,
       * visit /login, submit valid credentials, then store the returned id
       * token for downstream auth assertions. Yields the token.
       */
      loginAs(
        role?: AppRole,
        opts?: { isSalesRequired?: boolean }
      ): Chainable<string>;

      /**
       * Wait on `@loginRequest`, assert it returned 200, and store the id token
       * from the body for the rest of the spec. Yields the token.
       */
      storeIdToken(): Chainable<string>;

      /** The token captured by `storeIdToken`, or undefined before login. */
      getStoredIdToken(): Chainable<string | undefined>;
    }
  }
}

// js-cookie's Cookies.remove() only clears host-only cookies — a cookie set
// with a Domain attribute (".dev.assistly.live") survives removal and the app
// keeps treating the visitor as logged in. Write host-only cookies so the
// app's own teardown (logout, expired-session cleanup) actually clears them.
const HOST_ONLY = { hostOnly: true } as const;

Cypress.Commands.add("setAuthSession", (role: AppRole = "PCHO") => {
  cy.setCookie(AUTH_COOKIES.idToken, buildMockIdToken(role), HOST_ONLY);
  cy.setCookie(AUTH_COOKIES.accessToken, "mock-access-token", HOST_ONLY);
  cy.setCookie(AUTH_COOKIES.userId, TEST_USER_ID, HOST_ONLY);
  cy.setCookie(AUTH_COOKIES.homeId, TEST_HOME_ID, HOST_ONLY);
});

Cypress.Commands.add("setExpiredAuthSession", (role: AppRole = "PCHO") => {
  // exp in the past -> utils/auth.ts treats the session as expired.
  cy.setCookie(
    AUTH_COOKIES.idToken,
    buildMockIdToken(role, { exp: 1000000000 }),
    HOST_ONLY
  );
  cy.setCookie(AUTH_COOKIES.accessToken, "mock-access-token", HOST_ONLY);
  cy.setCookie(AUTH_COOKIES.userId, TEST_USER_ID, HOST_ONLY);
  cy.setCookie(AUTH_COOKIES.homeId, TEST_HOME_ID, HOST_ONLY);
});

Cypress.Commands.add("clearAuthSession", () => {
  cy.clearCookies();
  cy.clearLocalStorage();
  // Cypress.env persists across tests in a spec — drop a token from a prior
  // test so `attachIdTokenToRequests` cannot leak it into an unauth'd one.
  Cypress.env(ID_TOKEN_ENV_KEY, undefined);
});

Cypress.Commands.add(
  "login",
  (
    email: string = Cypress.env("TEST_USER_EMAIL"),
    password: string = Cypress.env("TEST_USER_PASSWORD")
  ) => {
    const apiBaseUrl = Cypress.env("API_BASE_URL") as string;

    cy.session(
      ["signin", email, apiBaseUrl],
      () => {
        // Establish the app domain first so cy.setCookie lands on it rather
        // than the default localhost origin.
        cy.visit(LOGIN_PATH);
        cy.request({
          method: "POST",
          url: `${apiBaseUrl}/signin`,
          body: { email, password },
        }).then((response) => {
          expect(response.status, "sign-in status").to.eq(200);
          const cookies = response.body?.cookies;
          expect(cookies?.idToken, "idToken in sign-in body").to.be.a("string");

          cy.setCookie(AUTH_COOKIES.idToken, cookies.idToken);
          cy.setCookie(AUTH_COOKIES.accessToken, cookies.accessToken);
          cy.setCookie(AUTH_COOKIES.userId, cookies.userId);
          cy.setCookie(AUTH_COOKIES.homeId, cookies.homeId);
        });
      },
      {
        validate: () => {
          // A restored session is only useful if the token cookie survived and
          // has not expired — utils/auth.ts wipes it the moment it is.
          cy.getCookie(AUTH_COOKIES.idToken).should("exist");
        },
      }
    );
  }
);

Cypress.Commands.add(
  "loginAs",
  (role: AppRole = "PCHO", opts?: { isSalesRequired?: boolean }) => {
    cy.stubLoginSuccess(role);
    cy.stubHomeLookup(opts?.isSalesRequired ?? false);
    cy.visitLoginPage();
    cy.fillLoginForm(
      Cypress.env("TEST_USER_EMAIL"),
      Cypress.env("TEST_USER_PASSWORD")
    );
    cy.contains("button", "Sign in").click();
    return cy.storeIdToken();
  }
);

Cypress.Commands.add("storeIdToken", () =>
  cy.wait("@loginRequest").then(({ response }) => {
    expect(response?.statusCode, "sign-in status").to.eq(200);

    // The API returns the token at the top level; fall back to the cookies
    // payload so this also works against stubs built before that was added.
    const idToken: string | undefined =
      response?.body?.idToken ?? response?.body?.cookies?.idToken;

    expect(idToken, "id token in the 200 body").to.be.a("string").and.not.be
      .empty;

    Cypress.env(ID_TOKEN_ENV_KEY, idToken);
    return cy.wrap(idToken as string, { log: false });
  })
);

Cypress.Commands.add("getStoredIdToken", () =>
  cy.wrap(Cypress.env(ID_TOKEN_ENV_KEY) as string | undefined, { log: false })
);
