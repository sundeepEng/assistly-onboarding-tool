/* eslint-disable cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * RevOps — Budget: the ledger tabs (Income, Expenses, Thresholds, Alerts)
 *
 *   components/revops/budget/revops-budget.tsx      the period bar and stat row
 *   components/revops/budget/income.tsx             the income table
 *   components/revops/budget/add-budget-income.tsx  Add / Edit Income
 *   components/revops/budget/expenses.tsx           the expense table
 *   components/revops/budget/add-budget-expense.tsx Add / Edit Expense
 *   components/revops/budget/threshold.tsx          the threshold table
 *   components/revops/budget/add-threshold.tsx      Add / Edit Threshold
 *   components/revops/budget/budget-alerts.tsx      the alerts list
 *   utils/budget-utils.ts                           every period and alert sum
 *
 * `revops-budget.cy.ts` already covers the screen SHELL — the metrics query, the
 * four stat cards and their cents conversion, role gating and the RevOps landing
 * route. This spec is the four working tabs it stops short of, plus the period
 * selector that drives all of them. The Overview tab is deliberately left out.
 *
 * ONE ENDPOINT, TWO LEDGERS
 *   Income and Expenses both read `GET /v1/revops/budget`, told apart only by
 *   `?transaction_type=`. They are separate React Query entries, so the stubs
 *   below match on that query parameter rather than on the path:
 *
 *     transaction_type=income    { budgets, income_invoice }   the Income tab
 *     transaction_type=expense   { budgets, expense_payroll }  the PAGE itself
 *
 *   The expense query lives on the page, not the tab, so it fires on first paint;
 *   the income query only fires once the Income tab is opened.
 *
 * THRESHOLDS ARE NOT A RESOURCE
 *   There is no threshold endpoint. A threshold is a leaf on the home record at
 *   `home.thresholds[year][monthAbbr][category]`, so creating, editing or
 *   toggling one is a `PUT /v1/home` carrying the WHOLE home back — with no id
 *   in the path, because it goes through `useUpsert` rather than `useUpdate`.
 *
 * THE CLOCK MUST BE FROZEN
 *   The month options, the quarter options, the default period and the modals'
 *   default dates are all computed from `new Date()`. Everything below freezes
 *   at **Thu 17 Sep 2026**, which is the month the screenshots were taken in, so
 *   "September 2026" and "Q3 2026" are stable assertions rather than today's
 *   accidents.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildDashboardMetrics,
  buildHome,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const BUDGET = "/revops/budget";

/** Thu 17 Sep 2026, midday local — safely inside the month in every timezone. */
const FROZEN_NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

/** What `new Date().toISOString().split("T")[0]` yields at the frozen instant. */
const TODAY = "2026-09-17";

/**
 * How the two tables render a date.
 *
 * Both split the stored `YYYY-MM-DD` and hand the parts to `new Date`, then call
 * `toLocaleDateString()` with no locale — so the output follows whatever locale
 * the browser is running under. Computing the expectation the same way keeps
 * these assertions honest on a machine that is not en-US.
 */
const localDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A budget entry as GET /v1/revops/budget returns it. Amounts are **cents**. */
const entry = (overrides: Record<string, any> = {}) => ({
  id: 501,
  home_id: TEST_HOME_ID,
  transaction_type: "income",
  category_type: "CARE_FEE",
  amount_cents: 120000,
  transaction_date: "2026-09-05",
  entry_mode: "one_time",
  description: "September care fee",
  notes: "",
  receipt_url: null,
  created_by_user_id: TEST_USER_ID,
  ...overrides,
});

/** An expense entry — same shape, the other side of the ledger. */
const expenseEntry = (overrides: Record<string, any> = {}) =>
  entry({
    id: 601,
    transaction_type: "expense",
    category_type: "GROCERIES",
    amount_cents: 45000,
    description: "Weekly shop",
    ...overrides,
  });

/**
 * A home carrying one threshold.
 *
 * `year` and `month` are the literal keys the app looks under — a four-digit
 * year string and a three-letter lower-case month.
 */
const homeWithThreshold = ({
  category = "groceries",
  thresholdName = "Groceries Cap",
  fixedAmount = 1000,
  isEnabled = true,
  year = "2026",
  month = "sep",
}: Partial<{
  category: string;
  /**
   * Pass `null` — not `undefined` — to store a threshold with no name.
   * A default parameter value kicks in for `undefined`, so the sentinel has to
   * be something else or the fallback can never be exercised.
   */
  thresholdName: string | null;
  fixedAmount: number;
  isEnabled: boolean;
  year: string;
  month: string;
}> = {}) =>
  buildHome({
    thresholds: {
      [year]: {
        [month]: {
          [category]: {
            ...(thresholdName === null ? {} : { thresholdName }),
            fixedAmount,
            isEnabled,
          },
        },
      },
    },
  });

/** A home carrying an arbitrary threshold tree. */
const homeWithThresholds = (thresholds: Record<string, any>) =>
  buildHome({ thresholds });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  /** `Toggle` renders both halves as plain divs holding only their label. */
  monthlyToggle: () => cy.contains("div", /^Monthly$/),
  quarterlyToggle: () => cy.contains("div", /^Quarterly$/),
  periodSelect: () => cy.get('select[name="period"]'),

  /** Tab labels are the only `span.text-xl` on the screen. */
  tab: (label: string) => cy.contains("span.text-xl", new RegExp(`^${label}$`)),

  /** react-modal portals its content to the end of the body. */
  modal: () => cy.get(".ReactModal__Content", { timeout: 10000 }),
  /** The budget modals put their heading in the body, not CommonModal's title. */
  modalTitle: (text: string) => cy.contains("h2", text),
  /** CommonModal's cross — anchored on its position, not on "the only svg". */
  cross: () => sel.modal().find('div[class*="right-6"]').first(),

  /** BaseTable rows always carry `border-b`, whatever `rowStyles` adds. */
  row: (text: string) => cy.contains(text).closest('div[class*="border-b"]'),
  rows: () => cy.get('div[class*="border-b"]'),

  /** The shared Add/Edit fields — income and expense use the same names. */
  description: () => cy.get('input[name="description"]'),
  category: () => cy.get('select[name="category_type"]'),
  amount: () => cy.get('input[name="amount_cents"]'),
  date: () => cy.get('input[name="transaction_date"]'),
  notes: () => cy.get('textarea[name="notes"]'),
  /** `RadioButton` is styled divs — there is no `input[type=radio]` here. */
  oneTime: () => cy.contains("div", /^One Time$/),
  recurring: () => cy.contains("div", /^Recurring$/),
  chosenMode: () => cy.get('[data-state="on"]'),

  /**
   * The Income tab's own Total Income card.
   *
   * The page header carries a card with the SAME title, and it renders first —
   * so `cy.contains("Total Income")` always lands on the header's. The tab's
   * card is the only one with a breakdown caption, which makes that caption the
   * reliable anchor.
   */
  incomeTotal: () => cy.contains("p", /^\(Billing Invoices/).parent(),
  /** The Expenses tab's own Total Expenses card, told apart the same way. */
  expenseTotal: () => cy.contains("p", /^\(Payroll/).parent(),

  /** Add/Edit Threshold. */
  thresholdName: () => cy.get('input[name="thresholdName"]'),
  thresholdCategory: () => cy.get('select[name="category"]'),
  thresholdMonth: () => cy.get('input[name="month"]'),
  fixedAmount: () => cy.get('input[name="fixedAmount"]'),
  enableToggle: () => cy.contains("Enable Threshold").parent().find("button"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

type BudgetOpts = {
  role?: any;
  home?: any;
  /** Rows the `transaction_type=income` query answers with. */
  income?: any[];
  /** Rows the `transaction_type=expense` query answers with. */
  expenses?: any[];
  /** `income_invoice` — billing income for the period, in **cents**. */
  incomeInvoice?: number;
  /** `expense_payroll` — payroll for the period, in **cents**. */
  expensePayroll?: number;
  /** Pass `null` to omit the key entirely and exercise the undefined path. */
  metrics?: Record<string, any>;
  /** Skip the income/expense bodies so a test can stub them itself. */
  skipLedger?: boolean;
};

/**
 * Land on the budget screen with both ledgers and the metrics stubbed.
 *
 * The metrics intercept is registered LAST so it wins on its own URL even if a
 * future minimatch change lets `*` cross a slash.
 */
const visitBudget = (opts: BudgetOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers();

  if (!opts.skipLedger) {
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      {
        statusCode: 200,
        body: {
          budgets: opts.income ?? [],
          income_invoice: opts.incomeInvoice ?? 0,
        },
      }
    ).as("getIncome");

    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      {
        statusCode: 200,
        body: {
          budgets: opts.expenses ?? [],
          ...(opts.expensePayroll === undefined
            ? { expense_payroll: 0 }
            : { expense_payroll: opts.expensePayroll }),
        },
      }
    ).as("getExpenses");
  }

  cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
    statusCode: 200,
    body: opts.metrics ?? buildDashboardMetrics(),
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
};

/** Stub every write the budget screen can make. */
const stubWrites = () => {
  cy.intercept("POST", "**/v1/revops/budget", { statusCode: 201, body: {} }).as("createEntry");
  cy.intercept("PUT", "**/v1/revops/budget/**", { statusCode: 200, body: {} }).as("updateEntry");
  // `useUpsert` PUTs to the collection, with no id in the path.
  cy.intercept("PUT", "**/v1/home", { statusCode: 200, body: {} }).as("upsertHome");
};

/**
 * Yield the `@getExpenses` call that carries a real date window.
 *
 * `selectedPeriod` starts as `""` and is filled in by a mount effect, but
 * `useGetAllShifts` has no `enabled` guard on this query — so the page fires an
 * unscoped expense request (`?start_date=undefined`) before the properly scoped
 * one. `cy.wait("@getExpenses")` resolves on that first, useless call, which is
 * why every expense-query assertion below goes through here instead.
 */
const scopedExpenses = (startDate = "2026-09-01") =>
  cy
    .get("@getExpenses.all", { timeout: 10000 })
    .should((calls: any) => {
      const scoped = calls.filter(
        (c: any) => new URL(c.request.url).searchParams.get("start_date") === startDate
      );
      expect(scoped, `an expense query scoped to ${startDate}`).to.have.length.greaterThan(0);
    })
    .then((calls: any) =>
      calls.find(
        (c: any) => new URL(c.request.url).searchParams.get("start_date") === startDate
      )
    );

/** Open a tab and wait for something on it to paint. */
const openTab = (label: string) => {
  sel.tab(label).click();
};

/** Open the Income tab and let its own query land. */
const openIncome = () => {
  openTab("Income");
  cy.wait("@getIncome");
};

/** Fill the parts of Add Income / Add Expense that validation insists on. */
const fillEntry = ({
  description = "Raffle takings",
  category = "MISC",
  amount = "250",
}: Partial<{ description: string; category: string; amount: string }> = {}) => {
  sel.description().clear().type(description);
  sel.category().select(category);
  sel.amount().clear().type(amount);
};

// ═══════════════════════════════════════════════════════════════════════════
// The period selector
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: choosing a period", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("The Monthly / Quarterly toggle", () => {
    beforeEach(() => {
      visitBudget();
      cy.wait("@getMetrics");
    });

    it("offers both halves", () => {
      sel.monthlyToggle().should("be.visible");
      sel.quarterlyToggle().should("be.visible");
    });

    /**
     * The selected half is marked `text-white font-semibold`.
     *
     * Not `bg-black`: `Toggle` writes that token for Monthly but `bg-[black]`
     * for Quarterly, so a background assertion only works on one side.
     */
    it("starts on Monthly", () => {
      sel.monthlyToggle().should("have.class", "text-white");
    });

    it("leaves Quarterly unselected to begin with", () => {
      sel.quarterlyToggle().should("not.have.class", "text-white");
    });

    it("selects Quarterly when it is clicked", () => {
      sel.quarterlyToggle().click();
      sel.quarterlyToggle().should("have.class", "text-white");
    });

    it("deselects Monthly at the same time", () => {
      sel.quarterlyToggle().click();
      sel.monthlyToggle().should("not.have.class", "text-white");
    });

    it("comes back to Monthly", () => {
      sel.quarterlyToggle().click();
      sel.monthlyToggle().click();
      sel.monthlyToggle().should("have.class", "text-white");
    });
  });

  describe("The month picker", () => {
    beforeEach(() => {
      visitBudget();
      cy.wait("@getMetrics");
    });

    it("defaults to the current month", () => {
      sel.periodSelect().should("have.value", "2026-09");
    });

    it("says which month is being viewed", () => {
      cy.contains("Viewing:").should("contain.text", "September 2026");
    });

    it("offers nine months — three ahead and six back", () => {
      sel.periodSelect().find("option").should("have.length.at.least", 9);
    });

    it("offers the three months ahead of today", () => {
      ["December 2026", "November 2026", "October 2026"].forEach((label) => {
        sel.periodSelect().should("contain.text", label);
      });
    });

    it("offers the current month and the five behind it", () => {
      [
        "September 2026",
        "August 2026",
        "July 2026",
        "June 2026",
        "May 2026",
        "April 2026",
      ].forEach((label) => {
        sel.periodSelect().should("contain.text", label);
      });
    });

    it("lists the future months first, newest down", () => {
      sel
        .periodSelect()
        .find("option")
        .then(($options) => {
          // Index 0 is SelectComponent's disabled placeholder option.
          const labels = [...$options].map((o) => o.textContent);
          expect(labels[0]).to.eq("Select Month");
          expect(labels[1]).to.eq("December 2026");
          expect(labels[4]).to.eq("September 2026");
        });
    });

    it("does not offer a month more than three ahead", () => {
      sel.periodSelect().should("not.contain.text", "January 2027");
    });

    it("does not offer a month more than five behind", () => {
      sel.periodSelect().should("not.contain.text", "March 2026");
    });

    it("moves the viewing label when another month is picked", () => {
      sel.periodSelect().select("2026-08");
      cy.contains("Viewing:").should("contain.text", "August 2026");
    });

    it("re-queries the metrics for the month picked", () => {
      sel.periodSelect().select("2026-08");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const august = calls.filter(
          (c: any) => new URL(c.request.url).searchParams.get("start_date") === "2026-08-01"
        );
        expect(august, "a metrics call for August").to.have.length.greaterThan(0);
      });
    });

    it("asks for the whole month, first to last", () => {
      sel.periodSelect().select("2026-08");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const august = calls
          .map((c: any) => new URL(c.request.url).searchParams)
          .find((q: URLSearchParams) => q.get("start_date") === "2026-08-01");
        expect(august?.get("end_date")).to.eq("2026-08-31");
      });
    });

    it("gets February's length right", () => {
      sel.periodSelect().select("2026-04");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const april = calls
          .map((c: any) => new URL(c.request.url).searchParams)
          .find((q: URLSearchParams) => q.get("start_date") === "2026-04-01");
        expect(april?.get("end_date")).to.eq("2026-04-30");
      });
    });

    it("re-queries the expense ledger too", () => {
      cy.get("@getExpenses.all").then((before: any) => {
        sel.periodSelect().select("2026-08");
        cy.get("@getExpenses.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("shows the picked month's figures, not the previous one's", () => {
      cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", (req) => {
        const start = new URL(req.url).searchParams.get("start_date");
        req.reply({
          statusCode: 200,
          body: buildDashboardMetrics({
            total_income: start === "2026-08-01" ? 500000 : 1200000,
          }),
        });
      }).as("getMetrics");

      cy.contains("Total Income").parent().should("contain.text", "$12,000");
      sel.periodSelect().select("2026-08");
      cy.contains("Total Income").parent().should("contain.text", "$5,000");
    });
  });

  describe("The quarter picker", () => {
    beforeEach(() => {
      visitBudget();
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
    });

    it("defaults to the current quarter", () => {
      sel.periodSelect().should("have.value", "2026-Q3");
    });

    it("says which quarter is being viewed", () => {
      cy.contains("Viewing:").should("contain.text", "Q3 2026");
    });

    it("offers five quarters — one ahead and four back", () => {
      sel.periodSelect().find("option").should("have.length.at.least", 5);
    });

    it("offers the quarter ahead", () => {
      sel.periodSelect().should("contain.text", "Q4 2026");
    });

    it("offers the current quarter and the three behind it", () => {
      ["Q3 2026", "Q2 2026", "Q1 2026", "Q4 2025"].forEach((label) => {
        sel.periodSelect().should("contain.text", label);
      });
    });

    it("lists the future quarter first", () => {
      sel
        .periodSelect()
        .find("option")
        .then(($options) => {
          // Index 0 is the disabled "Select Quarter" placeholder.
          expect([...$options][1].textContent).to.eq("Q4 2026");
        });
    });

    it("no longer offers individual months", () => {
      sel.periodSelect().should("not.contain.text", "September 2026");
    });

    it("asks for a three-month window", () => {
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const q3 = calls
          .map((c: any) => new URL(c.request.url).searchParams)
          .find((q: URLSearchParams) => q.get("start_date") === "2026-07-01");
        expect(q3, "a metrics call for Q3").to.not.be.undefined;
        expect(q3?.get("end_date")).to.eq("2026-09-30");
      });
    });

    it("re-queries when another quarter is picked", () => {
      sel.periodSelect().select("2026-Q2");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const q2 = calls
          .map((c: any) => new URL(c.request.url).searchParams)
          .find((q: URLSearchParams) => q.get("start_date") === "2026-04-01");
        expect(q2?.get("end_date")).to.eq("2026-06-30");
      });
    });

    it("spans the turn of the year for Q4", () => {
      sel.periodSelect().select("2025-Q4");
      cy.get("@getMetrics.all", { timeout: 10000 }).should((calls: any) => {
        const q4 = calls
          .map((c: any) => new URL(c.request.url).searchParams)
          .find((q: URLSearchParams) => q.get("start_date") === "2025-10-01");
        expect(q4?.get("end_date")).to.eq("2025-12-31");
      });
    });

    it("returns to the current month when Monthly is chosen again", () => {
      sel.monthlyToggle().click();
      sel.periodSelect().should("have.value", "2026-09");
    });

    it("forgets a quarter that was picked before switching back", () => {
      sel.periodSelect().select("2026-Q1");
      sel.monthlyToggle().click();
      sel.periodSelect().should("have.value", "2026-09");
    });

    it("keeps the stat cards on screen while switching", () => {
      // Changing period gives the metrics query a new key, so the whole stat
      // row is replaced by the loader until it lands. Allow for that.
      cy.contains("Total Income", { timeout: 10000 }).should("be.visible");
      cy.contains("Budget Utilization", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("Switching period while a tab is open", () => {
    it("stays on the tab you were reading", () => {
      visitBudget();
      cy.wait("@getMetrics");
      openIncome();
      sel.periodSelect().select("2026-08");
      cy.contains("Recurring Income").should("be.visible");
    });

    it("re-queries the income ledger for the new period", () => {
      visitBudget();
      cy.wait("@getMetrics");
      openIncome();
      cy.get("@getIncome.all").then((before: any) => {
        sel.periodSelect().select("2026-08");
        cy.get("@getIncome.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("re-reads thresholds for the new period", () => {
      visitBudget({ home: homeWithThreshold() });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Groceries Cap", { timeout: 10000 }).should("be.visible");
      sel.periodSelect().select("2026-08");
      cy.contains("Groceries Cap").should("not.exist");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Income — the query
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: the income query", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("does not run while the Overview tab is showing", () => {
    visitBudget();
    cy.wait("@getMetrics");
    cy.assertNoRequest("@getIncome");
  });

  it("GETs /v1/revops/budget when the Income tab is opened", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
  });

  it("asks for income rather than expenses", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
    cy.assertQuery("@getIncome", { transaction_type: "income" });
  });

  it("scopes the query to the signed-in user's home", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
    cy.assertQuery("@getIncome", { home_id: TEST_HOME_ID });
  });

  it("sends the selected month as the date window", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
    cy.assertQuery("@getIncome", { start_date: "2026-09-01", end_date: "2026-09-30" });
  });

  it("repeats transaction_date rather than indexing it", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
    cy.get("@getIncome").then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      expect(query.getAll("transaction_date")).to.have.length(2);
      expect(interception.request.url).not.to.include("transaction_date[");
    });
  });

  it("authenticates with the session id token", () => {
    visitBudget();
    cy.wait("@getMetrics");
    openIncome();
    cy.assertAuthorized("@getIncome");
  });

  it("sends a quarter-wide window in quarterly view", () => {
    visitBudget();
    cy.wait("@getMetrics");
    sel.quarterlyToggle().click();
    openIncome();
    cy.assertQuery("@getIncome", { start_date: "2026-07-01", end_date: "2026-09-30" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Income — the table
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: the income table", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Layout", () => {
    beforeEach(() => {
      visitBudget({ income: [entry()], incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
    });

    it("renders the six named columns", () => {
      ["Source", "Description", "Type", "Received Date", "Amount", "Receipt"].forEach(
        (header) => {
          cy.contains(header).should("be.visible");
        }
      );
    });

    it("offers an Add Income button", () => {
      cy.contains("button", "Add Income").should("be.visible");
    });

    it("renders the three income stat cards", () => {
      ["Total Income", "Recurring Income", "One-time Income"].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });
  });

  describe("The synthetic Billing Invoice row", () => {
    it("is always present, even with no entries at all", () => {
      visitBudget({ income: [], incomeInvoice: 0 });
      cy.wait("@getMetrics");
      openIncome();
      cy.contains("Billing Invoice").should("be.visible");
    });

    it("describes itself as Billing Invoice Income", () => {
      visitBudget({ incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      cy.contains("Billing Invoice Income").should("be.visible");
    });

    it("shows invoiced income converted from cents", () => {
      // 250,000 cents = $2,500.
      visitBudget({ incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").should("contain.text", "$2,500");
    });

    it("is marked recurring", () => {
      visitBudget({ incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").should("contain.text", "recurring");
    });

    it("carries no receipt", () => {
      visitBudget({ incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").should("contain.text", "No Receipt");
    });

    it("offers no row menu — it is not an entry anyone can edit", () => {
      visitBudget({ incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").find("svg.cursor-pointer").should("not.exist");
    });

    it("reads $0 when nothing was invoiced", () => {
      visitBudget({ incomeInvoice: 0 });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").should("contain.text", "$0");
    });

    it("reads $0 rather than NaN when the key is missing", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.intercept(
        { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
        { statusCode: 200, body: { budgets: [] } }
      ).as("getIncome");
      cy.intercept(
        { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
        { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
      ).as("getExpenses");
      cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
        statusCode: 200,
        body: buildDashboardMetrics(),
      }).as("getMetrics");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(BUDGET);

      cy.wait("@getMetrics");
      openIncome();
      sel.row("Billing Invoice Income").should("not.contain.text", "NaN");
    });

    it("sits at the top, ahead of the real entries", () => {
      visitBudget({ income: [entry({ description: "Raffle" })], incomeInvoice: 250000 });
      cy.wait("@getMetrics");
      openIncome();
      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((r) => r.textContent ?? "");
        const invoice = text.findIndex((t) => t.includes("Billing Invoice Income"));
        const raffle = text.findIndex((t) => t.includes("Raffle"));
        expect(invoice, "the invoice row").to.be.greaterThan(-1);
        expect(raffle, "the raffle row").to.be.greaterThan(invoice);
      });
    });
  });

  describe("An income entry", () => {
    beforeEach(() => {
      visitBudget({ income: [entry()] });
      cy.wait("@getMetrics");
      openIncome();
    });

    it("is listed", () => {
      cy.contains("September care fee").should("be.visible");
    });

    it("shows its amount in dollars", () => {
      sel.row("September care fee").should("contain.text", "$1,200");
    });

    it("shows its received date", () => {
      sel.row("September care fee").should("contain.text", localDate("2026-09-05"));
    });

    it("is labelled one-time for a one_time entry", () => {
      sel.row("September care fee").should("contain.text", "one-time");
    });

    it("reports no receipt when none was uploaded", () => {
      sel.row("September care fee").should("contain.text", "No Receipt");
    });

    it("offers a row menu", () => {
      sel.row("September care fee").find("svg.cursor-pointer").should("exist");
    });

    it("[as-built] shows the raw category enum in Source", () => {
      // `source` is `budget.category_type` straight from the API, so the column
      // reads CARE_FEE rather than the "Care Fee" the Category select offers.
      sel.row("September care fee").should("contain.text", "CARE_FEE");
    });
  });

  describe("Several entries", () => {
    it("lists them all", () => {
      visitBudget({
        income: [
          entry({ id: 1, description: "Care fee" }),
          entry({ id: 2, description: "Outing takings" }),
          entry({ id: 3, description: "Donation" }),
        ],
      });
      cy.wait("@getMetrics");
      openIncome();
      ["Care fee", "Outing takings", "Donation"].forEach((text) => {
        cy.contains(text).should("be.visible");
      });
    });

    it("labels a recurring entry recurring", () => {
      visitBudget({
        income: [entry({ entry_mode: "recurring", description: "Monthly fee" })],
      });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Monthly fee").should("contain.text", "recurring");
    });

    it("treats anything that is not one_time as recurring", () => {
      visitBudget({
        income: [entry({ entry_mode: "weekly", description: "Odd cadence" })],
      });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Odd cadence").should("contain.text", "recurring");
    });

    it("separates thousands in the amount", () => {
      visitBudget({ income: [entry({ amount_cents: 1250000, description: "Big one" })] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Big one").should("contain.text", "$12,500");
    });

    it("renders a zero-amount entry as $0", () => {
      visitBudget({ income: [entry({ amount_cents: 0, description: "Waived" })] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Waived").should("contain.text", "$0");
    });

    it("keeps cents visible", () => {
      visitBudget({ income: [entry({ amount_cents: 12345, description: "Odd cents" })] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Odd cents").should("contain.text", "$123.45");
    });

    it("shows an empty description as blank rather than crashing", () => {
      visitBudget({ income: [entry({ description: "", category_type: "MISC" })] });
      cy.wait("@getMetrics");
      openIncome();
      cy.contains("MISC").should("be.visible");
    });
  });

  describe("Receipts", () => {
    const withReceipt = () =>
      entry({
        description: "Bake sale",
        receipt_url: "https://bucket.s3.amazonaws.com/budget/receipts/home/1.pdf",
      });

    it("offers view and download when a receipt is on file", () => {
      visitBudget({ income: [withReceipt()] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Bake sale").find('[title="View Receipt"]').should("exist");
      sel.row("Bake sale").find('[title="Download Receipt"]').should("exist");
    });

    it("does not say No Receipt when one exists", () => {
      visitBudget({ income: [withReceipt()] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Bake sale").should("not.contain.text", "No Receipt");
    });

    it("offers neither action when there is no receipt", () => {
      visitBudget({ income: [entry({ description: "No paperwork" })] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("No paperwork").find('[title="View Receipt"]').should("not.exist");
    });

    it("presigns the receipt before opening it", () => {
      cy.stubPresign();
      visitBudget({ income: [withReceipt()] });
      cy.wait("@getMetrics");
      openIncome();
      cy.window().then((win) => cy.stub(win, "open").as("windowOpen"));
      sel.row("Bake sale").find('[title="View Receipt"]').click();
      cy.wait("@presign");
    });

    it("opens the presigned receipt in a new tab", () => {
      cy.stubPresign();
      visitBudget({ income: [withReceipt()] });
      cy.wait("@getMetrics");
      openIncome();
      cy.window().then((win) => cy.stub(win, "open").as("windowOpen"));
      sel.row("Bake sale").find('[title="View Receipt"]').click();
      cy.get("@windowOpen").should("have.been.called");
    });

    it("warns when the receipt cannot be presigned", () => {
      cy.intercept("POST", "/api/s3/presign-get", { statusCode: 500, body: {} }).as("presign");
      cy.intercept("GET", "**/v1/s3-pre-signed-url*", { statusCode: 500, body: {} });
      visitBudget({ income: [withReceipt()] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Bake sale").find('[title="View Receipt"]').click();
      cy.assertPopover("Unable to load receipt. Please try again.");
    });
  });

  describe("What the table filters and what it does not", () => {
    it("drops an expense row that comes back in the income response", () => {
      visitBudget({
        income: [
          entry({ id: 1, description: "Real income" }),
          entry({ id: 2, transaction_type: "expense", description: "Stray expense" }),
        ],
      });
      cy.wait("@getMetrics");
      openIncome();
      cy.contains("Real income").should("be.visible");
      cy.contains("Stray expense").should("not.exist");
    });

    it("[as-built] never shows its empty message", () => {
      // `customEmptyMessage="No income recorded yet."` can never fire: the
      // synthetic Billing Invoice row is prepended unconditionally, so
      // `tableData` always has at least one entry.
      visitBudget({ income: [], incomeInvoice: 0 });
      cy.wait("@getMetrics");
      openIncome();
      cy.contains("No income recorded yet.").should("not.exist");
    });

    it("[as-built] renders Invalid Date for an entry with no date", () => {
      // The renderer splits the raw string and feeds the parts to `new Date`,
      // with no guard for a missing value.
      visitBudget({ income: [entry({ transaction_date: "", description: "Undated" })] });
      cy.wait("@getMetrics");
      openIncome();
      sel.row("Undated").should("contain.text", "Invalid Date");
    });

    it("survives a response with no budgets array", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.intercept(
        { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
        { statusCode: 200, body: { income_invoice: 100000 } }
      ).as("getIncome");
      cy.intercept(
        { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
        { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
      ).as("getExpenses");
      cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
        statusCode: 200,
        body: buildDashboardMetrics(),
      }).as("getMetrics");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(BUDGET);

      cy.wait("@getMetrics");
      openIncome();
      cy.contains("Billing Invoice").should("be.visible");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Income — the stats
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: the income stats", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("adds invoiced income to entered income", () => {
    // $2,500 invoiced + $1,200 entered.
    visitBudget({ income: [entry()], incomeInvoice: 250000 });
    cy.wait("@getMetrics");
    openIncome();
    sel.incomeTotal().should("contain.text", "$3,700");
  });

  it("breaks the total down in its own caption", () => {
    visitBudget({ income: [entry()], incomeInvoice: 250000 });
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("(Billing Invoices $2,500 + Added Income $1,200)").should("be.visible");
  });

  it("sums only recurring entries into Recurring Income", () => {
    visitBudget({
      income: [
        entry({ id: 1, entry_mode: "recurring", amount_cents: 100000 }),
        entry({ id: 2, entry_mode: "one_time", amount_cents: 50000 }),
      ],
    });
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("Recurring Income").parent().should("contain.text", "$1,000");
  });

  it("sums only one-time entries into One-time Income", () => {
    visitBudget({
      income: [
        entry({ id: 1, entry_mode: "recurring", amount_cents: 100000 }),
        entry({ id: 2, entry_mode: "one_time", amount_cents: 50000 }),
      ],
    });
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("One-time Income").parent().should("contain.text", "$500");
  });

  it("leaves the synthetic Billing Invoice row out of Recurring Income", () => {
    // The row is marked recurring, but it is built after the sum — so $2,500 of
    // invoiced income must not appear here.
    visitBudget({ income: [], incomeInvoice: 250000 });
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("Recurring Income").parent().should("contain.text", "$0");
  });

  it("adds several entries of the same cadence together", () => {
    visitBudget({
      income: [
        entry({ id: 1, entry_mode: "recurring", amount_cents: 100000 }),
        entry({ id: 2, entry_mode: "recurring", amount_cents: 25000 }),
      ],
    });
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("Recurring Income").parent().should("contain.text", "$1,250");
  });

  it("reads all zeroes for a month with nothing in it", () => {
    visitBudget({ income: [], incomeInvoice: 0 });
    cy.wait("@getMetrics");
    openIncome();
    sel.incomeTotal().should("contain.text", "$0");
    cy.contains("One-time Income").parent().should("contain.text", "$0");
  });

  it("never renders NaN", () => {
    visitBudget({ income: [entry({ amount_cents: null as any })] });
    cy.wait("@getMetrics");
    openIncome();
    sel.incomeTotal().should("not.contain.text", "NaN");
  });

  it("shows a loader while the ledger is in flight", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.stubUsers();
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      { statusCode: 200, body: { budgets: [], income_invoice: 0 }, delay: 1200 }
    ).as("getIncome");
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: buildDashboardMetrics(),
    }).as("getMetrics");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);

    cy.wait("@getMetrics");
    openTab("Income");
    cy.contains("Loading income...").should("be.visible");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Add Income
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: Add Income", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
    visitBudget();
    stubWrites();
    cy.wait("@getMetrics");
    openIncome();
    cy.contains("button", "Add Income").click();
  });

  describe("The form", () => {
    it("is titled Add Budget Income", () => {
      sel.modalTitle("Add Budget Income").should("be.visible");
    });

    it("offers a description field", () => {
      sel.description().should("have.attr", "placeholder", "Enter income description");
    });

    it("starts with an empty description", () => {
      sel.description().should("have.value", "");
    });

    it("offers a category select", () => {
      sel.category().should("exist");
    });

    it("leaves the category unchosen", () => {
      sel.category().invoke("val").should("not.be.ok");
    });

    it("prompts the user to select a category", () => {
      sel.category().should("contain.text", "Select Category");
    });

    it("offers the six income categories", () => {
      ["Care Fee", "Monthly Fee", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (label) => {
          sel.category().should("contain.text", label);
        }
      );
    });

    it("does not offer the expense-only categories", () => {
      sel.category().should("not.contain.text", "Groceries");
      sel.category().should("not.contain.text", "Utilities");
    });

    it("offers an amount field", () => {
      sel.amount().should("have.attr", "type", "number");
    });

    it("refuses a negative amount at the input level", () => {
      sel.amount().should("have.attr", "min", "0");
    });

    it("allows fractional amounts", () => {
      sel.amount().should("have.attr", "step", "any");
    });

    it("starts the amount at zero", () => {
      sel.amount().should("have.value", "0");
    });

    it("offers both payment types", () => {
      cy.contains("Payment Type").should("be.visible");
      sel.oneTime().should("be.visible");
      sel.recurring().should("be.visible");
    });

    it("defaults to One Time", () => {
      sel.chosenMode().should("contain.text", "One Time");
    });

    it("offers a received date, marked required", () => {
      cy.contains("Received Date *").should("be.visible");
    });

    it("defaults the received date to today", () => {
      sel.date().should("have.value", TODAY);
    });

    it("will not accept a received date in the future", () => {
      sel.date().should("have.attr", "max", TODAY);
    });

    it("offers an optional receipt upload", () => {
      cy.contains("Upload Receipt (Optional)").should("be.visible");
    });

    it("starts with no receipt on file", () => {
      cy.contains("Not on file").should("be.visible");
    });

    it("offers a notes box", () => {
      sel.notes().should("have.attr", "placeholder", "Add any additional notes");
    });

    it("offers Cancel and Create Income", () => {
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Create Income").should("be.visible");
    });
  });

  describe("Filling it in", () => {
    it("accepts a description", () => {
      sel.description().clear().type("Raffle takings");
      sel.description().should("have.value", "Raffle takings");
    });

    it("accepts a category", () => {
      sel.category().select("MISC");
      sel.category().should("have.value", "MISC");
    });

    it("accepts an amount", () => {
      sel.amount().clear().type("250");
      sel.amount().should("have.value", "250");
    });

    it("accepts a five-figure amount", () => {
      sel.amount().clear().type("12500");
      sel.amount().should("have.value", "12500");
    });

    it("switches to Recurring", () => {
      sel.recurring().click();
      sel.chosenMode().should("contain.text", "Recurring");
    });

    it("switches back to One Time", () => {
      sel.recurring().click();
      sel.oneTime().click();
      sel.chosenMode().should("contain.text", "One Time");
    });

    it("accepts an earlier received date", () => {
      sel.date().clear().type("2026-09-01");
      sel.date().should("have.value", "2026-09-01");
    });

    it("accepts notes", () => {
      sel.notes().clear().type("Cash counted by two staff");
      sel.notes().should("have.value", "Cash counted by two staff");
    });
  });

  describe("Validation", () => {
    it("refuses a blank form", () => {
      cy.contains("button", "Create Income").click();
      cy.assertNoRequest("@createEntry");
    });

    it("demands a description", () => {
      sel.category().select("MISC");
      sel.amount().clear().type("250");
      cy.contains("button", "Create Income").click();
      cy.contains("Description is required").should("be.visible");
    });

    it("demands a category", () => {
      sel.description().clear().type("Raffle takings");
      sel.amount().clear().type("250");
      cy.contains("button", "Create Income").click();
      cy.contains("Please select a category").should("be.visible");
    });

    it("blocks the request while a field is invalid", () => {
      sel.description().clear().type("Raffle takings");
      cy.contains("button", "Create Income").click();
      cy.assertNoRequest("@createEntry");
    });

    it("accepts a zero amount — income can legitimately be nil", () => {
      sel.description().clear().type("Waived fee");
      sel.category().select("MISC");
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
    });

    it("refuses a description over 500 characters", () => {
      sel.description().clear().type("x".repeat(501), { delay: 0 });
      sel.category().select("MISC");
      cy.contains("Description must not exceed 500 characters").should("be.visible");
    });

    it("refuses notes over 1000 characters", () => {
      fillEntry();
      sel.notes().clear().type("y".repeat(1001), { delay: 0 });
      cy.contains("Notes must not exceed 1000 characters").should("be.visible");
    });

    it("blocks submission with an empty received date", () => {
      fillEntry();
      sel.date().clear();
      cy.contains("button", "Create Income").click();
      cy.assertNoRequest("@createEntry");
    });

    it("lets the form through once the missing field is filled", () => {
      cy.contains("button", "Create Income").click();
      cy.contains("Description is required").should("be.visible");
      fillEntry();
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
    });
  });

  describe("The payload", () => {
    beforeEach(() => {
      fillEntry({ description: "Raffle takings", category: "MISC", amount: "250" });
    });

    it("POSTs to /v1/revops/budget", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.method").should("eq", "POST");
    });

    it("marks the entry as income", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.transaction_type").should("eq", "income");
    });

    it("converts the dollar amount to cents", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.amount_cents").should("eq", 25000);
    });

    it("converts a five-figure amount to cents", () => {
      sel.amount().clear().type("12500");
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.amount_cents").should("eq", 1250000);
    });

    it("sends the chosen category", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.category_type").should("eq", "MISC");
    });

    it("sends the description", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.description").should("eq", "Raffle takings");
    });

    it("defaults the entry mode to one_time", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.entry_mode").should("eq", "one_time");
    });

    it("sends recurring when that was picked", () => {
      sel.recurring().click();
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.entry_mode").should("eq", "recurring");
    });

    it("sends today's date by default", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.transaction_date").should("eq", TODAY);
    });

    it("sends an earlier date when one was chosen", () => {
      sel.date().clear().type("2026-09-01");
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.transaction_date").should("eq", "2026-09-01");
    });

    it("sends the notes", () => {
      sel.notes().clear().type("Counted twice");
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.notes").should("eq", "Counted twice");
    });

    it("sends a null receipt when nothing was uploaded", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.receipt_url").should("be.null");
    });

    it("scopes the entry to the home", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.home_id").should("eq", TEST_HOME_ID);
    });

    it("records who entered it", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").its("request.body.created_by_user_id").should("eq", TEST_USER_ID);
    });

    it("sends no id — the backend assigns one", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry").then(({ request }) => {
        expect(request.body).to.not.have.property("id");
      });
    });

    it("authenticates with the session id token", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
      cy.assertAuthorized("@createEntry");
    });
  });

  describe("After saving", () => {
    beforeEach(() => {
      fillEntry();
    });

    it("confirms with a popover", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
      cy.assertPopover("Income created successfully!");
    });

    it("closes the modal", () => {
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
      sel.modalTitle("Add Budget Income").should("not.exist");
    });

    it("refreshes the ledger", () => {
      cy.get("@getIncome.all").then((before: any) => {
        cy.contains("button", "Create Income").click();
        cy.wait("@createEntry");
        cy.get("@getIncome.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("reports a server error rather than pretending it worked", () => {
      cy.intercept("POST", "**/v1/revops/budget", {
        statusCode: 500,
        body: { error: "Ledger is closed for the period" },
      }).as("createEntry");
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
      cy.assertPopover("Ledger is closed for the period");
    });

    it("keeps the modal open after a failure", () => {
      cy.intercept("POST", "**/v1/revops/budget", { statusCode: 500, body: {} }).as(
        "createEntry"
      );
      cy.contains("button", "Create Income").click();
      cy.wait("@createEntry");
      cy.dismissPopover();
      sel.modalTitle("Add Budget Income").should("be.visible");
    });
  });

  describe("Backing out", () => {
    it("closes on the cross", () => {
      sel.cross().click();
      sel.modalTitle("Add Budget Income").should("not.exist");
    });

    it("sends nothing when the cross is used", () => {
      fillEntry();
      sel.cross().click();
      cy.assertNoRequest("@createEntry");
    });

    it("closes on Cancel", () => {
      cy.contains("button", "Cancel").click();
      sel.modalTitle("Add Budget Income").should("not.exist");
    });

    it("sends nothing on Cancel when the form is incomplete", () => {
      sel.description().clear().type("Half-finished");
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@createEntry");
    });


    it("forgets what was typed when reopened", () => {
      sel.description().clear().type("Abandoned");
      sel.cross().click();
      cy.contains("button", "Add Income").click();
      sel.description().should("have.value", "");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edit Income
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: Edit Income", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const stored = () =>
    entry({
      id: 777,
      category_type: "TRANSPORT",
      amount_cents: 20500,
      transaction_date: "2026-07-08",
      description: "Miscellaneous",
      entry_mode: "one_time",
      notes: "Minibus hire",
    });

  const openEdit = (income = [stored()]) => {
    cy.clearAuthSession();
    visitBudget({ income });
    stubWrites();
    cy.wait("@getMetrics");
    openIncome();
    cy.openRowMenu("Miscellaneous");
  };

  describe("The row menu", () => {
    beforeEach(() => openEdit());

    it("offers Edit Income", () => {
      cy.contains("Edit Income").should("be.visible");
    });

    it("offers nothing else — no delete, no stop recurring", () => {
      cy.contains("Delete").should("not.exist");
      cy.contains("Stop Recurring").should("not.exist");
    });

    it("opens the modal", () => {
      cy.contains("Edit Income").click();
      sel.modalTitle("Edit Income").should("be.visible");
    });

    it("closes the menu when the modal opens", () => {
      cy.contains("Edit Income").click();
      sel.modalTitle("Edit Income").should("be.visible");
      cy.contains("Stop Recurring").should("not.exist");
    });
  });

  describe("What it prefills", () => {
    beforeEach(() => {
      openEdit();
      cy.contains("Edit Income").click();
    });

    it("is titled Edit Income, not Add", () => {
      sel.modalTitle("Edit Income").should("be.visible");
      cy.contains("Add Budget Income").should("not.exist");
    });

    it("prefills the description", () => {
      sel.description().should("have.value", "Miscellaneous");
    });

    it("prefills the category", () => {
      sel.category().should("have.value", "TRANSPORT");
    });

    it("prefills the amount in dollars, not cents", () => {
      // 20,500 cents is $205 — not 20500.
      sel.amount().should("have.value", "205");
    });

    it("prefills the payment type", () => {
      sel.chosenMode().should("contain.text", "One Time");
    });

    it("prefills the received date", () => {
      sel.date().should("have.value", "2026-07-08");
    });

    it("prefills the notes", () => {
      sel.notes().should("have.value", "Minibus hire");
    });

    it("labels the submit button Update Income", () => {
      cy.contains("button", "Update Income").should("be.visible");
      cy.contains("button", "Create Income").should("not.exist");
    });
  });

  describe("Everything stays editable", () => {
    beforeEach(() => {
      openEdit();
      cy.contains("Edit Income").click();
    });

    it("lets the description be changed", () => {
      sel.description().clear().type("Minibus hire refund");
      sel.description().should("have.value", "Minibus hire refund");
    });

    it("lets the category be changed", () => {
      sel.category().select("MEDICAL");
      sel.category().should("have.value", "MEDICAL");
    });

    it("lets the amount be changed", () => {
      sel.amount().clear().type("310");
      sel.amount().should("have.value", "310");
    });

    it("lets the payment type be changed", () => {
      sel.recurring().click();
      sel.chosenMode().should("contain.text", "Recurring");
    });

    it("lets the date be changed", () => {
      sel.date().clear().type("2026-07-10");
      sel.date().should("have.value", "2026-07-10");
    });

    it("lets the notes be changed", () => {
      sel.notes().clear().type("Reimbursed");
      sel.notes().should("have.value", "Reimbursed");
    });
  });

  describe("The update", () => {
    beforeEach(() => {
      openEdit();
      cy.contains("Edit Income").click();
    });

    it("PUTs rather than POSTing", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.method").should("eq", "PUT");
    });

    it("addresses the entry by id in the path", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.url").should("include", "/v1/revops/budget/777");
    });

    it("carries the id in the body too", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.id").should("eq", 777);
    });

    it("sends the edited amount in cents", () => {
      sel.amount().clear().type("310");
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.amount_cents").should("eq", 31000);
    });

    it("sends the edited category", () => {
      sel.category().select("MEDICAL");
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.category_type").should("eq", "MEDICAL");
    });

    it("sends the edited description", () => {
      sel.description().clear().type("Corrected");
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.description").should("eq", "Corrected");
    });

    it("sends the edited payment type", () => {
      sel.recurring().click();
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.entry_mode").should("eq", "recurring");
    });

    it("keeps it on the income side of the ledger", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.transaction_type").should("eq", "income");
    });

    it("leaves untouched fields alone", () => {
      sel.amount().clear().type("310");
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry").its("request.body.transaction_date").should("eq", "2026-07-08");
    });

    it("authenticates with the session id token", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry");
      cy.assertAuthorized("@updateEntry");
    });

    it("confirms with a popover", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry");
      cy.assertPopover("Income updated successfully!");
    });

    it("closes the modal", () => {
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry");
      sel.modalTitle("Edit Income").should("not.exist");
    });

    it("refuses to save with the description emptied", () => {
      sel.description().clear();
      cy.contains("button", "Update Income").click();
      cy.assertNoRequest("@updateEntry");
    });

    it("reports a server error", () => {
      cy.intercept("PUT", "**/v1/revops/budget/**", {
        statusCode: 500,
        body: { error: "Entry is locked" },
      }).as("updateEntry");
      cy.contains("button", "Update Income").click();
      cy.wait("@updateEntry");
      cy.assertPopover("Entry is locked");
    });
  });

  describe("Edge cases", () => {
    it("reopens with the stored values after an abandoned edit", () => {
      openEdit();
      cy.contains("Edit Income").click();
      sel.description().clear().type("Scribbled over");
      sel.cross().click();
      cy.openRowMenu("Miscellaneous");
      cy.contains("Edit Income").click();
      sel.description().should("have.value", "Miscellaneous");
    });

    it("[defect] editing a second entry prefills the FIRST one's values", { tags: [Tags.DEFECT] }, () => {
      // `Form` captures `defaultValues` once, at mount, and its `key` is
      // `editIncome?.home_id` — the HOME's id, which is identical for every
      // entry in the home. So the form is never re-keyed between two edits and
      // never re-reads its defaults: opening entry B shows entry A's
      // description, category, amount and date. Saving then writes A's figures
      // over B. Keying on `editIncome?.id` fixes it.
      openEdit([
        stored(),
        entry({ id: 888, description: "Second entry", amount_cents: 99900 }),
      ]);
      cy.contains("Edit Income").click();
      sel.cross().click();
      cy.openRowMenu("Second entry");
      cy.contains("Edit Income").click();
      sel.description().should("have.value", "Miscellaneous");
    });

    it("[defect] carries the first entry's amount over too", { tags: [Tags.DEFECT] }, () => {
      openEdit([
        stored(),
        entry({ id: 888, description: "Second entry", amount_cents: 99900 }),
      ]);
      cy.contains("Edit Income").click();
      sel.cross().click();
      cy.openRowMenu("Second entry");
      cy.contains("Edit Income").click();
      // $205 is the first entry's amount; the second one is $999.
      sel.amount().should("have.value", "205");
    });

    it("prefills an empty notes box when none were stored", () => {
      openEdit([entry({ id: 777, description: "Miscellaneous", notes: null as any })]);
      cy.contains("Edit Income").click();
      sel.notes().should("have.value", "");
    });

    it("[as-built] falls back to the Add form for an entry with no id", () => {
      // The row's id is `budget.id?.toString() || ''`, and the lookup then
      // compares that against `b.id?.toString()` — which is `undefined` for the
      // same row. Nothing matches, `editingIncome` stays null, and the kebab's
      // Edit Income opens a blank create form.
      openEdit([entry({ id: undefined as any, description: "Miscellaneous" })]);
      cy.contains("Edit Income").click();
      sel.modalTitle("Add Budget Income").should("be.visible");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Expenses — the table
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: the expense query", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("runs on first paint — the page owns it, not the tab", () => {
    visitBudget();
    cy.wait("@getExpenses");
  });

  it("asks for expenses rather than income", () => {
    visitBudget();
    scopedExpenses().then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      expect(query.get("transaction_type")).to.eq("expense");
    });
  });

  it("scopes the query to the home", () => {
    visitBudget();
    scopedExpenses().then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      expect(query.get("home_id")).to.eq(TEST_HOME_ID);
    });
  });

  it("sends the selected month as the date window", () => {
    visitBudget();
    scopedExpenses().then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      expect(query.get("end_date")).to.eq("2026-09-30");
    });
  });

  it("repeats transaction_date rather than indexing it", () => {
    visitBudget();
    scopedExpenses().then((interception: any) => {
      const query = new URL(interception.request.url).searchParams;
      expect(query.getAll("transaction_date")).to.have.length(2);
      expect(interception.request.url).not.to.include("transaction_date[");
    });
  });

  it("authenticates with the session id token", () => {
    visitBudget();
    cy.getCookie("idToken").then((cookie) => {
      scopedExpenses().then((interception: any) => {
        expect(interception.request.headers.authorization).to.eq(`Bearer ${cookie?.value}`);
      });
    });
  });

  /**
   * Unlike the metrics query — which `revops-budget.cy.ts` pins going out with
   * an empty window before `selectedPeriod` is set — every expense request
   * observed carries a real month. The helper below still tolerates an
   * unscoped call, because nothing in the code prevents one.
   */
  it("never asks for expenses without a date window", () => {
    visitBudget();
    scopedExpenses();
    cy.get("@getExpenses.all").should((calls: any) => {
      const windowless = calls.filter((c: any) => {
        const start = new URL(c.request.url).searchParams.get("start_date");
        return start === "undefined";
      });
      expect(windowless, "a start_date=undefined request").to.have.length(0);
    });
  });

  it("serves the Expenses tab from the query the page already made", () => {
    visitBudget({ expenses: [expenseEntry()] });
    scopedExpenses();
    cy.get("@getExpenses.all").then((before: any) => {
      openTab("Expenses");
      cy.contains("Weekly shop").should("be.visible");
      cy.wait(500, { log: false });
      cy.get("@getExpenses.all").should("have.length", before.length);
    });
  });
});

describe("RevOps — Budget: the expense table", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Layout", () => {
    beforeEach(() => {
      visitBudget({ expenses: [expenseEntry()], expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
    });

    it("renders the six named columns", () => {
      ["Category", "Description", "Type", "Paid Date", "Amount", "Receipt"].forEach((header) => {
        cy.contains(header).should("be.visible");
      });
    });

    it("says Paid Date rather than Received Date", () => {
      cy.contains("Paid Date").should("be.visible");
      cy.contains("Received Date").should("not.exist");
    });

    it("offers an Add Expense button", () => {
      cy.contains("button", "Add Expense").should("be.visible");
    });

    it("renders the three expense stat cards", () => {
      ["Total Expenses", "Recurring Expenses", "One-time Expenses"].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });
  });

  describe("The synthetic Payroll row", () => {
    it("is always present", () => {
      visitBudget({ expenses: [], expensePayroll: 0 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("Payroll Expense").should("be.visible");
    });

    it("is categorised Payroll", () => {
      visitBudget({ expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Payroll Expense").should("contain.text", "Payroll");
    });

    it("shows payroll converted from cents", () => {
      // 100,000 cents = $1,000.
      visitBudget({ expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Payroll Expense").should("contain.text", "$1,000");
    });

    it("is marked recurring", () => {
      visitBudget({ expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Payroll Expense").should("contain.text", "recurring");
    });

    it("offers no row menu — payroll is not edited here", () => {
      visitBudget({ expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Payroll Expense").find("svg.cursor-pointer").should("not.exist");
    });

    it("sits ahead of the entered expenses", () => {
      visitBudget({
        expenses: [expenseEntry({ description: "Weekly shop" })],
        expensePayroll: 100000,
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((r) => r.textContent ?? "");
        const payroll = text.findIndex((t) => t.includes("Payroll Expense"));
        const shop = text.findIndex((t) => t.includes("Weekly shop"));
        expect(payroll).to.be.greaterThan(-1);
        expect(shop).to.be.greaterThan(payroll);
      });
    });

    it("[as-built] reads $NaN when the response omits expense_payroll", () => {
      // `payrollAmount = expensesData?.expense_payroll / 100`, with no guard —
      // `undefined / 100` is NaN, and it goes straight into the row and the
      // stat card. A home whose ledger has no payroll key sees "$NaN".
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
        { statusCode: 200, body: { budgets: [] } }
      ).as("getExpenses");
      cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
        statusCode: 200,
        body: buildDashboardMetrics(),
      }).as("getMetrics");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(BUDGET);

      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Payroll Expense").should("contain.text", "NaN");
    });
  });

  describe("An expense entry", () => {
    beforeEach(() => {
      visitBudget({ expenses: [expenseEntry()], expensePayroll: 0 });
      cy.wait("@getMetrics");
      openTab("Expenses");
    });

    it("is listed", () => {
      cy.contains("Weekly shop").should("be.visible");
    });

    it("shows its amount in dollars", () => {
      sel.row("Weekly shop").should("contain.text", "$450");
    });

    it("shows its paid date", () => {
      sel.row("Weekly shop").should("contain.text", localDate("2026-09-05"));
    });

    it("is labelled one-time", () => {
      sel.row("Weekly shop").should("contain.text", "one-time");
    });

    it("reports no receipt", () => {
      sel.row("Weekly shop").should("contain.text", "No Receipt");
    });

    it("offers a row menu", () => {
      sel.row("Weekly shop").find("svg.cursor-pointer").should("exist");
    });

    it("[as-built] shows the raw category enum", () => {
      sel.row("Weekly shop").should("contain.text", "GROCERIES");
    });
  });

  describe("Several expenses", () => {
    it("lists them all", () => {
      visitBudget({
        expenses: [
          expenseEntry({ id: 1, description: "Groceries run" }),
          expenseEntry({ id: 2, description: "Power bill", category_type: "UTILITIES" }),
          expenseEntry({ id: 3, description: "Minibus diesel", category_type: "TRANSPORT" }),
        ],
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      ["Groceries run", "Power bill", "Minibus diesel"].forEach((text) => {
        cy.contains(text).should("be.visible");
      });
    });

    it("labels a recurring expense recurring", () => {
      visitBudget({
        expenses: [expenseEntry({ entry_mode: "recurring", description: "Rent" })],
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Rent").should("contain.text", "recurring");
    });

    it("separates thousands", () => {
      visitBudget({
        expenses: [expenseEntry({ amount_cents: 1250000, description: "Boiler" })],
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Boiler").should("contain.text", "$12,500");
    });

    it("offers receipt actions when one is on file", () => {
      visitBudget({
        expenses: [
          expenseEntry({
            description: "Boiler service",
            receipt_url: "https://bucket.s3.amazonaws.com/budget/receipts/home/9.pdf",
          }),
        ],
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Boiler service").find('[title="View Receipt"]').should("exist");
      sel.row("Boiler service").find('[title="Download Receipt"]').should("exist");
    });

    it("[as-built] does not filter on transaction_type", () => {
      // Unlike the income table, `expenses.tsx` maps the whole `budgets` array.
      // It relies entirely on the server honouring `?transaction_type=expense`;
      // an income row in that response is listed and counted as an expense.
      visitBudget({
        expenses: [expenseEntry({ transaction_type: "income", description: "Stray income" })],
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("Stray income").should("be.visible");
    });

    it("[as-built] never shows its empty message", () => {
      visitBudget({ expenses: [], expensePayroll: 0 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("No expenses recorded yet.").should("not.exist");
    });

    it("renders Invalid Date for an expense with no date", () => {
      visitBudget({ expenses: [expenseEntry({ transaction_date: "", description: "Undated" })] });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.row("Undated").should("contain.text", "Invalid Date");
    });
  });

  describe("The expense stats", () => {
    it("adds payroll to entered expenses", () => {
      // $1,000 payroll + $450 entered.
      visitBudget({ expenses: [expenseEntry()], expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.expenseTotal().should("contain.text", "$1,450");
    });

    it("breaks the total down in its own caption", () => {
      visitBudget({ expenses: [expenseEntry()], expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("(Payroll $1,000 + Added Expenses $450)").should("be.visible");
    });

    it("sums only recurring entries into Recurring Expenses", () => {
      visitBudget({
        expenses: [
          expenseEntry({ id: 1, entry_mode: "recurring", amount_cents: 60000 }),
          expenseEntry({ id: 2, entry_mode: "one_time", amount_cents: 20000 }),
        ],
        expensePayroll: 0,
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("Recurring Expenses").parent().should("contain.text", "$600");
    });

    it("sums only one-time entries into One-time Expenses", () => {
      visitBudget({
        expenses: [
          expenseEntry({ id: 1, entry_mode: "recurring", amount_cents: 60000 }),
          expenseEntry({ id: 2, entry_mode: "one_time", amount_cents: 20000 }),
        ],
        expensePayroll: 0,
      });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("One-time Expenses").parent().should("contain.text", "$200");
    });

    it("leaves payroll out of Recurring Expenses", () => {
      visitBudget({ expenses: [], expensePayroll: 100000 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      cy.contains("Recurring Expenses").parent().should("contain.text", "$0");
    });

    it("reads all zeroes for a month with nothing in it", () => {
      visitBudget({ expenses: [], expensePayroll: 0 });
      cy.wait("@getMetrics");
      openTab("Expenses");
      sel.expenseTotal().should("contain.text", "$0");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Add / Edit Expense
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: Add Expense", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
    visitBudget();
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Expenses");
    cy.contains("button", "Add Expense").click();
  });

  describe("The form", () => {
    it("is titled Add Budget Expense", () => {
      sel.modalTitle("Add Budget Expense").should("be.visible");
    });

    it("prompts for an expense description", () => {
      sel.description().should("have.attr", "placeholder", "Enter expense description");
    });

    it("asks for a Paid Date rather than a Received Date", () => {
      cy.contains("Paid Date *").should("be.visible");
      cy.contains("Received Date *").should("not.exist");
    });

    it("defaults the paid date to today", () => {
      sel.date().should("have.value", TODAY);
    });

    it("will not accept a paid date in the future", () => {
      sel.date().should("have.attr", "max", TODAY);
    });

    it("offers the six expense categories", () => {
      ["Groceries", "Utilities", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (label) => {
          sel.category().should("contain.text", label);
        }
      );
    });

    it("does not offer the income-only categories", () => {
      sel.category().should("not.contain.text", "Care Fee");
      sel.category().should("not.contain.text", "Monthly Fee");
    });

    it("offers both payment types, defaulting to One Time", () => {
      sel.chosenMode().should("contain.text", "One Time");
    });

    it("offers an optional receipt upload", () => {
      cy.contains("Upload Receipt (Optional)").should("be.visible");
      cy.contains("Not on file").should("be.visible");
    });

    it("offers a notes box", () => {
      sel.notes().should("exist");
    });

    it("offers Cancel and Create Expense", () => {
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Create Expense").should("be.visible");
    });
  });

  describe("Validation", () => {
    it("refuses a blank form", () => {
      cy.contains("button", "Create Expense").click();
      cy.assertNoRequest("@createEntry");
    });

    it("demands a description", () => {
      sel.category().select("GROCERIES");
      cy.contains("button", "Create Expense").click();
      cy.contains("Description is required").should("be.visible");
    });

    it("demands a category", () => {
      sel.description().clear().type("Weekly shop");
      cy.contains("button", "Create Expense").click();
      cy.contains("Please select a category").should("be.visible");
    });

    it("accepts a zero amount", () => {
      sel.description().clear().type("Donated stock");
      sel.category().select("GROCERIES");
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry");
    });
  });

  describe("The payload", () => {
    beforeEach(() => {
      fillEntry({ description: "Weekly shop", category: "GROCERIES", amount: "450" });
    });

    it("POSTs to /v1/revops/budget", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.method").should("eq", "POST");
    });

    it("marks the entry as an expense", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.transaction_type").should("eq", "expense");
    });

    it("converts the dollar amount to cents", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.amount_cents").should("eq", 45000);
    });

    it("sends the chosen category", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.category_type").should("eq", "GROCERIES");
    });

    it("sends the description", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.description").should("eq", "Weekly shop");
    });

    it("sends recurring when that was picked", () => {
      sel.recurring().click();
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.entry_mode").should("eq", "recurring");
    });

    it("sends today's paid date by default", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.transaction_date").should("eq", TODAY);
    });

    it("sends a null receipt when nothing was uploaded", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.receipt_url").should("be.null");
    });

    it("scopes the entry to the home", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry").its("request.body.home_id").should("eq", TEST_HOME_ID);
    });

    it("authenticates with the session id token", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry");
      cy.assertAuthorized("@createEntry");
    });
  });

  describe("After saving", () => {
    beforeEach(() => {
      fillEntry({ description: "Weekly shop", category: "GROCERIES", amount: "450" });
    });

    it("confirms with a popover", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry");
      cy.assertPopover("Expense created successfully!");
    });

    it("closes the modal", () => {
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry");
      sel.modalTitle("Add Budget Expense").should("not.exist");
    });

    it("reports a server error", () => {
      cy.intercept("POST", "**/v1/revops/budget", {
        statusCode: 500,
        body: { error: "Budget locked" },
      }).as("createEntry");
      cy.contains("button", "Create Expense").click();
      cy.wait("@createEntry");
      cy.assertPopover("Budget locked");
    });
  });

  describe("Backing out", () => {
    it("closes on Cancel", () => {
      cy.contains("button", "Cancel").click();
      sel.modalTitle("Add Budget Expense").should("not.exist");
    });

    it("sends nothing on Cancel when the form is incomplete", () => {
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@createEntry");
    });


    it("closes on the cross without saving an incomplete form", () => {
      sel.cross().click();
      cy.assertNoRequest("@createEntry");
    });
  });
});

describe("RevOps — Budget: Edit Expense", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const stored = () =>
    expenseEntry({
      id: 909,
      category_type: "UTILITIES",
      amount_cents: 5500,
      transaction_date: "2026-09-02",
      description: "Power bill",
      entry_mode: "recurring",
      notes: "Quarterly billing",
    });

  const openEdit = (expenses = [stored()]) => {
    cy.clearAuthSession();
    visitBudget({ expenses, expensePayroll: 0 });
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Expenses");
    cy.openRowMenu("Power bill");
  };

  it("offers Edit Expense in the row menu", () => {
    openEdit();
    cy.contains("Edit Expense").should("be.visible");
  });

  it("offers nothing else in the row menu", () => {
    openEdit();
    cy.contains("Delete").should("not.exist");
    cy.contains("Stop Recurring").should("not.exist");
  });

  it("opens a modal titled Edit Expense", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.modalTitle("Edit Expense").should("be.visible");
  });

  it("prefills the description", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.description().should("have.value", "Power bill");
  });

  it("prefills the category", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.category().should("have.value", "UTILITIES");
  });

  it("prefills the amount in dollars", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.amount().should("have.value", "55");
  });

  it("prefills the payment type", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.chosenMode().should("contain.text", "Recurring");
  });

  it("prefills the paid date", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.date().should("have.value", "2026-09-02");
  });

  it("prefills the notes", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.notes().should("have.value", "Quarterly billing");
  });

  it("labels the submit button Update Expense", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.contains("button", "Update Expense").should("be.visible");
  });

  it("PUTs to the entry's own path", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry").its("request.url").should("include", "/v1/revops/budget/909");
  });

  it("carries the id in the body", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry").its("request.body.id").should("eq", 909);
  });

  it("sends the edited amount in cents", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.amount().clear().type("62");
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry").its("request.body.amount_cents").should("eq", 6200);
  });

  it("keeps it on the expense side of the ledger", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry").its("request.body.transaction_type").should("eq", "expense");
  });

  it("confirms with a popover", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry");
    cy.assertPopover("Expense updated successfully!");
  });

  it("reports a server error", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    cy.intercept("PUT", "**/v1/revops/budget/**", {
      statusCode: 500,
      body: { error: "Entry is locked" },
    }).as("updateEntry");
    cy.contains("button", "Update Expense").click();
    cy.wait("@updateEntry");
    cy.assertPopover("Entry is locked");
  });

  it("refuses to save with the description emptied", () => {
    openEdit();
    cy.contains("Edit Expense").click();
    sel.description().clear();
    cy.contains("button", "Update Expense").click();
    cy.assertNoRequest("@updateEntry");
  });

  it("does not offer a row menu on the payroll row", () => {
    cy.clearAuthSession();
    visitBudget({ expenses: [stored()], expensePayroll: 100000 });
    cy.wait("@getMetrics");
    openTab("Expenses");
    sel.row("Payroll Expense").find("svg.cursor-pointer").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Thresholds
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: the thresholds table", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Layout", () => {
    beforeEach(() => {
      visitBudget({ home: homeWithThreshold() });
      cy.wait("@getMetrics");
      openTab("Thresholds");
    });

    it("renders the five named columns", () => {
      ["Name", "Category", "Month", "Threshold Amount", "Status"].forEach((header) => {
        cy.contains(header).should("be.visible");
      });
    });

    it("offers an Add Threshold button", () => {
      cy.contains("button", "Add Threshold").should("be.visible");
    });

    it("renders the three threshold stat cards", () => {
      ["Total Thresholds", "Active", "Inactive"].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });

    it("reads the home record", () => {
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });
  });

  describe("A stored threshold", () => {
    beforeEach(() => {
      visitBudget({ home: homeWithThreshold({ fixedAmount: 1250 }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
    });

    it("is listed", () => {
      cy.contains("Groceries Cap").should("be.visible");
    });

    it("shows its stored name", () => {
      sel.row("Groceries Cap").should("contain.text", "Groceries Cap");
    });

    it("capitalises the category key", () => {
      sel.row("Groceries Cap").should("contain.text", "Groceries");
    });

    it("spells the month out in full", () => {
      sel.row("Groceries Cap").should("contain.text", "September 2026");
    });

    it("formats the amount as dollars", () => {
      sel.row("Groceries Cap").should("contain.text", "$1,250");
    });

    it("reads active when enabled", () => {
      sel.row("Groceries Cap").should("contain.text", "active");
    });

    it("offers a row menu", () => {
      sel.row("Groceries Cap").find("svg.cursor-pointer").should("exist");
    });
  });

  describe("Names, states and counts", () => {
    it("falls back to a generated name when none was stored", () => {
      visitBudget({ home: homeWithThreshold({ thresholdName: null }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      // extractThresholds builds `${category} Threshold` from the raw key, so
      // the fallback reads lower-case where the alert list would read "Groceries".
      cy.contains("groceries Threshold").should("be.visible");
    });

    it("reads inactive when disabled", () => {
      visitBudget({ home: homeWithThreshold({ isEnabled: false }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      sel.row("Groceries Cap").should("contain.text", "inactive");
    });

    it("counts one threshold", () => {
      visitBudget({ home: homeWithThreshold() });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Total Thresholds").parent().should("contain.text", "1");
    });

    it("counts an enabled one as active", () => {
      visitBudget({ home: homeWithThreshold() });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Active").parent().should("contain.text", "1");
      cy.contains("Inactive").parent().should("contain.text", "0");
    });

    it("counts a disabled one as inactive", () => {
      visitBudget({ home: homeWithThreshold({ isEnabled: false }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Inactive").parent().should("contain.text", "1");
      cy.contains("Active").parent().should("contain.text", "0");
    });

    it("lists several categories in one month", () => {
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            sep: {
              groceries: { thresholdName: "Groceries Cap", fixedAmount: 1000, isEnabled: true },
              utilities: { thresholdName: "Power Cap", fixedAmount: 500, isEnabled: true },
              medical: { thresholdName: "Medical Cap", fixedAmount: 300, isEnabled: false },
            },
          },
        }),
      });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      ["Groceries Cap", "Power Cap", "Medical Cap"].forEach((name) => {
        cy.contains(name).should("be.visible");
      });
    });

    it("counts them all, split by state", () => {
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            sep: {
              groceries: { thresholdName: "Groceries Cap", fixedAmount: 1000, isEnabled: true },
              utilities: { thresholdName: "Power Cap", fixedAmount: 500, isEnabled: true },
              medical: { thresholdName: "Medical Cap", fixedAmount: 300, isEnabled: false },
            },
          },
        }),
      });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Total Thresholds").parent().should("contain.text", "3");
      cy.contains("Active").parent().should("contain.text", "2");
      cy.contains("Inactive").parent().should("contain.text", "1");
    });

    it("shows a zero cap as $0 rather than hiding the row", () => {
      visitBudget({ home: homeWithThreshold({ fixedAmount: 0 }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      sel.row("Groceries Cap").should("contain.text", "$0");
    });
  });

  describe("The period decides what is listed", () => {
    it("says so when the month has no thresholds", () => {
      visitBudget({ home: buildHome() });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("No thresholds set yet.").should("be.visible");
    });

    it("hides a threshold from another month", () => {
      visitBudget({ home: homeWithThreshold({ month: "jul" }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Groceries Cap").should("not.exist");
    });

    it("shows it once that month is selected", () => {
      visitBudget({ home: homeWithThreshold({ month: "jul" }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      sel.periodSelect().select("2026-07");
      cy.contains("Groceries Cap", { timeout: 10000 }).should("be.visible");
    });

    it("hides a threshold from another year", () => {
      visitBudget({ home: homeWithThreshold({ year: "2025" }) });
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.contains("Groceries Cap").should("not.exist");
    });

    it("gathers all three months of a quarter", () => {
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            jul: { groceries: { thresholdName: "July Cap", fixedAmount: 1000, isEnabled: true } },
            aug: { utilities: { thresholdName: "August Cap", fixedAmount: 500, isEnabled: true } },
            sep: { medical: { thresholdName: "September Cap", fixedAmount: 300, isEnabled: true } },
          },
        }),
      });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      ["July Cap", "August Cap", "September Cap"].forEach((name) => {
        cy.contains(name, { timeout: 10000 }).should("be.visible");
      });
    });

    it("counts a quarter's thresholds together", () => {
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            jul: { groceries: { thresholdName: "July Cap", fixedAmount: 1000, isEnabled: true } },
            aug: { utilities: { thresholdName: "August Cap", fixedAmount: 500, isEnabled: true } },
            sep: { medical: { thresholdName: "September Cap", fixedAmount: 300, isEnabled: true } },
          },
        }),
      });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      cy.contains("Total Thresholds").parent().should("contain.text", "3");
    });

    it("labels each with its own month, not the quarter", () => {
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            jul: { groceries: { thresholdName: "July Cap", fixedAmount: 1000, isEnabled: true } },
            sep: { medical: { thresholdName: "September Cap", fixedAmount: 300, isEnabled: true } },
          },
        }),
      });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      sel.row("July Cap").should("contain.text", "July 2026");
      sel.row("September Cap").should("contain.text", "September 2026");
    });

    it("leaves a month outside the quarter out", () => {
      visitBudget({ home: homeWithThreshold({ month: "jun", thresholdName: "June Cap" }) });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      cy.contains("June Cap").should("not.exist");
    });
  });
});

describe("RevOps — Budget: the threshold row menu", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const openMenu = (home = homeWithThreshold()) => {
    cy.clearAuthSession();
    visitBudget({ home });
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Thresholds");
    cy.openRowMenu("Groceries Cap");
  };

  it("offers Edit", () => {
    openMenu();
    cy.contains("Edit").should("be.visible");
  });

  it("offers Disable for an enabled threshold", () => {
    openMenu();
    cy.contains("Disable").should("be.visible");
  });

  it("offers Enable for a disabled threshold", () => {
    openMenu(homeWithThreshold({ isEnabled: false }));
    cy.contains("Enable").should("be.visible");
  });

  it("does not offer Disable for a disabled threshold", () => {
    openMenu(homeWithThreshold({ isEnabled: false }));
    cy.contains("Disable").should("not.exist");
  });

  it("offers no delete — thresholds cannot be removed here", () => {
    openMenu();
    cy.contains("Delete").should("not.exist");
  });

  describe("Toggling", () => {
    it("PUTs the home", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome").its("request.method").should("eq", "PUT");
    });

    it("addresses the collection, with no id in the path", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.url).to.match(/\/v1\/home$/);
      });
    });

    it("flips isEnabled to false", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.isEnabled")
        .should("eq", false);
    });

    it("flips isEnabled to true", () => {
      openMenu(homeWithThreshold({ isEnabled: false }));
      cy.contains("Enable").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.isEnabled")
        .should("eq", true);
    });

    it("keeps the name and the cap", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome").then(({ request }) => {
        const stored = request.body.thresholds["2026"].sep.groceries;
        expect(stored.thresholdName).to.eq("Groceries Cap");
        expect(stored.fixedAmount).to.eq(1000);
      });
    });

    it("leaves another category in the same month alone", () => {
      openMenu(
        homeWithThresholds({
          "2026": {
            sep: {
              groceries: { thresholdName: "Groceries Cap", fixedAmount: 1000, isEnabled: true },
              utilities: { thresholdName: "Power Cap", fixedAmount: 500, isEnabled: true },
            },
          },
        })
      );
      cy.contains("Disable").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"].sep.utilities.isEnabled).to.eq(true);
      });
    });

    it("leaves another month alone", () => {
      openMenu(
        homeWithThresholds({
          "2026": {
            jul: { groceries: { thresholdName: "July Cap", fixedAmount: 700, isEnabled: true } },
            sep: { groceries: { thresholdName: "Groceries Cap", fixedAmount: 1000, isEnabled: true } },
          },
        })
      );
      cy.contains("Disable").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"].jul.groceries.isEnabled).to.eq(true);
      });
    });

    it("carries the home id in the body", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome").its("request.body.homeId").should("eq", TEST_HOME_ID);
    });

    it("keeps the rest of the home record", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome").its("request.body.homeName").should("eq", "Comfort Cove");
    });

    it("strips the fields the home endpoint rejects", () => {
      cy.clearAuthSession();
      const noisy = {
        home: {
          ...homeWithThreshold().home,
          modifiedAt: "2026-09-01T00:00:00.000Z",
          clinical: { something: true },
          lastLoginTimestamp: "2026-09-16T00:00:00.000Z",
          roaster: [{ pay_rate: "10" }],
        },
      };
      visitBudget({ home: noisy as any });
      stubWrites();
      cy.wait("@getMetrics");
      openTab("Thresholds");
      cy.openRowMenu("Groceries Cap");
      cy.contains("Disable").click();
      cy.wait("@upsertHome").then(({ request }) => {
        ["modifiedAt", "clinical", "lastLoginTimestamp", "roaster"].forEach((key) => {
          expect(request.body, key).to.not.have.property(key);
        });
      });
    });

    it("confirms a disable with a popover", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Threshold disabled");
    });

    it("confirms an enable with a popover", () => {
      openMenu(homeWithThreshold({ isEnabled: false }));
      cy.contains("Enable").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Threshold enabled");
    });

    it("closes the menu", () => {
      openMenu();
      cy.contains("Disable").click();
      cy.wait("@upsertHome");
      cy.contains("Disable").should("not.exist");
    });

    it("re-reads the home afterwards", () => {
      openMenu();
      cy.get("@getHome.all").then((before: any) => {
        cy.contains("Disable").click();
        cy.wait("@upsertHome");
        cy.get("@getHome.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("reports a server error", () => {
      openMenu();
      cy.intercept("PUT", "**/v1/home", {
        statusCode: 500,
        body: { error: "Home is read-only" },
      }).as("upsertHome");
      cy.contains("Disable").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Home is read-only");
    });
  });
});

describe("RevOps — Budget: Add Threshold", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const open = (home = buildHome()) => {
    cy.clearAuthSession();
    visitBudget({ home });
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Thresholds");
    cy.contains("button", "Add Threshold").click();
  };

  describe("The form", () => {
    beforeEach(() => open());

    it("is titled Add Expense Threshold", () => {
      sel.modalTitle("Add Expense Threshold").should("be.visible");
    });

    it("offers a name field", () => {
      sel.thresholdName().should("have.attr", "placeholder", "Enter threshold name");
    });

    it("starts with an empty name", () => {
      sel.thresholdName().should("have.value", "");
    });

    it("offers a category select", () => {
      sel.thresholdCategory().should("contain.text", "Select Category");
    });

    it("leaves the category unchosen", () => {
      sel.thresholdCategory().invoke("val").should("not.be.ok");
    });

    it("offers only expense categories — thresholds cap spending", () => {
      ["Groceries", "Utilities", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (label) => {
          sel.thresholdCategory().should("contain.text", label);
        }
      );
      sel.thresholdCategory().should("not.contain.text", "Care Fee");
    });

    it("offers a month field", () => {
      sel.thresholdMonth().should("have.attr", "type", "month");
    });

    it("defaults the month to the period being viewed", () => {
      sel.thresholdMonth().should("have.value", "2026-09");
    });

    it("offers a fixed amount field", () => {
      sel.fixedAmount().should("have.attr", "type", "number");
    });

    it("starts the amount at zero", () => {
      sel.fixedAmount().should("have.value", "0");
    });

    it("refuses a negative amount at the input level", () => {
      sel.fixedAmount().should("have.attr", "min", "0");
    });

    it("offers an enable toggle", () => {
      cy.contains("Enable Threshold").should("be.visible");
    });

    it("has the toggle on by default", () => {
      sel.enableToggle().should("have.class", "bg-primary");
    });

    it("offers Cancel and Create Threshold", () => {
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Create Threshold").should("be.visible");
    });

    it("shows no already-exists warning for a fresh combination", () => {
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("A threshold already exists").should("not.exist");
    });
  });

  describe("Validation", () => {
    beforeEach(() => open());

    it("refuses a blank form", () => {
      cy.contains("button", "Create Threshold").click();
      cy.assertNoRequest("@upsertHome");
    });

    it("demands a name", () => {
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.contains("Threshold Name is required").should("be.visible");
    });

    it("demands a category", () => {
      sel.thresholdName().clear().type("Groceries Cap");
      cy.contains("button", "Create Threshold").click();
      cy.contains("Category is required").should("be.visible");
    });

    it("demands a month", () => {
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      sel.thresholdMonth().clear();
      cy.contains("button", "Create Threshold").click();
      cy.assertNoRequest("@upsertHome");
    });

    it("refuses a cleared amount — it must be a number", () => {
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      sel.fixedAmount().clear();
      cy.contains("button", "Create Threshold").click();
      cy.contains("Fixed Amount must be a number").should("be.visible");
    });

    it("accepts a zero cap", () => {
      sel.thresholdName().clear().type("No spend");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
    });

    it("lets the form through once the missing field is filled", () => {
      cy.contains("button", "Create Threshold").click();
      cy.contains("Threshold Name is required").should("be.visible");
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
    });
  });

  describe("The payload", () => {
    beforeEach(() => {
      open();
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      sel.fixedAmount().clear().type("1200");
    });

    it("PUTs the home rather than posting a threshold", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").its("request.method").should("eq", "PUT");
    });

    it("files it under the year", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds).to.have.property("2026");
      });
    });

    it("files it under a three-letter month key", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"]).to.have.property("sep");
      });
    });

    it("lower-cases the category into the key", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"].sep).to.have.property("groceries");
      });
    });

    it("stores the name", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.thresholdName")
        .should("eq", "Groceries Cap");
    });

    it("stores the cap as a number, not a string", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.fixedAmount")
        .should("eq", 1200);
    });

    it("stores a five-figure cap", () => {
      sel.fixedAmount().clear().type("12000");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.fixedAmount")
        .should("eq", 12000);
    });

    it("stores it enabled by default", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.isEnabled")
        .should("eq", true);
    });

    it("honours the toggle being switched off", () => {
      sel.enableToggle().click();
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome")
        .its("request.body.thresholds.2026.sep.groceries.isEnabled")
        .should("eq", false);
    });

    it("files it under the month that was typed, not the one on screen", () => {
      sel.thresholdMonth().clear().type("2026-07");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"]).to.have.property("jul");
      });
    });

    it("handles a month in another year", () => {
      sel.thresholdMonth().clear().type("2025-12");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2025"]).to.have.property("dec");
      });
    });

    it("carries the home id", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").its("request.body.homeId").should("eq", TEST_HOME_ID);
    });

    it("authenticates with the session id token", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
      cy.assertAuthorized("@upsertHome");
    });
  });

  describe("Adding alongside what is already there", () => {
    it("keeps a threshold in another month", () => {
      open(homeWithThreshold({ month: "jul", thresholdName: "July Cap" }));
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"].jul.groceries.thresholdName).to.eq("July Cap");
      });
    });

    it("keeps another category in the same month", () => {
      open(homeWithThreshold({ category: "utilities", thresholdName: "Power Cap" }));
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"].sep.utilities.thresholdName).to.eq("Power Cap");
      });
    });

    it("keeps a threshold from another year", () => {
      open(homeWithThreshold({ year: "2025", thresholdName: "Last Year Cap" }));
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2025"].sep.groceries.thresholdName).to.eq(
          "Last Year Cap"
        );
      });
    });
  });

  describe("After saving", () => {
    beforeEach(() => {
      open();
      sel.thresholdName().clear().type("Groceries Cap");
      sel.thresholdCategory().select("GROCERIES");
      sel.fixedAmount().clear().type("1200");
    });

    it("confirms with a popover", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Threshold created successfully!");
    });

    it("closes the modal", () => {
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
      sel.modalTitle("Add Expense Threshold").should("not.exist");
    });

    it("re-reads the home", () => {
      cy.get("@getHome.all").then((before: any) => {
        cy.contains("button", "Create Threshold").click();
        cy.wait("@upsertHome");
        cy.get("@getHome.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });

    it("reports a server error", () => {
      cy.intercept("PUT", "**/v1/home", {
        statusCode: 500,
        body: { error: "Home is read-only" },
      }).as("upsertHome");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome");
      cy.assertPopover("Home is read-only");
    });
  });

  describe("Backing out", () => {
    beforeEach(() => open());

    it("closes on Cancel", () => {
      cy.contains("button", "Cancel").click();
      sel.modalTitle("Add Expense Threshold").should("not.exist");
    });

    it("sends nothing on Cancel when the form is incomplete", () => {
      sel.thresholdName().clear().type("Half-finished");
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@upsertHome");
    });


    it("closes on the cross", () => {
      sel.cross().click();
      sel.modalTitle("Add Expense Threshold").should("not.exist");
    });
  });

  describe("In quarterly view", () => {
    it("defaults the month to the first month of the quarter", () => {
      cy.clearAuthSession();
      visitBudget();
      stubWrites();
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      cy.contains("button", "Add Threshold").click();
      sel.thresholdMonth().should("have.value", "2026-07");
    });

    it("stores it against that month", () => {
      cy.clearAuthSession();
      visitBudget();
      stubWrites();
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Thresholds");
      cy.contains("button", "Add Threshold").click();
      sel.thresholdName().clear().type("Quarter Cap");
      sel.thresholdCategory().select("GROCERIES");
      cy.contains("button", "Create Threshold").click();
      cy.wait("@upsertHome").then(({ request }) => {
        expect(request.body.thresholds["2026"]).to.have.property("jul");
      });
    });
  });
});

describe("RevOps — Budget: Add Threshold over an existing one", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const open = () => {
    cy.clearAuthSession();
    visitBudget({ home: homeWithThreshold({ fixedAmount: 1000 }) });
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Thresholds");
    cy.contains("button", "Add Threshold").click();
  };

  it("warns as soon as a taken category is chosen", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    cy.contains("A threshold already exists for this category and month.").should("be.visible");
  });

  it("prefills the stored name", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.thresholdName().should("have.value", "Groceries Cap");
  });

  it("prefills the stored cap", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.fixedAmount().should("have.value", "1000");
  });

  it("retitles itself Update Expense Threshold", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.modalTitle("Update Expense Threshold").should("be.visible");
  });

  it("relabels the submit button Update Threshold", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    cy.contains("button", "Update Threshold").should("be.visible");
    cy.contains("button", "Create Threshold").should("not.exist");
  });

  it("stays quiet for a category that is free", () => {
    open();
    sel.thresholdCategory().select("MEDICAL");
    cy.contains("A threshold already exists").should("not.exist");
  });

  it("drops the warning when the category is changed to a free one", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    cy.contains("A threshold already exists").should("be.visible");
    sel.thresholdCategory().select("MEDICAL");
    cy.contains("A threshold already exists").should("not.exist");
  });

  it("stays quiet when the month is moved to a free one", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.thresholdMonth().clear().type("2026-07");
    cy.contains("A threshold already exists").should("not.exist");
  });

  it("overwrites rather than duplicating", () => {
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.fixedAmount().clear().type("1500");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome")
      .its("request.body.thresholds.2026.sep.groceries.fixedAmount")
      .should("eq", 1500);
  });

  it("[as-built] still reports it as created, though the button says Update", () => {
    // The button text is driven by `editThreshold || existingThreshold`, but
    // the toast is driven by `editThreshold` alone — which is null on this
    // path. Pressing "Update Threshold" therefore confirms "created".
    open();
    sel.thresholdCategory().select("GROCERIES");
    sel.fixedAmount().clear().type("1500");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome");
    cy.assertPopover("Threshold created successfully!");
  });
});

describe("RevOps — Budget: Edit Threshold", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const openEdit = (
    home = homeWithThreshold({ fixedAmount: 1000 }),
    rowName = "Groceries Cap"
  ) => {
    cy.clearAuthSession();
    visitBudget({ home });
    stubWrites();
    cy.wait("@getMetrics");
    openTab("Thresholds");
    cy.openRowMenu(rowName);
    cy.contains("Edit").click();
  };

  it("opens a modal titled Edit Expense Threshold", () => {
    openEdit();
    sel.modalTitle("Edit Expense Threshold").should("be.visible");
  });

  it("prefills the name", () => {
    openEdit();
    sel.thresholdName().should("have.value", "Groceries Cap");
  });

  it("prefills the cap", () => {
    openEdit();
    sel.fixedAmount().should("have.value", "1000");
  });

  it("labels the submit button Update Threshold", () => {
    openEdit();
    cy.contains("button", "Update Threshold").should("be.visible");
  });

  it("defaults the month to the period being viewed", () => {
    openEdit();
    sel.thresholdMonth().should("have.value", "2026-09");
  });


  it("saves against the stored category despite what the select shows", () => {
    // The mismatch is cosmetic, not destructive: react-hook-form still holds
    // "utilities", so the write lands on the right category. Only the dropdown
    // lies — which is enough to make someone "correct" it to Groceries by hand.
    openEdit(
      homeWithThreshold({ category: "utilities", thresholdName: "Power Cap" }),
      "Power Cap"
    );
    sel.fixedAmount().type("{selectall}1800");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome").then(({ request }) => {
      const sep = request.body.thresholds["2026"].sep;
      expect(sep.utilities.fixedAmount, "the category actually edited").to.eq(1800);
      expect(sep.groceries, "the one the select displayed").to.be.undefined;
    });
  });

  it("saves the amount against the category the select settled on", () => {
    openEdit();
    sel.thresholdCategory().select("GROCERIES");
    sel.fixedAmount().type("{selectall}1800");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome")
      .its("request.body.thresholds.2026.sep.groceries.fixedAmount")
      .should("eq", 1800);
  });

  it("saves the edited name", () => {
    openEdit();
    sel.thresholdCategory().select("GROCERIES");
    sel.thresholdName().type("{selectall}Food budget");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome")
      .its("request.body.thresholds.2026.sep.groceries.thresholdName")
      .should("eq", "Food budget");
  });

  it("confirms with the update message", () => {
    openEdit();
    sel.thresholdCategory().select("GROCERIES");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome");
    cy.assertPopover("Threshold updated successfully!");
  });


  it("[as-built] moves a threshold to the period's month in quarterly view", () => {
    // The month field is seeded from `dateRange.startDate`, not from the
    // threshold being edited. Editing a September cap while viewing Q3 files it
    // under July instead.
    cy.clearAuthSession();
    visitBudget({ home: homeWithThreshold({ month: "sep" }) });
    stubWrites();
    cy.wait("@getMetrics");
    sel.quarterlyToggle().click();
    openTab("Thresholds");
    cy.openRowMenu("Groceries Cap");
    cy.contains("Edit").click();
    sel.thresholdMonth().should("have.value", "2026-07");
    sel.thresholdCategory().select("GROCERIES");
    cy.contains("button", "Update Threshold").click();
    cy.wait("@upsertHome").then(({ request }) => {
      expect(request.body.thresholds["2026"]).to.have.property("jul");
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `buildDashboardMetrics()` reports 150,000 cents of groceries ($1,500) and
 * 90,000 cents of utilities ($900), which is what every cap below is measured
 * against.
 */
describe("RevOps — Budget: alerts", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  const openAlerts = (home: any) => {
    visitBudget({ home });
    cy.wait("@getMetrics");
    openTab("Alerts");
  };

  describe("Nothing to report", () => {
    it("says so when the home has no thresholds", () => {
      openAlerts(buildHome());
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("reads the home record", () => {
      openAlerts(homeWithThreshold());
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });

    it("stays quiet well below the cap", () => {
      // $1,500 against $10,000 is 15%.
      openAlerts(homeWithThreshold({ fixedAmount: 10000 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("stays quiet at 75%", () => {
      // $1,500 against $2,000.
      openAlerts(homeWithThreshold({ fixedAmount: 2000 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("ignores a disabled cap however far it is exceeded", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1, isEnabled: false }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("ignores a zero cap", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 0 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("ignores a negative cap", () => {
      openAlerts(homeWithThreshold({ fixedAmount: -500 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("stays quiet for a category with no spending at all", () => {
      // The metrics body carries no `budget_expense_medical`, so actual is $0.
      openAlerts(homeWithThreshold({ category: "medical", fixedAmount: 300 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });

    it("stays quiet for a cap in a month outside the period", () => {
      openAlerts(homeWithThreshold({ month: "jul", fixedAmount: 1000 }));
      cy.contains("No budget alerts at this time.").should("be.visible");
    });
  });

  describe("Going over the cap", () => {
    beforeEach(() => {
      openAlerts(homeWithThreshold({ fixedAmount: 1000 }));
    });

    it("raises an alert", () => {
      cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");
    });

    it("names the category and the overspend", () => {
      cy.contains("Groceries expenses have exceeded the budget limit by $500.00").should(
        "be.visible"
      );
    });

    it("shows the threshold's own name", () => {
      cy.contains("Groceries Cap").should("be.visible");
    });

    it("chips the category and the month", () => {
      cy.contains("Groceries (September 2026)").should("be.visible");
    });

    it("shows the usage line", () => {
      cy.contains("Usage: 150% ($1,500 / $1,000)").should("be.visible");
    });

    it("colours itself as critical", () => {
      cy.contains("exceeded the budget limit")
        .closest('div[class*="bg-red-50"]')
        .should("exist");
    });

    it("does not also show the empty message", () => {
      cy.contains("No budget alerts at this time.").should("not.exist");
    });
  });

  describe("Sitting exactly on the cap", () => {
    it("counts as exceeded, not as a warning", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1500 }));
      cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");
    });

    it("reports $0.00 of overspend", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1500 }));
      cy.contains("exceeded the budget limit by $0.00").should("be.visible");
    });

    it("reports 100% usage", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1500 }));
      cy.contains("Usage: 100%").should("be.visible");
    });
  });

  describe("Approaching the cap", () => {
    it("warns at 83%", () => {
      // $1,500 against $1,800.
      openAlerts(homeWithThreshold({ fixedAmount: 1800 }));
      cy.contains("Groceries expenses have reached 83% of the threshold", {
        timeout: 10000,
      }).should("be.visible");
    });

    it("warns at exactly 80%", () => {
      // $1,500 against $1,875.
      openAlerts(homeWithThreshold({ fixedAmount: 1875 }));
      cy.contains("reached 80% of the threshold", { timeout: 10000 }).should("be.visible");
    });

    it("does not claim the limit was exceeded", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1800 }));
      cy.contains("exceeded the budget limit").should("not.exist");
    });

    it("colours itself as a warning, not a critical", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1800 }));
      cy.contains("of the threshold")
        .closest('div[class*="bg-yellow-50"]')
        .should("exist");
    });

    it("shows the usage line", () => {
      openAlerts(homeWithThreshold({ fixedAmount: 1800 }));
      cy.contains("Usage: 83% ($1,500 / $1,800)").should("be.visible");
    });
  });

  describe("Several alerts", () => {
    const twoOver = () =>
      homeWithThresholds({
        "2026": {
          sep: {
            groceries: { thresholdName: "T1", fixedAmount: 50, isEnabled: true },
            utilities: { thresholdName: "Power bill", fixedAmount: 50, isEnabled: true },
          },
        },
      });

    it("lists one per threshold", () => {
      openAlerts(twoOver());
      cy.contains("T1", { timeout: 10000 }).should("be.visible");
      cy.contains("Power bill").should("be.visible");
    });

    it("measures each against its own category's spend", () => {
      openAlerts(twoOver());
      cy.contains("Groceries expenses have exceeded the budget limit by $1,450.00").should(
        "be.visible"
      );
      cy.contains("Utilities expenses have exceeded the budget limit by $850.00").should(
        "be.visible"
      );
    });

    it("puts critical alerts above warnings", () => {
      openAlerts(
        homeWithThresholds({
          "2026": {
            sep: {
              // $900 against $1,000 is 90% — a warning.
              utilities: { thresholdName: "Power warning", fixedAmount: 1000, isEnabled: true },
              // $1,500 against $1,000 — critical.
              groceries: { thresholdName: "Groceries critical", fixedAmount: 1000, isEnabled: true },
            },
          },
        })
      );
      cy.contains("Groceries critical", { timeout: 10000 }).should("be.visible");
      // `Alert` colours the whole block, so the two classes identify the two
      // severities without also matching an ancestor.
      cy.get('div[class*="bg-red-50"], div[class*="bg-yellow-50"]').should(($blocks) => {
        expect($blocks, "both alerts rendered").to.have.length(2);
        expect($blocks[0].className, "critical listed first").to.include("bg-red-50");
      });
    });

    it("skips the disabled one and keeps the enabled one", () => {
      openAlerts(
        homeWithThresholds({
          "2026": {
            sep: {
              groceries: { thresholdName: "Live cap", fixedAmount: 50, isEnabled: true },
              utilities: { thresholdName: "Dormant cap", fixedAmount: 50, isEnabled: false },
            },
          },
        })
      );
      cy.contains("Live cap", { timeout: 10000 }).should("be.visible");
      cy.contains("Dormant cap").should("not.exist");
    });

    it("falls back to a generated name when none was stored", () => {
      openAlerts(homeWithThreshold({ thresholdName: null, fixedAmount: 1000 }));
      // The alert list title-cases the category; the threshold table does not.
      cy.contains("Groceries Threshold", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("Across a quarter", () => {
    it("reports a cap from any month in the quarter", () => {
      visitBudget({ home: homeWithThreshold({ month: "jul", fixedAmount: 1000 }) });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Alerts");
      cy.contains("Groceries (July 2026)", { timeout: 10000 }).should("be.visible");
    });

    it("[as-built] measures every month's cap against the whole quarter's spend", () => {
      // The metrics call is scoped to the selected range, so in quarterly view
      // `budget_expense_groceries` is a three-month figure. It is then compared
      // against each month's cap separately, so one month of overspend raises
      // an identical alert for all three.
      visitBudget({
        home: homeWithThresholds({
          "2026": {
            jul: { groceries: { thresholdName: "July Cap", fixedAmount: 1000, isEnabled: true } },
            aug: { groceries: { thresholdName: "August Cap", fixedAmount: 1000, isEnabled: true } },
            sep: { groceries: { thresholdName: "Sept Cap", fixedAmount: 1000, isEnabled: true } },
          },
        }),
      });
      cy.wait("@getMetrics");
      sel.quarterlyToggle().click();
      openTab("Alerts");
      cy.contains("Groceries (July 2026)", { timeout: 10000 }).should("be.visible");
      cy.contains("Groceries (August 2026)").should("be.visible");
      cy.contains("Groceries (September 2026)").should("be.visible");
    });
  });

  describe("Following the period", () => {
    it("drops an alert when the month moves past it", () => {
      visitBudget({ home: homeWithThreshold({ fixedAmount: 1000 }) });
      cy.wait("@getMetrics");
      openTab("Alerts");
      cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");
      sel.periodSelect().select("2026-08");
      cy.contains("No budget alerts at this time.", { timeout: 10000 }).should("be.visible");
    });

    it("stays quiet when the metrics come back empty", () => {
      visitBudget({ home: homeWithThreshold({ fixedAmount: 1000 }), metrics: {} });
      cy.wait("@getMetrics");
      openTab("Alerts");
      cy.contains("No budget alerts at this time.").should("be.visible");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Moving between the tabs
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: moving between the tabs", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
    visitBudget({ home: homeWithThreshold(), income: [entry()], expenses: [expenseEntry()] });
    cy.wait("@getMetrics");
  });

  it("opens on Overview", () => {
    sel.tab("Overview").parent().should("have.class", "border-primary");
  });

  it("underlines the tab that is open", () => {
    openTab("Income");
    sel.tab("Income").parent().should("have.class", "border-primary");
  });

  it("stops underlining the one you left", () => {
    openTab("Income");
    sel.tab("Overview").parent().should("not.have.class", "border-primary");
  });

  it("walks through all five", () => {
    openTab("Income");
    cy.contains("button", "Add Income").should("be.visible");
    openTab("Expenses");
    cy.contains("button", "Add Expense").should("be.visible");
    openTab("Thresholds");
    cy.contains("button", "Add Threshold").should("be.visible");
    openTab("Alerts");
    cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");
    openTab("Overview");
    cy.contains("button", "Add Income").should("not.exist");
  });

  it("keeps the stat row on screen throughout", () => {
    openTab("Thresholds");
    cy.contains("Budget Utilization").should("be.visible");
  });

  it("keeps the period selector on screen throughout", () => {
    openTab("Alerts");
    sel.periodSelect().should("have.value", "2026-09");
  });

  it("brings the income table back when you return", () => {
    openIncome();
    cy.contains("September care fee").should("be.visible");
    openTab("Expenses");
    openTab("Income");
    cy.contains("September care fee").should("be.visible");
  });

  it("does not leak Add Income onto the Expenses tab", () => {
    openTab("Expenses");
    cy.contains("button", "Add Income").should("not.exist");
  });

  it("does not leak Add Expense onto the Income tab", () => {
    openIncome();
    cy.contains("button", "Add Expense").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// End to end
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps — Budget: end to end", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("records income and counts it once the ledger refreshes", () => {
    let saved = false;
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.stubUsers();
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      (req) => {
        req.reply({
          statusCode: 200,
          body: {
            budgets: saved
              ? [entry({ id: 1, description: "Raffle takings", amount_cents: 25000 })]
              : [],
            income_invoice: 0,
          },
        });
      }
    ).as("getIncome");
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: buildDashboardMetrics(),
    }).as("getMetrics");
    cy.intercept("POST", "**/v1/revops/budget", (req) => {
      saved = true;
      req.reply({ statusCode: 201, body: {} });
    }).as("createEntry");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);

    cy.wait("@getMetrics");
    openIncome();
    sel.incomeTotal().should("contain.text", "$0");

    cy.contains("button", "Add Income").click();
    fillEntry({ description: "Raffle takings", category: "MISC", amount: "250" });
    cy.contains("button", "Create Income").click();
    cy.wait("@createEntry");
    cy.assertPopover("Income created successfully!");
    cy.dismissPopover();

    cy.contains("Raffle takings", { timeout: 10000 }).should("be.visible");
    sel.incomeTotal().should("contain.text", "$250");
  });

  it("records an expense and shows it on the expense ledger", () => {
    let saved = false;
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
      (req) => {
        req.reply({
          statusCode: 200,
          body: {
            budgets: saved
              ? [expenseEntry({ id: 1, description: "Weekly shop", amount_cents: 45000 })]
              : [],
            expense_payroll: 0,
          },
        });
      }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: buildDashboardMetrics(),
    }).as("getMetrics");
    cy.intercept("POST", "**/v1/revops/budget", (req) => {
      saved = true;
      req.reply({ statusCode: 201, body: {} });
    }).as("createEntry");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);

    cy.wait("@getMetrics");
    openTab("Expenses");
    cy.contains("button", "Add Expense").click();
    fillEntry({ description: "Weekly shop", category: "GROCERIES", amount: "450" });
    cy.contains("button", "Create Expense").click();
    cy.wait("@createEntry");
    cy.assertPopover("Expense created successfully!");
    cy.dismissPopover();

    cy.contains("Weekly shop", { timeout: 10000 }).should("be.visible");
    sel.expenseTotal().should("contain.text", "$450");
  });

  it("corrects an income entry's amount", () => {
    visitBudget({ income: [entry({ id: 777, description: "Miscellaneous", amount_cents: 20500 })] });
    stubWrites();
    cy.wait("@getMetrics");
    openIncome();

    cy.openRowMenu("Miscellaneous");
    cy.contains("Edit Income").click();
    sel.amount().should("have.value", "205");
    sel.amount().clear().type("305");
    cy.contains("button", "Update Income").click();
    cy.wait("@updateEntry").its("request.body.amount_cents").should("eq", 30500);
    cy.assertPopover("Income updated successfully!");
  });

  it("sets a cap, then sees the alert it raises", () => {
    let created = false;
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", (req) => {
      req.reply({
        statusCode: 200,
        body: created ? homeWithThreshold({ fixedAmount: 1000 }) : buildHome(),
      });
    }).as("getHome");
    cy.stubUsers();
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      { statusCode: 200, body: { budgets: [], income_invoice: 0 } }
    ).as("getIncome");
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: buildDashboardMetrics(),
    }).as("getMetrics");
    cy.intercept("PUT", "**/v1/home", (req) => {
      created = true;
      req.reply({ statusCode: 200, body: {} });
    }).as("upsertHome");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);

    cy.wait("@getMetrics");
    openTab("Alerts");
    cy.contains("No budget alerts at this time.").should("be.visible");

    openTab("Thresholds");
    cy.contains("No thresholds set yet.", { timeout: 10000 }).should("be.visible");
    cy.contains("button", "Add Threshold").click();
    sel.thresholdName().clear().type("Groceries Cap");
    sel.thresholdCategory().select("GROCERIES");
    sel.fixedAmount().clear().type("1000");
    cy.contains("button", "Create Threshold").click();
    cy.wait("@upsertHome");
    cy.assertPopover("Threshold created successfully!");
    cy.dismissPopover();

    cy.contains("Groceries Cap", { timeout: 10000 }).should("be.visible");
    openTab("Alerts");
    cy.contains("Groceries expenses have exceeded the budget limit by $500.00", {
      timeout: 10000,
    }).should("be.visible");
  });

  it("disables a cap and the alert goes with it", () => {
    let disabled = false;
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", (req) => {
      req.reply({
        statusCode: 200,
        body: homeWithThreshold({ fixedAmount: 1000, isEnabled: !disabled }),
      });
    }).as("getHome");
    cy.stubUsers();
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
      { statusCode: 200, body: { budgets: [], income_invoice: 0 } }
    ).as("getIncome");
    cy.intercept(
      { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
      { statusCode: 200, body: { budgets: [], expense_payroll: 0 } }
    ).as("getExpenses");
    cy.intercept("GET", "**/v1/revops/budget/dashboard/metrics*", {
      statusCode: 200,
      body: buildDashboardMetrics(),
    }).as("getMetrics");
    cy.intercept("PUT", "**/v1/home", (req) => {
      disabled = true;
      req.reply({ statusCode: 200, body: {} });
    }).as("upsertHome");
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(BUDGET);

    cy.wait("@getMetrics");
    openTab("Alerts");
    cy.contains("exceeded the budget limit", { timeout: 10000 }).should("be.visible");

    openTab("Thresholds");
    cy.openRowMenu("Groceries Cap");
    cy.contains("Disable").click();
    cy.wait("@upsertHome");
    cy.assertPopover("Threshold disabled");
    cy.dismissPopover();

    sel.row("Groceries Cap").should("contain.text", "inactive");
    openTab("Alerts");
    cy.contains("No budget alerts at this time.", { timeout: 10000 }).should("be.visible");
  });

  it("carries a month's income and expenses through to the top stat row", () => {
    visitBudget({
      income: [entry({ amount_cents: 300000 })],
      incomeInvoice: 500000,
      expenses: [expenseEntry({ amount_cents: 100000 })],
      expensePayroll: 200000,
      metrics: buildDashboardMetrics({
        total_income: 800000,
        total_expense: 300000,
        net_balance: 500000,
        utilization: 37.5,
      }),
    });
    cy.wait("@getMetrics");

    cy.contains("Total Income").parent().should("contain.text", "$8,000");
    cy.contains("Total Expenses").parent().should("contain.text", "$3,000");
    cy.contains("Net Balance").parent().should("contain.text", "$5,000");

    openIncome();
    cy.contains("(Billing Invoices $5,000 + Added Income $3,000)").should("be.visible");

    openTab("Expenses");
    cy.contains("(Payroll $2,000 + Added Expenses $1,000)").should("be.visible");
  });
});
