/// <reference types="cypress" />

/**
 * RevOps — Budget: the Overview tab
 *
 *   components/revops/budget/budget-overview.tsx  the tab
 *   commonComponents/budget-category-card.tsx     one category card
 *   commonComponents/pie-chart.tsx                the two distributions
 *   commonComponents/bar-chart.tsx                the two forecast charts
 *   utils/budget-utils.ts                         the category lists and colours
 *
 * The Overview tab is a read-out, not a worklist: nothing is created here. So
 * this spec is almost entirely about ONE question — does every number land in
 * the right category, on the right side, in the right unit?
 *
 * WHERE EACH FIGURE COMES FROM
 *   The tab reads three sources at once and puts them in the same card:
 *
 *     Income  Actual      (budget_income_<cat> + invoice_income_<cat>) / 100
 *     Expense Actual      budget_expense_<cat> / 100   ← from the metrics
 *     Payroll Actual      expense_payroll / 100        ← from the LEDGER instead
 *     Forecasted/Budgeted home.budget[year][mon][income|expense][camelKey]
 *
 *   Metrics are in **cents**; the home's forecasts are in **dollars**. Mixing
 *   the two up is the single most likely regression here, which is why every
 *   card assertion below states both numbers.
 *
 * THE CARD LIST IS FIXED, NOT DERIVED
 *   `ALL_INCOME_CATEGORY_KEYS` and `ALL_EXPENSE_CATEGORY_KEYS` come from the
 *   colour map, so the tab always renders **six** income cards and **seven**
 *   expense cards whether or not any money moved. The charts are the opposite:
 *   they drop anything with no actual, which is what makes the empty states
 *   reachable.
 *
 * FOUR CATEGORY NAMES APPEAR TWICE
 *   Entertainment, Transport, Medical and Misc are both an income category and
 *   an expense one, so every card lookup is scoped to its column first.
 *
 * The numbers used throughout are the ones in the screenshots this spec was
 * written from, so a failure reads against a real home rather than a fixture.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const BUDGET = "/revops/budget";

/** Thu 17 Sep 2026, midday local — the month the screenshots were taken in. */
const FROZEN_NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

/**
 * How `budget-category-card.tsx` formats money.
 *
 * `formatCurrency` in budget-utils passes no locale, so the output follows the
 * browser's. Computing the expectation the same way keeps these assertions
 * honest away from en-US.
 */
const money = (value: number) =>
  value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A metrics body carrying only what a test sets.
 *
 * Deliberately not `buildDashboardMetrics()` — that fixture seeds groceries and
 * utilities, which would quietly populate cards a test meant to leave empty.
 */
const metrics = (overrides: Record<string, any> = {}) => ({
  total_income: 0,
  total_expense: 0,
  net_balance: 0,
  utilization: 0,
  ...overrides,
});

/** The income figures from the screenshots, in **cents**. */
const SCREENSHOT_INCOME = {
  budget_income_care_fee: 15000,
  budget_income_monthly_fee: 22025,
  budget_income_entertainment: 10000,
  budget_income_transport: 20500,
  budget_income_medical: 57200,
  budget_income_misc: 14900,
};

/** The expense figures from the screenshots, in **cents** (payroll excepted). */
const SCREENSHOT_EXPENSE = {
  budget_expense_groceries: 12500,
  budget_expense_utilities: 5500,
  budget_expense_entertainment: 2500,
  budget_expense_transport: 2800,
  budget_expense_medical: 10000,
  budget_expense_misc: 5400,
};

/** `expense_payroll` from the screenshots — $638.17 in cents. */
const SCREENSHOT_PAYROLL = 63817;

/** A home carrying forecasts for September 2026. */
const homeWithForecasts = (sep: { income?: Record<string, number>; expense?: Record<string, number> }) =>
  buildHome({ budget: { "2026": { sep } } });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  tab: (label: string) => cy.contains("span.text-xl", new RegExp(`^${label}$`)),
  monthlyToggle: () => cy.contains("div", /^Monthly$/),
  quarterlyToggle: () => cy.contains("div", /^Quarterly$/),
  periodSelect: () => cy.get('select[name="period"]'),

  /** The div a chart heading owns — holds either the svg or the empty state. */
  panel: (heading: string) => cy.contains("h2", heading).parent(),
  chart: (heading: string) => sel.panel(heading).find("svg"),

  /**
   * The two card columns.
   *
   * Four category names appear on both sides, so nothing may be looked up
   * without going through one of these first.
   */
  incomeColumn: () => cy.contains("h2", "Income Categories").parent(),
  expenseColumn: () => cy.contains("h2", "Expense Categories").parent(),

  incomeCard: (title: string) =>
    sel.incomeColumn().contains("h3", new RegExp(`^${title}$`)).closest("div.border"),
  expenseCard: (title: string) =>
    sel.expenseColumn().contains("h3", new RegExp(`^${title}$`)).closest("div.border"),

  /** The forecast editor, which only exists in monthly view. */
  pencil: (card: Cypress.Chainable<JQuery<HTMLElement>>) =>
    card.find('button[title="Edit category"]'),
  modal: () => cy.get(".ReactModal__Content", { timeout: 10000 }),
  forecastInput: () => cy.get('input[name="primaryValue"]'),
  /**
   * The progress indicator inside a card.
   *
   * Radix's `Progress.Root` does not render `aria-valuenow` in this build, so
   * the assertion goes on the transform the component itself writes:
   * `translateX(-${100 - value}%)`.
   */
  progress: (card: Cypress.Chainable<JQuery<HTMLElement>>) =>
    card.find("div.bg-primary\\/65"),
};

/**
 * Read one labelled row out of a category card.
 *
 * Each row is `<div class="flex justify-between"><span>Label:</span><span>$…</span></div>`,
 * so the label's parent is the pair.
 */
const cardRow = (card: Cypress.Chainable<JQuery<HTMLElement>>, label: string) =>
  card.contains("span", new RegExp(`^${label}:$`)).parent();

// ── Setup ────────────────────────────────────────────────────────────────────

type OverviewOpts = {
  role?: any;
  /** The home record — where forecasts live. */
  home?: any;
  /** The dashboard-metrics body. Cents. */
  metrics?: Record<string, any>;
  /** `expense_payroll` on the expense ledger. Cents. Omit to send no key. */
  payroll?: number;
  /** Rows on the expense ledger — only the Expenses tab reads these. */
  expenses?: any[];
  /** Rows on the income ledger. */
  income?: any[];
};

const visitOverview = (opts: OverviewOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers();

  cy.intercept(
    { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
    { statusCode: 200, body: { budgets: opts.income ?? [], income_invoice: 0 } }
  ).as("getIncome");

  cy.intercept(
    { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
    {
      statusCode: 200,
      body: {
        budgets: opts.expenses ?? [],
        ...(opts.payroll === undefined ? {} : { expense_payroll: opts.payroll }),
      },
    }
  ).as("getExpenses");

  cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
    statusCode: 200,
    body: opts.metrics ?? metrics(),
  }).as("getMetrics");

  // A 1280x800 viewport is too small for this module: the taller modals push
  // their submit row below the fold, and the wider tables push the Actions
  // column outside the horizontal scroll window — so Cypress refuses to call
  // those elements visible for reasons that have nothing to do with the app.
  // Give the tests room rather than reaching for `force: true`, which would
  // hide a genuine coverage bug.
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(BUDGET);
  cy.contains("Budget Overview", { timeout: 10000 }).should("be.visible");
};

/** The home is only PUT when a forecast is edited. */
const stubWrites = () => {
  cy.intercept("PUT", "**/v1/home", { statusCode: 200, body: {} }).as("upsertHome");
};

/** Land on the Overview with every figure from the screenshots in place. */
const visitScreenshot = () =>
  visitOverview({
    metrics: metrics({ ...SCREENSHOT_INCOME, ...SCREENSHOT_EXPENSE }),
    payroll: SCREENSHOT_PAYROLL,
    home: homeWithForecasts({ expense: { payroll: 100 } }),
  });

// ═══════════════════════════════════════════════════════════════════════════
// The tab itself
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: the screen", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Layout", () => {
    beforeEach(() => {
      visitScreenshot();
    });

    it("is the tab the screen lands on", () => {
      sel.tab("Overview").parent().should("have.class", "border-primary");
    });

    it("renders its own heading", () => {
      cy.contains("h1", "Budget Overview").should("be.visible");
    });

    it("renders the two distribution headings", () => {
      cy.contains("h2", "Income Distribution").should("be.visible");
      cy.contains("h2", "Expense Distribution").should("be.visible");
    });

    it("renders the two comparison headings", () => {
      cy.contains("h2", "Income - Forecast vs Actual").should("be.visible");
      cy.contains("h2", "Expense - Budgeted vs Actual").should("be.visible");
    });

    it("renders the two category-column headings", () => {
      cy.contains("h2", "Income Categories").should("be.visible");
      cy.contains("h2", "Expense Categories").should("be.visible");
    });

    it("reads the home record for the forecasts", () => {
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });

    it("reads the expense ledger for the payroll figure", () => {
      cy.wait("@getExpenses");
      cy.assertAuthorized("@getExpenses");
    });

    it("offers nothing to create — the tab is a read-out", () => {
      ["Add Income", "Add Expense", "Add Threshold"].forEach((name) => {
        cy.contains("button", name).should("not.exist");
      });
    });

    it("offers no Download PDF — it is commented out in source", () => {
      cy.contains("button", "Download PDF").should("not.exist");
    });

    it("keeps the period selector and the stat row above it", () => {
      sel.periodSelect().should("have.value", "2026-09");
      cy.contains("Budget Utilization").should("be.visible");
    });

    it("does not query the income ledger — Overview never needs it", () => {
      cy.assertNoRequest("@getIncome");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Income category cards
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: income category cards", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("The fixed set of six", () => {
    beforeEach(() => {
      visitOverview();
    });

    it("renders a card for every known income category", () => {
      ["Care Fee", "Monthly Fee", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (title) => {
          sel.incomeCard(title).should("exist");
        }
      );
    });

    it("renders exactly six", () => {
      sel.incomeColumn().find("h3").should("have.length", 6);
    });

    it("lists them in the colour map's order", () => {
      sel.incomeColumn()
        .find("h3")
        .then(($titles) => {
          expect([...$titles].map((t) => t.textContent)).to.deep.eq([
            "Care Fee",
            "Monthly Fee",
            "Entertainment",
            "Transport",
            "Medical",
            "Misc",
          ]);
        });
    });

    it("renders them all even with no data whatsoever", () => {
      sel.incomeCard("Medical").should("be.visible");
    });

    it("offers no expense-only category on the income side", () => {
      sel.incomeColumn().should("not.contain.text", "Groceries");
      sel.incomeColumn().should("not.contain.text", "Utilities");
      sel.incomeColumn().should("not.contain.text", "Payroll");
    });

    it("tags every card as income", () => {
      sel.incomeCard("Care Fee").should("contain.text", "income");
    });

    it("labels the forecast Forecasted, not Budgeted", () => {
      sel.incomeCard("Care Fee").should("contain.text", "Forecasted:");
      sel.incomeCard("Care Fee").should("not.contain.text", "Budgeted:");
    });

    it("labels the difference Over Forecast, not Remaining", () => {
      sel.incomeCard("Care Fee").should("contain.text", "Over Forecast:");
      sel.incomeCard("Care Fee").should("not.contain.text", "Remaining:");
    });

    it("carries all four labelled rows", () => {
      ["Forecasted:", "Actual:", "Over Forecast:", "Utilization:"].forEach((label) => {
        sel.incomeCard("Care Fee").should("contain.text", label);
      });
    });
  });

  describe("Where Actual comes from", () => {
    it("converts budget-entered income from cents", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(150));
    });

    it("counts invoiced income for the same category", () => {
      visitOverview({ metrics: metrics({ invoice_income_care_fee: 250000 }) });
      cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(2500));
    });

    it("adds the two together", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 15000, invoice_income_care_fee: 250000 }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(2650));
    });

    it("reads zero when neither key is present", () => {
      visitOverview({ metrics: metrics() });
      cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(0));
    });

    it("keeps cents", () => {
      visitOverview({ metrics: metrics({ budget_income_monthly_fee: 22025 }) });
      cardRow(sel.incomeCard("Monthly Fee"), "Actual").should("contain.text", money(220.25));
    });

    it("separates thousands", () => {
      visitOverview({ metrics: metrics({ budget_income_medical: 1234500 }) });
      cardRow(sel.incomeCard("Medical"), "Actual").should("contain.text", "$12,345.00");
    });

    it("reads the two-word category's snake_case key", () => {
      visitOverview({ metrics: metrics({ budget_income_monthly_fee: 50000 }) });
      cardRow(sel.incomeCard("Monthly Fee"), "Actual").should("contain.text", money(500));
    });

    it("never renders NaN for a null figure", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: null }) });
      sel.incomeCard("Care Fee").should("not.contain.text", "NaN");
    });

    it("keeps one category's money off another's card", () => {
      visitOverview({ metrics: metrics({ budget_income_medical: 57200 }) });
      cardRow(sel.incomeCard("Medical"), "Actual").should("contain.text", money(572));
      cardRow(sel.incomeCard("Misc"), "Actual").should("contain.text", money(0));
    });

    it("does not read an expense key onto an income card", () => {
      visitOverview({ metrics: metrics({ budget_expense_medical: 99900 }) });
      cardRow(sel.incomeCard("Medical"), "Actual").should("contain.text", money(0));
    });

    it("fills every card from the same body", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(150));
      cardRow(sel.incomeCard("Monthly Fee"), "Actual").should("contain.text", money(220.25));
      cardRow(sel.incomeCard("Entertainment"), "Actual").should("contain.text", money(100));
      cardRow(sel.incomeCard("Transport"), "Actual").should("contain.text", money(205));
      cardRow(sel.incomeCard("Medical"), "Actual").should("contain.text", money(572));
      cardRow(sel.incomeCard("Misc"), "Actual").should("contain.text", money(149));
    });
  });

  describe("Where Forecasted comes from", () => {
    it("reads the home's budget for the month", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(500));
    });

    it("treats the home's figure as dollars, not cents", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("not.contain.text", "$5.00");
    });

    it("camel-cases the two-word category's key", () => {
      visitOverview({ home: homeWithForecasts({ income: { monthlyFee: 750 } }) });
      cardRow(sel.incomeCard("Monthly Fee"), "Forecasted").should("contain.text", money(750));
    });

    it("reads zero when the home carries no budget at all", () => {
      visitOverview({ home: buildHome() });
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(0));
    });

    it("reads zero when the home has a budget for another year", () => {
      visitOverview({ home: buildHome({ budget: { "2025": { sep: { income: { careFee: 500 } } } } }) });
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(0));
    });

    it("reads zero when the home has a budget for another month", () => {
      visitOverview({ home: buildHome({ budget: { "2026": { jul: { income: { careFee: 500 } } } } }) });
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(0));
    });

    it("picks it up once that month is selected", () => {
      visitOverview({ home: buildHome({ budget: { "2026": { jul: { income: { careFee: 500 } } } } }) });
      sel.periodSelect().select("2026-07");
      cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(500));
    });

    it("does not read an expense forecast onto an income card", () => {
      visitOverview({ home: homeWithForecasts({ expense: { medical: 900 } }) });
      cardRow(sel.incomeCard("Medical"), "Forecasted").should("contain.text", money(0));
    });

    it("leaves the other categories at zero", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      cardRow(sel.incomeCard("Misc"), "Forecasted").should("contain.text", money(0));
    });
  });

  describe("Over Forecast", () => {
    it("shows what is still to come when income is under forecast", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 30000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast").should("contain.text", money(200));
    });

    it("colours a shortfall green", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 30000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast")
        .find("span.text-green-600")
        .should("exist");
    });

    it("shows the overshoot when income beats the forecast", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 70000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast").should("contain.text", money(200));
    });

    it("colours an overshoot red", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 70000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast")
        .find("span.text-red-600")
        .should("exist");
    });

    it("reads zero and green when the two match", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 50000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast").should("contain.text", money(0));
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast")
        .find("span.text-green-600")
        .should("exist");
    });

    it("[as-built] shows any income at all as red Over Forecast when nothing was forecast", () => {
      // The difference is `forecast - actual` rendered through `Math.abs`, so an
      // unforecast category reports every dollar it earned as an overshoot —
      // the screenshots' "Over Forecast: $150.00" in red against a $0 forecast.
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast").should("contain.text", money(150));
      cardRow(sel.incomeCard("Care Fee"), "Over Forecast")
        .find("span.text-red-600")
        .should("exist");
    });
  });

  describe("Utilization", () => {
    it("is the actual as a percentage of the forecast", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 25000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "50.0%");
    });

    it("always carries one decimal place", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 50000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "100.0%");
    });

    it("rounds to that one decimal", () => {
      // $333.33 of a $500 forecast is 66.666%.
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 33333 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "66.7%");
    });

    it("goes past 100% rather than capping", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 75000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "150.0%");
    });

    it("reads NA when nothing was forecast", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "NA");
    });

    it("reads NA rather than 0% for a category with neither figure", () => {
      visitOverview({ metrics: metrics() });
      cardRow(sel.incomeCard("Misc"), "Utilization").should("contain.text", "NA");
    });

    it("reads 0.0% when a forecast was set and nothing earned", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      cardRow(sel.incomeCard("Care Fee"), "Utilization").should("contain.text", "0.0%");
    });
  });

  describe("The progress bar", () => {
    it("half-fills the bar at half utilization", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 25000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      sel.progress(sel.incomeCard("Care Fee"))
        .should("have.attr", "style")
        .and("contain", "translateX(-50%)");
    });

    it("caps at 100 even when utilization does not", () => {
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 75000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      // Written as `translateX(-0%)`; the browser normalises it to `0%`.
      sel.progress(sel.incomeCard("Care Fee"))
        .should("have.attr", "style")
        .and("contain", "translateX(0%)");
    });

    it("sits at zero for an NA utilization", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      sel.progress(sel.incomeCard("Care Fee"))
        .should("have.attr", "style")
        .and("contain", "translateX(-100%)");
    });

    it("sits at zero when nothing was earned", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      sel.progress(sel.incomeCard("Care Fee"))
        .should("have.attr", "style")
        .and("contain", "translateX(-100%)");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Expense category cards
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: expense category cards", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("The fixed set of seven", () => {
    beforeEach(() => {
      visitOverview({ payroll: 0 });
    });

    it("renders a card for every known expense category", () => {
      [
        "Payroll",
        "Groceries",
        "Utilities",
        "Entertainment",
        "Transport",
        "Medical",
        "Misc",
      ].forEach((title) => {
        sel.expenseCard(title).should("exist");
      });
    });

    it("renders exactly seven", () => {
      sel.expenseColumn().find("h3").should("have.length", 7);
    });

    it("puts Payroll first", () => {
      sel.expenseColumn()
        .find("h3")
        .then(($titles) => {
          expect([...$titles][0].textContent).to.eq("Payroll");
        });
    });

    it("lists them in the colour map's order", () => {
      sel.expenseColumn()
        .find("h3")
        .then(($titles) => {
          expect([...$titles].map((t) => t.textContent)).to.deep.eq([
            "Payroll",
            "Groceries",
            "Utilities",
            "Entertainment",
            "Transport",
            "Medical",
            "Misc",
          ]);
        });
    });

    it("offers no income-only category on the expense side", () => {
      sel.expenseColumn().should("not.contain.text", "Care Fee");
      sel.expenseColumn().should("not.contain.text", "Monthly Fee");
    });

    it("tags every card as expense", () => {
      sel.expenseCard("Groceries").should("contain.text", "expense");
    });

    it("labels the forecast Budgeted, not Forecasted", () => {
      sel.expenseCard("Groceries").should("contain.text", "Budgeted:");
      sel.expenseCard("Groceries").should("not.contain.text", "Forecasted:");
    });

    it("labels the difference Remaining, not Over Forecast", () => {
      sel.expenseCard("Groceries").should("contain.text", "Remaining:");
      sel.expenseCard("Groceries").should("not.contain.text", "Over Forecast:");
    });

    it("carries all four labelled rows", () => {
      ["Budgeted:", "Actual:", "Remaining:", "Utilization:"].forEach((label) => {
        sel.expenseCard("Groceries").should("contain.text", label);
      });
    });
  });

  describe("Where Actual comes from", () => {
    it("converts the metrics figure from cents", () => {
      visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Actual").should("contain.text", money(125));
    });

    it("reads zero for a category the metrics do not mention", () => {
      visitOverview({ metrics: metrics(), payroll: 0 });
      cardRow(sel.expenseCard("Utilities"), "Actual").should("contain.text", money(0));
    });

    it("keeps one category's spend off another's card", () => {
      visitOverview({ metrics: metrics({ budget_expense_utilities: 5500 }), payroll: 0 });
      cardRow(sel.expenseCard("Utilities"), "Actual").should("contain.text", money(55));
      cardRow(sel.expenseCard("Medical"), "Actual").should("contain.text", money(0));
    });

    it("does not read an income key onto an expense card", () => {
      visitOverview({ metrics: metrics({ budget_income_medical: 99900 }), payroll: 0 });
      cardRow(sel.expenseCard("Medical"), "Actual").should("contain.text", money(0));
    });

    it("fills every card from the same body", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Actual").should("contain.text", money(125));
      cardRow(sel.expenseCard("Utilities"), "Actual").should("contain.text", money(55));
      cardRow(sel.expenseCard("Entertainment"), "Actual").should("contain.text", money(25));
      cardRow(sel.expenseCard("Transport"), "Actual").should("contain.text", money(28));
      cardRow(sel.expenseCard("Medical"), "Actual").should("contain.text", money(100));
      cardRow(sel.expenseCard("Misc"), "Actual").should("contain.text", money(54));
    });

    it("separates thousands", () => {
      visitOverview({ metrics: metrics({ budget_expense_groceries: 1234500 }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Actual").should("contain.text", "$12,345.00");
    });
  });

  describe("Payroll is the exception", () => {
    it("takes its actual from the ledger, not the metrics", () => {
      visitOverview({ payroll: SCREENSHOT_PAYROLL });
      cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(638.17));
    });

    it("ignores a budget_expense_payroll key on the metrics", () => {
      visitOverview({ metrics: metrics({ budget_expense_payroll: 999900 }), payroll: 50000 });
      cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(500));
    });

    it("converts the ledger figure from cents", () => {
      visitOverview({ payroll: 100000 });
      cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(1000));
    });

    it("reads zero when no wages were paid", () => {
      visitOverview({ payroll: 0 });
      cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(0));
    });

    it("reads zero rather than NaN when the ledger omits the key", () => {
      // `payrollAmount` is `undefined / 100` — NaN — but the card coerces it
      // with `payrollAmount || 0`, so this tab survives what the Expenses tab
      // does not.
      visitOverview({});
      cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(0));
      sel.expenseCard("Payroll").should("not.contain.text", "NaN");
    });

    it("still reads its budget from the home record", () => {
      visitOverview({
        payroll: SCREENSHOT_PAYROLL,
        home: homeWithForecasts({ expense: { payroll: 100 } }),
      });
      cardRow(sel.expenseCard("Payroll"), "Budgeted").should("contain.text", money(100));
    });
  });

  describe("Where Budgeted comes from", () => {
    it("reads the home's budget for the month", () => {
      visitOverview({ home: homeWithForecasts({ expense: { groceries: 600 } }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Budgeted").should("contain.text", money(600));
    });

    it("treats the home's figure as dollars", () => {
      visitOverview({ home: homeWithForecasts({ expense: { groceries: 600 } }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Budgeted").should("not.contain.text", "$6.00");
    });

    it("reads zero when the home carries no budget", () => {
      visitOverview({ payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Budgeted").should("contain.text", money(0));
    });

    it("does not read an income forecast onto an expense card", () => {
      visitOverview({ home: homeWithForecasts({ income: { medical: 900 } }), payroll: 0 });
      cardRow(sel.expenseCard("Medical"), "Budgeted").should("contain.text", money(0));
    });
  });

  describe("Remaining", () => {
    it("shows what is left when spending is under budget", () => {
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 20000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Remaining").should("contain.text", money(400));
    });

    it("colours what is left green", () => {
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 20000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Remaining")
        .find("span.text-green-600")
        .should("exist");
    });

    it("reads zero and green when the budget is spent exactly", () => {
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 60000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Remaining").should("contain.text", money(0));
      cardRow(sel.expenseCard("Groceries"), "Remaining")
        .find("span.text-green-600")
        .should("exist");
    });

    it("colours an overspend red", () => {
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 80000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Remaining")
        .find("span.text-red-600")
        .should("exist");
    });

    it("[as-built] prints an overspend as a positive Remaining", () => {
      // `Math.abs(budget - actual)` drops the sign, so $800 spent against a
      // $600 budget reads "Remaining: $200.00" — which says the opposite of
      // what happened. Only the red colour distinguishes it.
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 80000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Remaining").should("contain.text", money(200));
      cardRow(sel.expenseCard("Groceries"), "Remaining").should("not.contain.text", "-");
    });

    it("[as-built] reports all of an unbudgeted category's spend as Remaining", () => {
      // The screenshots' "Groceries — Budgeted $0.00, Actual $125.00,
      // Remaining $125.00" in red.
      visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Remaining").should("contain.text", money(125));
      cardRow(sel.expenseCard("Groceries"), "Remaining")
        .find("span.text-red-600")
        .should("exist");
    });
  });

  describe("Utilization", () => {
    it("is the spend as a percentage of the budget", () => {
      visitOverview({
        metrics: metrics({ budget_expense_groceries: 30000 }),
        home: homeWithForecasts({ expense: { groceries: 600 } }),
        payroll: 0,
      });
      cardRow(sel.expenseCard("Groceries"), "Utilization").should("contain.text", "50.0%");
    });

    it("goes past 100% on an overspend", () => {
      visitOverview({
        payroll: SCREENSHOT_PAYROLL,
        home: homeWithForecasts({ expense: { payroll: 100 } }),
      });
      cardRow(sel.expenseCard("Payroll"), "Utilization").should("contain.text", "638.2%");
    });

    it("reads NA when nothing was budgeted", () => {
      visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Utilization").should("contain.text", "NA");
    });

    it("reads 0.0% when a budget was set and nothing spent", () => {
      visitOverview({ home: homeWithForecasts({ expense: { groceries: 600 } }), payroll: 0 });
      cardRow(sel.expenseCard("Groceries"), "Utilization").should("contain.text", "0.0%");
    });

    it("caps the progress bar at 100 while the figure runs on", () => {
      visitOverview({
        payroll: SCREENSHOT_PAYROLL,
        home: homeWithForecasts({ expense: { payroll: 100 } }),
      });
      sel.progress(sel.expenseCard("Payroll"))
        .should("have.attr", "style")
        .and("contain", "translateX(0%)");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The distribution pies
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: the distribution charts", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Income Distribution", () => {
    it("draws a chart once there is income", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income Distribution").should("exist");
    });

    it("legends every category that earned something", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      ["Care Fee", "Monthly Fee", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (label) => {
          sel.chart("Income Distribution").should("contain.text", label);
        }
      );
    });

    it("leaves out a category that earned nothing", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      sel.chart("Income Distribution").should("contain.text", "Care Fee");
      sel.chart("Income Distribution").should("not.contain.text", "Medical");
    });

    it("leaves out a category that was only forecast", () => {
      // A pie slice of zero is meaningless, so forecast alone does not qualify.
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 15000 }),
        home: homeWithForecasts({ income: { medical: 900 } }),
      });
      sel.chart("Income Distribution").should("not.contain.text", "Medical");
    });

    it("draws a single-category ring", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      sel.chart("Income Distribution").find("path").should("have.length", 1);
    });

    it("draws one slice per earning category", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income Distribution").find("path").should("have.length", 6);
    });

    it("labels a slice with its share of the total", () => {
      // $150 of $1,396.25 is 10.7%.
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income Distribution").should("contain.text", "10.7%");
    });

    it("labels the largest slice", () => {
      // $572 of $1,396.25 is 41.0%.
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income Distribution").should("contain.text", "41.0%");
    });

    it("hides the label on a slice under 5%", () => {
      // $10 of $1,010 is 1%.
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 100000, budget_income_misc: 1000 }),
      });
      sel.chart("Income Distribution").should("not.contain.text", "1.0%");
    });

    it("says so when nothing came in", () => {
      visitOverview({ metrics: metrics() });
      sel.panel("Income Distribution").should("contain.text", "No income data available");
    });

    it("draws no chart when nothing came in", () => {
      visitOverview({ metrics: metrics() });
      sel.panel("Income Distribution").find("svg").should("not.exist");
    });

    it("still shows the empty state when only a forecast exists", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      sel.panel("Income Distribution").should("contain.text", "No income data available");
    });

    it("counts invoiced income into the ring", () => {
      visitOverview({ metrics: metrics({ invoice_income_care_fee: 250000 }) });
      sel.chart("Income Distribution").should("contain.text", "Care Fee");
    });
  });

  describe("Expense Distribution", () => {
    it("draws a chart once there is spending", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense Distribution").should("exist");
    });

    it("legends every category that spent something", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      [
        "Payroll",
        "Groceries",
        "Utilities",
        "Entertainment",
        "Transport",
        "Medical",
        "Misc",
      ].forEach((label) => {
        sel.chart("Expense Distribution").should("contain.text", label);
      });
    });

    it("includes Payroll from the ledger figure", () => {
      visitOverview({ payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense Distribution").should("contain.text", "Payroll");
    });

    it("leaves Payroll out when no wages were paid", () => {
      visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
      sel.chart("Expense Distribution").should("contain.text", "Groceries");
      sel.chart("Expense Distribution").should("not.contain.text", "Payroll");
    });

    it("draws one slice per spending category", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense Distribution").find("path").should("have.length", 7);
    });

    it("gives payroll the largest share of the screenshots' month", () => {
      // $638.17 of $1,025.17 is 62.3%.
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense Distribution").should("contain.text", "62.3%");
    });

    it("says so when nothing went out", () => {
      visitOverview({ metrics: metrics(), payroll: 0 });
      sel.panel("Expense Distribution").should("contain.text", "No expense data available");
    });

    it("draws no chart when nothing went out", () => {
      visitOverview({ metrics: metrics(), payroll: 0 });
      sel.panel("Expense Distribution").find("svg").should("not.exist");
    });

    it("shows both empty states for a month with no movement at all", () => {
      visitOverview({ metrics: metrics(), payroll: 0 });
      sel.panel("Income Distribution").should("contain.text", "No income data available");
      sel.panel("Expense Distribution").should("contain.text", "No expense data available");
    });

    it("keeps income out of the expense ring", () => {
      visitOverview({ metrics: metrics({ budget_income_medical: 57200 }), payroll: 0 });
      sel.panel("Expense Distribution").should("contain.text", "No expense data available");
    });

    it("keeps expenses out of the income ring", () => {
      visitOverview({ metrics: metrics({ budget_expense_medical: 10000 }), payroll: 0 });
      sel.panel("Income Distribution").should("contain.text", "No income data available");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The forecast-versus-actual bars
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: the comparison charts", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Income - Forecast vs Actual", () => {
    it("draws a chart once there is income", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income - Forecast vs Actual").should("exist");
    });

    it("names the month being viewed", () => {
      // `getMonthYear(dateRange?.startDate + 1)` concatenates rather than adding,
      // turning "2026-09-01" into "2026-09-011" — which V8 parses as the 11th of
      // the same month, so the label is accidentally right for every period.
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      cy.contains("h2", "Income - Forecast vs Actual").should("contain.text", "September 2026");
    });

    it("follows the month that is picked", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.periodSelect().select("2026-07");
      cy.contains("h2", "Income - Forecast vs Actual").should("contain.text", "July 2026");
    });

    it("names no month in quarterly view", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.quarterlyToggle().click();
      cy.contains("h2", "Income - Forecast vs Actual").should("not.contain.text", "2026)");
    });

    it("labels its axis", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "Amount ($)");
    });

    it("lists every earning category on the axis", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
      ["Care Fee", "Monthly Fee", "Transport", "Medical", "Misc"].forEach((label) => {
        sel.chart("Income - Forecast vs Actual").should("contain.text", label);
      });
    });

    it("truncates a category name past twelve characters", () => {
      visitOverview({ metrics: metrics({ budget_income_entertainment: 10000 }) });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "Entertainmen...");
    });

    it("leaves out a category with neither a forecast nor an actual", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "Care Fee");
      sel.chart("Income - Forecast vs Actual").should("not.contain.text", "Medical");
    });

    it("includes a category that was forecast but has earned nothing", () => {
      // Unlike the pie, the bar chart keeps a forecast-only row — that gap is
      // the point of the comparison.
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 15000 }),
        home: homeWithForecasts({ income: { medical: 900 } }),
      });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "Medical");
    });

    it("prints bare values while no forecast is set anywhere", () => {
      visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "150");
      sel.chart("Income - Forecast vs Actual").should("not.contain.text", "$150");
    });

    it("switches to $-prefixed values once any forecast exists", () => {
      // One forecast anywhere flips the whole chart into its grouped mode.
      visitOverview({
        metrics: metrics({ budget_income_care_fee: 15000 }),
        home: homeWithForecasts({ income: { careFee: 500 } }),
      });
      sel.chart("Income - Forecast vs Actual").should("contain.text", "$150");
    });

    it("says so when there is nothing to compare", () => {
      visitOverview({ metrics: metrics() });
      sel.panel("Income - Forecast vs Actual").should(
        "contain.text",
        "No income data available"
      );
    });

    it("draws a chart for a forecast with no income yet", () => {
      visitOverview({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      sel.chart("Income - Forecast vs Actual").should("exist");
    });
  });

  describe("Expense - Budgeted vs Actual", () => {
    it("draws a chart once there is spending", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense - Budgeted vs Actual").should("exist");
    });

    it("names the month being viewed", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      cy.contains("h2", "Expense - Budgeted vs Actual").should("contain.text", "September 2026");
    });

    it("names no month in quarterly view", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      sel.quarterlyToggle().click();
      cy.contains("h2", "Expense - Budgeted vs Actual").should("not.contain.text", "2026)");
    });

    it("lists Payroll on the axis", () => {
      visitOverview({ payroll: SCREENSHOT_PAYROLL });
      sel.chart("Expense - Budgeted vs Actual").should("contain.text", "Payroll");
    });

    it("lists every spending category on the axis", () => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: SCREENSHOT_PAYROLL });
      ["Payroll", "Groceries", "Utilities", "Transport", "Medical", "Misc"].forEach((label) => {
        sel.chart("Expense - Budgeted vs Actual").should("contain.text", label);
      });
    });

    it("shows the screenshots' payroll figure with the budget set", () => {
      visitOverview({
        metrics: metrics(SCREENSHOT_EXPENSE),
        payroll: SCREENSHOT_PAYROLL,
        home: homeWithForecasts({ expense: { payroll: 100 } }),
      });
      sel.chart("Expense - Budgeted vs Actual").should("contain.text", "$638.17");
    });

    it("prints bare values while no budget is set anywhere", () => {
      visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
      sel.chart("Expense - Budgeted vs Actual").should("contain.text", "125");
      sel.chart("Expense - Budgeted vs Actual").should("not.contain.text", "$125");
    });

    it("says so when there is nothing to compare", () => {
      visitOverview({ metrics: metrics(), payroll: 0 });
      sel.panel("Expense - Budgeted vs Actual").should(
        "contain.text",
        "No expense data available"
      );
    });

    it("keeps income out of the expense comparison", () => {
      visitOverview({ metrics: metrics({ budget_income_medical: 57200 }), payroll: 0 });
      sel.panel("Expense - Budgeted vs Actual").should(
        "contain.text",
        "No expense data available"
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Quarterly view
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: quarterly view", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("still renders both card columns", () => {
    visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
    sel.quarterlyToggle().click();
    sel.incomeColumn().find("h3").should("have.length", 6);
    sel.expenseColumn().find("h3").should("have.length", 7);
  });

  it("shows the quarter's actuals", () => {
    visitOverview({ metrics: metrics({ budget_income_care_fee: 15000 }) });
    sel.quarterlyToggle().click();
    cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(150));
  });

  it("[as-built] reads the forecast from the quarter's first month only", () => {
    // `getBudgetForecasts` derives its month from `dateRange.startDate`, which
    // is July for Q3 — so a September forecast is invisible in the quarter that
    // contains it, and July's stands in for all three months.
    visitOverview({
      home: buildHome({
        budget: {
          "2026": {
            jul: { income: { careFee: 700 } },
            sep: { income: { careFee: 900 } },
          },
        },
      }),
    });
    sel.quarterlyToggle().click();
    cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(700));
  });

  it("shows no forecast at all when only a later month has one", () => {
    visitOverview({
      home: buildHome({ budget: { "2026": { sep: { income: { careFee: 900 } } } } }),
    });
    sel.quarterlyToggle().click();
    cardRow(sel.incomeCard("Care Fee"), "Forecasted").should("contain.text", money(0));
  });

  it("withdraws the forecast pencil — a quarter cannot be forecast", () => {
    visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
    sel.quarterlyToggle().click();
    sel.incomeColumn().find('button[title="Edit category"]').should("not.exist");
  });

  it("withdraws it from the expense column too", () => {
    visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: 0 });
    sel.quarterlyToggle().click();
    sel.expenseColumn().find('button[title="Edit category"]').should("not.exist");
  });

  it("brings the pencil back on returning to Monthly", () => {
    visitOverview({ metrics: metrics(SCREENSHOT_INCOME) });
    sel.quarterlyToggle().click();
    sel.monthlyToggle().click();
    sel.incomeColumn().find('button[title="Edit category"]').should("exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Editing a forecast
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: editing a forecast", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  const openIncomeEditor = (opts: OverviewOpts = {}) => {
    visitOverview({ metrics: metrics(SCREENSHOT_INCOME), ...opts });
    stubWrites();
    sel.pencil(sel.incomeCard("Care Fee")).click();
  };

  describe("The pencil", () => {
    it("sits on every income card in monthly view", () => {
      visitOverview();
      sel.incomeColumn().find('button[title="Edit category"]').should("have.length", 6);
    });

    it("sits on every expense card too", () => {
      visitOverview({ payroll: 0 });
      sel.expenseColumn().find('button[title="Edit category"]').should("have.length", 7);
    });
  });

  describe("The editor", () => {
    beforeEach(() => openIncomeEditor());

    it("is titled for the side it was opened from", () => {
      sel.modal().should("contain.text", "Edit Income Category");
    });

    it("names the category, read-only", () => {
      sel.modal().should("contain.text", "Care Fee");
    });

    it("shows the actual, read-only", () => {
      sel.modal().should("contain.text", "$150");
    });

    it("offers a Forecasted Amount field", () => {
      sel.modal().should("contain.text", "Forecasted Amount");
      sel.forecastInput().should("exist");
    });

    it("prefills the stored forecast", () => {
      sel.forecastInput().should("have.value", "0");
    });

    it("offers Cancel and Save", () => {
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Save").should("be.visible");
    });
  });

  describe("Saving it", () => {
    beforeEach(() => openIncomeEditor());

    it("PUTs the home", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").its("request.method").should("eq", "PUT");
    });

    it("files the figure under the year and the month abbreviation", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"]).to.have.property("sep");
      });
    });

    it("files it on the income side", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income).to.have.property("careFee", 500);
      });
    });

    it("camel-cases the two-word category's key", () => {
      cy.contains("button", "Cancel").click();
      sel.pencil(sel.incomeCard("Monthly Fee")).click();
      sel.forecastInput().clear().type("750");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income).to.have.property("monthlyFee", 750);
      });
    });

    it("stores dollars, not cents", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income.careFee).to.eq(500);
      });
    });

    it("carries the home id", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").its("request.body.homeId").should("eq", TEST_HOME_ID);
    });

    it("closes the editor", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome");
      cy.contains("Edit Income Category").should("not.exist");
    });

    it("re-reads the home", () => {
      cy.get("@getHome.all").then((before: any) => {
        sel.forecastInput().clear().type("500");
        cy.contains("button", "Save").click();
        cy.wait("@upsertHome");
        cy.get("@getHome.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("sends nothing on Cancel", () => {
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@upsertHome");
    });

    it("closes on Cancel", () => {
      cy.contains("button", "Cancel").click();
      cy.contains("Edit Income Category").should("not.exist");
    });

    it("reports a failure", () => {
      cy.intercept("PUT", "**/v1/home", {
        statusCode: 500,
        body: { message: "Home is read-only" },
      }).as("upsertHome");
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Home is read-only");
    });

    it("falls back to its own message when the server says nothing", () => {
      cy.intercept("PUT", "**/v1/home", { statusCode: 500, body: {} }).as("upsertHome");
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Error in updating budget");
    });
  });

  describe("Alongside what is already stored", () => {
    it("keeps another category's forecast", () => {
      openIncomeEditor({ home: homeWithForecasts({ income: { medical: 900 } }) });
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income.medical).to.eq(900);
      });
    });

    it("keeps the expense side of the same month", () => {
      openIncomeEditor({ home: homeWithForecasts({ expense: { payroll: 100 } }) });
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.expense.payroll).to.eq(100);
      });
    });

    it("keeps another month's budget", () => {
      openIncomeEditor({
        home: buildHome({ budget: { "2026": { jul: { income: { careFee: 700 } } } } }),
      });
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].jul.income.careFee).to.eq(700);
      });
    });

    it("overwrites the category it was opened on", () => {
      openIncomeEditor({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      sel.forecastInput().should("have.value", "500");
      // `.clear()` on this controlled number input sets state to 0, React
      // re-renders it as "0" and the cursor lands at the START — so typing
      // "650" onto it yields 6500. Replace the selection instead.
      sel.forecastInput().type("{selectall}650");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income.careFee).to.eq(650);
      });
    });

    it("keeps the rest of the home record", () => {
      openIncomeEditor();
      sel.forecastInput().clear().type("500");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").its("request.body.homeName").should("eq", "Comfort Cove");
    });
  });

  describe("From the expense side", () => {
    const openExpenseEditor = (opts: OverviewOpts = {}) => {
      visitOverview({ metrics: metrics(SCREENSHOT_EXPENSE), payroll: 0, ...opts });
      stubWrites();
      sel.pencil(sel.expenseCard("Groceries")).click();
    };

    it("is titled for the expense side", () => {
      openExpenseEditor();
      sel.modal().should("contain.text", "Edit Expense Category");
    });

    it("offers a Budgeted Amount field", () => {
      openExpenseEditor();
      sel.modal().should("contain.text", "Budgeted Amount");
    });

    it("files the figure on the expense side", () => {
      openExpenseEditor();
      sel.forecastInput().clear().type("600");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.expense).to.have.property("groceries", 600);
      });
    });

    it("keeps the income side of the same month", () => {
      openExpenseEditor({ home: homeWithForecasts({ income: { careFee: 500 } }) });
      sel.forecastInput().clear().type("600");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.income.careFee).to.eq(500);
      });
    });

    it("can budget payroll", () => {
      visitOverview({ payroll: SCREENSHOT_PAYROLL });
      stubWrites();
      sel.pencil(sel.expenseCard("Payroll")).click();
      sel.forecastInput().clear().type("100");
      cy.contains("button", "Save").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.budget["2026"].sep.expense).to.have.property("payroll", 100);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Everything agreeing with everything else
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget Overview: the numbers agree", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("reproduces the screenshots' income column exactly", () => {
    visitScreenshot();
    ([
      ["Care Fee", 150],
      ["Monthly Fee", 220.25],
      ["Entertainment", 100],
      ["Transport", 205],
      ["Medical", 572],
      ["Misc", 149],
    ] as [string, number][]).forEach(([title, actual]) => {
      cardRow(sel.incomeCard(title), "Forecasted").should("contain.text", money(0));
      cardRow(sel.incomeCard(title), "Actual").should("contain.text", money(actual));
      cardRow(sel.incomeCard(title), "Over Forecast").should("contain.text", money(actual));
      cardRow(sel.incomeCard(title), "Utilization").should("contain.text", "NA");
    });
  });

  it("reproduces the screenshots' expense column exactly", () => {
    visitScreenshot();
    ([
      ["Groceries", 125],
      ["Utilities", 55],
      ["Entertainment", 25],
      ["Transport", 28],
      ["Medical", 100],
      ["Misc", 54],
    ] as [string, number][]).forEach(([title, actual]) => {
      cardRow(sel.expenseCard(title), "Budgeted").should("contain.text", money(0));
      cardRow(sel.expenseCard(title), "Actual").should("contain.text", money(actual));
      cardRow(sel.expenseCard(title), "Remaining").should("contain.text", money(actual));
      cardRow(sel.expenseCard(title), "Utilization").should("contain.text", "NA");
    });
  });

  it("reproduces the screenshots' payroll card exactly", () => {
    visitScreenshot();
    cardRow(sel.expenseCard("Payroll"), "Budgeted").should("contain.text", money(100));
    cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(638.17));
    cardRow(sel.expenseCard("Payroll"), "Remaining").should("contain.text", money(538.17));
    cardRow(sel.expenseCard("Payroll"), "Utilization").should("contain.text", "638.2%");
  });

  it("agrees between the income card, the ring and the bar", () => {
    visitOverview({ metrics: metrics({ budget_income_medical: 57200 }) });
    cardRow(sel.incomeCard("Medical"), "Actual").should("contain.text", money(572));
    sel.chart("Income Distribution").should("contain.text", "Medical");
    sel.chart("Income - Forecast vs Actual").should("contain.text", "572");
  });

  it("agrees between the expense card, the ring and the bar", () => {
    visitOverview({ metrics: metrics({ budget_expense_groceries: 12500 }), payroll: 0 });
    cardRow(sel.expenseCard("Groceries"), "Actual").should("contain.text", money(125));
    sel.chart("Expense Distribution").should("contain.text", "Groceries");
    sel.chart("Expense - Budgeted vs Actual").should("contain.text", "125");
  });

  it("agrees with the page's own stat row", () => {
    visitOverview({
      metrics: metrics({
        ...SCREENSHOT_INCOME,
        ...SCREENSHOT_EXPENSE,
        total_income: 139625,
        total_expense: 38700,
      }),
      payroll: 0,
    });
    // The stat row divides by 100 as the cards do, but formats with
    // `maximumFractionDigits: 0` (charts/chart-utils), so $1,396.25 of income
    // is rounded to the dollar where the Overview cards keep the cents.
    cy.contains("Total Income").parent().should("contain.text", "$1,396");
    cy.contains("Total Expenses").parent().should("contain.text", "$387");
  });

  it("moves every figure together when the month changes", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.stubUsers();
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      { statusCode: 200, body: { budgets: [], income_invoice: 0 } }
    ).as("getIncome");
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", (req) => {
      const start = new URL(req.url).searchParams.get("start_date");
      req.reply({
        statusCode: 200,
        body: metrics({
          budget_income_care_fee: start === "2026-08-01" ? 9900 : 15000,
        }),
      });
    }).as("getMetrics");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);
    cy.contains("Budget Overview", { timeout: 10000 }).should("be.visible");

    cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(150));
    sel.periodSelect().select("2026-08");
    cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(99));
  });

  it("empties every panel for a month with no movement", () => {
    visitOverview({ metrics: metrics(), payroll: 0 });
    sel.panel("Income Distribution").should("contain.text", "No income data available");
    sel.panel("Expense Distribution").should("contain.text", "No expense data available");
    sel.panel("Income - Forecast vs Actual").should("contain.text", "No income data available");
    sel.panel("Expense - Budgeted vs Actual").should(
      "contain.text",
      "No expense data available"
    );
    cardRow(sel.incomeCard("Care Fee"), "Actual").should("contain.text", money(0));
    cardRow(sel.expenseCard("Payroll"), "Actual").should("contain.text", money(0));
  });

  it("survives a metrics body that is entirely empty", () => {
    visitOverview({ metrics: {}, payroll: 0 });
    sel.incomeColumn().find("h3").should("have.length", 6);
    sel.incomeColumn().should("not.contain.text", "NaN");
    sel.expenseColumn().should("not.contain.text", "NaN");
  });
});
