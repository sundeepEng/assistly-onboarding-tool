/// <reference types="cypress" />

/**
 * RevOps — Budget (pages/revops/budget.tsx) and the RevOps landing route
 * (pages/revops/index.tsx).
 *
 * Money note: every figure the metrics endpoint returns is in **cents** and the
 * screen divides by 100 before formatting. The stat-card assertions below are
 * the regression test for that conversion — dropping it renders a $12,000 income
 * as $1,200,000.
 *
 * Two requests fire on first paint: the Budget screen initialises
 * `selectedPeriod` in a mount effect, so the first metrics call goes out with an
 * empty date window and the properly scoped one follows. Assertions target the
 * scoped request via `scopedMetricsRequest()`.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildDashboardMetrics,
  buildHome,
  TEST_HOME_ID,
} from "../../framework/module-commands";

const BUDGET = "/revops/budget";
const REVOPS = "/revops";

/** The current month as the period picker computes it (UTC, per getCurrentPeriod). */
const currentPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * Yield the first `@getMetrics` interception that carries a real date window.
 * Retries until one arrives, so it survives the empty first-paint request.
 */
const scopedMetricsRequest = () =>
  cy
    .get("@getMetrics.all", { timeout: 10000 })
    .should((interceptions: any) => {
      const scoped = interceptions.filter((i: any) =>
        new URL(i.request.url).searchParams.get("start_date")
      );
      expect(scoped, "a metrics request with a date window").to.have.length.greaterThan(0);
    })
    .then((interceptions: any) =>
      interceptions.find((i: any) => new URL(i.request.url).searchParams.get("start_date"))
    );

describe("RevOps — Budget", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The dashboard metrics query", () => {
    it("GETs /v1/revops/budget/dashboard/metrics on load", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
    });

    it("scopes the query to the signed-in user's home", () => {
      cy.visitRevopsAs(BUDGET);
      scopedMetricsRequest().then((interception: any) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("home_id")).to.eq(TEST_HOME_ID);
      });
    });

    it("sends a start_date on the first of the selected month", () => {
      cy.visitRevopsAs(BUDGET);
      scopedMetricsRequest().then((interception: any) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("start_date")).to.match(/^\d{4}-\d{2}-01$/);
      });
    });

    it("sends an end_date within the same month as the start", () => {
      cy.visitRevopsAs(BUDGET);
      scopedMetricsRequest().then((interception: any) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("end_date")?.slice(0, 7)).to.eq(query.get("start_date")?.slice(0, 7));
      });
    });

    it("defaults the window to the current month", () => {
      cy.visitRevopsAs(BUDGET);
      scopedMetricsRequest().then((interception: any) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("start_date")?.slice(0, 7)).to.eq(currentPeriod());
      });
    });

    it("authenticates with the session id token", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
      cy.assertAuthorized("@getMetrics");
    });

    /**
     * Pinned: `useGetAll` has no `enabled` guard, so the screen fires a metrics
     * request before `selectedPeriod` is initialised — with `start_date=` and
     * `end_date=` empty. The server sees a windowless query for the whole home.
     */
    it("fires an unscoped request before the period is initialised", () => {
      cy.visitRevopsAs(BUDGET);
      cy.get("@getMetrics.all", { timeout: 10000 }).should((interceptions: any) => {
        const unscoped = interceptions.filter(
          (i: any) => new URL(i.request.url).searchParams.get("start_date") === ""
        );
        expect(unscoped, "an empty-window metrics request").to.have.length.greaterThan(0);
      });
    });
  });

  describe("The expense summary query", () => {
    it("GETs /v1/revops/budget filtered to expenses", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getBudget");
      cy.assertQuery("@getBudget", { transaction_type: "expense" });
    });

    it("scopes the query to the home", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getBudget");
      cy.assertQuery("@getBudget", { home_id: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getBudget");
      cy.assertAuthorized("@getBudget");
    });

    /**
     * `transaction_date` is a start/end pair. It goes out as a *repeated* key —
     * the reason this screen borrows `useGetAllShifts` rather than `useGetAll`.
     */
    it("repeats transaction_date rather than indexing it", () => {
      cy.visitRevopsAs(BUDGET);
      cy.get("@getBudget.all", { timeout: 10000 }).should((interceptions: any) => {
        const withDates = interceptions.filter((i: any) =>
          i.request.url.includes("transaction_date=")
        );
        expect(withDates, "a request carrying transaction_date").to.have.length.greaterThan(0);
        expect(withDates[0].request.url).not.to.include("transaction_date[");
      });
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The budget screen", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
    });

    it("renders the page heading", () => {
      cy.contains("Budget Management").should("be.visible");
    });

    it("renders the strapline", () => {
      cy.contains("Track income, expenses, and budget utilization for your care home").should(
        "be.visible"
      );
    });

    it("renders the four stat cards", () => {
      ["Total Income", "Total Expenses", "Net Balance", "Budget Utilization"].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });

    it("renders the five budget tabs", () => {
      ["Overview", "Income", "Expenses", "Thresholds", "Alerts"].forEach((tab) => {
        cy.contains(tab).should("be.visible");
      });
    });

    it("offers a Monthly/Quarterly toggle", () => {
      cy.contains("Monthly").should("be.visible");
      cy.contains("Quarterly").should("be.visible");
    });

    it("shows which period is being viewed", () => {
      cy.contains("Viewing:").should("be.visible");
    });
  });

  // ── Cents conversion ───────────────────────────────────────────────────────

  describe("The stat cards", () => {
    it("divides total_income by 100 before rendering", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
      // 1,200,000 cents = $12,000 — not $1,200,000.
      cy.contains("Total Income").parent().should("contain.text", "$12,000");
    });

    it("divides total_expense by 100", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
      cy.contains("Total Expenses").parent().should("contain.text", "$4,500");
    });

    it("divides net_balance by 100", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
      cy.contains("Net Balance").parent().should("contain.text", "$7,500");
    });

    it("renders utilization as a percentage, not cents", () => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
      cy.contains("Budget Utilization").parent().should("contain.text", "37.5%");
    });

    it("rounds utilization to two decimal places", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics(buildDashboardMetrics({ utilization: 37.5678 }));
      cy.visit(BUDGET);

      cy.contains("Budget Utilization").parent().should("contain.text", "37.57%");
    });

    it("shows zeroes rather than NaN when the metrics body is empty", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics({});
      cy.visit(BUDGET);

      cy.contains("Total Income").parent().should("contain.text", "$0");
      cy.contains("Total Income").parent().should("not.contain.text", "NaN");
    });

    it("renders a negative net balance", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics(buildDashboardMetrics({ net_balance: -250000 }));
      cy.visit(BUDGET);

      cy.contains("Net Balance").parent().should("contain.text", "$2,500");
    });
  });

  // ── Period switching ───────────────────────────────────────────────────────

  describe("Switching the period", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
    });

    it("re-queries metrics when a different month is picked", () => {
      cy.get("@getMetrics.all").then((before: any) => {
        cy.get('select[name="period"]').select(1);
        cy.get("@getMetrics.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("switches the window to a quarter when Quarterly is selected", () => {
      cy.contains("Quarterly").click();
      cy.get("@getMetrics.all", { timeout: 10000 }).should((interceptions: any) => {
        const spans = interceptions
          .map((i: any) => new URL(i.request.url).searchParams)
          .filter((q: URLSearchParams) => q.get("start_date"))
          .map((q: URLSearchParams) => ({
            start: q.get("start_date") as string,
            end: q.get("end_date") as string,
          }));
        // A quarter spans three months, so start and end fall in different months.
        const quarterly = spans.filter(
          (s: { start: string; end: string }) => s.start.slice(0, 7) !== s.end.slice(0, 7)
        );
        expect(quarterly, "a quarter-length window").to.have.length.greaterThan(0);
      });
    });

    it("keeps the stat cards visible while switching", () => {
      cy.contains("Quarterly").click();
      cy.contains("Total Income").should("be.visible");
    });
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────

  describe("The budget tabs", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BUDGET);
      cy.wait("@getMetrics");
    });

    it("opens on Overview", () => {
      cy.contains("Overview").should("be.visible");
    });

    it("switches to Income", () => {
      cy.contains("Income").click();
      cy.contains("Total Income").should("be.visible");
    });

    it("switches to Expenses", () => {
      cy.contains("Expenses").click();
      cy.contains("Total Expenses").should("be.visible");
    });

    it("switches to Thresholds", () => {
      cy.contains("Thresholds").click();
      cy.contains("Budget Management").should("be.visible");
    });

    it("switches to Alerts", () => {
      cy.contains("Alerts").click();
      cy.contains("Budget Management").should("be.visible");
    });

    it("reads the home record for the Thresholds tab", () => {
      cy.contains("Thresholds").click();
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });
  });

  // ── Thresholds and alerts ──────────────────────────────────────────────────

  describe("Thresholds stored on the home record", () => {
    const withThreshold = (fixedAmount: number, isEnabled = true) => {
      const now = new Date();
      const monthAbbr = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
      ][now.getUTCMonth()];
      return buildHome({
        thresholds: {
          [String(now.getUTCFullYear())]: {
            [monthAbbr]: {
              groceries: { thresholdName: "Groceries Cap", fixedAmount, isEnabled },
            },
          },
        },
      });
    };

    it("raises a critical alert when spending exceeds the cap", () => {
      // 150,000 cents = $1,500 against a $1,000 cap.
      cy.visitRevopsAs(BUDGET, "PCHO", { home: withThreshold(1000) });
      cy.wait("@getMetrics");
      cy.contains("Alerts").click();
      cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");
    });

    it("raises a warning at 80% of the cap", () => {
      // $1,500 spend against a $1,800 cap is 83%.
      cy.visitRevopsAs(BUDGET, "PCHO", { home: withThreshold(1800) });
      cy.wait("@getMetrics");
      cy.contains("Alerts").click();
      cy.contains("of the threshold", { timeout: 10000 }).should("be.visible");
    });

    it("stays quiet well below the cap", () => {
      // $1,500 spend against a $10,000 cap is 15%.
      cy.visitRevopsAs(BUDGET, "PCHO", { home: withThreshold(10000) });
      cy.wait("@getMetrics");
      cy.contains("Alerts").click();
      cy.contains("exceeded the budget limit").should("not.exist");
    });

    it("ignores a disabled threshold entirely", () => {
      cy.visitRevopsAs(BUDGET, "PCHO", { home: withThreshold(1, false) });
      cy.wait("@getMetrics");
      cy.contains("Alerts").click();
      cy.contains("exceeded the budget limit").should("not.exist");
    });

    it("lists the threshold on the Thresholds tab", () => {
      cy.visitRevopsAs(BUDGET, "PCHO", { home: withThreshold(1000) });
      cy.wait("@getMetrics");
      cy.contains("Thresholds").click();
      cy.contains("Groceries Cap", { timeout: 10000 }).should("be.visible");
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────

  describe("Role gating", () => {
    it("lets a PCHO manage the budget", () => {
      cy.visitRevopsAs(BUDGET, "PCHO");
      cy.contains("Budget Management").should("be.visible");
    });

    it("redirects a PCG away — REVOPS_BUDGET is PCHO-only", { tags: [Tags.PCG] }, () => {
      cy.visitRevopsAs(BUDGET, "PCG");
      cy.location("pathname", { timeout: 10000 }).should("not.eq", BUDGET);
    });

    it("redirects a HomeAdmin away", { tags: [Tags.HOMEADMIN] }, () => {
      cy.visitRevopsAs(BUDGET, "HomeAdmin");
      cy.location("pathname", { timeout: 10000 }).should("not.eq", BUDGET);
    });

    it("redirects a Senior away", { tags: [Tags.SENIOR] }, () => {
      cy.visitRevopsAs(BUDGET, "Senior");
      cy.location("pathname", { timeout: 10000 }).should("not.eq", BUDGET);
    });
  });
});

// ─── The RevOps landing route ────────────────────────────────────────────────

describe("RevOps — the landing route", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("sends a PCHO on to the budget screen", () => {
    cy.visitRevopsAs(REVOPS, "PCHO");
    cy.location("pathname", { timeout: 10000 }).should("eq", BUDGET);
  });

  it("keeps a PCG on the landing route — they have their own portal dashboard", { tags: [Tags.PCG] }, () => {
    cy.visitRevopsAs(REVOPS, "PCG");
    cy.location("pathname", { timeout: 10000 }).should("eq", REVOPS);
  });

  it("reads the caregiver's pay stubs for the PCG portal", { tags: [Tags.PCG] }, () => {
    cy.visitRevopsAs(REVOPS, "PCG");
    cy.wait("@getPayouts");
    cy.assertAuthorized("@getPayouts");
  });

  it("keeps a Senior on the landing route — they see their own billing dashboard", { tags: [Tags.SENIOR] }, () => {
    cy.visitRevopsAs(REVOPS, "Senior");
    cy.location("pathname", { timeout: 10000 }).should("eq", REVOPS);
  });

  /**
   * Unlike the billing and budget pages, the landing route *does* consult
   * `authorizedModules` — a home without a REVOPS licence gets the Access Denied
   * card rather than a redirect.
   */
  describe("Module entitlement", () => {
    it("shows Access Denied when the home has no REVOPS licence", { tags: [Tags.PCG] }, () => {
      cy.visitRevopsAs(REVOPS, "PCG", {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "COMPLIANCE"] }),
      });
      cy.assertRestricted();
    });

    it("does not redirect a licensed PCG to the budget screen", { tags: [Tags.PCG] }, () => {
      cy.visitRevopsAs(REVOPS, "PCG", {
        home: buildHome({ authorizedModules: ["REVOPS"] }),
      });
      cy.contains("Access Denied").should("not.exist");
    });

    it("falls back to every module when the home carries no module list", { tags: [Tags.PCG] }, () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCG");
      cy.intercept("GET", "**/v1/home/**", { statusCode: 200, body: { home: {} } }).as("getHome");
      cy.stubUsers();
      cy.stubPayouts();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics();
      cy.visit(REVOPS);

      // `useAuthorizedModules` defaults to accessAllModules, so no restriction.
      cy.contains("Access Denied").should("not.exist");
    });
  });

  it("redirects a Nurse away from RevOps entirely", { tags: [Tags.NURSE] }, () => {
    cy.visitRevopsAs(REVOPS, "Nurse");
    cy.location("pathname", { timeout: 10000 }).should("not.eq", REVOPS);
  });
});
