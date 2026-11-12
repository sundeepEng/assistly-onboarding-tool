/// <reference types="cypress" />

/**
 * Network commands — intercepts, named stubs, and auth-propagation assertions.
 *
 * Endpoint paths mirror utils/constants.ts:
 *   POST   /signin              credentials -> session cookies payload
 *   PUT    /reset-password      forgot password
 *   GET    /v1/home/{id}        home config (type + authorized modules)
 *   GET    /v1/users            list users of a type within a home
 *   GET    /v1/user/{id}        one record
 *   GET    /v1/clinical/user    clinical record
 *   GET    /v1/hcm/shifts       staffing shifts
 *   GET    /v1/revops/...       billing, budget, payments
 *
 * Convention: prefer `cy.interceptApi(method, path, alias)` for one-off
 * watches, and add a named `stub<Entity><Variant>` command here whenever a
 * response needs the framework's canonical shape (factories).
 */

import { AppRole, ID_TOKEN_ENV_KEY } from "../constants";
import { buildSigninResponse, decodeMockJwt } from "../factories";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Endpoints that run before a session exists and must NOT carry the token. */
const PRE_AUTH_PATHS = [
  "/signin",
  "/signup",
  "/reset-password",
  "/confirm-reset-password",
  "/activate-account",
];

/** Requests the Next.js app makes to itself (pages, _next assets, images). */
const isAppOriginRequest = (url: string) =>
  url.startsWith(Cypress.config("baseUrl") as string);

const isPreAuthRequest = (url: string) =>
  PRE_AUTH_PATHS.some((path) => url.includes(path));

/** Methods that carry a body at all — a GET/HEAD body is dropped by the browser. */
const BODY_METHODS: HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Alias a request without stubbing it: `cy.interceptApi("GET", "/v1/users", "users")`
       * then `cy.wait("@users")`. Glob-matches so it catches the full API origin.
       */
      interceptApi(
        method: HttpMethod,
        path: string,
        alias: string,
        response?: { statusCode?: number; body?: unknown }
      ): Chainable<void>;

      /**
       * Stub POST **\/signin with a 200 whose body carries the `cookies` object
       * the app persists, so the post-login redirect resolves a real role route.
       * Aliased as `@loginRequest`.
       */
      stubLoginSuccess(role?: AppRole): Chainable<void>;

      /**
       * Stub POST **\/signin with an error status + `{ error }` body. Pass an
       * object as `error` to exercise the app's "non-string error" fallback.
       * Aliased as `@loginRequest`.
       */
      stubLoginFailure(
        statusCode?: number,
        errorMessage?: string | Record<string, unknown>
      ): Chainable<void>;

      /** Stub POST **\/signin with a delayed 200 so the loading state is observable. */
      stubLoginDelayed(delayMs?: number, role?: AppRole): Chainable<void>;

      /** Alias POST **\/signin without stubbing it. Aliased as `@loginRequest`. */
      interceptLoginApi(): Chainable<void>;

      /** Stub PUT **\/reset-password. Aliased as `@forgotPasswordRequest`. */
      stubForgotPassword(
        statusCode?: number,
        body?: Record<string, unknown>
      ): Chainable<void>;

      /**
       * Stub PUT **\/confirm-reset-password — the OTP + new-password submission
       * (desktop-login.tsx OTP screen). Aliased as `@confirmResetRequest`.
       */
      stubConfirmResetPassword(
        statusCode?: number,
        body?: Record<string, unknown>
      ): Chainable<void>;

      /**
       * Stub GET **\/v1/home\/*. After a successful sign-in the login handler
       * fetches the home, caches `isSalesRequired` in a cookie, and routes on
       * it (desktop-login.tsx -> getInitialRoute). Unstubbed, that call hits
       * the real API with a mock token and fails, so the flag silently reads
       * false. Aliased as `@homeLookup`.
       */
      stubHomeLookup(isSalesRequired?: boolean): Chainable<void>;

      /**
       * Stub POST **\/activate-account — the invite-acceptance call.
       * Aliased as `@activate`.
       */
      stubActivateAccount(
        statusCode?: number,
        body?: Record<string, unknown>
      ): Chainable<void>;

      /** Assert no sign-in request was made (validation blocked submission). */
      assertNoLoginRequest(): Chainable<void>;

      /**
       * Assert zero requests were captured for `alias` — e.g. "@activate".
       * Delegates to `assertNoRequest`, which waits out the app's dispatch
       * window first: checking `.all` immediately can pass while the request
       * is still in flight.
       */
      assertNoRequests(alias: string): Chainable<void>;

      /**
       * Add `idToken` to the request body of every subsequent authenticated
       * request (POST/PUT/PATCH/DELETE to the API). Pre-auth endpoints and the
       * app's own origin are skipped. Call before the request is triggered.
       */
      attachIdTokenToRequests(): Chainable<void>;

      /** Assert an intercepted request's body carries the stored id token. */
      assertBodyCarriesIdToken(alias: string): Chainable<void>;

      /**
       * Assert an intercepted request authenticates with the stored id token —
       * `Authorization: Bearer <idToken>`, which is what the app's services send.
       */
      assertAuthorizedWithIdToken(alias: string): Chainable<void>;

      /**
       * Validate the login 200 body reports `expected` as the user type, and
       * that the id token's `custom:role` claim agrees with it.
       */
      assertUserType(expected: AppRole): Chainable<void>;
    }
  }
}

Cypress.Commands.add("interceptApi", (...args: any[]) => {
  const [method, path, alias, response] = args as [
    HttpMethod,
    string,
    string,
    { statusCode?: number; body?: unknown } | undefined,
  ];
  const intercept = response
    ? cy.intercept(method, `**${path}`, {
        statusCode: response.statusCode ?? 200,
        body: response.body as any,
      })
    : cy.intercept(method, `**${path}`);
  intercept.as(alias);
});

Cypress.Commands.add("stubLoginSuccess", (role: AppRole = "PCHO") => {
  cy.intercept("POST", "**/signin", {
    statusCode: 200,
    body: buildSigninResponse(role),
  }).as("loginRequest");
});

Cypress.Commands.add(
  "stubLoginFailure",
  (
    statusCode = 401,
    errorMessage: string | Record<string, unknown> = "Invalid email or password"
  ) => {
    cy.intercept("POST", "**/signin", {
      statusCode,
      body: { error: errorMessage },
    }).as("loginRequest");
  }
);

Cypress.Commands.add(
  "stubLoginDelayed",
  (delayMs = 1500, role: AppRole = "PCHO") => {
    cy.intercept("POST", "**/signin", (req) => {
      req.reply({
        delay: delayMs,
        statusCode: 200,
        body: buildSigninResponse(role),
      });
    }).as("loginRequest");
  }
);

Cypress.Commands.add("interceptLoginApi", () => {
  cy.intercept("POST", "**/signin").as("loginRequest");
});

Cypress.Commands.add(
  "stubForgotPassword",
  (statusCode = 200, body: Record<string, unknown> = { message: "OTP sent" }) => {
    // useUpdatePassword sends FORGOT_PASSWORD as a PUT, not a POST.
    cy.intercept("PUT", "**/reset-password", { statusCode, body }).as(
      "forgotPasswordRequest"
    );
  }
);

Cypress.Commands.add(
  "stubConfirmResetPassword",
  (
    statusCode = 200,
    body: Record<string, unknown> = { message: "Password reset" }
  ) => {
    cy.intercept("PUT", "**/confirm-reset-password", { statusCode, body }).as(
      "confirmResetRequest"
    );
  }
);

Cypress.Commands.add("stubHomeLookup", (isSalesRequired = false) => {
  cy.intercept("GET", "**/v1/home/*", {
    statusCode: 200,
    body: { home: { homeName: "Comfort Cove", isSalesRequired } },
  }).as("homeLookup");
});

Cypress.Commands.add(
  "stubActivateAccount",
  (statusCode = 200, body: Record<string, unknown> = { message: "ok" }) => {
    cy.intercept("POST", "**/activate-account", { statusCode, body }).as(
      "activate"
    );
  }
);

Cypress.Commands.add("assertNoRequests", (alias: string) => {
  cy.assertNoRequest(alias);
});

Cypress.Commands.add("assertNoLoginRequest", () => {
  cy.assertNoRequests("@loginRequest");
});

Cypress.Commands.add("attachIdTokenToRequests", () => {
  // `middleware: true` runs this handler before any stub for the same route,
  // so the request is mutated and then still handled by that stub.
  cy.intercept({ url: /.*/, middleware: true }, (req) => {
    const idToken = Cypress.env(ID_TOKEN_ENV_KEY);
    if (!idToken) return;
    if (isAppOriginRequest(req.url) || isPreAuthRequest(req.url)) return;
    if (!BODY_METHODS.includes(req.method as HttpMethod)) return;

    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    req.body = { ...body, idToken };
  });
});

Cypress.Commands.add("assertBodyCarriesIdToken", (alias: string) => {
  cy.get(alias).then((interception: any) => {
    expect(interception.request.body, `${alias} body`).to.have.property(
      "idToken",
      Cypress.env(ID_TOKEN_ENV_KEY)
    );
  });
});

Cypress.Commands.add("assertAuthorizedWithIdToken", (alias: string) => {
  cy.get(alias).then((interception: any) => {
    expect(
      interception.request.headers.authorization,
      `${alias} Authorization header`
    ).to.eq(`Bearer ${Cypress.env(ID_TOKEN_ENV_KEY)}`);
  });
});

Cypress.Commands.add("assertUserType", (expected: AppRole) => {
  cy.get("@loginRequest").then((interception: any) => {
    const body = interception.response?.body;

    expect(body, "sign-in body").to.have.property("userType", expected);
    // The claim the app actually routes on must agree with the reported type,
    // otherwise the user lands on a route their token does not permit.
    expect(
      decodeMockJwt(body.idToken ?? body.cookies.idToken)["custom:role"],
      "custom:role claim"
    ).to.eq(expected);
  });
});
