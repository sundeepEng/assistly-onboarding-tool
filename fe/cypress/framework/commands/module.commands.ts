/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />
/* eslint-disable cypress/no-unnecessary-waiting */

/**
 * Module commands — shared by the authenticated suites (CRM, Clinical, HCM,
 * Compliance, RevOps, Dashboard).
 *
 * Ported from the legacy cypress/support/module-commands.ts. `loginAs` lives in
 * auth.commands.ts. Specs reach it through the cypress/framework/module-commands.ts
 * barrel; new code should import builders from ../factories.
 *
 * Conventions:
 *   cy.setAuthSession() seeds the session; cy.visitAs()/cy.visitRevopsAs()/
 *   cy.visitComplianceAs() bundle session + the stubs every screen needs.
 *   Endpoint paths mirror utils/routes.ts ApiPaths.
 */

import { AppRole, TEST_USER_ID } from "../constants";
import {
  buildDashboardMetrics,
  buildHome,
  buildInvoiceRow,
  buildPayoutRow,
  buildUserRow,
  buildUserWithDocuments,
} from "../factories";

/** Add Lead queries these userTypes to build its Lead Owner select. */
const LEAD_OWNER_ROLES = ["PCHO", "SalesDirector", "SalesRepresentative"];

declare global {
  namespace Cypress {
    interface Chainable {
      /** Stub GET /v1/home/{id}. Aliased `@getHome`. */
      stubHome(home?: ReturnType<typeof buildHome>): Chainable<void>;

      /** Stub GET /v1/users. Aliased as `alias` (default `@getUsers`). */
      stubUsers(users?: any[], alias?: string): Chainable<void>;

      /** Stub GET /v1/users with an error. Aliased `@getUsers`. */
      stubUsersFailure(statusCode?: number, error?: string): Chainable<void>;

      /** Stub GET /v1/user/{id}. Aliased `@getUser`. */
      stubUser(user: Record<string, any>): Chainable<void>;

      /** Stub POST to `path`. Aliased as `alias`. */
      stubPost(
        path: string,
        alias: string,
        statusCode?: number,
        body?: any
      ): Chainable<void>;

      /** Stub PUT to `path/**`. Aliased as `alias`. */
      stubPut(
        path: string,
        alias: string,
        statusCode?: number,
        body?: any
      ): Chainable<void>;

      /** Stub DELETE to `path/**`. Aliased as `alias`. */
      stubDelete(
        path: string,
        alias: string,
        statusCode?: number,
        body?: any
      ): Chainable<void>;

      /** Seed a session + stub home/users, then visit `path`. */
      visitAs(path: string, role?: AppRole): Chainable<void>;

      /**
       * Assert an intercepted request carried
       * `Authorization: Bearer <idToken>` matching the session cookie.
       */
      assertAuthorized(alias: string): Chainable<void>;

      /** Assert an intercepted request's query string contains `params`. */
      assertQuery(alias: string, params: Record<string, string>): Chainable<void>;

      /** Assert no request matched `alias` (waits out the dispatch window). */
      assertNoRequest(alias: string): Chainable<void>;

      /** Open the actions (⋮) menu on the table row containing `text`. */
      openRowMenu(text: string): Chainable<void>;

      /** Wait for a query to exhaust react-query's 3-retry backoff. */
      waitForQueryFailure(alias: string): Chainable<void>;

      /** Wait until the remount-prone `<form>` element holds still. */
      settleForm(stableMs?: number): Chainable<void>;

      // ── RevOps ────────────────────────────────────────────────────────

      /** Stub GET /v1/revops/invoice. Aliased `@getInvoices`. */
      stubInvoices(invoices?: any[]): Chainable<void>;

      /** Stub GET /v1/revops/invoice with an error. Aliased `@getInvoices`. */
      stubInvoicesFailure(statusCode?: number, error?: string): Chainable<void>;

      /** Stub GET /v1/revops/budget/dashboard/metrics. Aliased `@getMetrics`. */
      stubBudgetMetrics(metrics?: Record<string, any>): Chainable<void>;

      /** Stub GET /v1/revops/budget (expense summary). Aliased `@getBudget`. */
      stubBudgetSummary(body?: Record<string, any>): Chainable<void>;

      /** Stub GET /v1/revops/payout. Aliased `@getPayouts`. */
      stubPayouts(payouts?: any[]): Chainable<void>;

      /** Session + every RevOps endpoint stubbed, then visit `path`. */
      visitRevopsAs(
        path: string,
        role?: AppRole,
        opts?: { home?: ReturnType<typeof buildHome>; invoices?: any[] }
      ): Chainable<void>;

      // ── Compliance ────────────────────────────────────────────────────

      /** Session + home/user record stubs Compliance reads, then visit `path`. */
      visitComplianceAs(
        path: string,
        role?: AppRole,
        opts?: { home?: ReturnType<typeof buildHome>; documents?: any[] }
      ): Chainable<void>;

      /** Stub the S3 presign round-trip document cards depend on. */
      stubPresign(url?: string): Chainable<void>;

      /** Assert the Access Denied card rendered (restricted.tsx). */
      assertRestricted(): Chainable<void>;
    }
  }
}

// ── Implementations ──────────────────────────────────────────────────────────

Cypress.Commands.add("stubHome", (home = buildHome()) => {
  cy.intercept("GET", "**/v1/home/**", { statusCode: 200, body: home }).as(
    "getHome"
  );
});

Cypress.Commands.add(
  "stubUsers",
  (users: any[] = [buildUserRow()], alias = "getUsers") => {
    cy.intercept("GET", "**/v1/users*", (req) => {
      const userType = req.query.userType as string | undefined;

      // Add Lead fetches PCHOs, sales directors and sales reps to populate its
      // Lead Owner select, and defaults the owner to the signed-in user. Answer
      // those role-scoped calls with the signed-in user so the form is
      // submittable; the list query still gets `users`.
      if (userType && LEAD_OWNER_ROLES.includes(userType)) {
        req.reply({
          statusCode: 200,
          body: { users: [{ name: "Test User", userId: TEST_USER_ID }] },
        });
        return;
      }

      req.reply({ statusCode: 200, body: { users } });
    }).as(alias);
  }
);

Cypress.Commands.add(
  "stubUsersFailure",
  (statusCode = 500, error = "Failed to fetch users") => {
    cy.intercept("GET", "**/v1/users*", {
      statusCode,
      body: { error, message: error },
    }).as("getUsers");
  }
);

Cypress.Commands.add("stubUser", (user: Record<string, any>) => {
  cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user } }).as(
    "getUser"
  );
});

Cypress.Commands.add(
  "stubPost",
  (path: string, alias: string, statusCode = 201, body: any = {}) => {
    cy.intercept("POST", `**${path}`, { statusCode, body }).as(alias);
  }
);

Cypress.Commands.add(
  "stubPut",
  (path: string, alias: string, statusCode = 200, body: any = {}) => {
    cy.intercept("PUT", `**${path}/**`, { statusCode, body }).as(alias);
  }
);

Cypress.Commands.add(
  "stubDelete",
  (path: string, alias: string, statusCode = 200, body: any = {}) => {
    cy.intercept("DELETE", `**${path}/**`, { statusCode, body }).as(alias);
  }
);

Cypress.Commands.add("visitAs", (path: string, role: AppRole = "PCHO") => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome();
  cy.stubUsers();
  cy.visit(path);
});

Cypress.Commands.add("assertAuthorized", (alias: string) => {
  cy.getCookie("idToken").then((cookie) => {
    cy.get(alias).then((interception: any) => {
      expect(
        interception.request.headers.authorization,
        `${alias} Authorization header`
      ).to.eq(`Bearer ${cookie?.value}`);
    });
  });
});

Cypress.Commands.add(
  "assertQuery",
  (alias: string, params: Record<string, string>) => {
    cy.get(alias).then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      Object.entries(params).forEach(([key, value]) => {
        expect(query.get(key), `${alias} ?${key}`).to.eq(value);
      });
    });
  }
);

/**
 * How long to let a request appear before concluding none was sent.
 * `should("have.length", 0)` passes the instant it runs — before the app has
 * dispatched anything — so a no-request assertion without a settle window can
 * pass while the request is still in flight. 500ms covers the React handler →
 * axios hop this app makes.
 */
const NO_REQUEST_SETTLE_MS = 500;

Cypress.Commands.add("assertNoRequest", (alias: string) => {
  cy.wait(NO_REQUEST_SETTLE_MS, { log: false });
  cy.get(`${alias}.all`).should("have.length", 0);
});

Cypress.Commands.add("openRowMenu", (text: string) => {
  cy.contains(text)
    .closest('div[class*="border-b"]')
    // MenuIcon renders <svg class="w-6 h-6 cursor-pointer">; the click handler
    // sits on its wrapping div, so the event has to bubble from the icon.
    .find("svg.cursor-pointer")
    .last()
    .click({ force: true });
});

Cypress.Commands.add("settleForm", (stableMs = 400) => {
  cy.get("form", { timeout: 10000 }).should("exist");
  cy.window({ log: false }).then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        let last = win.document.querySelector("form");
        let stableSince = Date.now();
        const deadline = Date.now() + 10000;

        const id = win.setInterval(() => {
          const current = win.document.querySelector("form");
          if (current !== last) {
            last = current;
            stableSince = Date.now();
          } else if (Date.now() - stableSince >= stableMs) {
            win.clearInterval(id);
            resolve();
          } else if (Date.now() > deadline) {
            win.clearInterval(id);
            reject(new Error("form never stopped remounting within 10s"));
          }
        }, 25);
      })
  );
});

// ── RevOps ───────────────────────────────────────────────────────────────────

Cypress.Commands.add("stubInvoices", (invoices: any[] = [buildInvoiceRow()]) => {
  cy.intercept("GET", "**/v1/revops/invoice*", {
    statusCode: 200,
    body: { invoices },
  }).as("getInvoices");
});

Cypress.Commands.add(
  "stubInvoicesFailure",
  (statusCode = 500, error = "Failed to fetch invoices") => {
    cy.intercept("GET", "**/v1/revops/invoice*", {
      statusCode,
      body: { error, message: error },
    }).as("getInvoices");
  }
);

Cypress.Commands.add(
  "stubBudgetMetrics",
  (metrics: Record<string, any> = buildDashboardMetrics()) => {
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: metrics,
    }).as("getMetrics");
  }
);

Cypress.Commands.add(
  "stubBudgetSummary",
  (body: Record<string, any> = { expense_payroll: 250000, budget: [] }) => {
    cy.intercept("GET", "**/v1/revops/budget*", { statusCode: 200, body }).as(
      "getBudget"
    );
  }
);

Cypress.Commands.add("stubPayouts", (payouts: any[] = [buildPayoutRow()]) => {
  cy.intercept("GET", "**/v1/revops/payout*", {
    statusCode: 200,
    body: { payouts },
  }).as("getPayouts");
});

Cypress.Commands.add(
  "visitRevopsAs",
  (
    path: string,
    role: AppRole = "PCHO",
    opts: { home?: ReturnType<typeof buildHome>; invoices?: any[] } = {}
  ) => {
    cy.clearAuthSession();
    cy.setAuthSession(role);
    cy.stubHome(opts.home ?? buildHome());
    cy.stubUsers();
    cy.stubUser(buildUserWithDocuments());
    cy.stubBudgetSummary();
    cy.stubBudgetMetrics();
    cy.stubInvoices(opts.invoices);
    cy.stubPayouts();
    cy.visit(path);
  }
);

// ── Compliance ───────────────────────────────────────────────────────────────

Cypress.Commands.add(
  "visitComplianceAs",
  (
    path: string,
    role: AppRole = "PCHO",
    opts: { home?: ReturnType<typeof buildHome>; documents?: any[] } = {}
  ) => {
    cy.clearAuthSession();
    cy.setAuthSession(role);
    cy.stubHome(opts.home ?? buildHome());
    cy.stubUsers();
    cy.stubUser(buildUserWithDocuments(opts.documents ?? []));
    // The certificates page PUTs a deduped user record back on first paint.
    cy.stubPut("/v1/user", "updateUser");
    cy.stubPresign();
    cy.visit(path);
  }
);

Cypress.Commands.add(
  "stubPresign",
  (
    url = "https://bucket.s3.amazonaws.com/signed/doc.pdf?X-Amz-Signature=stub"
  ) => {
    cy.intercept("POST", "/api/s3/presign-get", {
      statusCode: 200,
      body: { url },
    }).as("presign");
    // The legacy fallback the service tries when the Next route fails.
    cy.intercept("GET", "**/v1/s3-pre-signed-url*", {
      statusCode: 200,
      body: { message: url },
    }).as("presignLegacy");
  }
);

Cypress.Commands.add("assertRestricted", () => {
  // RestrictedPage delays its own render by 200ms before showing the card.
  cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
});

Cypress.Commands.add("waitForQueryFailure", (alias: string) => {
  // react-query retries a failed query on 1s/2s/4s backoff — but the retry
  // budget is configured per screen, so waiting a fixed count breaks whenever
  // the app changes it. Wait for the first request, then until the interception
  // count stops growing across a 2.5s window (longer than the widest backoff).
  cy.wait(alias as `@${string}`, { timeout: 20000 });
  const settle = (roundsLeft: number) => {
    if (roundsLeft <= 0) return;
    cy.get(`${alias}.all`, { log: false }).then((reqs: any) => {
      const before = reqs.length;
      cy.wait(2500, { log: false });
      cy.get(`${alias}.all`, { log: false }).then((after: any) => {
        if (after.length !== before) settle(roundsLeft - 1);
      });
    });
  };
  settle(6);
});
