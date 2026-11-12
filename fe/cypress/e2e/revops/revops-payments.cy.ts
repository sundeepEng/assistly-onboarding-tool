/// <reference types="cypress" />

/**
 * RevOps — Payment: paying the care team
 *
 *   pages/revops/payments.tsx                             the route and its gate
 *   components/revops/payroll/revops-payroll.tsx          the screen, month filter, tabs
 *   components/revops/payroll/tabs/pay-stubs-tab.tsx      the table and its four actions
 *   components/revops/payroll/tabs/caregivers-tab.tsx     the roster and its ⋮ menu
 *   components/revops/payroll/modals/new-pay-stub-modal.tsx   Create AND Edit
 *   components/revops/payroll/modals/view-pay-stub-modal.tsx  the read-only detail
 *   components/revops/payroll/modals/process-payment-modal.tsx Stripe / manual
 *   components/revops/payroll/pay-stub-pdf.ts             the downloaded PDF
 *   utils/revops/constants.ts                             options, labels, mappings
 *
 * This is the other half of RevOps: `revops-invoices.cy.ts` covers money coming
 * IN from residents, this one covers money going OUT to caregivers.
 *
 * ONE MODAL, TWO MODES
 *   New Pay Stub and Edit Pay Stub are the same component. `mode="edit"`
 *   disables all four selects, stops the shifts query from running at all, and
 *   turns the POST into a PUT. Only the expenses are actually editable — which
 *   is the whole point of the edit flow and is asserted from both directions.
 *
 * HOURS AND RATE ARE NEVER TYPED
 *   Both fields are `readOnly`. Hours come from the caregiver's clocked shifts
 *   in the chosen period; the rate comes from those same shifts — EXCEPT for a
 *   caregiver whose roster says `pay_frequency: "Monthly"`, where the roster
 *   rate wins and the hours stop mattering entirely. That is the John Sparrow
 *   case: a fixed bi-weekly cheque, zero hours logged, still $1,750 owed.
 *
 * THREE WAYS THE BASE AMOUNT IS DECIDED
 *   fixed roster    the roster rate (halved for a bi-weekly period)
 *   one shift rate  hours x that rate
 *   mixed rates     the per-rate breakdown table, summed
 *
 * THE CLOCK IS FROZEN
 *   The month filter defaults to `new Date()`, the Month dropdown offers the
 *   last 24 months from now, and the bi-weekly second option depends on the
 *   length of the chosen month. All three move with the wall clock, so every
 *   test freezes at Mon 14 Sep 2026.
 *
 * NOT COVERED
 *   Paying through Stripe. The card, its copy, its CTA and the fact that it is
 *   preselected are all asserted, but no checkout is driven — only the manual
 *   "Mark as Paid" path reaches the API here. What the pay stub PDF *says* is
 *   out of scope too, in line with the rest of the suite; the download is
 *   asserted down to a real `%PDF-` file with the right name.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildUserWithDocuments,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const PAYMENTS = "/revops/payments";

/** Monday 14 September 2026, 10:00 local. */
const FROZEN_NOW = new Date(2026, 8, 14, 10, 0, 0).getTime();

const THIS_MONTH = "2026-09";
const THIS_MONTH_LABEL = "September 2026";
const LAST_MONTH = "2026-08";
const LAST_MONTH_LABEL = "August 2026";

// ── Caregivers ───────────────────────────────────────────────────────────────

const KRISHNA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALBERT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SPARROW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOVA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const buildCaregiver = (
  userId: string,
  name: string,
  overrides: Record<string, any> = {}
) => ({
  userId,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-06-01T10:00:00.000Z",
  isDeleted: false,
  roaster: [{ pay_rate: "10", pay_frequency: "Hourly" }],
  ...overrides,
});

const KRISHNA_CG = buildCaregiver(KRISHNA, "Krishna Rao");
const ALBERT_CG = buildCaregiver(ALBERT, "Albert Einstein", {
  createdAt: "2026-08-17T10:00:00.000Z",
});
/** The fixed-rate edge case: paid monthly, so hours never enter the sum. */
const SPARROW_CG = buildCaregiver(SPARROW, "John Sparrow", {
  createdAt: "2026-03-18T10:00:00.000Z",
  roaster: [{ pay_rate: "3500", pay_frequency: "Monthly" }],
});
const NOVA_CG = buildCaregiver(NOVA, "Nova Carelead", {
  createdAt: "2026-05-14T10:00:00.000Z",
  roaster: [{ pay_rate: "12", pay_frequency: "Hourly" }],
});

const ALL_CAREGIVERS = [KRISHNA_CG, ALBERT_CG, SPARROW_CG, NOVA_CG];

// ── Pay stubs (the backend payout shape) ─────────────────────────────────────

const buildPayout = (overrides: Record<string, any> = {}) => ({
  id: 501,
  payroll_payout_id: "PAY-2026-09-0501",
  home_id: TEST_HOME_ID,
  pcho_user_id: TEST_USER_ID,
  pcg_user_id: KRISHNA,
  pcg_user_name: "Krishna Rao",
  period_type: "MONTHLY",
  period_label: THIS_MONTH_LABEL,
  period_start_date: "2026-09-01",
  period_end_date: "2026-09-30",
  hours_worked_minutes: 829,
  hourly_rate_cents: 1000,
  base_amount_cents: 13817,
  total_amount_cents: 13817,
  status: "DRAFT",
  notes: "",
  created_at: "2026-09-16T12:00:00.000Z",
  updated_at: "2026-09-16T12:00:00.000Z",
  items: [],
  ...overrides,
});

/**
 * What `formatCurrency` prints — `toLocaleString` on the browser's own locale,
 * so an en-GB runner renders "US$10.00" where en-US renders "$10.00". Derived
 * rather than hardcoded so the assertion holds wherever the suite runs.
 */
const usd = (dollars: number) =>
  dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** What `formatToShortDateRangeForPayStub` prints — Intl on the runner's locale. */
const payStubRange = (startIso: string, endIso: string) => {
  const parse = (value: string) => {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parse(startIso));
  const end = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parse(endIso));
  return `${start} - ${end}`;
};

/** Settled — no Edit, no Pay, a paid-on date instead. */
const PAID_STUB = buildPayout({ status: "PAID" });

/** Outstanding, bi-weekly, 1.50h at $10. */
const DUE_STUB = buildPayout({
  id: 502,
  payroll_payout_id: "PAY-2026-09-0502",
  pcg_user_id: ALBERT,
  pcg_user_name: "Albert Einstein",
  period_type: "BIWEEKLY",
  period_label: `${THIS_MONTH_LABEL} (1st - 15th)`,
  period_start_date: "2026-09-01",
  period_end_date: "2026-09-15",
  hours_worked_minutes: 90,
  hourly_rate_cents: 1000,
  base_amount_cents: 1500,
  total_amount_cents: 1500,
});

/** Nothing clocked, but $100 of expenses — the amount is all miscellaneous. */
const EXPENSES_ONLY_STUB = buildPayout({
  id: 503,
  payroll_payout_id: "PAY-2026-09-0503",
  pcg_user_id: NOVA,
  pcg_user_name: "Nova Carelead",
  hours_worked_minutes: 0,
  hourly_rate_cents: 0,
  base_amount_cents: 0,
  total_amount_cents: 10000,
  items: [
    {
      payout_item_id: "item-tips",
      payout_id: 503,
      description: "Tips",
      amount_cents: 10000,
      created_at: "2026-09-16T12:00:00.000Z",
    },
  ],
});

/** John Sparrow's fixed bi-weekly cheque. */
const SPARROW_STUB = buildPayout({
  id: 504,
  payroll_payout_id: "PAY-2026-09-0504",
  pcg_user_id: SPARROW,
  pcg_user_name: "John Sparrow",
  period_type: "BIWEEKLY",
  period_start_date: "2026-09-01",
  period_end_date: "2026-09-15",
  hours_worked_minutes: 0,
  hourly_rate_cents: 175000,
  base_amount_cents: 175000,
  total_amount_cents: 175000,
});

// ── Shifts (what the create form reads hours from) ────────────────────────────

const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 9001,
  user_id: ALBERT,
  user_name: "Albert Einstein",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_start_time: "2026-09-03T09:00:00.000Z",
  shift_end_time: "2026-09-03T10:30:00.000Z",
  clock_in_timestamp: "2026-09-03T09:00:00.000Z",
  clock_out_timestamp: "2026-09-03T10:30:00.000Z",
  pay_rate: "10",
  ...overrides,
});

/** 1.5 hours at $10 — one rate, so no breakdown table. */
const ONE_RATE_SHIFTS = [buildShift()];

/** 1.5h at $10 plus 2h at $20 — two rates, so the breakdown table appears. */
const MIXED_RATE_SHIFTS = [
  buildShift(),
  buildShift({
    id: 9002,
    pay_rate: "20",
    clock_in_timestamp: "2026-09-04T09:00:00.000Z",
    clock_out_timestamp: "2026-09-04T11:00:00.000Z",
  }),
];

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  monthFilter: () => cy.get('input[name="filterMonth"]'),
  newPayStub: () => cy.contains("button", "New Pay Stub"),
  tab: (label: string) => cy.contains("span", label),

  /** react-modal gives its content this class unless one is passed. */
  modal: () => cy.get(".ReactModal__Content", { timeout: 10000 }),
  /** CommonModal's cross — anchored on its position, not on "the only svg". */
  close: () => sel.modal().find('div[class*="right-6"]').first(),

  // Pay Stubs table
  row: (caregiver: string) =>
    cy.contains(caregiver).closest('div[class*="border-b"]'),
  view: (caregiver: string) => sel.row(caregiver).find('button[title="View details"]'),
  edit: (caregiver: string) =>
    sel.row(caregiver).find('button[title*="Edit pay stub"], button[title*="cannot be edited"]'),
  download: (caregiver: string) =>
    sel.row(caregiver).find('button[title="Download pay stub"]'),
  /** Lower-case `title` is the app's own spelling, not a typo here. */
  delete: (caregiver: string) =>
    sel.row(caregiver).find('button[title="delete pay stub"]'),
  pay: (caregiver: string) => sel.row(caregiver).contains("button", "Pay"),

  // The pay stub form (create and edit share it)
  periodType: () => cy.get('select[name="periodType"]'),
  month: () => cy.get('select[name="month"]'),
  dateRange: () => cy.get('select[name="dateRange"]'),
  caregiver: () => cy.get('select[name="caregiverId"]'),
  hoursWorked: () => cy.get('input[name="hoursWorked"]'),
  hourlyRate: () => cy.get('input[name="hourlyRate"]'),
  expenseDescription: () => cy.get('input[placeholder="Description (e.g., Tips)"]'),
  expenseAmount: () => cy.get('input[placeholder="Amount"]'),
  addExpense: () => sel.expenseAmount().closest("div.grid").find("button"),
  removeExpense: () => cy.contains("button", "Remove"),
  savePayStub: () => cy.contains("button", "Save Pay Stub"),
  updatePayStub: () => cy.contains("button", "Update Pay Stub"),
  cancel: () => cy.contains("button", /^Cancel$/),
  baseAmountRow: () => cy.contains("div", /^Base Amount$/).parent(),
  totalAmountRow: () => cy.contains("div", /^Total Amount$/).parent(),

  // Process Payment
  stripeCard: () => cy.contains("button", "Process payment instantly via Stripe"),
  manualCard: () => cy.contains("button", "Record an external payment"),
  manualType: () => cy.get('select[name="manualPaymentType"]'),
  reference: () => cy.get('input[name="manualReferenceId"]'),
  paidAmount: () => cy.get('input[name="amount"]'),
  payWithStripe: () => cy.contains("button", "Pay with Stripe"),
  markAsPaid: () => cy.contains("button", "Mark as Paid"),

  // Caregivers tab
  kebab: (name: string) => sel.row(name).find("svg.cursor-pointer"),
  menuItem: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubPayoutList = (payouts: any[]) =>
  cy
    .intercept("GET", "**/v1/revops/payout*", { statusCode: 200, body: { payouts } })
    .as("getPayouts");

const stubCaregivers = (users: any[] = ALL_CAREGIVERS) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as("getUsers");

const stubShifts = (shifts: any[] = []) =>
  cy
    .intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts } })
    .as("getShifts");

/** Every write this screen can make. */
const stubWrites = () => {
  cy.intercept("POST", "**/v1/revops/payout", { statusCode: 201, body: {} }).as(
    "createPayout"
  );
  cy.intercept("PUT", "**/v1/revops/payout/**", { statusCode: 200, body: {} }).as(
    "updatePayout"
  );
  cy.intercept("POST", "**/v1/revops/payment", { statusCode: 201, body: {} }).as(
    "createPayment"
  );
  // Delete arrived with the stg merge. Stubbed here rather than per-test so an
  // unexpected delete cannot escape to the real API from any spec below.
  cy.intercept("DELETE", "**/v1/revops/payout/**", { statusCode: 200, body: {} }).as(
    "deletePayout"
  );
};

const visitPayments = (
  payouts: any[] = [PAID_STUB, DUE_STUB],
  opts: {
    role?: any;
    home?: any;
    caregivers?: any[];
    shifts?: any[];
    expectRedirect?: boolean;
  } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUser(buildUserWithDocuments());
  stubCaregivers(opts.caregivers);
  stubShifts(opts.shifts);
  stubPayoutList(payouts);
  // A 1280x800 viewport is too small for this module: the taller modals push
  // their submit row below the fold, and the wider tables push the Actions
  // column outside the horizontal scroll window — so Cypress refuses to call
  // those elements visible for reasons that have nothing to do with the app.
  // Give the tests room rather than reaching for `force: true`, which would
  // hide a genuine coverage bug.
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(PAYMENTS);
  if (opts.expectRedirect) return;
  cy.contains("Payment Management", { timeout: 10000 }).should("be.visible");
};

/** Open the create modal with the three (or four) selections already made. */
const openCreate = (
  choices: { periodType?: string; month?: string; dateRange?: string; caregiver?: string } = {}
) => {
  sel.newPayStub().click();
  sel.modal().should("contain.text", "Create a pay stub for a caregiver.");
  if (choices.periodType) sel.periodType().select(choices.periodType);
  if (choices.month) sel.month().select(choices.month);
  if (choices.dateRange) sel.dateRange().select(choices.dateRange);
  if (choices.caregiver) sel.caregiver().select(choices.caregiver);
};

/** Add one miscellaneous line. */
const addExpense = (description: string, amount: string) => {
  sel.expenseDescription().clear().type(description);
  sel.expenseAmount().clear().type(amount);
  sel.addExpense().click();
};

/** The body of the last request on an alias, as an object. */
const bodyOf = (alias: `@${string}`, assert: (body: any) => void) =>
  cy.wait(alias).then((interception: any) => assert(interception.request.body));

describe("RevOps — Payment", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The screen
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Payment Management screen", () => {
    beforeEach(() => visitPayments());

    it("renders the heading", () => {
      cy.contains("Payment Management").should("be.visible");
    });

    it("renders the strapline", () => {
      cy.contains("Process caregiver payments and manage timesheets").should("be.visible");
    });

    it("offers a month filter", () => {
      sel.monthFilter().should("exist");
    });

    it("defaults the month filter to the current month", () => {
      sel.monthFilter().should("have.value", THIS_MONTH);
    });

    it("caps the month filter at the current month — you cannot pay the future", () => {
      sel.monthFilter().should("have.attr", "max", THIS_MONTH);
    });

    it("offers a New Pay Stub button", () => {
      sel.newPayStub().should("be.visible");
    });

    it("renders both tabs", () => {
      sel.tab("Pay Stubs").should("be.visible");
      sel.tab("Caregivers").should("be.visible");
    });

    it("does not render a Summary tab — it is commented out in source", () => {
      cy.contains("span", "Summary").should("not.exist");
    });

    it("lands on Pay Stubs", () => {
      cy.contains("Period Type").should("be.visible");
    });

    it("opens no modal until asked", () => {
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Who may reach it
  // ──────────────────────────────────────────────────────────────────────────

  describe("Reaching the screen", () => {
    it("lets a PCHO in", () => {
      visitPayments();
      cy.contains("Payment Management").should("be.visible");
    });

    it("turns a HomeAdmin away — it does not hold REVOPS_PAYROLL", { tags: [Tags.HOMEADMIN] }, () => {
      visitPayments([], { role: "HomeAdmin", expectRedirect: true });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", PAYMENTS);
    });

    it("turns a Lead away", () => {
      visitPayments([], { role: "Lead", expectRedirect: true });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", PAYMENTS);
    });

    it("turns a Senior away — it holds billing but not payroll", { tags: [Tags.SENIOR] }, () => {
      visitPayments([], { role: "Senior", expectRedirect: true });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", PAYMENTS);
    });

    it("gives a caregiver their own payroll view instead", { tags: [Tags.PCG] }, () => {
      // PCG holds REVOPS_PAYROLL, but the page swaps in PCGMyPayroll — an
      // employee looking at their own pay, not the home paying its team.
      visitPayments([], { role: "PCG", expectRedirect: true });
      cy.contains("Payment Management").should("not.exist");
    });

    it("[as-built] does not check the home's REVOPS entitlement", () => {
      // Billing & Invoices gates on `authorizedModules`; this page gates on the
      // role alone, so a home without the RevOps licence still reaches payroll.
      visitPayments([PAID_STUB], {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
      });
      cy.contains("Payment Management").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The pay stubs query
  // ──────────────────────────────────────────────────────────────────────────

  describe("The pay stubs query", () => {
    it("GETs /v1/revops/payout on load", () => {
      visitPayments();
      cy.wait("@getPayouts");
    });

    it("scopes it to the signed-in user's home", () => {
      visitPayments();
      cy.wait("@getPayouts");
      cy.assertQuery("@getPayouts", { home_id: TEST_HOME_ID });
    });

    it("asks for the whole of the filtered month", () => {
      visitPayments();
      cy.wait("@getPayouts").then((interception: any) => {
        const dates = new URL(interception.request.url).searchParams.getAll(
          "period_start_date"
        );
        expect(dates).to.deep.eq(["2026-09-01", "2026-09-30"]);
      });
    });

    it("authenticates with the session id token", () => {
      visitPayments();
      cy.wait("@getPayouts");
      cy.assertAuthorized("@getPayouts");
    });

    it("re-queries when the month changes", () => {
      visitPayments();
      cy.wait("@getPayouts");
      sel.monthFilter().clear().type(LAST_MONTH);
      cy.wait("@getPayouts").then((interception: any) => {
        const dates = new URL(interception.request.url).searchParams.getAll(
          "period_start_date"
        );
        expect(dates).to.deep.eq(["2026-08-01", "2026-08-31"]);
      });
    });

    it("gets February's short month right", () => {
      visitPayments();
      cy.wait("@getPayouts");
      sel.monthFilter().clear().type("2026-02");
      cy.wait("@getPayouts").then((interception: any) => {
        const dates = new URL(interception.request.url).searchParams.getAll(
          "period_start_date"
        );
        expect(dates).to.deep.eq(["2026-02-01", "2026-02-28"]);
      });
    });

    it("shows a loader while it is in flight", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      stubShifts();
      cy.intercept("GET", "**/v1/revops/payout*", (req) => {
        req.reply({ statusCode: 200, body: { payouts: [] }, delay: 1500 });
      }).as("getPayouts");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Loading...").should("be.visible");
    });

    it("says so when the query fails", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      stubShifts();
      cy.intercept("GET", "**/v1/revops/payout*", {
        statusCode: 500,
        body: { error: "boom" },
      }).as("getPayouts");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Failed to load pay stubs. Please try again.", {
        timeout: 20000,
      }).should("be.visible");
    });

    it("keeps the rest of the screen usable when the query fails", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      stubShifts();
      cy.intercept("GET", "**/v1/revops/payout*", { statusCode: 500, body: {} }).as(
        "getPayouts"
      );
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Failed to load pay stubs. Please try again.", { timeout: 20000 });
      sel.newPayStub().should("be.visible");
    });

    it("says nothing is there for an empty month", () => {
      visitPayments([]);
      cy.contains("Nothing added yet.").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. The pay stubs table
  // ──────────────────────────────────────────────────────────────────────────

  describe("The pay stubs table", () => {
    beforeEach(() => visitPayments([PAID_STUB, DUE_STUB, EXPENSES_ONLY_STUB]));

    it("names every column", () => {
      ["Caregiver", "Period Type", "Date Range", "Hours", "Amount", "Status", "Actions"].forEach(
        (header) => cy.contains(header).should("be.visible")
      );
    });

    it("lists one row per pay stub", () => {
      cy.contains("Krishna Rao").should("be.visible");
      cy.contains("Albert Einstein").should("be.visible");
      cy.contains("Nova Carelead").should("be.visible");
    });

    it("names the caregiver from the payout row itself", () => {
      sel.row("Krishna Rao").should("contain.text", "Krishna Rao");
    });

    it("falls back to a dash when the payout carries no name", () => {
      visitPayments([buildPayout({ pcg_user_name: undefined })]);
      cy.contains("--").should("be.visible");
    });

    it("calls a MONTHLY period Monthly", () => {
      sel.row("Krishna Rao").should("contain.text", "Monthly");
    });

    it("calls a BIWEEKLY period Bi-Weekly", () => {
      sel.row("Albert Einstein").should("contain.text", "Bi-Weekly");
    });

    it("[as-built] calls anything that is not BIWEEKLY Monthly", () => {
      // `revopsPayStubPeriodTypeFromBackend` has no third branch, so a missing
      // or unrecognised period type reads as Monthly rather than failing loudly.
      visitPayments([buildPayout({ period_type: "WEEKLY" })]);
      sel.row("Krishna Rao").should("contain.text", "Monthly");
    });

    it("renders a full-month date range", () => {
      sel.row("Krishna Rao").should("contain.text", payStubRange("2026-09-01", "2026-09-30"));
    });

    it("renders a half-month date range", () => {
      sel.row("Albert Einstein").should("contain.text", payStubRange("2026-09-01", "2026-09-15"));
    });

    it("renders a dash when a period date is missing", () => {
      visitPayments([buildPayout({ period_end_date: null })]);
      sel.row("Krishna Rao").should("contain.text", "—");
    });

    it("turns worked minutes into hours to two places", () => {
      sel.row("Krishna Rao").should("contain.text", "13.82h");
    });

    it("renders a fractional hour", () => {
      sel.row("Albert Einstein").should("contain.text", "1.50h");
    });

    it("renders zero hours rather than blank", () => {
      sel.row("Nova Carelead").should("contain.text", "0.00h");
    });

    it("turns cents into a dollar amount", () => {
      sel.row("Krishna Rao").should("contain.text", "$138.17");
    });

    it("formats a thousands separator", () => {
      visitPayments([SPARROW_STUB]);
      sel.row("John Sparrow").should("contain.text", "$1,750.00");
    });

    it("shows an amount made entirely of expenses", () => {
      sel.row("Nova Carelead").should("contain.text", "$100.00");
    });

    it("marks a settled stub Paid", () => {
      sel.row("Krishna Rao").should("contain.text", "Paid");
    });

    it("marks an unsettled stub Due", () => {
      sel.row("Albert Einstein").should("contain.text", "Due");
    });

    it("[as-built] calls every non-PAID status Due", () => {
      // DRAFT, FINALIZED and PENDING all collapse into one pill, so the table
      // cannot distinguish a stub that has been approved from one that has not.
      visitPayments([buildPayout({ status: "FINALIZED" })]);
      sel.row("Krishna Rao").should("contain.text", "Due");
    });

    it("keeps paid and unpaid stubs in the same list", () => {
      // Unlike invoices, a paid pay stub is not filtered out of the worklist.
      cy.contains("Krishna Rao").should("be.visible");
      cy.contains("Albert Einstein").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. The row actions
  // ──────────────────────────────────────────────────────────────────────────


  // ──────────────────────────────────────────────────────────────────────────
  // Deleting a pay stub
  //   components/revops/payroll/modals/delete-pay-stub-modal.tsx
  //
  // Added to stg after the rest of this spec was written. The control is
  // withheld from a PAID stub by the same rule that disables Edit.
  // ──────────────────────────────────────────────────────────────────────────

  describe("The delete action", () => {
    beforeEach(() => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
    });

    it("offers Delete on an unpaid stub", () => {
      sel.delete("Albert Einstein").should("exist");
    });

    it("withholds Delete from a paid stub", () => {
      sel.delete("Krishna Rao").should("not.exist");
    });

    it("still offers View on a paid stub", () => {
      sel.view("Krishna Rao").should("exist");
    });

    it("still offers Download on a paid stub", () => {
      sel.download("Krishna Rao").should("exist");
    });

    it("opens no modal until it is clicked", () => {
      cy.contains("Are you sure you want to delete this pay stub?").should(
        "not.exist"
      );
    });
  });

  describe("The delete confirmation", () => {
    beforeEach(() => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
      sel.delete("Albert Einstein").click();
    });

    it("asks for confirmation in as many words", () => {
      sel.modal().should(
        "contain.text",
        "Are you sure you want to delete this pay stub?"
      );
    });

    it("says the deletion cannot be undone", () => {
      sel.modal().should("contain.text", "This action cannot be undone");
    });

    it("repeats the warning in red", () => {
      sel.modal().should("contain.text", "You will not be able");
    });

    it("names the pay stub being deleted", () => {
      sel.modal().should("contain.text", "PAY-2026-09-0502");
    });

    it("names the caregiver", () => {
      sel.modal().should("contain.text", "Albert Einstein");
    });

    it("shows the period label", () => {
      sel.modal().should("contain.text", "1st - 15th");
    });

    it("shows the date range as the stored dates", () => {
      sel.modal().should("contain.text", "2026-09-01 - 2026-09-15");
    });

    it("shows the amount in dollars to the cent", () => {
      // Printed with toFixed(2) rather than the usual currency formatter, so
      // no thousands separator and always two decimals.
      sel.modal().should("contain.text", "$15.00");
    });

    it("offers a Cancel button", () => {
      sel.modal().contains("button", "Cancel").should("be.visible");
    });

    it("offers a Delete Pay Stub button", () => {
      sel.modal().contains("button", "Delete Pay Stub").should("be.visible");
    });

    it("sends nothing while it is only asking", () => {
      cy.assertNoRequest("@deletePayout");
    });

    it("closes on Cancel without deleting", () => {
      sel.modal().contains("button", "Cancel").click();
      cy.contains("Are you sure you want to delete this pay stub?").should(
        "not.exist"
      );
      cy.assertNoRequest("@deletePayout");
    });

    it("closes on the cross without deleting", () => {
      sel.close().click();
      cy.contains("Are you sure you want to delete this pay stub?").should(
        "not.exist"
      );
      cy.assertNoRequest("@deletePayout");
    });
  });

  describe("Deleting a pay stub", () => {
    beforeEach(() => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
      sel.delete("Albert Einstein").click();
    });

    const confirm = () =>
      sel.modal().contains("button", "Delete Pay Stub").click();

    it("DELETEs the payout", () => {
      confirm();
      cy.wait("@deletePayout");
    });

    it("addresses the request to the row's numeric id", () => {
      // `useDelete` builds `${path}/${id}` from `id`, NOT from the readable
      // `payroll_payout_id` the modal displays.
      confirm();
      cy.wait("@deletePayout").then(({ request }) => {
        expect(new URL(request.url).pathname).to.contain("/v1/revops/payout/502");
      });
    });

    it("authenticates with the session id token", () => {
      confirm();
      cy.wait("@deletePayout");
      cy.assertAuthorized("@deletePayout");
    });

    it("sends one request per press", () => {
      confirm();
      cy.wait("@deletePayout");
      cy.get("@deletePayout.all").should("have.length", 1);
    });

    it("confirms the deletion", () => {
      confirm();
      cy.assertPopover("Pay stub deleted successfully!");
    });

    it("closes the modal afterwards", () => {
      confirm();
      cy.wait("@deletePayout");
      cy.contains("Are you sure you want to delete this pay stub?").should(
        "not.exist"
      );
    });

    it("re-reads the list so the row can disappear", () => {
      cy.get("@getPayouts.all").then((before: any) => {
        confirm();
        cy.wait("@deletePayout");
        cy.get("@getPayouts.all", { timeout: 10000 }).should(
          "have.length.greaterThan",
          before.length
        );
      });
    });
  });

  describe("When the delete fails", () => {
    const stubDeleteFailure = (statusCode: number, body: any) =>
      cy
        .intercept("DELETE", "**/v1/revops/payout/**", { statusCode, body })
        .as("deletePayout");

    const confirm = () =>
      sel.modal().contains("button", "Delete Pay Stub").click();

    it("surfaces the API's own message", () => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
      stubDeleteFailure(409, { error: "This pay stub has already been paid." });
      sel.delete("Albert Einstein").click();
      confirm();
      cy.assertPopover("This pay stub has already been paid.");
    });

    it("falls back to its own message when the API sends none", () => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
      stubDeleteFailure(500, {});
      sel.delete("Albert Einstein").click();
      confirm();
      cy.assertPopover("Failed to delete pay stub. Please try again.");
    });

    it("keeps the stub in the table", () => {
      visitPayments([PAID_STUB, DUE_STUB]);
      stubWrites();
      stubDeleteFailure(500, {});
      sel.delete("Albert Einstein").click();
      confirm();
      cy.wait("@deletePayout");
      cy.contains("Albert Einstein").should("exist");
    });

    it("refuses to send at all when the row has no id", () => {
      // The guard before the mutation: without `id` there is no URL to
      // address, so it complains rather than calling /payout/undefined.
      stubWrites();
      const idless = buildPayout({
        id: undefined,
        payroll_payout_id: "PAY-NO-ID",
        pcg_user_id: ALBERT,
        pcg_user_name: "Albert Einstein",
        status: "DRAFT",
      });
      visitPayments([idless]);
      sel.delete("Albert Einstein").click();
      confirm();
      cy.assertPopover("Pay stub ID is missing.");
      cy.assertNoRequest("@deletePayout");
    });
  });

  describe("The row actions", () => {
    beforeEach(() => visitPayments([PAID_STUB, DUE_STUB]));

    it("offers View on every stub", () => {
      sel.view("Krishna Rao").should("exist");
      sel.view("Albert Einstein").should("exist");
    });

    it("offers Download on every stub", () => {
      sel.download("Krishna Rao").should("exist");
      sel.download("Albert Einstein").should("exist");
    });

    it("offers Edit on an unpaid stub", () => {
      sel.edit("Albert Einstein").should("not.be.disabled");
    });

    it("labels the Edit action", () => {
      sel.edit("Albert Einstein").should("have.attr", "title", "Edit pay stub");
    });

    it("disables Edit once the stub is paid", () => {
      sel.edit("Krishna Rao").should("be.disabled");
    });

    it("explains why Edit is disabled", () => {
      sel
        .edit("Krishna Rao")
        .should("have.attr", "title", "Paid pay stubs cannot be edited");
    });

    it("offers Pay on an unpaid stub", () => {
      sel.pay("Albert Einstein").should("be.visible");
    });

    it("withholds Pay from a paid stub", () => {
      sel.row("Krishna Rao").contains("button", "Pay").should("not.exist");
    });

    it("shows when a paid stub was paid instead", () => {
      sel.row("Krishna Rao").should("contain.text", "Paid 09/16/2026");
    });

    it("[as-built] reads 'Paid —' when there is no timestamp", () => {
      // The intended fallback is the bare word "Paid", but `formatIsoToDate`
      // returns an em dash rather than an empty string for a missing date, and
      // an em dash is truthy — so the dash branch is unreachable.
      visitPayments([buildPayout({ status: "PAID", updated_at: null })]);
      sel.row("Krishna Rao").should("contain.text", "Paid —");
    });

    it("sends nothing to the API just by rendering", () => {
      stubWrites();
      cy.assertNoRequest("@createPayout");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Viewing a pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Pay Stub Details modal", () => {
    beforeEach(() => {
      visitPayments([PAID_STUB, DUE_STUB]);
      sel.view("Krishna Rao").click();
    });

    it("opens on the view action", () => {
      sel.modal().should("contain.text", "Pay Stub Details");
    });

    it("names the caregiver it belongs to", () => {
      sel.modal().should("contain.text", "Pay stub for Krishna Rao");
    });

    it("quotes the pay stub's identifier", () => {
      sel.modal().should("contain.text", "ID: PAY-2026-09-0501");
    });

    it("states the period type", () => {
      sel.modal().should("contain.text", "Monthly");
    });

    it("states the date range", () => {
      sel.modal().should("contain.text", payStubRange("2026-09-01", "2026-09-30"));
    });

    it("states the hours and the rate they were paid at", () => {
      sel.modal().should("contain.text", `13.82h @ ${usd(10)}/hr`);
    });

    it("states the base amount", () => {
      sel.modal().should("contain.text", "$138.17");
    });

    it("states the status", () => {
      sel.modal().should("contain.text", "Paid");
    });

    it("breaks the total down into base pay", () => {
      sel.modal().should("contain.text", "Base Pay");
    });

    it("states the total amount", () => {
      sel.modal().should("contain.text", "Total Amount");
    });

    it("stamps when it was created", () => {
      sel.modal().should("contain.text", "Created: 09/16/2026");
    });

    it("stamps when it was last touched", () => {
      sel.modal().should("contain.text", "Last Updated: 09/16/2026");
    });

    it("hides the items section when there are none", () => {
      sel.modal().should("not.contain.text", "Additional Items");
    });

    it("hides the notes section when there are none", () => {
      sel.modal().should("not.contain.text", "Notes");
    });

    it("sends nothing to the API", () => {
      stubWrites();
      cy.assertNoRequest("@updatePayout");
    });

    it("closes on the cross", () => {
      sel.close().click();
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });

  describe("A pay stub with extras", () => {
    beforeEach(() => {
      visitPayments([EXPENSES_ONLY_STUB]);
      sel.view("Nova Carelead").click();
    });

    it("lists the additional items", () => {
      sel.modal().should("contain.text", "Additional Items");
    });

    it("names each item", () => {
      sel.modal().should("contain.text", "Tips");
    });

    it("prices each item", () => {
      sel.modal().should("contain.text", "$100.00");
    });

    it("stamps when an item was added", () => {
      sel.modal().should("contain.text", "Added: 09/16/2026");
    });

    it("totals the items separately from the base pay", () => {
      sel.modal().should("contain.text", "Additional Items");
      sel.modal().should("contain.text", "Total Amount");
    });

    it("shows notes when the stub carries them", () => {
      visitPayments([
        buildPayout({ notes: "Covered two extra weekend shifts." }),
      ]);
      sel.view("Krishna Rao").click();
      sel.modal().should("contain.text", "Covered two extra weekend shifts.");
    });

    it("renders a deduction in red", () => {
      visitPayments([
        buildPayout({
          items: [
            {
              payout_item_id: "item-advance",
              description: "Advance recovery",
              amount_cents: -5000,
            },
          ],
        }),
      ]);
      sel.view("Krishna Rao").click();
      sel.modal().contains(usd(-50)).should("have.class", "text-red-600");
    });

    it("dashes a missing created timestamp", () => {
      visitPayments([buildPayout({ created_at: null, updated_at: null })]);
      sel.view("Krishna Rao").click();
      sel.modal().should("contain.text", "Created: —");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Downloading a pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("Downloading a pay stub", () => {
    it("writes a PDF named after the pay stub", () => {
      visitPayments([PAID_STUB]);
      sel.download("Krishna Rao").click();
      cy.readFile("cypress/downloads/PAY-2026-09-0501.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("writes a real PDF", () => {
      visitPayments([PAID_STUB]);
      sel.download("Krishna Rao").click();
      cy.readFile("cypress/downloads/PAY-2026-09-0501.pdf", "binary", {
        timeout: 20000,
      }).then((contents: any) => {
        expect(contents.slice(0, 5), "PDF magic number").to.eq("%PDF-");
      });
    });

    it("falls back to the numeric id when there is no public identifier", () => {
      visitPayments([buildPayout({ payroll_payout_id: undefined, id: 777 })]);
      sel.download("Krishna Rao").click();
      cy.readFile("cypress/downloads/777.pdf", null, { timeout: 20000 }).should(
        "have.length.greaterThan",
        0
      );
    });

    it("reads the home so the employer block can be filled in", () => {
      visitPayments([PAID_STUB]);
      sel.download("Krishna Rao").click();
      cy.wait("@getHome");
    });

    it("still produces a PDF when the home lookup fails", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      stubShifts();
      stubPayoutList([buildPayout({ payroll_payout_id: "PAY-NO-HOME" })]);
      cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: {} }).as("getHome");
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Krishna Rao", { timeout: 10000 }).should("be.visible");
      sel.download("Krishna Rao").click();
      cy.readFile("cypress/downloads/PAY-NO-HOME.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("downloads a paid stub too", () => {
      visitPayments([buildPayout({ status: "PAID", payroll_payout_id: "PAY-PAID-1" })]);
      sel.download("Krishna Rao").click();
      cy.readFile("cypress/downloads/PAY-PAID-1.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. The New Pay Stub form — the three questions
  // ──────────────────────────────────────────────────────────────────────────

  describe("Opening New Pay Stub", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.newPayStub().click();
    });

    it("opens the modal", () => {
      sel.modal().should("contain.text", "New Pay Stub");
    });

    it("explains what it is for", () => {
      sel.modal().should("contain.text", "Create a pay stub for a caregiver.");
    });

    it("asks for a pay period type", () => {
      cy.contains("Pay Period Type").should("be.visible");
    });

    it("asks for a month", () => {
      cy.contains("Month").should("be.visible");
    });

    it("asks for a caregiver", () => {
      cy.contains("Caregiver").should("be.visible");
    });

    it("asks nothing else until a type is chosen", () => {
      cy.contains("Date Range").should("not.exist");
    });

    it("starts with nothing chosen", () => {
      sel.periodType().invoke("val").should("not.be.ok");
      sel.month().invoke("val").should("not.be.ok");
      sel.caregiver().invoke("val").should("not.be.ok");
    });

    it("prompts for a type", () => {
      sel.periodType().contains("option", "Select type").should("exist");
    });

    it("prompts for a month", () => {
      sel.month().contains("option", "Select month").should("exist");
    });

    it("prompts for a caregiver", () => {
      sel.caregiver().contains("option", "Select caregiver").should("exist");
    });

    it("hides the pay figures until a caregiver is chosen", () => {
      cy.contains("Hours Worked").should("not.exist");
      cy.contains("Base Amount").should("not.exist");
    });

    it("offers Cancel and Save", () => {
      sel.cancel().should("be.visible");
      sel.savePayStub().should("be.visible");
    });

    it("closes on Cancel", () => {
      sel.cancel().click();
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("closes on the cross", () => {
      sel.close().click();
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("forgets the selections when reopened", () => {
      sel.periodType().select("Monthly");
      sel.cancel().click();
      sel.newPayStub().click();
      sel.periodType().invoke("val").should("not.be.ok");
    });
  });

  describe("The Pay Period Type question", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.newPayStub().click();
    });

    it("offers exactly two types", () => {
      // Plus the disabled placeholder.
      sel.periodType().find("option").should("have.length", 3);
    });

    it("offers Bi-Weekly", () => {
      sel.periodType().contains("option", "Bi-Weekly").should("exist");
    });

    it("offers Monthly", () => {
      sel.periodType().contains("option", "Monthly").should("exist");
    });

    it("asks no date range for Monthly", () => {
      sel.periodType().select("Monthly");
      cy.contains("Date Range").should("not.exist");
    });

    it("asks for a date range once Bi-Weekly is chosen", () => {
      sel.periodType().select("Bi-Weekly");
      cy.contains("Date Range").should("be.visible");
    });

    it("drops the date range question again on switching back to Monthly", () => {
      sel.periodType().select("Bi-Weekly");
      cy.contains("Date Range").should("be.visible");
      sel.periodType().select("Monthly");
      cy.contains("Date Range").should("not.exist");
    });

    it("clears a chosen date range when the type changes", () => {
      sel.periodType().select("Bi-Weekly");
      sel.month().select(THIS_MONTH_LABEL);
      sel.dateRange().select("1st - 15th");
      sel.periodType().select("Monthly");
      sel.periodType().select("Bi-Weekly");
      sel.dateRange().invoke("val").should("not.be.ok");
    });
  });

  describe("The Month question", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.newPayStub().click();
    });

    it("offers two years of months", () => {
      sel.month().find("option").should("have.length", 25);
    });

    it("starts at the current month", () => {
      sel.month().find("option").eq(1).should("have.text", THIS_MONTH_LABEL);
    });

    it("offers last month next", () => {
      sel.month().find("option").eq(2).should("have.text", LAST_MONTH_LABEL);
    });

    it("reaches back two years", () => {
      sel.month().find("option").last().should("have.text", "October 2024");
    });

    it("offers no future month", () => {
      sel.month().contains("option", "October 2026").should("not.exist");
    });

    it("stores the month as YYYY-MM", () => {
      sel.month().select(THIS_MONTH_LABEL);
      sel.month().should("have.value", THIS_MONTH);
    });
  });

  describe("The Date Range question", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.newPayStub().click();
      sel.periodType().select("Bi-Weekly");
    });

    it("offers exactly two halves", () => {
      sel.dateRange().find("option").should("have.length", 3);
    });

    it("offers the first half", () => {
      sel.dateRange().contains("option", "1st - 15th").should("exist");
    });

    it("defaults the second half to the 31st before a month is chosen", () => {
      sel.dateRange().contains("option", "16th - 31st").should("exist");
    });

    it("ends the second half on the last day of a 30-day month", () => {
      sel.month().select(THIS_MONTH_LABEL);
      sel.dateRange().contains("option", "16th - 30th").should("exist");
    });

    it("ends the second half on the 31st of a 31-day month", () => {
      sel.month().select("December 2025");
      sel.dateRange().contains("option", "16th - 31st").should("exist");
    });

    it("ends the second half on the 28th of February", () => {
      sel.month().select("February 2026");
      sel.dateRange().contains("option", "16th - 28th").should("exist");
    });

    it("stores the first half as a day span", () => {
      sel.month().select(THIS_MONTH_LABEL);
      sel.dateRange().select("1st - 15th");
      sel.dateRange().should("have.value", "1-15");
    });

    it("stores the second half as a day span", () => {
      sel.month().select(THIS_MONTH_LABEL);
      sel.dateRange().select("16th - 30th");
      sel.dateRange().should("have.value", "16-30");
    });

    it("clears the chosen half when the month changes", () => {
      sel.month().select(THIS_MONTH_LABEL);
      sel.dateRange().select("1st - 15th");
      sel.month().select(LAST_MONTH_LABEL);
      sel.dateRange().invoke("val").should("not.be.ok");
    });
  });

  describe("The Caregiver question", () => {
    it("lists every active caregiver", () => {
      visitPayments([]);
      sel.newPayStub().click();
      sel.caregiver().find("option").should("have.length", ALL_CAREGIVERS.length + 1);
    });

    it("names them", () => {
      visitPayments([]);
      sel.newPayStub().click();
      sel.caregiver().contains("option", "John Sparrow").should("exist");
    });

    it("leaves a deleted caregiver out", () => {
      visitPayments([], {
        caregivers: [KRISHNA_CG, buildCaregiver(NOVA, "Gone Away", { isDeleted: true })],
      });
      sel.newPayStub().click();
      sel.caregiver().contains("option", "Gone Away").should("not.exist");
    });

    it("says it is still loading them", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      cy.intercept("GET", "**/v1/users*", (req) => {
        req.reply({ statusCode: 200, body: { users: ALL_CAREGIVERS }, delay: 2000 });
      }).as("getUsers");
      stubShifts();
      stubPayoutList([]);
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Payment Management", { timeout: 10000 });
      sel.newPayStub().click();
      sel.caregiver().contains("option", "Loading caregivers...").should("exist");
    });

    it("disables the select while they load", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      cy.intercept("GET", "**/v1/users*", (req) => {
        req.reply({ statusCode: 200, body: { users: ALL_CAREGIVERS }, delay: 2000 });
      }).as("getUsers");
      stubShifts();
      stubPayoutList([]);
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Payment Management", { timeout: 10000 });
      sel.newPayStub().click();
      sel.caregiver().should("be.disabled");
    });

    it("reveals the pay figures once one is chosen", () => {
      visitPayments([]);
      openCreate({ periodType: "Monthly", month: THIS_MONTH_LABEL, caregiver: "Albert Einstein" });
      cy.contains("Hours Worked").should("be.visible");
      cy.contains("Base Amount").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Where the hours come from
  // ──────────────────────────────────────────────────────────────────────────

  describe("The hours query", () => {
    it("asks for nothing until a caregiver is chosen", () => {
      visitPayments([]);
      openCreate({ periodType: "Monthly", month: THIS_MONTH_LABEL });
      cy.assertNoRequest("@getShifts");
    });

    it("asks for nothing until a month is chosen", () => {
      visitPayments([]);
      openCreate({ periodType: "Monthly", caregiver: "Albert Einstein" });
      cy.assertNoRequest("@getShifts");
    });

    it("waits for the half-month before asking, on a bi-weekly stub", () => {
      visitPayments([]);
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.assertNoRequest("@getShifts");
    });

    it("asks once all four are chosen", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
    });

    it("asks only for that caregiver", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      cy.assertQuery("@getShifts", { user_id: ALBERT });
    });

    it("asks only for this home", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      cy.assertQuery("@getShifts", { home_id: TEST_HOME_ID });
    });

    it("asks only for available shifts", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      cy.assertQuery("@getShifts", { shift_status: "available" });
    });

    it("bounds a monthly stub by the whole month", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts").then((interception: any) => {
        const times = new URL(interception.request.url).searchParams.getAll(
          "shift_start_time"
        );
        expect(times).to.have.length(2);
        expect(new Date(times[0]).getDate()).to.eq(1);
        expect(new Date(times[1]).getDate()).to.eq(30);
      });
    });

    it("bounds a first-half stub by the 1st and the 15th", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts").then((interception: any) => {
        const times = new URL(interception.request.url).searchParams.getAll(
          "shift_start_time"
        );
        expect(new Date(times[0]).getDate()).to.eq(1);
        expect(new Date(times[1]).getDate()).to.eq(15);
      });
    });

    it("bounds a second-half stub by the 16th and the last day", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "16th - 30th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts").then((interception: any) => {
        const times = new URL(interception.request.url).searchParams.getAll(
          "shift_start_time"
        );
        expect(new Date(times[0]).getDate()).to.eq(16);
        expect(new Date(times[1]).getDate()).to.eq(30);
      });
    });

    it("asks again when the caregiver changes", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.caregiver().select("Nova Carelead");
      cy.wait("@getShifts");
      cy.assertQuery("@getShifts", { user_id: NOVA });
    });

    it("reports how many hours it found", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 1.50 hours").should("be.visible");
    });

    it("reports zero hours rather than staying silent", () => {
      visitPayments([], { shifts: [] });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 0.00 hours").should("be.visible");
    });

    it("says it is still loading them", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
        req.reply({ statusCode: 200, body: { shifts: ONE_RATE_SHIFTS }, delay: 2000 });
      }).as("getShifts");
      stubPayoutList([]);
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Payment Management", { timeout: 10000 });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loading hours worked...").should("be.visible");
    });

    it("blocks Save while the hours are loading", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
        req.reply({ statusCode: 200, body: { shifts: ONE_RATE_SHIFTS }, delay: 2000 });
      }).as("getShifts");
      stubPayoutList([]);
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Payment Management", { timeout: 10000 });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      sel.savePayStub().should("be.disabled");
    });

    it("says so when the hours cannot be loaded", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUser(buildUserWithDocuments());
      stubCaregivers();
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 500, body: {} }).as(
        "getShifts"
      );
      stubPayoutList([]);
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(PAYMENTS);
      cy.contains("Payment Management", { timeout: 10000 });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Failed to load hours worked", { timeout: 20000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Hours, rate and the base amount
  // ──────────────────────────────────────────────────────────────────────────

  describe("An hourly caregiver", () => {
    beforeEach(() => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
    });

    it("fills the hours in from the shifts", () => {
      sel.hoursWorked().should("have.value", "1.5");
    });

    it("fills the rate in from the shifts", () => {
      sel.hourlyRate().should("have.value", "10");
    });

    it("will not let the hours be typed over", () => {
      sel.hoursWorked().should("have.attr", "readonly");
    });

    it("will not let the rate be typed over", () => {
      sel.hourlyRate().should("have.attr", "readonly");
    });

    it("calls the rate an hourly one", () => {
      cy.contains("Hourly Rate ($)").should("be.visible");
    });

    it("multiplies the two into the base amount", () => {
      sel.baseAmountRow().should("contain.text", "$15.00");
    });

    it("shows its working in the base pay line", () => {
      cy.contains("Base Pay (1.5h x $10/h)").should("be.visible");
    });

    it("carries the base straight into the total", () => {
      sel.totalAmountRow().should("contain.text", "$15.00");
    });

    it("explains where the hours came from", () => {
      // PopoverComponent puts the hover handlers on a wrapper around the icon,
      // and React derives onMouseEnter from mouseover — so the event has to go
      // to the wrapper, not the icon's own div.
      cy.get('div[class*="w-[20px]"]').first().parent().trigger("mouseover");
      cy.contains(
        "Hours worked is calculated based on the shifts logged by the caregiver."
      ).should("be.visible");
    });
  });

  describe("A caregiver with nothing clocked", () => {
    beforeEach(() => {
      visitPayments([], { shifts: [] });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Nova Carelead",
      });
    });

    it("reports no hours", () => {
      sel.hoursWorked().should("have.value", "0");
    });

    it("reports no base amount", () => {
      sel.baseAmountRow().should("contain.text", "$0.00");
    });

    it("still lets the stub be saved — expenses may be all there is", () => {
      sel.savePayStub().should("not.be.disabled");
    });
  });

  describe("Shifts that do not count towards the hours", () => {
    it("ignores a shift that was never clocked out of", () => {
      visitPayments([], {
        shifts: [buildShift({ clock_out_timestamp: null })],
      });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 0.00 hours").should("be.visible");
    });

    it("ignores a shift that was never clocked into", () => {
      visitPayments([], {
        shifts: [buildShift({ clock_in_timestamp: null })],
      });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 0.00 hours").should("be.visible");
    });

    it("ignores a shift clocked out before it was clocked into", () => {
      visitPayments([], {
        shifts: [
          buildShift({
            clock_in_timestamp: "2026-09-03T11:00:00.000Z",
            clock_out_timestamp: "2026-09-03T09:00:00.000Z",
          }),
        ],
      });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 0.00 hours").should("be.visible");
    });

    it("ignores a shift carrying no pay rate", () => {
      visitPayments([], { shifts: [buildShift({ pay_rate: "0" })] });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 0.00 hours").should("be.visible");
    });

    it("adds up two shifts at the same rate", () => {
      visitPayments([], {
        shifts: [
          buildShift(),
          buildShift({
            id: 9003,
            clock_in_timestamp: "2026-09-05T09:00:00.000Z",
            clock_out_timestamp: "2026-09-05T11:30:00.000Z",
          }),
        ],
      });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.contains("Loaded 4.00 hours").should("be.visible");
      sel.baseAmountRow().should("contain.text", "$40.00");
    });

    it("strips a currency symbol off a shift's rate", () => {
      visitPayments([], { shifts: [buildShift({ pay_rate: "$10.00" })] });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      sel.hourlyRate().should("have.value", "10");
    });
  });

  describe("A caregiver paid a fixed amount", () => {
    beforeEach(() => {
      visitPayments([], { shifts: [] });
    });

    it("calls the rate a monthly one on a monthly stub", () => {
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "John Sparrow",
      });
      cy.contains("Monthly Rate ($)").should("be.visible");
    });

    it("takes the rate from the roster, not from any shift", () => {
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "John Sparrow",
      });
      sel.hourlyRate().should("have.value", "3500");
    });

    it("pays the full monthly amount", () => {
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "John Sparrow",
      });
      sel.baseAmountRow().should("contain.text", "$3,500.00");
    });

    it("names the monthly rate in the base pay line", () => {
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "John Sparrow",
      });
      cy.contains("Base Pay (Monthly Rate)").should("be.visible");
    });

    it("halves the rate for a bi-weekly stub", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.hourlyRate().should("have.value", "1750");
    });

    it("calls it a bi-weekly rate on a bi-weekly stub", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      cy.contains("Bi-Weekly Rate ($)").should("be.visible");
    });

    it("pays half the monthly amount", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.baseAmountRow().should("contain.text", "$1,750.00");
    });

    it("pays it with zero hours logged — the edge case the whole rule exists for", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.hoursWorked().should("have.value", "0");
      sel.totalAmountRow().should("contain.text", "$1,750.00");
    });

    it("pays the same fixed amount even when hours were logged", () => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS.map((s) => ({ ...s, user_id: SPARROW })) });
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      cy.wait("@getShifts");
      sel.baseAmountRow().should("contain.text", "$1,750.00");
    });

    it("keeps the rate when the period type is switched", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.hourlyRate().should("have.value", "1750");
      sel.periodType().select("Monthly");
      sel.hourlyRate().should("have.value", "3500");
    });

    it("[as-built] leaves the old rate behind when switching to an hourly caregiver", () => {
      // Nothing resets `hourlyRate` when the new caregiver has an hourly roster
      // and no clocked shifts, so the field keeps the previous caregiver's
      // figure — $1,750/hour, in this case — and the base pay line quotes it.
      // Saving here would record a nonsense rate against a real payout.
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.hourlyRate().should("have.value", "1750");
      sel.caregiver().select("Nova Carelead");
      sel.hourlyRate().should("have.value", "1750");
      cy.contains("Base Pay (0h x $1750/h)").should("be.visible");
    });
  });

  describe("A caregiver worked at more than one rate", () => {
    beforeEach(() => {
      visitPayments([], { shifts: MIXED_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
    });

    it("hides the single hours field", () => {
      cy.get('input[name="hoursWorked"]').should("not.exist");
    });

    it("hides the single rate field", () => {
      cy.get('input[name="hourlyRate"]').should("not.exist");
    });

    it("shows a breakdown instead", () => {
      cy.contains("Hourly Rate").should("be.visible");
      cy.contains("Wages").should("be.visible");
    });

    it("lists the lower rate", () => {
      cy.contains("$10.00/hr").should("be.visible");
    });

    it("lists the higher rate", () => {
      cy.contains("$20.00/hr").should("be.visible");
    });

    it("orders the rates cheapest first", () => {
      // Asserted inside `should` so it RETRIES. `.invoke("text").then(...)`
      // reads the body once, which raced the shifts query — both rates were
      // absent and `-1 < -1` failed. It passed for a long time by luck.
      cy.get("body").should(($body) => {
        const text = $body.text();
        const cheaper = text.indexOf("$10.00/hr");
        const dearer = text.indexOf("$20.00/hr");
        expect(cheaper, "the cheaper rate is rendered").to.be.greaterThan(-1);
        expect(dearer, "the dearer rate is rendered").to.be.greaterThan(-1);
        expect(cheaper).to.be.lessThan(dearer);
      });
    });

    it("totals the hours across the rates", () => {
      cy.contains("Loaded 3.50 hours").should("be.visible");
    });

    it("totals the wages across the rates", () => {
      sel.baseAmountRow().should("contain.text", "$55.00");
    });

    it("says it is a mixed-rate base pay", () => {
      cy.contains("Base Pay (Mixed hourly rates)").should("be.visible");
    });

    it("shows the single field again when the rates are not mixed", () => {
      // The breakdown is not sticky — one rate puts the two inputs back.
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      cy.get('input[name="hoursWorked"]').should("exist");
      cy.contains("Base Pay (Mixed hourly rates)").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Additional expenses
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Additional Expenses editor", () => {
    beforeEach(() => {
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
    });

    it("heads the section", () => {
      cy.contains("Additional Expenses / Miscellaneous").should("be.visible");
    });

    it("prompts for a description", () => {
      sel.expenseDescription().should("have.attr", "placeholder", "Description (e.g., Tips)");
    });

    it("prompts for an amount", () => {
      sel.expenseAmount().should("have.attr", "placeholder", "Amount");
    });

    it("offers an add button", () => {
      sel.addExpense().should("be.visible");
    });

    it("starts with no lines", () => {
      cy.contains("button", "Remove").should("not.exist");
    });

    it("adds a line", () => {
      addExpense("Tips", "50");
      cy.contains("Tips").should("be.visible");
    });

    it("prices the line", () => {
      addExpense("Tips", "50");
      cy.contains("$50.00").should("be.visible");
    });

    it("offers to remove the line", () => {
      addExpense("Tips", "50");
      sel.removeExpense().should("be.visible");
    });

    it("clears the inputs after adding", () => {
      addExpense("Tips", "50");
      sel.expenseDescription().should("have.value", "");
      sel.expenseAmount().should("have.value", "");
    });

    it("adds the expense to the total", () => {
      addExpense("Tips", "50");
      sel.totalAmountRow().should("contain.text", "$65.00");
    });

    it("leaves the base amount alone", () => {
      addExpense("Tips", "50");
      sel.baseAmountRow().should("contain.text", "$15.00");
    });

    it("adds a second line", () => {
      addExpense("Tips", "50");
      addExpense("Mileage", "25");
      cy.contains("Mileage").should("be.visible");
    });

    it("sums both lines into the total", () => {
      addExpense("Tips", "50");
      addExpense("Mileage", "25");
      sel.totalAmountRow().should("contain.text", "$90.00");
    });

    it("takes a decimal amount", () => {
      addExpense("Mileage", "12.75");
      cy.contains("$12.75").should("be.visible");
    });

    it("trims a padded description", () => {
      sel.expenseDescription().clear().type("   Tips   ");
      sel.expenseAmount().clear().type("50");
      sel.addExpense().click();
      cy.contains("button", "Remove")
        .closest('div[class*="justify-between"]')
        .should("contain.text", "Tips");
    });

    it("refuses a line with no description", () => {
      sel.expenseAmount().clear().type("50");
      sel.addExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("refuses a line with no amount", () => {
      sel.expenseDescription().clear().type("Tips");
      sel.addExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("refuses a whitespace-only description", () => {
      sel.expenseDescription().clear().type("   ");
      sel.expenseAmount().clear().type("50");
      sel.addExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("refuses a zero amount", () => {
      sel.expenseDescription().clear().type("Tips");
      sel.expenseAmount().clear().type("0");
      sel.addExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("refuses a negative amount", () => {
      sel.expenseDescription().clear().type("Deduction");
      sel.expenseAmount().clear().type("-50");
      sel.addExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("removes a line again", () => {
      addExpense("Tips", "50");
      sel.removeExpense().click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("takes the removed line back out of the total", () => {
      addExpense("Tips", "50");
      sel.totalAmountRow().should("contain.text", "$65.00");
      sel.removeExpense().click();
      sel.totalAmountRow().should("contain.text", "$15.00");
    });

    it("removes only the line asked for", () => {
      addExpense("Tips", "50");
      addExpense("Mileage", "25");
      cy.contains("Mileage").parents('div[class*="justify-between"]').first().contains("button", "Remove").click();
      cy.contains("Tips").should("be.visible");
      cy.contains("Mileage").should("not.exist");
    });

    it("lets a fixed-rate caregiver carry expenses too", () => {
      visitPayments([], { shifts: [] });
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      addExpense("Tips", "50");
      sel.totalAmountRow().should("contain.text", "$1,800.00");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Validating the pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("Validating a new pay stub", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([]);
      sel.newPayStub().click();
    });

    it("insists on a pay period type", () => {
      sel.savePayStub().click();
      cy.contains("Select pay period type").should("be.visible");
    });

    it("insists on a month", () => {
      sel.savePayStub().click();
      cy.contains("Select month").should("be.visible");
    });

    it("insists on a caregiver", () => {
      sel.savePayStub().click();
      cy.contains("Select caregiver").should("be.visible");
    });

    it("sends nothing when all three are missing", () => {
      sel.savePayStub().click();
      cy.assertNoRequest("@createPayout");
    });

    it("insists on a date range for a bi-weekly stub", () => {
      sel.periodType().select("Bi-Weekly");
      sel.month().select(THIS_MONTH_LABEL);
      sel.caregiver().select("Albert Einstein");
      sel.savePayStub().click();
      cy.contains("Select date range").should("be.visible");
    });

    it("sends nothing while the date range is missing", () => {
      sel.periodType().select("Bi-Weekly");
      sel.month().select(THIS_MONTH_LABEL);
      sel.caregiver().select("Albert Einstein");
      sel.savePayStub().click();
      cy.assertNoRequest("@createPayout");
    });

    it("asks for no date range on a monthly stub", () => {
      sel.periodType().select("Monthly");
      sel.month().select(THIS_MONTH_LABEL);
      sel.caregiver().select("Albert Einstein");
      sel.savePayStub().click();
      cy.contains("Select date range").should("not.exist");
    });

    it("clears the complaint once the field is answered", () => {
      // `REVOPS_PAY_STUB_PLACEHOLDERS.MONTH` and
      // `REVOPS_PAY_STUB_VALIDATION_MESSAGES.MONTH_REQUIRED` are both the
      // literal "Select month", and the placeholder `<option>` never leaves the
      // DOM — so the complaint has to be read off the error node itself.
      sel.savePayStub().click();
      cy.get("div.text-red-500").should("contain.text", "Select month");
      // The error container renders unconditionally — empty when there is no
      // complaint — so it is the TEXT that has to go, not the node.
      sel.month().select(THIS_MONTH_LABEL);
      cy.get("div.text-red-500").should("not.contain.text", "Select month");
    });

    it("sends nothing on Cancel", () => {
      sel.periodType().select("Monthly");
      sel.month().select(THIS_MONTH_LABEL);
      sel.caregiver().select("Albert Einstein");
      sel.cancel().click();
      cy.assertNoRequest("@createPayout");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Saving a pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving a new pay stub", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([], { shifts: ONE_RATE_SHIFTS });
    });

    const fillMonthly = () => {
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
    };

    it("POSTs to the payout endpoint", () => {
      fillMonthly();
      sel.savePayStub().click();
      cy.wait("@createPayout");
    });

    it("authenticates the write", () => {
      fillMonthly();
      sel.savePayStub().click();
      cy.wait("@createPayout");
      cy.assertAuthorized("@createPayout");
    });

    it("stamps the home on it", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.home_id).to.eq(TEST_HOME_ID));
    });

    it("records who raised it", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.pcho_user_id).to.eq(TEST_USER_ID));
    });

    it("records who it is for", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.pcg_user_id).to.eq(ALBERT));
    });

    it("mints an identifier stamped with the period", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) =>
        expect(body.payroll_payout_id).to.match(/^PAY-2026-09-\d+$/)
      );
    });

    it("sends a monthly period type", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.period_type).to.eq("MONTHLY"));
    });

    it("labels the period", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.period_label).to.eq(THIS_MONTH_LABEL));
    });

    it("spans the whole month", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.period_start_date).to.eq("2026-09-01");
        expect(body.period_end_date).to.eq("2026-09-30");
      });
    });

    it("sends the hours as minutes", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.hours_worked_minutes).to.eq(90));
    });

    it("sends the rate in cents", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.hourly_rate_cents).to.eq(1000));
    });

    it("sends the base amount in cents", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.base_amount_cents).to.eq(1500));
    });

    it("sends the total in cents", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.total_amount_cents).to.eq(1500));
    });

    it("raises it as a draft", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.status).to.eq("DRAFT"));
    });

    it("sends no items when there are no expenses", () => {
      fillMonthly();
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.items).to.deep.eq([]));
    });

    it("sends each expense as an item", () => {
      fillMonthly();
      addExpense("Tips", "50");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.items).to.have.length(1);
        expect(body.items[0].description).to.eq("Tips");
        expect(body.items[0].amount_cents).to.eq(5000);
      });
    });

    it("gives a new item its own identifier", () => {
      fillMonthly();
      addExpense("Tips", "50");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) =>
        expect(body.items[0].payout_item_id).to.be.a("string").and.not.be.empty
      );
    });

    it("leaves the payout id at zero — the backend assigns it", () => {
      fillMonthly();
      addExpense("Tips", "50");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.items[0].payout_id).to.eq(0));
    });

    it("adds the expenses into the total", () => {
      fillMonthly();
      addExpense("Tips", "50");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.total_amount_cents).to.eq(6500));
    });

    it("sends a bi-weekly period type", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.period_type).to.eq("BIWEEKLY"));
    });

    it("names the half-month in the label", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) =>
        expect(body.period_label).to.eq("September 2026 (1st - 15th)")
      );
    });

    it("spans the first half of the month", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.period_start_date).to.eq("2026-09-01");
        expect(body.period_end_date).to.eq("2026-09-15");
      });
    });

    it("spans the second half of the month", () => {
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "16th - 30th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.period_start_date).to.eq("2026-09-16");
        expect(body.period_end_date).to.eq("2026-09-30");
      });
    });

    it("sends a fixed-rate caregiver their whole monthly amount", () => {
      visitPayments([], { shifts: [] });
      stubWrites();
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "John Sparrow",
      });
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.hourly_rate_cents).to.eq(350000);
        expect(body.base_amount_cents).to.eq(350000);
      });
    });

    it("halves it for a bi-weekly period", () => {
      visitPayments([], { shifts: [] });
      stubWrites();
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.hourly_rate_cents).to.eq(175000);
        expect(body.base_amount_cents).to.eq(175000);
        expect(body.hours_worked_minutes).to.eq(0);
      });
    });

    it("sends no single rate when the hours were worked at several", () => {
      visitPayments([], { shifts: MIXED_RATE_SHIFTS });
      stubWrites();
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.hourly_rate_cents).to.eq(0));
    });

    it("sends the summed wages as the base for mixed rates", () => {
      visitPayments([], { shifts: MIXED_RATE_SHIFTS });
      stubWrites();
      openCreate({
        periodType: "Monthly",
        month: THIS_MONTH_LABEL,
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => {
        expect(body.base_amount_cents).to.eq(5500);
        expect(body.hours_worked_minutes).to.eq(210);
      });
    });

    it("confirms the stub was created", () => {
      fillMonthly();
      sel.savePayStub().click();
      cy.assertPopover("Pay stub created successfully!");
    });

    it("closes the modal afterwards", () => {
      fillMonthly();
      sel.savePayStub().click();
      cy.wait("@createPayout");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("reloads the list afterwards", () => {
      fillMonthly();
      sel.savePayStub().click();
      cy.wait("@createPayout");
      cy.wait("@getPayouts");
    });

    it("reports the server's complaint when the save fails", () => {
      cy.intercept("POST", "**/v1/revops/payout", {
        statusCode: 409,
        body: { error: "A pay stub already exists for this period." },
      }).as("createPayout");
      fillMonthly();
      sel.savePayStub().click();
      cy.assertPopover("A pay stub already exists for this period.");
    });

    it("keeps the modal open when the save fails", () => {
      cy.intercept("POST", "**/v1/revops/payout", {
        statusCode: 500,
        body: { error: "boom" },
      }).as("createPayout");
      fillMonthly();
      sel.savePayStub().click();
      cy.assertPopover("boom");
      cy.get(".ReactModal__Content").should("exist");
    });

    it("still says something when the server explains nothing", () => {
      cy.intercept("POST", "**/v1/revops/payout", { statusCode: 500, body: {} }).as(
        "createPayout"
      );
      fillMonthly();
      sel.savePayStub().click();
      cy.get("#popover-portal", { timeout: 10000 }).should("not.be.empty");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 14. Editing a pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Edit Pay Stub modal", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([DUE_STUB]);
      sel.edit("Albert Einstein").click();
      sel.modal().should("contain.text", "Edit Pay Stub");
    });

    it("says it is updating rather than creating", () => {
      sel.modal().should("contain.text", "Update an existing pay stub.");
    });

    it("offers an Update button rather than a Save one", () => {
      sel.updatePayStub().should("be.visible");
      cy.contains("button", "Save Pay Stub").should("not.exist");
    });

    it("locks the period type", () => {
      sel.periodType().should("be.disabled");
    });

    it("locks the month", () => {
      sel.month().should("be.disabled");
    });

    it("locks the date range", () => {
      sel.dateRange().should("be.disabled");
    });

    it("locks the caregiver", () => {
      sel.caregiver().should("be.disabled");
    });

    it("prefills the period type", () => {
      sel.periodType().should("have.value", "Bi-Weekly");
    });

    it("prefills the month", () => {
      sel.month().should("have.value", THIS_MONTH);
    });

    it("prefills the half-month", () => {
      sel.dateRange().should("have.value", "1-15");
    });

    it("prefills the caregiver", () => {
      sel.caregiver().should("have.value", ALBERT);
    });

    it("prefills the hours", () => {
      sel.hoursWorked().should("have.value", "1.5");
    });

    it("prefills the rate", () => {
      sel.hourlyRate().should("have.value", "10");
    });

    it("keeps the hours read-only", () => {
      sel.hoursWorked().should("have.attr", "readonly");
    });

    it("keeps the rate read-only", () => {
      sel.hourlyRate().should("have.attr", "readonly");
    });

    it("re-derives the base amount from them", () => {
      sel.baseAmountRow().should("contain.text", "$15.00");
    });

    it("does not go back to the shifts — the stored figures stand", () => {
      cy.assertNoRequest("@getShifts");
    });

    it("leaves the expenses editable", () => {
      sel.expenseDescription().should("not.be.disabled");
      sel.addExpense().should("not.be.disabled");
    });

    it("closes on Cancel without writing", () => {
      sel.cancel().click();
      cy.get(".ReactModal__Content").should("not.exist");
      cy.assertNoRequest("@updatePayout");
    });
  });

  describe("A pay stub's existing expenses", () => {
    it("loads them into the editor", () => {
      stubWrites();
      visitPayments([{ ...EXPENSES_ONLY_STUB, status: "DRAFT" }]);
      sel.edit("Nova Carelead").click();
      cy.contains("Tips").should("be.visible");
      sel.removeExpense().should("be.visible");
    });

    it("prices them from cents", () => {
      stubWrites();
      visitPayments([{ ...EXPENSES_ONLY_STUB, status: "DRAFT" }]);
      sel.edit("Nova Carelead").click();
      cy.contains("$100.00").should("be.visible");
    });

    it("leaves the base salary line out — it is not an expense", () => {
      stubWrites();
      visitPayments([
        buildPayout({
          items: [
            { payout_item_id: "i1", description: "Base Salary", amount_cents: 350000 },
            { payout_item_id: "i2", description: "Tips", amount_cents: 5000 },
          ],
        }),
      ]);
      sel.edit("Krishna Rao").click();
      cy.contains("Tips").should("be.visible");
      cy.get(".ReactModal__Content").should("not.contain.text", "Base Salary");
    });

    it("leaves a deduction out — the editor cannot express one", () => {
      stubWrites();
      visitPayments([
        buildPayout({
          items: [
            { payout_item_id: "i1", description: "Advance recovery", amount_cents: -5000 },
          ],
        }),
      ]);
      sel.edit("Krishna Rao").click();
      cy.contains("button", "Remove").should("not.exist");
    });

    it("keeps an existing item's identifier when saved again", () => {
      stubWrites();
      visitPayments([{ ...EXPENSES_ONLY_STUB, status: "DRAFT" }]);
      sel.edit("Nova Carelead").click();
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) =>
        expect(body.items[0].payout_item_id).to.eq("item-tips")
      );
    });

    it("ties an existing item to its payout", () => {
      stubWrites();
      visitPayments([{ ...EXPENSES_ONLY_STUB, status: "DRAFT" }]);
      sel.edit("Nova Carelead").click();
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.items[0].payout_id).to.eq(503));
    });
  });

  describe("Saving an edited pay stub", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([DUE_STUB]);
      sel.edit("Albert Einstein").click();
      sel.modal().should("contain.text", "Edit Pay Stub");
    });

    it("PUTs rather than POSTing", () => {
      sel.updatePayStub().click();
      cy.wait("@updatePayout");
      cy.assertNoRequest("@createPayout");
    });

    it("addresses the existing pay stub", () => {
      sel.updatePayStub().click();
      cy.wait("@updatePayout").then((interception: any) => {
        expect(interception.request.url).to.contain("/v1/revops/payout/502");
      });
    });

    it("authenticates the write", () => {
      sel.updatePayStub().click();
      cy.wait("@updatePayout");
      cy.assertAuthorized("@updatePayout");
    });

    it("keeps the record's own id", () => {
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.id).to.eq(502));
    });

    it("keeps the public identifier stable", () => {
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) =>
        expect(body.payroll_payout_id).to.eq("PAY-2026-09-0502")
      );
    });

    it("keeps the status it already had", () => {
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.status).to.eq("DRAFT"));
    });

    it("keeps the period untouched", () => {
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => {
        expect(body.period_type).to.eq("BIWEEKLY");
        expect(body.period_start_date).to.eq("2026-09-01");
        expect(body.period_end_date).to.eq("2026-09-15");
      });
    });

    it("keeps the hours untouched", () => {
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.hours_worked_minutes).to.eq(90));
    });

    it("adds a new expense", () => {
      addExpense("Tips", "50");
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => {
        expect(body.items).to.have.length(1);
        expect(body.items[0].description).to.eq("Tips");
      });
    });

    it("raises the total by the new expense", () => {
      addExpense("Tips", "50");
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.total_amount_cents).to.eq(6500));
    });

    it("ties the new expense to this payout", () => {
      addExpense("Tips", "50");
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.items[0].payout_id).to.eq(502));
    });


    it("confirms the update", () => {
      sel.updatePayStub().click();
      cy.assertPopover("Pay stub updated successfully!");
    });

    it("closes the modal afterwards", () => {
      sel.updatePayStub().click();
      cy.wait("@updatePayout");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("reloads the list afterwards", () => {
      sel.updatePayStub().click();
      cy.wait("@updatePayout");
      cy.wait("@getPayouts");
    });

    it("reports the server's complaint when the update fails", () => {
      cy.intercept("PUT", "**/v1/revops/payout/**", {
        statusCode: 400,
        body: { error: "This pay stub has already been paid." },
      }).as("updatePayout");
      sel.updatePayStub().click();
      cy.assertPopover("This pay stub has already been paid.");
    });

    it("keeps the modal open when the update fails", () => {
      cy.intercept("PUT", "**/v1/revops/payout/**", {
        statusCode: 500,
        body: { error: "boom" },
      }).as("updatePayout");
      sel.updatePayStub().click();
      cy.assertPopover("boom");
      cy.get(".ReactModal__Content").should("exist");
    });
  });

  describe("Editing a fixed-rate caregiver's pay stub", () => {
    it("[as-built] rewrites the base amount from today's roster", () => {
      // The stored `hourly_rate_cents` still fills the read-only field, but the
      // base amount is recomputed from the roster every time the modal opens.
      // A raise between raising the stub and editing it silently changes what
      // the caregiver is owed for a period that is already closed.
      stubWrites();
      visitPayments([SPARROW_STUB], {
        caregivers: [
          KRISHNA_CG,
          ALBERT_CG,
          NOVA_CG,
          buildCaregiver(SPARROW, "John Sparrow", {
            roaster: [{ pay_rate: "4000", pay_frequency: "Monthly" }],
          }),
        ],
      });
      sel.edit("John Sparrow").click();
      sel.hourlyRate().should("have.value", "1750");
      sel.baseAmountRow().should("contain.text", "$2,000.00");
    });

    it("[as-built] sends the rewritten amount to the API", () => {
      stubWrites();
      visitPayments([SPARROW_STUB], {
        caregivers: [
          KRISHNA_CG,
          ALBERT_CG,
          NOVA_CG,
          buildCaregiver(SPARROW, "John Sparrow", {
            roaster: [{ pay_rate: "4000", pay_frequency: "Monthly" }],
          }),
        ],
      });
      sel.edit("John Sparrow").click();
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.base_amount_cents).to.eq(200000));
    });

    it("leaves it alone when the roster has not moved", () => {
      stubWrites();
      visitPayments([SPARROW_STUB]);
      sel.edit("John Sparrow").click();
      sel.updatePayStub().click();
      bodyOf("@updatePayout", (body) => expect(body.base_amount_cents).to.eq(175000));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 15. Paying a pay stub
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Process Payment modal", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([DUE_STUB]);
      sel.pay("Albert Einstein").click();
      sel.modal().should("contain.text", "Process Payment");
    });

    it("names who is being paid and for what", () => {
      sel.modal().should("contain.text", `Pay Albert Einstein for the period ${payStubRange("2026-09-01", "2026-09-15")}`);
    });

    it("restates the caregiver", () => {
      sel.modal().should("contain.text", "Caregiver");
      sel.modal().should("contain.text", "Albert Einstein");
    });

    it("restates the hours and rate", () => {
      sel.modal().should("contain.text", "1.5h @ $10/h");
    });

    it("restates the base amount", () => {
      sel.modal().should("contain.text", "$15.00");
    });

    it("restates the expenses", () => {
      sel.modal().should("contain.text", "Expenses");
      sel.modal().should("contain.text", "$0.00");
    });

    it("states the total to pay", () => {
      sel.modal().should("contain.text", "Total to Pay");
    });

    it("offers two ways to pay", () => {
      sel.stripeCard().should("be.visible");
      sel.manualCard().should("be.visible");
    });

    it("describes the Stripe option", () => {
      sel.modal().should("contain.text", "Process payment instantly via Stripe");
    });

    it("describes the manual option", () => {
      sel.modal().should("contain.text", "Record an external payment");
    });

    it("preselects Stripe", () => {
      sel.payWithStripe().should("be.visible");
    });

    it("hides the manual fields until manual is chosen", () => {
      cy.get('select[name="manualPaymentType"]').should("not.exist");
    });

    it("changes the CTA when manual is chosen", () => {
      sel.manualCard().click();
      sel.markAsPaid().should("be.visible");
      cy.contains("button", "Pay with Stripe").should("not.exist");
    });

    it("asks how the money moved", () => {
      sel.manualCard().click();
      sel.manualType().should("be.visible");
    });

    it("defaults that to a bank transfer", () => {
      sel.manualCard().click();
      sel.manualType().should("have.value", "Bank Transfer");
    });

    it("offers seven ways money can have moved", () => {
      sel.manualCard().click();
      sel.manualType().find("option").should("have.length", 7);
    });

    it("asks for a reference", () => {
      sel.manualCard().click();
      cy.contains("Reference ID / Check Number").should("be.visible");
    });

    it("suggests what a reference looks like", () => {
      sel.manualCard().click();
      sel
        .reference()
        .should("have.attr", "placeholder", "e.g., TXN-2024-001 or Check #1234");
    });

    it("starts with no reference", () => {
      sel.manualCard().click();
      sel.reference().should("have.value", "");
    });

    it("shows the amount being recorded", () => {
      sel.manualCard().click();
      sel.paidAmount().should("have.value", usd(15));
    });

    it("will not let the amount be changed", () => {
      sel.manualCard().click();
      sel.paidAmount().should("have.attr", "readonly");
    });

    it("hides the manual fields again on switching back to Stripe", () => {
      sel.manualCard().click();
      sel.stripeCard().click();
      cy.get('select[name="manualPaymentType"]').should("not.exist");
    });

    it("forgets a typed reference on switching back to Stripe", () => {
      sel.manualCard().click();
      sel.reference().type("TXN-1");
      sel.stripeCard().click();
      sel.manualCard().click();
      sel.reference().should("have.value", "");
    });

    it("closes on Cancel", () => {
      sel.cancel().click();
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("sends nothing on Cancel", () => {
      sel.manualCard().click();
      sel.cancel().click();
      cy.assertNoRequest("@createPayment");
    });

    it("sends nothing just by opening", () => {
      cy.assertNoRequest("@createPayment");
    });
  });

  describe("Recording a manual payment", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([DUE_STUB]);
      sel.pay("Albert Einstein").click();
      sel.manualCard().click();
    });

    it("POSTs to the payment endpoint", () => {
      sel.markAsPaid().click();
      cy.wait("@createPayment");
    });

    it("authenticates the write", () => {
      sel.markAsPaid().click();
      cy.wait("@createPayment");
      cy.assertAuthorized("@createPayment");
    });

    it("says the payment is against a payroll payout", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) =>
        expect(body.subject_type).to.eq("PAYROLL_PAYOUT")
      );
    });

    it("names the pay stub it settles", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) =>
        expect(body.subject_public_id).to.eq("PAY-2026-09-0502")
      );
    });

    it("says the money moved outside Stripe", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.provider).to.eq("MANUAL"));
    });

    it("sends the chosen method", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("BANK_TRANSFER"));
    });

    it("sends a null reference when none was typed", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_reference).to.eq(null));
    });

    it("sends the reference when one was typed", () => {
      sel.reference().type("TXN-2026-0917");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) =>
        expect(body.manual_reference).to.eq("TXN-2026-0917")
      );
    });

    it("names who is paying", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.payer_user_id).to.eq(TEST_USER_ID));
    });

    it("names who pressed the button", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) =>
        expect(body.initiated_by_user_id).to.eq(TEST_USER_ID)
      );
    });

    it("carries the return addresses Stripe would have needed", () => {
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => {
        expect(body.success_url).to.contain("/revops/payments");
        expect(body.cancel_url).to.contain("/revops/payments");
      });
    });

    it("records a check", () => {
      sel.manualType().select("Check");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("CHECK"));
    });

    it("records cash", () => {
      sel.manualType().select("Cash");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("CASH"));
    });

    it("records PayPal", () => {
      sel.manualType().select("PayPal");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("PAYPAL"));
    });

    it("records Zelle", () => {
      sel.manualType().select("Zelle");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("ZELLE"));
    });

    it("records Venmo", () => {
      sel.manualType().select("Venmo");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("VENMO"));
    });

    it("records anything else as Other", () => {
      sel.manualType().select("Other");
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => expect(body.manual_method).to.eq("OTHER"));
    });

    it("closes the modal once recorded", () => {
      sel.markAsPaid().click();
      cy.wait("@createPayment");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("reloads the list once recorded", () => {
      sel.markAsPaid().click();
      cy.wait("@createPayment");
      cy.wait("@getPayouts");
    });

    it("shows a progress message while it is in flight", () => {
      cy.intercept("POST", "**/v1/revops/payment", (req) => {
        req.reply({ statusCode: 201, body: {}, delay: 1500 });
      }).as("createPayment");
      sel.markAsPaid().click();
      cy.contains("Processing payment...").should("be.visible");
    });

    it("reports the server's complaint when the payment fails", () => {
      cy.intercept("POST", "**/v1/revops/payment", {
        statusCode: 402,
        body: { error: "The payout has already been settled." },
      }).as("createPayment");
      sel.markAsPaid().click();
      cy.assertPopover("The payout has already been settled.");
    });

    it("falls back to its own message when the server explains nothing", () => {
      cy.intercept("POST", "**/v1/revops/payment", { statusCode: 500, body: {} }).as(
        "createPayment"
      );
      sel.markAsPaid().click();
      cy.assertPopover("Payment failed. Please try again.");
    });

    it("keeps the modal open when the payment fails", () => {
      cy.intercept("POST", "**/v1/revops/payment", { statusCode: 500, body: {} }).as(
        "createPayment"
      );
      sel.markAsPaid().click();
      cy.assertPopover("Payment failed. Please try again.");
      cy.get(".ReactModal__Content").should("exist");
    });

    it("opens a checkout page if the API returns one", () => {
      cy.intercept("POST", "**/v1/revops/payment", {
        statusCode: 201,
        body: { checkout_url: "https://checkout.stripe.com/session" },
      }).as("createPayment");
      cy.window().then((win) => cy.stub(win, "open").as("openCheckout"));
      sel.markAsPaid().click();
      cy.get("@openCheckout").should("have.been.called");
    });
  });

  describe("Paying a pay stub that cannot be paid", () => {
    it("sends nothing when the stub has no public identifier", () => {
      stubWrites();
      visitPayments([{ ...DUE_STUB, payroll_payout_id: undefined }]);
      sel.pay("Albert Einstein").click();
      sel.manualCard().click();
      sel.markAsPaid().click();
      cy.assertNoRequest("@createPayment");
    });

    it("sends nothing when the stub has no payer", () => {
      stubWrites();
      visitPayments([{ ...DUE_STUB, pcho_user_id: undefined }]);
      sel.pay("Albert Einstein").click();
      sel.manualCard().click();
      sel.markAsPaid().click();
      cy.assertNoRequest("@createPayment");
    });

    it("stays open so the problem is visible", () => {
      stubWrites();
      visitPayments([{ ...DUE_STUB, payroll_payout_id: undefined }]);
      sel.pay("Albert Einstein").click();
      sel.manualCard().click();
      sel.markAsPaid().click();
      cy.get(".ReactModal__Content").should("exist");
    });
  });

  describe("Paying a stub made entirely of expenses", () => {
    beforeEach(() => {
      stubWrites();
      visitPayments([EXPENSES_ONLY_STUB]);
      sel.pay("Nova Carelead").click();
    });

    it("shows no base amount", () => {
      sel.modal().should("contain.text", "Base Amount");
      sel.modal().should("contain.text", "$0.00");
    });

    it("counts the items as expenses", () => {
      sel.modal().should("contain.text", "$100.00");
    });

    it("pays the expenses total", () => {
      sel.manualCard().click();
      sel.paidAmount().should("have.value", usd(100));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 16. The Caregivers tab
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Caregivers tab", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.tab("Caregivers").click();
    });

    it("names every column", () => {
      ["Name", "Role", "Wage", "Hire Date", "Actions"].forEach((header) =>
        cy.contains(header).should("exist")
      );
    });

    it("does not show an employee id column — it is commented out", () => {
      cy.contains("Employee ID").should("not.exist");
    });

    it("does not show a status column — it is commented out", () => {
      cy.contains("div", /^Status$/).should("not.exist");
    });

    it("lists every caregiver", () => {
      ALL_CAREGIVERS.forEach((cg) => cy.contains(cg.name).should("be.visible"));
    });

    it("spells out the PCG role", () => {
      sel.row("Krishna Rao").should("contain.text", "Caregiver");
    });

    it("leaves any other role as it is", () => {
      visitPayments([], {
        caregivers: [buildCaregiver(KRISHNA, "Krishna Rao", { role: "PCGLead" })],
      });
      sel.tab("Caregivers").click();
      sel.row("Krishna Rao").should("contain.text", "PCGLead");
    });

    it("states an hourly wage per hour", () => {
      sel.row("Krishna Rao").should("contain.text", "$10.00/hour");
    });

    it("states a fixed wage per month", () => {
      sel.row("John Sparrow").should("contain.text", "$3,500.00/month");
    });

    it("falls back to nothing per hour when there is no roster", () => {
      visitPayments([], {
        caregivers: [buildCaregiver(KRISHNA, "Krishna Rao", { roaster: [] })],
      });
      sel.tab("Caregivers").click();
      sel.row("Krishna Rao").should("contain.text", "$0.00/hour");
    });

    it("states the hire date", () => {
      sel.row("Krishna Rao").should("contain.text", "06/01/2026");
    });

    it("dashes a missing hire date", () => {
      visitPayments([], {
        caregivers: [buildCaregiver(KRISHNA, "Krishna Rao", { createdAt: "" })],
      });
      sel.tab("Caregivers").click();
      sel.row("Krishna Rao").should("contain.text", "-");
    });

    it("keeps a long name readable by titling it", () => {
      sel.row("Krishna Rao").contains("span", "Krishna Rao").should("have.attr", "title");
    });

    it("leaves a deleted caregiver out", () => {
      visitPayments([], {
        caregivers: [KRISHNA_CG, buildCaregiver(NOVA, "Gone Away", { isDeleted: true })],
      });
      sel.tab("Caregivers").click();
      cy.contains("Gone Away").should("not.exist");
    });

    it("says nothing is there when the home has no caregivers", () => {
      visitPayments([], { caregivers: [] });
      sel.tab("Caregivers").click();
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("goes back to Pay Stubs on request", () => {
      // `BaseTable` renders its empty message instead of a header row, so the
      // tab we return to needs a stub on it for "Period Type" to exist.
      visitPayments([DUE_STUB]);
      sel.tab("Caregivers").click();
      sel.tab("Pay Stubs").click();
      cy.contains("Period Type").should("be.visible");
    });

    it("keeps the pay stubs table off screen while it is showing", () => {
      cy.contains("Date Range").should("not.exist");
    });
  });

  describe("A caregiver's row menu", () => {
    beforeEach(() => {
      visitPayments([]);
      sel.tab("Caregivers").click();
      sel.kebab("Krishna Rao").click({ force: true });
    });

    it("offers Log Hours", () => {
      sel.menuItem("Log Hours").should("be.visible");
    });

    it("offers Edit Profile", () => {
      sel.menuItem("Edit Profile").should("be.visible");
    });

    it("offers nothing else — View Details is commented out", () => {
      cy.contains("div", /^View Details$/).should("not.exist");
    });

    it("offers no way to deactivate from here", () => {
      cy.contains("div", /^Deactivate$/).should("not.exist");
    });

    it("sends Log Hours to the Staff Management dashboard", () => {
      sel.menuItem("Log Hours").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
    });

    it("sends Edit Profile to that caregiver's Care Team page", () => {
      sel.menuItem("Edit Profile").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/hcm/team/${KRISHNA}`);
    });

    it("opens the right caregiver's page, not the first one", () => {
      // A fresh visit — each row owns its own menu state, so this has to start
      // from no menu open at all to prove the second row is not the first.
      visitPayments([]);
      sel.tab("Caregivers").click();
      sel.kebab("John Sparrow").click({ force: true });
      sel.menuItem("Edit Profile").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/hcm/team/${SPARROW}`);
    });

    it("goes nowhere when the caregiver has no id", () => {
      visitPayments([], {
        caregivers: [buildCaregiver(KRISHNA, "Krishna Rao", { userId: undefined })],
      });
      sel.tab("Caregivers").click();
      sel.kebab("Krishna Rao").click({ force: true });
      sel.menuItem("Edit Profile").click();
      cy.location("pathname").should("eq", PAYMENTS);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 17. End to end
  // ──────────────────────────────────────────────────────────────────────────

  describe("End to end", () => {
    it("raises an hourly pay stub from an empty month", () => {
      stubWrites();
      visitPayments([], { shifts: ONE_RATE_SHIFTS });

      cy.contains("Nothing added yet.").should("be.visible");
      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "Albert Einstein",
      });
      cy.wait("@getShifts");
      cy.contains("Loaded 1.50 hours").should("be.visible");
      sel.baseAmountRow().should("contain.text", "$15.00");

      stubPayoutList([DUE_STUB]);
      sel.savePayStub().click();
      cy.assertPopover("Pay stub created successfully!");
      cy.contains("Albert Einstein").should("be.visible");
      sel.row("Albert Einstein").should("contain.text", "Due");
    });

    it("raises the fixed-rate caregiver's cheque with nothing clocked", () => {
      stubWrites();
      visitPayments([], { shifts: [] });

      openCreate({
        periodType: "Bi-Weekly",
        month: THIS_MONTH_LABEL,
        dateRange: "1st - 15th",
        caregiver: "John Sparrow",
      });
      sel.hoursWorked().should("have.value", "0");
      sel.totalAmountRow().should("contain.text", "$1,750.00");

      stubPayoutList([SPARROW_STUB]);
      sel.savePayStub().click();
      bodyOf("@createPayout", (body) => expect(body.total_amount_cents).to.eq(175000));
      sel.row("John Sparrow").should("contain.text", "$1,750.00");
    });

    it("adds a tip to a raised stub and pays the higher amount", () => {
      stubWrites();
      visitPayments([DUE_STUB]);

      sel.edit("Albert Einstein").click();
      addExpense("Tips", "50");
      sel.totalAmountRow().should("contain.text", "$65.00");

      stubPayoutList([{ ...DUE_STUB, total_amount_cents: 6500, items: [] }]);
      sel.updatePayStub().click();
      cy.assertPopover("Pay stub updated successfully!");
      sel.row("Albert Einstein").should("contain.text", "$65.00");
    });

    it("settles an outstanding stub by cheque", () => {
      stubWrites();
      visitPayments([DUE_STUB]);

      sel.row("Albert Einstein").should("contain.text", "Due");
      sel.pay("Albert Einstein").click();
      sel.modal().should("contain.text", "Total to Pay");
      sel.manualCard().click();
      sel.manualType().select("Check");
      sel.reference().type("Check #1234");

      stubPayoutList([
        { ...DUE_STUB, status: "PAID", updated_at: "2026-09-17T12:00:00.000Z" },
      ]);
      sel.markAsPaid().click();
      bodyOf("@createPayment", (body) => {
        expect(body.manual_method).to.eq("CHECK");
        expect(body.manual_reference).to.eq("Check #1234");
      });
      sel.row("Albert Einstein").should("contain.text", "Paid 09/17/2026");
      sel.edit("Albert Einstein").should("be.disabled");
    });

    it("moves between months and sees a different set of stubs", () => {
      visitPayments([DUE_STUB]);
      cy.contains("Albert Einstein").should("be.visible");

      stubPayoutList([]);
      sel.monthFilter().clear().type(LAST_MONTH);
      cy.wait("@getPayouts");
      cy.contains("Nothing added yet.").should("be.visible");

      stubPayoutList([DUE_STUB]);
      sel.monthFilter().clear().type(THIS_MONTH);
      cy.wait("@getPayouts");
      cy.contains("Albert Einstein").should("be.visible");
    });

    it("looks a caregiver up and jumps to their profile", () => {
      visitPayments([DUE_STUB]);
      sel.tab("Caregivers").click();
      sel.row("John Sparrow").should("contain.text", "$3,500.00/month");
      sel.kebab("John Sparrow").click({ force: true });
      sel.menuItem("Edit Profile").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/hcm/team/${SPARROW}`);
    });

    it("reviews a stub, downloads it, then pays it", () => {
      stubWrites();
      visitPayments([DUE_STUB]);

      sel.view("Albert Einstein").click();
      sel.modal().should("contain.text", "ID: PAY-2026-09-0502");
      sel.close().click();

      sel.download("Albert Einstein").click();
      cy.readFile("cypress/downloads/PAY-2026-09-0502.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);

      sel.pay("Albert Einstein").click();
      sel.manualCard().click();
      sel.markAsPaid().click();
      cy.wait("@createPayment");
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });
});
