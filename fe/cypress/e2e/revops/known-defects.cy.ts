/* eslint-disable cypress/no-force, cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * RevOps — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE, like its clinical, CRM and HCM
 * counterparts. Each asserts the behaviour the app SHOULD have against code
 * that does something else.
 *
 * A test here turning green means the bug is fixed: move it into the spec that
 * owns the area rather than deleting it. Never weaken an assertion to match
 * the code — if the behaviour turns out to be intended, delete the test and
 * record the decision in the owning spec.
 *
 * WHAT IS IN HERE AND WHAT IS NOT
 *   RevOps carries 41 pinned findings. Most are `[as-built]` tests inside the
 *   normal specs: they PASS, they record what the app does today, and several
 *   need a product decision before anyone can say they are wrong.
 *
 *   This file holds only the subset where the correct behaviour is not in
 *   question — money reported wrong, and Cancel buttons that save. Those do
 *   not need a product conversation, so they are asserted the right way round
 *   and left red until fixed.
 *
 * NOT REACHABLE FROM THE UI
 *   `formatDateRange` inverts a single-day window (start 04:00, end 03:59:59
 *   on the SAME day). It cannot be pinned here because the budget period
 *   picker only ever offers whole months and quarters — there is no way to ask
 *   for one day. It stays pinned at unit level in
 *   __tests__/unit/common/shared-utils.test.ts.
 *
 *   npx cypress run --spec cypress/e2e/revops/known-defects.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const BILLING = "/revops/billing-invoice";
const BUDGET = "/revops/budget";
const PAYMENTS = "/revops/payments";

/** Mon 14 Sep 2026, 10:00 local — the instant the RevOps specs freeze at. */
const FROZEN_NOW = new Date(2026, 8, 14, 10, 0, 0).getTime();
const THIS_PERIOD = "2026-09";

const SHELDON = "55555555-5555-4555-8555-555555555555";
const CAREGIVER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const resident = (overrides: Record<string, any> = {}) => ({
  userId: SHELDON,
  name: "Sheldon Cooper",
  firstName: "Sheldon",
  lastName: "Cooper",
  email: "sheldon@assistly.com",
  mobile: "5551234567",
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["contract"],
  roomNumber: "12",
  monthly_rate: 2500,
  ...overrides,
});

const invoice = (overrides: Record<string, any> = {}) => ({
  id: 501,
  invoice_id: "INV_2026_09_501",
  home_id: TEST_HOME_ID,
  user_id: SHELDON,
  created_by_user_id: TEST_USER_ID,
  billing_period: THIS_PERIOD,
  status: "DUE",
  total_amount: 550,
  due_date: "2026-10-15",
  notes: "",
  items: [
    {
      invoice_item_id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      item_category: "CARE_FEE",
      description: "Monthly care fee",
      amount: 550,
    },
  ],
  ...overrides,
});

const budgetEntry = (overrides: Record<string, any> = {}) => ({
  id: 801,
  home_id: TEST_HOME_ID,
  created_by_user_id: TEST_USER_ID,
  transaction_type: "income",
  category_type: "TRANSPORT",
  description: "Miscellaneous",
  amount_cents: 20500,
  transaction_date: "2026-09-08",
  entry_mode: "one_time",
  notes: "",
  receipt_url: null,
  ...overrides,
});

const payout = (overrides: Record<string, any> = {}) => ({
  id: 901,
  payroll_payout_id: "PAY-2026-09-901",
  home_id: TEST_HOME_ID,
  pcho_user_id: TEST_USER_ID,
  pcg_user_id: CAREGIVER,
  pcg_user_name: "Morris Olsen",
  period_type: "MONTHLY",
  period_start_date: "2026-09-01",
  period_end_date: "2026-09-30",
  hours_worked_minutes: 90,
  hourly_rate_cents: 1000,
  base_amount_cents: 1500,
  total_amount_cents: 6500,
  status: "DRAFT",
  updated_at: "2026-09-10T10:00:00.000Z",
  created_at: "2026-09-01T10:00:00.000Z",
  items: [
    {
      payout_item_id: "bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      payout_id: 901,
      description: "Tips",
      amount_cents: 5000,
    },
  ],
  ...overrides,
});

const caregiverRow = {
  userId: CAREGIVER,
  name: "Morris Olsen",
  firstName: "Morris",
  lastName: "Olsen",
  email: "morris@assistly.com",
  mobile: "5559990000",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-06-01T10:00:00.000Z",
  roaster: [{ pay_rate: "10", pay_frequency: "Hourly" }],
  isDeleted: false,
};

/** A home carrying one enabled groceries cap for September 2026. */
const homeWithThreshold = (overrides: Record<string, any> = {}) =>
  buildHome({
    thresholds: {
      "2026": {
        sep: {
          groceries: {
            thresholdName: "Groceries Cap",
            fixedAmount: 1000,
            isEnabled: true,
            ...overrides,
          },
        },
      },
    },
  });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  tab: (label: string) => cy.contains("span", label),
  modal: () => cy.get(".ReactModal__Content", { timeout: 10000 }),
  inModal: (label: string) => sel.modal().contains("button", label),
  residentCard: (name: string) =>
    cy.contains(name).closest('div[class*="w-[400px]"]'),
  stat: (name: string, label: string) =>
    sel.residentCard(name).contains(label).parent(),
  openRowMenu: (text: string) =>
    cy
      .contains(text)
      .closest('div[class*="border-b"]')
      .find("svg.cursor-pointer")
      .last()
      .click({ force: true }),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubWrites = () => {
  cy.intercept("POST", "**/v1/revops/invoice", { statusCode: 201, body: {} }).as(
    "createInvoice"
  );
  cy.intercept("PUT", "**/v1/revops/invoice/**", { statusCode: 200, body: {} }).as(
    "updateInvoice"
  );
  cy.intercept("POST", "**/v1/revops/budget", { statusCode: 201, body: {} }).as(
    "createBudget"
  );
  cy.intercept("PUT", "**/v1/revops/budget/**", { statusCode: 200, body: {} }).as(
    "updateBudget"
  );
  cy.intercept("PUT", "**/v1/home*", { statusCode: 200, body: {} }).as("upsertHome");
  cy.intercept("PUT", "**/v1/revops/payout/**", { statusCode: 200, body: {} }).as(
    "updatePayout"
  );
};

const visitBilling = (invoices: any[] = [invoice()], residents = [resident()]) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: residents } }).as(
    "getResidents"
  );
  cy.intercept("GET", "**/v1/revops/invoice*", {
    statusCode: 200,
    body: { invoices },
  }).as("getInvoices");
  cy.stubBudgetSummary();
  cy.stubBudgetMetrics();
  cy.stubPayouts();
  stubWrites();
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(BILLING);
  cy.contains("Billing & Invoices", { timeout: 10000 }).should("be.visible");
};

const visitBudget = (
  opts: { home?: any; income?: any[]; expenses?: any[] } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers();
  cy.intercept(
    { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
    { statusCode: 200, body: { budgets: opts.income ?? [], income_invoice: 0 } }
  ).as("getIncome");
  cy.intercept(
    { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "expense" } },
    { statusCode: 200, body: { budgets: opts.expenses ?? [], expense_payroll: 0 } }
  ).as("getExpenses");
  cy.stubBudgetMetrics();
  stubWrites();
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(BUDGET);
  cy.contains("Budget Management", { timeout: 10000 }).should("be.visible");
};

const visitPayments = (payouts: any[] = [payout()]) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/users*", {
    statusCode: 200,
    body: { users: [caregiverRow] },
  }).as("getCaregivers");
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/revops/payout*", { statusCode: 200, body: { payouts } }).as(
    "getPayouts"
  );
  stubWrites();
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(PAYMENTS);
  cy.contains("Payment Management", { timeout: 10000 }).should("be.visible");
};

/**
 * Switch tab.
 *
 * Anchored to the tab strip's <span>: "Income" and "Expenses" also appear in
 * the stat cards above it, and an unscoped `cy.contains` finds those first.
 */
const openTab = (label: string) => {
  sel.tab(label).click();
  cy.wait(300);
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. A resident's balance is reported wrong
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps known defects — the Residents tab", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("shows a settled resident as square, not in credit", () => {
    // `residents-cards.tsx` computes Outstanding as `DUE total − PAID total`.
    // Once an invoice settles there is nothing left on the DUE side, so a paid
    // $550 invoice reports the resident $550 IN CREDIT. Nobody owes them
    // anything — the balance should be zero.
    visitBilling([invoice({ status: "PAID" })]);
    openTab("Residents");
    sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$0");
  });

  it("never reports a negative outstanding balance", () => {
    // An over-payment is a credit, not a negative debt, and the sign is
    // rendered after the symbol ("$-550") which is not a currency format.
    visitBilling([
      invoice({ id: 502, invoice_id: "INV_A", status: "PAID", total_amount: 600 }),
    ]);
    openTab("Residents");
    sel.stat("Sheldon Cooper", "Outstanding").should("not.contain.text", "-");
  });

  it("shows the resident's real monthly rate", () => {
    // `ResidentCard` reads `senior.monthly_rate`, but `residents.tsx` maps only
    // id, name, room, status and image — so the field is never populated and
    // every resident in every home reads $0.
    visitBilling([invoice()]);
    openTab("Residents");
    sel.stat("Sheldon Cooper", "Monthly Rate").should("contain.text", "2,500");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Cancel saves instead of discarding — five modals, one cause
// ═══════════════════════════════════════════════════════════════════════════
//
// `commonComponents/button.tsx` defaults to `type="submit"`, and each of these
// Cancel buttons omits the prop. Sitting inside a <form>, they are submit
// controls: clicking one runs its `onClose` AND submits the form. Any valid
// form is therefore written by the button meant to throw it away.

describe("RevOps known defects — Cancel must not save", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("abandons a new invoice", () => {
    // The form has to be VALID for this to mean anything. With no line items
    // the submit is refused by validation, so Cancel only looks well behaved —
    // that is a false pass, not a working Cancel button.
    visitBilling([]);
    cy.contains("button", "Create Invoice").click();
    sel.modal().find('select[name="user_id"]').select(SHELDON);
    sel.modal().find('select[name="billing_period"]').select(THIS_PERIOD);
    sel.modal().find('input[name="newItemDescription"]').type("Monthly care fee");
    sel.modal().find('input[name="newItemAmount"]').type("550");
    sel.modal().find('select[name="newItemCategory"]').select("CARE_FEE");
    cy.contains("div", /^Add Item$/).click();
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@createInvoice.all").should("have.length", 0);
  });

  it("abandons an edited invoice", () => {
    visitBilling([invoice({ status: "DRAFT" })]);
    sel.openRowMenu("INV_2026_09_501");
    cy.contains("div", /^Edit Invoice$/).click();
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@updateInvoice.all").should("have.length", 0);
  });

  it("abandons new budget income", () => {
    visitBudget();
    openTab("Income");
    cy.contains("button", "Add Income").click();
    sel.modal().find('input[name="description"]').type("Bus fares");
    sel.modal().find('select[name="category_type"]').select("TRANSPORT");
    sel.modal().find('input[name="amount_cents"]').clear().type("205");
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@createBudget.all").should("have.length", 0);
  });

  it("abandons a new budget expense", () => {
    visitBudget();
    openTab("Expenses");
    cy.contains("button", "Add Expense").click();
    sel.modal().find('input[name="description"]').type("Weekly shop");
    sel.modal().find('select[name="category_type"]').select("GROCERIES");
    sel.modal().find('input[name="amount_cents"]').clear().type("125");
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@createBudget.all").should("have.length", 0);
  });

  it("abandons a new expense threshold", () => {
    visitBudget();
    openTab("Thresholds");
    cy.contains("button", "Add Threshold").click();
    sel.modal().find('input[name="thresholdName"]').type("Grocery cap");
    sel.modal().find('select[name="category"]').select("GROCERIES");
    sel.modal().find('input[name="fixedAmount"]').clear().type("1200");
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@upsertHome.all").should("have.length", 0);
  });

  it("abandons an edited expense threshold", () => {
    visitBudget({ home: homeWithThreshold() });
    openTab("Thresholds");
    sel.openRowMenu("Groceries Cap");
    cy.contains("Edit").click();
    sel.inModal("Cancel").click();
    cy.wait(600);
    cy.get("@upsertHome.all").should("have.length", 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Remove on a pay-stub expense saves and closes
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps known defects — the Edit Pay Stub modal", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("drops an expense line and stays open", () => {
    // The Remove control on an expense row omits `type="button"` too, so it
    // submits: the pay stub is PUT and `onSuccess` closes the modal. There is
    // no way to delete one line and carry on editing.
    visitPayments();
    cy.get('button[title="Edit pay stub"]').first().click();
    sel.modal().should("contain.text", "Edit Pay Stub");
    cy.contains("button", "Remove").click();
    cy.wait(600);
    cy.get("@updatePayout.all").should("have.length", 0);
    cy.contains("button", "Update Pay Stub").should("be.visible");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Money shown does not match money sent
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps known defects — the invoice total", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("shows a fractional total to the cent", () => {
    // `add-invoice.tsx` formats with `maximumFractionDigits: 0`, so a $12.50
    // item is displayed as $13 while 12.5 is what gets sent. The figure on
    // screen is the one a resident is quoted.
    visitBilling([]);
    cy.contains("button", "Create Invoice").click();
    sel.modal().find('select[name="user_id"]').select(SHELDON);
    sel.modal().find('select[name="billing_period"]').select(THIS_PERIOD);
    sel.modal().find('input[name="newItemDescription"]').type("Part charge");
    sel.modal().find('input[name="newItemAmount"]').type("12.50");
    sel.modal().find('select[name="newItemCategory"]').select("MISC");
    cy.contains("div", /^Add Item$/).click();
    cy.contains("div", /^Total Amount$/)
      .parent()
      .should("contain.text", "$12.50");
  });

  it("warns rather than doing nothing when an item has no description", () => {
    // `handleAddLineItem` calls `.trim()` on an untouched
    // `newItemDescription`, which is `undefined` — so it throws before
    // reaching its own guard. No warning, no item, no clue.
    visitBilling([]);
    cy.contains("button", "Create Invoice").click();
    sel.modal().find('select[name="user_id"]').select(SHELDON);
    sel.modal().find('select[name="billing_period"]').select(THIS_PERIOD);
    sel.modal().find('input[name="newItemAmount"]').type("500");
    sel.modal().find('select[name="newItemCategory"]').select("MEDICAL");
    cy.contains("div", /^Add Item$/).click();
    cy.contains("Please fill in all item fields with valid values", {
      timeout: 10000,
    }).should("be.visible");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Editing a threshold retargets the wrong category
// ═══════════════════════════════════════════════════════════════════════════

describe("RevOps known defects — Edit Threshold", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("shows the category the threshold is filed under", () => {
    // `defaultValues.category` is lower-cased ("utilities") while the options
    // carry the upper-case enum, so nothing matches and the browser falls
    // through to the first enabled option — Groceries. The form still holds
    // the right value, so a save is correct; only the dropdown lies, which is
    // enough to make someone "correct" it to the wrong category by hand.
    visitBudget({
      home: buildHome({
        thresholds: {
          "2026": {
            sep: {
              utilities: {
                thresholdName: "Power Cap",
                fixedAmount: 1000,
                isEnabled: true,
              },
            },
          },
        },
      }),
    });
    openTab("Thresholds");
    sel.openRowMenu("Power Cap");
    cy.contains("Edit").click();
    sel.modal().find('select[name="category"]').should("have.value", "UTILITIES");
  });

  it("keeps a disabled threshold disabled when it is edited", () => {
    // `AddThreshold` seeds `isEnabled` from the record but `ToggleSwitch`
    // reports its own default on mount, so opening Edit on a disabled cap and
    // saving silently switches the alert back on.
    visitBudget({ home: homeWithThreshold({ isEnabled: false }) });
    openTab("Thresholds");
    sel.openRowMenu("Groceries Cap");
    cy.contains("Edit").click();
    sel.modal().find('input[name="fixedAmount"]').type("{selectall}1500");
    sel.inModal("Update Threshold").click();
    cy.wait("@upsertHome")
      .its("request.body.thresholds.2026.sep.groceries.isEnabled")
      .should("eq", false);
  });
});
