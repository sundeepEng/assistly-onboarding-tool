/// <reference types="cypress" />

/**
 * CRM — Sales Dashboard (pages/crm/sales-dashboard/index.tsx)
 *
 *   pages/crm/salesdasboard/sales-director-dashboard.tsx        what PCHO sees
 *   components/crm/sales-reps/sales-reps-top-bar-metrics.tsx    the four cards
 *   components/crm/sales-reps/per-rep-metrics-table.tsx         the rep table
 *   commonComponents/funnel-chart.tsx                           the pipeline
 *   commonComponents/stacked-bar-chart.tsx                      lost by rep
 *
 * ONE ROUTE, TWO DASHBOARDS
 *   `CRM_SALES_DASHBOARD` EDIT opens the route; the role then decides which
 *   component renders. A **SalesRepresentative** gets `SalesRepsDashboard`;
 *   everybody else who holds the feature — PCHO, SalesDirector, HomeAdmin —
 *   gets `SalesDirectorDashboard`. These tests are the PCHO view.
 *
 * EVERYTHING COMES FROM ONE ENDPOINT
 *   `GET /v1/crm/sales/metrics?userId&homeId&start_date&end_date` returns the
 *   whole screen: `cards`, `funnel`, `rep_performance`, `lost_by_reason` and
 *   `loss_reasons_by_rep`. Each section is derived from a different key and
 *   each has its own empty behaviour, so the stubs below hand back one key at a
 *   time rather than a single fat fixture.
 *
 * THE DATE WINDOW MOVES WITH THE CLOCK
 *   The range is "the last N days ending now", built from `new Date()`. The
 *   clock is frozen so the window is an assertion rather than today's accident,
 *   and the span is measured in days because the ISO strings are local-time
 *   dependent.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const SALES_DASHBOARD = "/crm/sales-dashboard";

/** Thu 17 Sep 2026, midday local. */
const FROZEN_NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

/** How many days a start/end pair spans. */
const spanDays = (start: string, end: string) =>
  Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const cards = (overrides: Record<string, any> = {}) => ({
  total_leads: { value: 48 },
  new_leads_7d: { value: 6 },
  new_leads_30d: { value: 19 },
  residents_boarded: { value: 11 },
  ...overrides,
});

const funnel = (overrides: Record<string, any> = {}) => ({
  initial_contact: 40,
  home_tour: 22,
  signed: 12,
  boarded: 11,
  lost: 8,
  ...overrides,
});

const repPerformance = () => [
  {
    name: "Rita Rep",
    funnel: { initial_contact: 20, home_tour: 12, signed: 7, boarded: 6, lost: 3 },
    newLeads7: 3,
    newLeads30: 10,
    conversionPercentage: 35,
    averageAge: { value: 12, unit: "days" },
  },
  {
    name: "Ravi Rep",
    funnel: { initial_contact: 20, home_tour: 10, signed: 5, boarded: 5, lost: 5 },
    newLeads7: 3,
    newLeads30: 9,
    conversionPercentage: 25,
    averageAge: { value: 18, unit: "days" },
  },
];

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  heading: () => cy.contains("Sales Dashboard"),
  rangeSelect: () => cy.get('select[name="dateRange"]'),
  addNew: () => cy.contains("button", "Add New"),
  card: (title: string) => cy.contains(title).parent(),
  panel: (heading: string) => cy.contains("h2", heading).parent(),
  chart: (heading: string) => sel.panel(heading).find("svg"),
  row: (text: string) => cy.contains(text).closest('div[class*="border-b"]'),
};

// ── Setup ────────────────────────────────────────────────────────────────────

type VisitOpts = {
  role?: any;
  metrics?: Record<string, any> | null;
  home?: any;
  delay?: number;
};

const visitSalesDashboard = (opts: VisitOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers();

  cy.intercept("GET", "**/v1/crm/sales/metrics*", {
    statusCode: 200,
    body: opts.metrics ?? {},
    ...(opts.delay ? { delay: opts.delay } : {}),
  }).as("getMetrics");

  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SALES_DASHBOARD);
};

// ═══════════════════════════════════════════════════════════════════════════

describe("CRM — Sales Dashboard", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The metrics query", () => {
    it("GETs /v1/crm/sales/metrics on load", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics");
    });

    it("scopes the query to the signed-in user", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics");
      cy.assertQuery("@getMetrics", { userId: TEST_USER_ID });
    });

    it("scopes the query to the home", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics");
      cy.assertQuery("@getMetrics", { homeId: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics");
      cy.assertAuthorized("@getMetrics");
    });

    it("sends a thirty-day window by default", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics").then((interception) => {
        const query = new URL(interception.request.url).searchParams;
        expect(
          spanDays(query.get("start_date") as string, query.get("end_date") as string)
        ).to.eq(30);
      });
    });

    it("ends the window today", () => {
      visitSalesDashboard();
      cy.wait("@getMetrics").then((interception) => {
        const query = new URL(interception.request.url).searchParams;
        const end = new Date(query.get("end_date") as string);
        expect(end.getFullYear()).to.eq(2026);
        expect(end.getMonth()).to.eq(8);
        expect(end.getDate()).to.eq(17);
      });
    });

    it("re-queries for a seven-day window", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      cy.wait("@getMetrics");
      sel.rangeSelect().select("7");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const spans = calls.map((c: any) => {
          const q = new URL(c.request.url).searchParams;
          return spanDays(q.get("start_date") as string, q.get("end_date") as string);
        });
        expect(spans, "a seven-day window").to.include(7);
      });
    });

    it("re-queries for a ninety-day window", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      cy.wait("@getMetrics");
      sel.rangeSelect().select("90");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const spans = calls.map((c: any) => {
          const q = new URL(c.request.url).searchParams;
          return spanDays(q.get("start_date") as string, q.get("end_date") as string);
        });
        expect(spans, "a ninety-day window").to.include(90);
      });
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The screen", () => {
    beforeEach(() => {
      visitSalesDashboard({ metrics: { cards: cards(), funnel: funnel() } });
      cy.wait("@getMetrics");
    });

    it("renders the page heading", () => {
      sel.heading().should("be.visible");
    });

    it("renders the strapline", () => {
      cy.contains("Monitor rep performance, stage health, and team conversion trends").should(
        "be.visible"
      );
    });

    it("offers a date-range select", () => {
      sel.rangeSelect().should("be.visible");
    });

    it("defaults the range to the last thirty days", () => {
      sel.rangeSelect().should("have.value", "30");
    });

    it("offers all three ranges", () => {
      ["Last 7 days", "Last 30 days", "Last 90 days"].forEach((label) => {
        sel.rangeSelect().should("contain.text", label);
      });
    });

    it("offers an Add New button", () => {
      sel.addNew().should("be.visible");
    });

    it("opens the Add Lead form from Add New", () => {
      sel.addNew().click();
      cy.get('input[name="firstName"]', { timeout: 10000 }).should("exist");
    });

    it("renders the Per-Rep Metrics section", () => {
      cy.contains("h2", "Per-Rep Metrics").should("be.visible");
    });

    it("renders the Pipeline Funnel section", () => {
      cy.contains("h2", "Pipeline Funnel").should("be.visible");
    });
  });

  // ── The four cards ─────────────────────────────────────────────────────────

  describe("The top-bar cards", () => {
    it("renders all four", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      ["Total Leads", "New Leads (7d)", "New Leads (30d)", "Residents Boarded"].forEach(
        (title) => {
          cy.contains(title).should("be.visible");
        }
      );
    });

    it("shows the total lead count", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      sel.card("Total Leads").should("contain.text", "48");
    });

    it("shows the seven-day count", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      sel.card("New Leads (7d)").should("contain.text", "6");
    });

    it("shows the thirty-day count", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      sel.card("New Leads (30d)").should("contain.text", "19");
    });

    it("shows the boarded count", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      sel.card("Residents Boarded").should("contain.text", "11");
    });

    it("carries each card's own caption", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      cy.contains("All leads in pipeline").should("be.visible");
      cy.contains("Added in last 7 days").should("be.visible");
      cy.contains("Successfully boarded residents").should("be.visible");
    });

    it("falls back to zero when the response carries no cards", () => {
      visitSalesDashboard({ metrics: {} });
      sel.card("Total Leads").should("contain.text", "0");
    });

    it("falls back to zero for a card the response omits", () => {
      visitSalesDashboard({ metrics: { cards: { total_leads: { value: 5 } } } });
      sel.card("Total Leads").should("contain.text", "5");
      sel.card("Residents Boarded").should("contain.text", "0");
    });

    it("renders the cards even with zero everywhere", () => {
      visitSalesDashboard({
        metrics: {
          cards: cards({
            total_leads: { value: 0 },
            new_leads_7d: { value: 0 },
            new_leads_30d: { value: 0 },
            residents_boarded: { value: 0 },
          }),
        },
      });
      cy.contains("Total Leads").should("be.visible");
    });
  });

  // ── The per-rep table ──────────────────────────────────────────────────────

  describe("The Per-Rep Metrics table", () => {
    it("renders the named columns", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      [
        "Rep",
        "Initial Contact",
        "Home Tour",
        "Contract Signed",
        "Lost",
        "New 7d",
        "New 30d",
        "Conv%",
        "Avg Age",
      ].forEach((header) => {
        cy.contains(header).should("be.visible");
      });
    });

    it("lists a rep", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      cy.contains("Rita Rep").should("be.visible");
    });

    it("lists every rep", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      cy.contains("Rita Rep").should("be.visible");
      cy.contains("Ravi Rep").should("be.visible");
    });

    it("shows a rep's funnel figures", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      sel.row("Rita Rep").should("contain.text", "20");
      sel.row("Rita Rep").should("contain.text", "12");
    });

    it("shows a rep's new-lead counts", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      sel.row("Rita Rep").should("contain.text", "10");
    });

    it("shows a rep's conversion percentage", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      sel.row("Rita Rep").should("contain.text", "35");
    });

    it("shows a rep's average lead age", () => {
      visitSalesDashboard({ metrics: { rep_performance: repPerformance() } });
      sel.row("Rita Rep").should("contain.text", "12");
    });

    it("defaults a rep's missing figures to zero rather than blank", () => {
      visitSalesDashboard({
        metrics: { rep_performance: [{ name: "Bare Rep" }] },
      });
      sel.row("Bare Rep").should("contain.text", "0");
    });

    it("survives a rep with no name", () => {
      visitSalesDashboard({ metrics: { rep_performance: [{ funnel: {} }] } });
      cy.contains("h2", "Per-Rep Metrics").should("be.visible");
    });

    it("shows the table's empty message when no rep performed", () => {
      visitSalesDashboard({ metrics: { rep_performance: [] } });
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("still renders the section heading with no reps", () => {
      visitSalesDashboard({ metrics: {} });
      cy.contains("h2", "Per-Rep Metrics").should("be.visible");
    });
  });

  // ── The funnel ─────────────────────────────────────────────────────────────

  describe("The Pipeline Funnel", () => {
    it("draws a chart once there is a funnel", () => {
      visitSalesDashboard({ metrics: { funnel: funnel() } });
      sel.chart("Pipeline Funnel").should("exist");
    });

    it("names its four stages", () => {
      visitSalesDashboard({ metrics: { funnel: funnel() } });
      ["Initial Contact", "Home Tour", "Agreement Signed", "Lost"].forEach((label) => {
        sel.chart("Pipeline Funnel").should("contain.text", label);
      });
    });

    it("shows each stage's count", () => {
      visitSalesDashboard({ metrics: { funnel: funnel() } });
      sel.chart("Pipeline Funnel").should("contain.text", "40");
      sel.chart("Pipeline Funnel").should("contain.text", "22");
      sel.chart("Pipeline Funnel").should("contain.text", "12");
      sel.chart("Pipeline Funnel").should("contain.text", "8");
    });

    it("leaves Boarded out — it is commented out of the stage list", () => {
      visitSalesDashboard({ metrics: { funnel: funnel() } });
      sel.panel("Pipeline Funnel").should("not.contain.text", "Boarded");
    });

    it("defaults a missing stage to zero", () => {
      visitSalesDashboard({ metrics: { funnel: { initial_contact: 40 } } });
      sel.chart("Pipeline Funnel").should("contain.text", "40");
      sel.chart("Pipeline Funnel").should("contain.text", "0");
    });

    it("still renders the heading with no funnel at all", () => {
      visitSalesDashboard({ metrics: {} });
      cy.contains("h2", "Pipeline Funnel").should("be.visible");
    });
  });

  // ── Loss analysis ──────────────────────────────────────────────────────────

  describe("Why Leads Were Lost", () => {
    it("appears once there are loss reasons", () => {
      visitSalesDashboard({
        metrics: { lost_by_reason: { "Too expensive": 5, "Chose another home": 3 } },
      });
      cy.contains("h2", "Why Leads Were Lost").should("be.visible");
    });

    it("names each reason on the axis", () => {
      visitSalesDashboard({
        metrics: { lost_by_reason: { "Too expensive": 5, "Chose another home": 3 } },
      });
      sel.chart("Why Leads Were Lost").should("contain.text", "Too expensive");
    });

    it("stays hidden when there are no loss reasons", () => {
      visitSalesDashboard({ metrics: { lost_by_reason: {} } });
      cy.contains("h2", "Why Leads Were Lost").should("not.exist");
    });

    it("stays hidden when the key is absent", () => {
      visitSalesDashboard({ metrics: { cards: cards() } });
      cy.contains("h2", "Why Leads Were Lost").should("not.exist");
    });
  });

  describe("Lost Reasons by Rep", () => {
    const byRep = () => [
      { name: "Rita Rep", lost_by_reason: { "Too expensive": 2, "Location": 1 } },
      { name: "Ravi Rep", lost_by_reason: { "Too expensive": 3 } },
    ];

    it("appears once there are per-rep reasons", () => {
      visitSalesDashboard({ metrics: { loss_reasons_by_rep: byRep() } });
      cy.contains("h2", "Lost Reasons by Rep").should("be.visible");
    });

    it("names each rep", () => {
      visitSalesDashboard({ metrics: { loss_reasons_by_rep: byRep() } });
      sel.chart("Lost Reasons by Rep").should("contain.text", "Rita Rep");
    });

    it("stays hidden when the list is empty", () => {
      visitSalesDashboard({ metrics: { loss_reasons_by_rep: [] } });
      cy.contains("h2", "Lost Reasons by Rep").should("not.exist");
    });

    it("stays hidden when every rep has no reasons", () => {
      visitSalesDashboard({
        metrics: { loss_reasons_by_rep: [{ name: "Rita Rep", lost_by_reason: {} }] },
      });
      cy.contains("h2", "Lost Reasons by Rep").should("not.exist");
    });

    it("drops a rep with no reasons but keeps one that has them", () => {
      visitSalesDashboard({
        metrics: {
          loss_reasons_by_rep: [
            { name: "Quiet Rep", lost_by_reason: {} },
            { name: "Rita Rep", lost_by_reason: { "Too expensive": 2 } },
          ],
        },
      });
      sel.chart("Lost Reasons by Rep").should("contain.text", "Rita Rep");
      sel.chart("Lost Reasons by Rep").should("not.contain.text", "Quiet Rep");
    });
  });

  // ── Loading and emptiness ──────────────────────────────────────────────────

  describe("While the metrics are in flight", () => {
    it("shows a loader instead of the sections", () => {
      visitSalesDashboard({ metrics: { cards: cards() }, delay: 1500 });
      cy.contains("h2", "Per-Rep Metrics").should("not.exist");
    });

    it("keeps the heading and the range select visible", () => {
      visitSalesDashboard({ metrics: { cards: cards() }, delay: 1500 });
      sel.heading().should("be.visible");
      sel.rangeSelect().should("be.visible");
    });

    it("reveals the sections once it lands", () => {
      visitSalesDashboard({ metrics: { cards: cards() }, delay: 800 });
      cy.contains("h2", "Per-Rep Metrics", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("An empty response", () => {
    it("still renders the four cards at zero", () => {
      visitSalesDashboard({ metrics: {} });
      sel.card("Total Leads").should("contain.text", "0");
    });

    it("still renders the funnel heading", () => {
      visitSalesDashboard({ metrics: {} });
      cy.contains("h2", "Pipeline Funnel").should("be.visible");
    });

    it("hides both loss panels", () => {
      visitSalesDashboard({ metrics: {} });
      cy.contains("h2", "Why Leads Were Lost").should("not.exist");
      cy.contains("h2", "Lost Reasons by Rep").should("not.exist");
    });

    it("never renders NaN", () => {
      visitSalesDashboard({ metrics: {} });
      cy.contains("NaN").should("not.exist");
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────

  describe("Role gating", () => {
    it("gives a PCHO the director dashboard", () => {
      visitSalesDashboard({ role: "PCHO", metrics: { cards: cards() } });
      sel.heading().should("be.visible");
      cy.contains("Monitor rep performance").should("be.visible");
    });

    it("gives a SalesDirector the same view", () => {
      visitSalesDashboard({ role: "SalesDirector", metrics: { cards: cards() } });
      cy.contains("Monitor rep performance").should("be.visible");
    });

    it("gives a SalesRepresentative a different dashboard", () => {
      visitSalesDashboard({ role: "SalesRepresentative", metrics: { cards: cards() } });
      cy.contains("Monitor rep performance, stage health, and team conversion trends").should(
        "not.exist"
      );
    });

    it("keeps a SalesRepresentative on the route", () => {
      visitSalesDashboard({ role: "SalesRepresentative", metrics: { cards: cards() } });
      cy.location("pathname", { timeout: 10000 }).should("eq", SALES_DASHBOARD);
    });

    it("redirects a PCG away", { tags: [Tags.PCG] }, () => {
      visitSalesDashboard({ role: "PCG" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", SALES_DASHBOARD);
    });

    it("redirects a Nurse away", { tags: [Tags.NURSE] }, () => {
      visitSalesDashboard({ role: "Nurse" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", SALES_DASHBOARD);
    });
  });

  // ── Failure handling ───────────────────────────────────────────────────────

  describe("When the API fails", () => {
    it("still renders the screen", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.intercept("GET", "**/v1/crm/sales/metrics*", {
        statusCode: 500,
        body: { error: "metrics unavailable" },
      }).as("getMetrics");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(SALES_DASHBOARD);

      sel.heading().should("be.visible");
    });

    it("falls back to zeroes on the cards", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.intercept("GET", "**/v1/crm/sales/metrics*", {
        statusCode: 500,
        body: { error: "metrics unavailable" },
      }).as("getMetrics");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(SALES_DASHBOARD);

      cy.contains("Total Leads", { timeout: 10000 }).parent().should("contain.text", "0");
    });
  });
});
