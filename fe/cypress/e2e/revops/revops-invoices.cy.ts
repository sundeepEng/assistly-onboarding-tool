/// <reference types="cypress" />

/**
 * RevOps — Billing & Invoices: the invoice lifecycle
 *
 *   components/revops/billing-invoice/invoices.tsx              the table and row actions
 *   components/revops/billing-invoice/add-invoice.tsx           Create / Update / Adjust
 *   components/revops/billing-invoice/view-invoice.tsx          the View modal
 *   components/revops/billing-invoice/pcho-mark-as-paid-modal.tsx
 *   components/revops/billing-invoice/download-invoice.ts       the PDF
 *   utils/billingPeriodUtils.ts                                 periods and due dates
 *
 * `revops-billing.cy.ts` already covers the screen around this — the invoices
 * query, the stats cards, the tab strip, module entitlement, role gating and
 * the API failure paths. This spec is the lifecycle itself, which that one
 * stops at the point of opening the modal.
 *
 * THE LIFECYCLE
 *
 *     Create ──▶ DRAFT ──Finalize──▶ DUE ──Mark as Paid──▶ PAID
 *                  │                  │
 *                  └──── Void ────────┴──▶ VOID
 *                                     │
 *                                     └──Adjust──▶ a NEW DUE invoice,
 *                                                  the original VOIDed
 *
 * The ⋮ menu is built from the status, so each state offers a different set and
 * a VOID invoice offers no menu at all. Every transition is the same
 * `PUT /v1/revops/invoice/{id}` carrying the whole invoice with a new `status`
 * — there is no dedicated finalize or void endpoint, so a spec that stubs only
 * the GET lets every one of them escape.
 *
 * TWO THINGS THE LIST DECIDES FOR ITSELF
 *   - **OVERDUE is derived, never stored.** A `DUE` invoice whose due date has
 *     passed renders as OVERDUE, and the ⋮ menu treats it exactly like DUE.
 *   - **PAID invoices are filtered out** of this table entirely; they live on
 *     the Payment History tab.
 *
 * ADJUST IS TWO REQUESTS
 *   `handleAdjustSubmit` POSTs the replacement (status DUE, carrying
 *   `parent_invoice_id`) and only then PUTs the original to VOID. Stub both, or
 *   the second escapes — and note the failure message is deliberately different
 *   if the void half fails after the create succeeded.
 *
 * THE CLOCK IS FROZEN
 *   The billing-period options are the current month and the two before it, and
 *   the default due date is the 15th of next month. Both move with the wall
 *   clock, so every test freezes at Mon 14 Sep 2026.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const BILLING = "/revops/billing-invoice";

/** Monday 14 September 2026, 10:00 local. */
const FROZEN_NOW = new Date(2026, 8, 14, 10, 0, 0).getTime();

/** What `getBillingPeriodOptions()` offers at the frozen instant. */
const THIS_PERIOD = "2026-09";
const LAST_PERIOD = "2026-08";
const THIS_PERIOD_LABEL = "September 2026";
const LAST_PERIOD_LABEL = "August 2026";

/** What `getDefaultDueDate()` produces — the 15th of next month. */
const DEFAULT_DUE_DATE = "2026-10-15";

const SHELDON = "55555555-5555-4555-8555-555555555555";
const TEJA = "55555555-5555-4555-8555-666666666666";

const buildResident = (userId: string, name: string, overrides = {}) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  clinical: { roomNumber: 10 },
  isDeleted: false,
  ...overrides,
});

const SHELDON_RESIDENT = buildResident(SHELDON, "Sheldon Cooper");
const TEJA_RESIDENT = buildResident(TEJA, "Teja Senior");

/** An invoice as GET /v1/revops/invoice returns it. */
const buildInvoice = (overrides: Record<string, any> = {}) => ({
  id: 107,
  invoice_id: "INV_2026_09_107",
  home_id: TEST_HOME_ID,
  user_id: SHELDON,
  created_by_user_id: TEST_USER_ID,
  billing_period: THIS_PERIOD,
  status: "DRAFT",
  total_amount: 550,
  due_date: "2026-10-14",
  created_at: "2026-09-14T09:00:00.000Z",
  notes: "",
  parent_invoice_id: null,
  payments: [],
  items: [
    {
      invoice_item_id: "item-1",
      item_category: "MEDICAL",
      description: "Vaccination",
      amount: 500,
    },
    {
      invoice_item_id: "item-2",
      item_category: "TRANSPORT",
      description: "Uber to and fro",
      amount: 50,
    },
  ],
  ...overrides,
});

const DRAFT_INVOICE = buildInvoice();
const DUE_INVOICE = buildInvoice({ id: 108, invoice_id: "INV_2026_09_108", status: "DUE" });
const VOID_INVOICE = buildInvoice({
  id: 105,
  invoice_id: "INV_2026_09_105",
  status: "VOID",
  user_id: TEJA,
  total_amount: 500,
});
/** DUE with a due date in the past — the list renders this as OVERDUE. */
const OVERDUE_INVOICE = buildInvoice({
  id: 109,
  invoice_id: "INV_2026_09_109",
  status: "DUE",
  due_date: "2026-08-14",
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  createInvoice: () => cy.contains("button", "Create Invoice"),
  row: (invoiceNumber: string) =>
    cy.contains(invoiceNumber).closest('div[class*="border-b"]'),
  status: (invoiceNumber: string) =>
    sel.row(invoiceNumber).find('span[class*="rounded-full"]'),
  viewAction: (invoiceNumber: string) =>
    sel.row(invoiceNumber).find('div[title="View Invoice"]'),
  downloadAction: (invoiceNumber: string) =>
    sel.row(invoiceNumber).find('div[title="Download Invoice"]'),
  kebab: (invoiceNumber: string) => sel.row(invoiceNumber).find("svg.cursor-pointer"),
  /** ⋮ entries are plain divs carrying an icon, so match on the label text. */
  menuItem: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),

  // The Create / Update / Adjust modal
  modalTitle: (title: string) => cy.contains("h2", title),
  resident: () => cy.get('select[name="user_id"]'),
  billingPeriod: () => cy.get('select[name="billing_period"]'),
  dueDate: () => cy.get('input[name="due_date"]'),
  itemDescription: () => cy.get('input[name="newItemDescription"]'),
  itemAmount: () => cy.get('input[name="newItemAmount"]'),
  itemCategory: () => cy.get('select[name="newItemCategory"]'),
  addItem: () => cy.contains("div", /^Add Item$/),
  notes: () => cy.get('textarea[name="notes"]'),
  /**
   * A button inside the open modal.
   *
   * Scoped deliberately: the billing screen's own header button is also
   * labelled "Create Invoice" and it comes first in the DOM, so an unscoped
   * `cy.contains("button", "Create Invoice")` finds the header one — which sits
   * behind react-modal's overlay and can never be clicked.
   */
  submit: (label: string) =>
    cy.get(".ReactModal__Content", { timeout: 10000 }).contains("button", label),
  cancel: () => cy.contains("button", /^Cancel$/),
  /** An item already added to the invoice, found through its description. */
  lineItem: (description: string) =>
    cy.contains("div", new RegExp(`^${description}$`)).closest('div[class*="py-3"]'),
  editLineItem: (description: string) =>
    sel.lineItem(description).find('div[class*="h-8"]').first(),
  deleteLineItem: (description: string) =>
    sel.lineItem(description).find('div[class*="h-8"]').last(),
  editItemDescription: () => cy.get('input[name="editItemDescription"]'),
  editItemAmount: () => cy.get('input[name="editItemAmount"]'),
  editItemCategory: () => cy.get('select[name="editItemCategory"]'),
  saveLineItem: () => cy.contains("div", /^Save$/),
  cancelLineItem: () => cy.contains("div", /^Cancel$/),
  totalAmount: () => cy.contains("div", /^Total Amount$/).parent(),

  // The tab strip
  tab: (label: string) => cy.contains("span", label),

  // Residents
  residentCard: (name: string) =>
    cy.contains(name).closest('div[class*="w-[400px]"]'),
  newInvoice: (name: string) =>
    sel.residentCard(name).contains("div", /^New Invoice$/),
  stat: (name: string, label: string) =>
    sel.residentCard(name).contains("p", label).parent(),

  // Mark as Paid
  paymentType: () => cy.get('select[name="paymentType"]'),
  paidDate: () => cy.get('input[name="paidDate"]'),
  referenceId: () => cy.get('input[name="referenceId"]'),
  paidAmount: () => cy.get('input[name="amount"]'),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubInvoiceList = (invoices: any[]) =>
  cy.intercept("GET", "**/v1/revops/invoice*", {
    statusCode: 200,
    body: { invoices },
  }).as("getInvoices");

/**
 * The Residents tab asks for seniors at the CONTRACT milestone specifically,
 * while the Invoices tab asks for all of them — one endpoint, two audiences, so
 * the fixtures carry the milestone.
 */
const stubResidents = (residents: any[] = [SHELDON_RESIDENT, TEJA_RESIDENT]) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "Senior" ? residents : [] },
    });
  }).as("getUsers");

/** Every write the invoice screens make. */
const stubWrites = () => {
  cy.intercept("POST", "**/v1/revops/invoice", { statusCode: 201, body: {} }).as(
    "createInvoice"
  );
  cy.intercept("PUT", "**/v1/revops/invoice/**", { statusCode: 200, body: {} }).as(
    "updateInvoice"
  );
  cy.intercept("POST", "**/v1/revops/payment", { statusCode: 201, body: {} }).as(
    "createPayment"
  );
};

const visitBilling = (
  invoices: any[] = [DRAFT_INVOICE],
  opts: { role?: any; home?: any; residents?: any[]; expectRestricted?: boolean } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  stubResidents(opts.residents);
  stubInvoiceList(invoices);
  cy.stubBudgetSummary();
  cy.stubBudgetMetrics();
  cy.stubPayouts();
  // A 1280x800 viewport is too small for this module: the taller modals push
  // their submit row below the fold, and the wider tables push the Actions
  // column outside the horizontal scroll window — so Cypress refuses to call
  // those elements visible for reasons that have nothing to do with the app.
  // Give the tests room rather than reaching for `force: true`, which would
  // hide a genuine coverage bug.
  cy.viewport(1600, 1400);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(BILLING);
  if (opts.expectRestricted) return;
  cy.contains("Billing & Invoices", { timeout: 10000 }).should("be.visible");
};

/** Open a row's ⋮ menu. */
const openMenu = (invoiceNumber: string) => {
  sel.kebab(invoiceNumber).last().click({ force: true });
};

/** Fill the new-item fields and add the item. */
const addItem = (description: string, amount: string, category: string) => {
  sel.itemDescription().clear().type(description);
  sel.itemAmount().clear().type(amount);
  sel.itemCategory().select(category);
  sel.addItem().click();
};

describe("RevOps — Billing & Invoices: the invoice lifecycle", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The invoice table
  // ──────────────────────────────────────────────────────────────────────────

  describe("The invoice table", () => {
    beforeEach(() => visitBilling([DRAFT_INVOICE]));

    it("names every column", () => {
      [
        "Invoice #",
        "Type",
        "Billing Period",
        "Resident",
        "Due Date",
        "Amount",
        "Status",
        "Actions",
      ].forEach((header) => cy.contains(header).should("be.visible"));
    });

    it("lists the invoice", () => {
      cy.contains("INV_2026_09_107").should("be.visible");
    });

    it("resolves the resident's name", () => {
      // The row carries only `user_id`; the name comes from the residents query.
      sel.row("INV_2026_09_107").should("contain.text", "Sheldon Cooper");
    });

    it("calls an invoice with no parent a Primary", () => {
      sel.row("INV_2026_09_107").should("contain.text", "Primary");
    });

    it("calls an invoice with a parent an Adjusted", () => {
      visitBilling([buildInvoice({ parent_invoice_id: 100 })]);
      sel.row("INV_2026_09_107").should("contain.text", "Adjusted");
    });

    it("shows the billing period as a month", () => {
      sel.row("INV_2026_09_107").should("contain.text", THIS_PERIOD_LABEL);
    });

    it("shows the total", () => {
      sel.row("INV_2026_09_107").should("contain.text", "550");
    });

    it("shows the status", () => {
      sel.status("INV_2026_09_107").should("contain.text", "DRAFT");
    });

    it("says Unknown for a resident it cannot resolve", () => {
      visitBilling([buildInvoice({ user_id: "someone-who-left" })]);
      sel.row("INV_2026_09_107").should("contain.text", "Unknown");
    });

    it("lists several invoices", () => {
      visitBilling([DRAFT_INVOICE, VOID_INVOICE]);
      cy.contains("INV_2026_09_107").should("be.visible");
      cy.contains("INV_2026_09_105").should("be.visible");
    });
  });

  describe("Statuses the list works out for itself", () => {
    it("shows a DUE invoice as DUE while its date is ahead", () => {
      visitBilling([DUE_INVOICE]);
      sel.status("INV_2026_09_108").should("contain.text", "DUE");
    });

    it("[as-built] shows a DUE invoice as OVERDUE once its date has passed", () => {
      // OVERDUE is never stored — the list derives it from `due_date < today`.
      visitBilling([OVERDUE_INVOICE]);
      sel.status("INV_2026_09_109").should("contain.text", "OVERDUE");
    });

    it("treats an invoice due today as still DUE, not overdue", () => {
      visitBilling([buildInvoice({ status: "DUE", due_date: "2026-09-14" })]);
      sel.status("INV_2026_09_107").should("contain.text", "DUE");
    });

    it("[as-built] hides a PAID invoice from this table entirely", () => {
      // Paid invoices move to the Payment History tab.
      visitBilling([buildInvoice({ status: "PAID" }), VOID_INVOICE]);
      cy.contains("INV_2026_09_105").should("be.visible");
      cy.contains("INV_2026_09_107").should("not.exist");
    });

    it("keeps a VOID invoice on the table", () => {
      visitBilling([VOID_INVOICE]);
      sel.status("INV_2026_09_105").should("contain.text", "VOID");
    });

    it("shows a payment awaiting approval as PENDING_APPROVAL", () => {
      visitBilling([
        buildInvoice({
          status: "DUE",
          payments: [
            {
              id: "pay-1",
              status: "PENDING_APPROVAL",
              created_at: "2026-09-13T10:00:00.000Z",
            },
          ],
        }),
      ]);
      sel.status("INV_2026_09_107").should("contain.text", "PENDING_APPROVAL");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The row actions
  // ──────────────────────────────────────────────────────────────────────────

  describe("The row actions", () => {
    it("offers view and download on every invoice", () => {
      visitBilling([DRAFT_INVOICE]);
      sel.viewAction("INV_2026_09_107").should("exist");
      sel.downloadAction("INV_2026_09_107").should("exist");
    });

    it("offers view and download even on a voided invoice", () => {
      visitBilling([VOID_INVOICE]);
      sel.viewAction("INV_2026_09_105").should("exist");
      sel.downloadAction("INV_2026_09_105").should("exist");
    });

    it("offers no ⋮ menu on a voided invoice", () => {
      // A void invoice has nowhere left to go.
      visitBilling([VOID_INVOICE]);
      sel.row("INV_2026_09_105").find("svg.cursor-pointer").should("not.exist");
    });

    it("offers a ⋮ menu on a draft", () => {
      visitBilling([DRAFT_INVOICE]);
      sel.kebab("INV_2026_09_107").should("exist");
    });
  });

  describe("The ⋮ menu on a draft", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
    });

    it("offers Edit, Finalize and Void", () => {
      sel.menuItem("Edit Invoice").should("be.visible");
      sel.menuItem("Finalize Invoice").should("be.visible");
      sel.menuItem("Void Invoice").should("be.visible");
    });

    it("offers nothing that belongs to a finalized invoice", () => {
      sel.menuItem("Adjust Invoice").should("not.exist");
      sel.menuItem("Mark as Paid").should("not.exist");
    });

    it("sends nothing merely by opening", () => {
      cy.assertNoRequest("@updateInvoice");
    });
  });

  describe("The ⋮ menu on a finalized invoice", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
      openMenu("INV_2026_09_108");
    });

    it("offers Adjust, Mark as Paid and Void", () => {
      sel.menuItem("Adjust Invoice").should("be.visible");
      sel.menuItem("Mark as Paid").should("be.visible");
      sel.menuItem("Void Invoice").should("be.visible");
    });

    it("no longer offers Edit or Finalize", () => {
      // A finalized invoice is corrected by adjustment, not by editing.
      sel.menuItem("Edit Invoice").should("not.exist");
      sel.menuItem("Finalize Invoice").should("not.exist");
    });
  });

  describe("The ⋮ menu on an overdue invoice", () => {
    it("offers exactly what a DUE invoice offers", () => {
      stubWrites();
      visitBilling([OVERDUE_INVOICE]);
      openMenu("INV_2026_09_109");
      sel.menuItem("Adjust Invoice").should("be.visible");
      sel.menuItem("Mark as Paid").should("be.visible");
      sel.menuItem("Void Invoice").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Viewing and downloading
  // ──────────────────────────────────────────────────────────────────────────

  describe("Viewing an invoice", () => {
    beforeEach(() => {
      visitBilling([DRAFT_INVOICE]);
      sel.viewAction("INV_2026_09_107").click();
    });

    it("opens the invoice", () => {
      cy.contains("Invoice #INV_2026_09_107").should("be.visible");
    });

    it("names who it is billed to", () => {
      cy.contains("Bill To:").should("be.visible");
      cy.contains("Sheldon Cooper").should("be.visible");
    });

    it("shows the period and the status", () => {
      cy.contains(THIS_PERIOD_LABEL).should("be.visible");
      cy.contains("DRAFT").should("be.visible");
    });

    it("lists every item", () => {
      cy.contains("Invoice Items").should("be.visible");
      cy.contains("Vaccination").should("be.visible");
      cy.contains("Uber to and fro").should("be.visible");
    });

    it("prices each item", () => {
      cy.contains("$500.00").should("be.visible");
      cy.contains("$50.00").should("be.visible");
    });

    it("totals them", () => {
      cy.contains("Total:").should("be.visible");
      cy.contains("$550.00").should("be.visible");
    });

    it("offers Download and Print", () => {
      cy.contains("button", "Download").should("be.visible");
      cy.contains("button", "Print").should("be.visible");
    });

    it("prints when asked", () => {
      cy.window().then((win) => cy.stub(win, "open").as("openPrint"));
      cy.contains("button", "Print").click();
      cy.get("@openPrint").should("have.been.called");
    });

    it("sends nothing to the API", () => {
      cy.intercept("PUT", "**/v1/revops/invoice/**").as("updateInvoice");
      cy.assertNoRequest("@updateInvoice");
    });
  });

  describe("Downloading an invoice", () => {
    it("writes a PDF named after the invoice", () => {
      visitBilling([DRAFT_INVOICE]);
      sel.downloadAction("INV_2026_09_107").click();
      cy.readFile("cypress/downloads/invoice-INV_2026_09_107.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("writes a real PDF", () => {
      visitBilling([DRAFT_INVOICE]);
      sel.downloadAction("INV_2026_09_107").click();
      cy.readFile("cypress/downloads/invoice-INV_2026_09_107.pdf", "binary", {
        timeout: 20000,
      }).then((contents: any) => {
        expect(contents.slice(0, 5), "PDF magic number").to.eq("%PDF-");
      });
    });

    it("downloads from the View modal too", () => {
      visitBilling([DRAFT_INVOICE]);
      sel.viewAction("INV_2026_09_107").click();
      cy.contains("button", "Download").click();
      cy.readFile("cypress/downloads/invoice-INV_2026_09_107.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Creating an invoice
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Create Invoice form", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([]);
      sel.createInvoice().click();
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("asks for a resident and a billing period", () => {
      cy.contains("Resident *").should("be.visible");
      cy.contains("Billing Period *").should("be.visible");
    });

    it("starts with neither chosen", () => {
      sel.resident().invoke("val").should("not.be.ok");
      sel.billingPeriod().invoke("val").should("not.be.ok");
    });

    it("offers every active resident", () => {
      sel.resident().should("contain.text", "Sheldon Cooper");
      sel.resident().should("contain.text", "Teja Senior");
    });

    it("leaves a deleted resident out", () => {
      visitBilling([], {
        residents: [SHELDON_RESIDENT, { ...TEJA_RESIDENT, isDeleted: true }],
      });
      sel.createInvoice().click();
      sel.resident().should("contain.text", "Sheldon Cooper");
      sel.resident().should("not.contain.text", "Teja Senior");
    });

    it("offers this month and the two before it", () => {
      sel.billingPeriod().should("contain.text", THIS_PERIOD_LABEL);
      sel.billingPeriod().should("contain.text", LAST_PERIOD_LABEL);
      sel.billingPeriod().should("contain.text", "July 2026");
    });

    it("defaults the due date to the fifteenth of next month", () => {
      sel.dueDate().should("have.value", DEFAULT_DUE_DATE);
    });

    it("refuses a due date in the past", () => {
      sel.dueDate().should("have.attr", "min", "2026-09-14");
    });

    it("offers the three item fields and an Add Item", () => {
      cy.contains("Invoice Items").should("be.visible");
      sel.itemDescription().should("exist");
      sel.itemAmount().should("exist");
      sel.itemCategory().should("exist");
      sel.addItem().should("be.visible");
    });

    it("offers every income category on an item", () => {
      ["Care Fee", "Monthly Fee", "Entertainment", "Transport", "Medical", "Misc"].forEach(
        (category) => sel.itemCategory().should("contain.text", category)
      );
    });

    it("offers a notes field", () => {
      sel.notes().should("exist");
      sel.notes().should("have.attr", "placeholder", "Add any additional notes");
    });

    it("shows no total until an item is added", () => {
      cy.contains("Total Amount").should("not.exist");
    });

    it("offers Cancel and Create Invoice", () => {
      sel.cancel().should("be.visible");
      sel.submit("Create Invoice").should("be.visible");
    });

    it("closes on Cancel", () => {
      sel.cancel().click();
      sel.modalTitle("Create Invoice").should("not.exist");
    });

    it("sends nothing merely by opening", () => {
      cy.assertNoRequest("@createInvoice");
    });
  });

  describe("Invoice items", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([]);
      sel.createInvoice().click();
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("adds an item to the invoice", () => {
      addItem("Vaccination", "500", "MEDICAL");
      cy.contains("Vaccination").should("be.visible");
    });

    it("shows the item's category", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.lineItem("Vaccination").should("contain.text", "Medical");
    });

    it("prices the item", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.lineItem("Vaccination").should("contain.text", "$500");
    });

    it("totals a single item", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.totalAmount().should("contain.text", "$500");
    });

    it("adds a second item", () => {
      addItem("Vaccination", "500", "MEDICAL");
      addItem("Uber to and fro", "50", "TRANSPORT");
      cy.contains("Vaccination").should("be.visible");
      cy.contains("Uber to and fro").should("be.visible");
    });

    it("totals several items", () => {
      addItem("Vaccination", "500", "MEDICAL");
      addItem("Uber to and fro", "50", "TRANSPORT");
      sel.totalAmount().should("contain.text", "$550");
    });

    it("clears the fields after adding", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.itemDescription().should("have.value", "");
      sel.itemAmount().should("have.value", "");
      sel.itemCategory().invoke("val").should("not.be.ok");
    });


    it("refuses an item whose description was typed and then cleared", () => {
      sel.itemDescription().type("x").clear();
      sel.itemAmount().type("500");
      sel.itemCategory().select("MEDICAL");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });

    it("refuses an item with no amount", () => {
      sel.itemDescription().type("Vaccination");
      sel.itemCategory().select("MEDICAL");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });

    it("refuses an item with no category", () => {
      sel.itemDescription().type("Vaccination");
      sel.itemAmount().type("500");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });

    it("refuses an amount of zero", () => {
      sel.itemDescription().type("Freebie");
      sel.itemAmount().type("0");
      sel.itemCategory().select("MISC");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });

    it("refuses a negative amount", () => {
      sel.itemDescription().type("Refund");
      sel.itemAmount().type("-50");
      sel.itemCategory().select("MISC");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });

    it("refuses a description of nothing but spaces", () => {
      sel.itemDescription().type("   ");
      sel.itemAmount().type("500");
      sel.itemCategory().select("MEDICAL");
      sel.addItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });


    it("keeps the fractional amount in the payload it submits", () => {
      // Resident and period go in FIRST. Changing either re-runs the
      // existing-draft lookup, which resets the form and takes the line items
      // with it — so an item added beforehand is gone by the time you submit.
      sel.resident().select(SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);
      addItem("Part charge", "12.50", "MISC");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").its("request.body.items.0.amount").should("eq", 12.5);
    });

    it("trims the description it stores", () => {
      addItem("  Vaccination  ", "500", "MEDICAL");
      sel.lineItem("Vaccination").should("exist");
    });

    it("removes an item", () => {
      addItem("Vaccination", "500", "MEDICAL");
      addItem("Uber to and fro", "50", "TRANSPORT");
      sel.deleteLineItem("Vaccination").click();
      cy.contains("Vaccination").should("not.exist");
      cy.contains("Uber to and fro").should("be.visible");
    });

    it("re-totals after a removal", () => {
      addItem("Vaccination", "500", "MEDICAL");
      addItem("Uber to and fro", "50", "TRANSPORT");
      sel.deleteLineItem("Vaccination").click();
      sel.totalAmount().should("contain.text", "$50");
    });

    it("opens an item for editing", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.editLineItem("Vaccination").click();
      sel.editItemDescription().should("have.value", "Vaccination");
      sel.editItemAmount().should("have.value", "500");
      sel.editItemCategory().should("have.value", "MEDICAL");
    });

    it("saves a changed item", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.editLineItem("Vaccination").click();
      sel.editItemAmount().clear().type("600");
      sel.saveLineItem().click();
      sel.totalAmount().should("contain.text", "$600");
    });

    it("abandons an edit on Cancel", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.editLineItem("Vaccination").click();
      sel.editItemAmount().clear().type("600");
      sel.cancelLineItem().click();
      sel.totalAmount().should("contain.text", "$500");
    });

    it("refuses to save an item edited to nothing", () => {
      addItem("Vaccination", "500", "MEDICAL");
      sel.editLineItem("Vaccination").click();
      sel.editItemDescription().clear();
      sel.saveLineItem().click();
      cy.assertPopover("Please fill in all item fields with valid values");
    });
  });

  describe("Creating an invoice — what it refuses", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([]);
      sel.createInvoice().click();
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("refuses an empty form", () => {
      sel.submit("Create Invoice").click();
      cy.assertNoRequest("@createInvoice");
    });

    it("says a resident is required", () => {
      sel.billingPeriod().select(THIS_PERIOD);
      sel.submit("Create Invoice").click();
      cy.contains("Resident is required").should("be.visible");
    });

    it("refuses an invoice with no billing period", () => {
      sel.resident().select(SHELDON);
      addItem("Vaccination", "500", "MEDICAL");
      sel.submit("Create Invoice").click();
      cy.assertNoRequest("@createInvoice");
    });

    it("refuses an invoice with no items", () => {
      sel.resident().select(SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);
      sel.submit("Create Invoice").click();

      cy.assertPopover("Please add at least one invoice item");
      cy.assertNoRequest("@createInvoice");
    });
  });

  describe("Creating an invoice — saving", () => {
    const fillInvoice = () => {
      sel.resident().select(SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);
      addItem("Vaccination", "500", "MEDICAL");
    };

    beforeEach(() => {
      stubWrites();
      visitBilling([]);
      sel.createInvoice().click();
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("creates the invoice", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.user_id).to.eq(SHELDON);
        expect(request.body.billing_period).to.eq(THIS_PERIOD);
        expect(request.body.home_id).to.eq(TEST_HOME_ID);
      });
    });

    it("creates it as a draft", () => {
      // A new invoice is always DRAFT — it becomes DUE only on Finalize.
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DRAFT");
      });
    });

    it("totals the items it carries", () => {
      fillInvoice();
      addItem("Uber to and fro", "50", "TRANSPORT");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(550);
        expect(request.body.items).to.have.length(2);
      });
    });

    it("carries each item's description, amount and category", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        const [item] = request.body.items;
        expect(item.description).to.eq("Vaccination");
        expect(item.amount).to.eq(500);
        expect(item.item_category).to.eq("MEDICAL");
        expect(item.invoice_item_id).to.be.a("string");
      });
    });

    it("carries the due date", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.due_date).to.eq(DEFAULT_DUE_DATE);
      });
    });

    it("carries a changed due date", () => {
      fillInvoice();
      sel.dueDate().clear().type("2026-10-20");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.due_date).to.eq("2026-10-20");
      });
    });

    it("carries the notes", () => {
      fillInvoice();
      sel.notes().type("Please settle by the due date");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.notes).to.eq("Please settle by the due date");
      });
    });

    it("nulls the notes when none were written", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.notes).to.eq(null);
      });
    });

    it("records who raised it", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.created_by_user_id).to.eq(TEST_USER_ID);
      });
    });

    it("authorises the request", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
      cy.assertAuthorized("@createInvoice");
    });

    it("confirms the creation", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
      cy.assertPopover("Invoice created successfully!");
    });

    it("closes the form", () => {
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
      sel.modalTitle("Create Invoice").should("not.exist");
    });

    it("reports a rejected creation", () => {
      cy.intercept("POST", "**/v1/revops/invoice", {
        statusCode: 400,
        body: { error: "Billing period already invoiced" },
      }).as("createInvoice");
      fillInvoice();
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice");
      cy.assertPopover("Billing period already invoiced");
    });

    it("keeps the form open after a rejected creation", () => {
      cy.intercept("POST", "**/v1/revops/invoice", { statusCode: 500, body: {} }).as(
        "createInvoice"
      );
      fillInvoice();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
      cy.dismissPopover();
      sel.modalTitle("Create Invoice").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. The existing-draft path
  // ──────────────────────────────────────────────────────────────────────────

  describe("When a draft already exists for that resident and period", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      sel.createInvoice().click();
      sel.resident().select(SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);
    });

    it("turns into an update rather than a second invoice", () => {
      sel.modalTitle("Update Draft Invoice").should("be.visible");
    });

    it("explains why", () => {
      cy.contains(
        "A draft invoice already exists for this resident and billing period"
      ).should("be.visible");
    });

    it("loads the items already on the draft", () => {
      cy.contains("Vaccination").should("be.visible");
      cy.contains("Uber to and fro").should("be.visible");
    });

    it("totals what is already there", () => {
      sel.totalAmount().should("contain.text", "$550");
    });

    it("renames the submit button", () => {
      sel.submit("Update Invoice").should("be.visible");
    });

    it("updates rather than creating", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Update Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.url).to.contain("/v1/revops/invoice/107");
        expect(request.body.id).to.eq(107);
      });
      cy.assertNoRequest("@createInvoice");
    });

    it("keeps the draft a draft", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Update Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DRAFT");
      });
    });

    it("re-totals with the added item", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Update Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(625);
        expect(request.body.items).to.have.length(3);
      });
    });

    it("keeps the ids of the items it already had", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Update Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        const ids = request.body.items.map((i: any) => i.invoice_item_id);
        expect(ids).to.include("item-1");
        expect(ids).to.include("item-2");
      });
    });

    it("confirms the update", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Update Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Invoice updated successfully!");
    });

    it("goes back to creating when a different period is chosen", () => {
      sel.billingPeriod().select(LAST_PERIOD);
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("goes back to creating when a different resident is chosen", () => {
      sel.resident().select(TEJA);
      sel.modalTitle("Create Invoice").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Editing a draft from the ⋮ menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("Edit Invoice", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Edit Invoice").click();
    });

    it("opens the draft for updating", () => {
      sel.modalTitle("Update Draft Invoice").should("be.visible");
    });

    it("pre-fills the resident and the period", () => {
      sel.resident().should("have.value", SHELDON);
      sel.billingPeriod().should("have.value", THIS_PERIOD);
    });

    it("pre-fills the items", () => {
      cy.contains("Vaccination").should("be.visible");
      cy.contains("Uber to and fro").should("be.visible");
      sel.totalAmount().should("contain.text", "$550");
    });

    it("saves a changed item", () => {
      sel.editLineItem("Vaccination").click();
      sel.editItemAmount().clear().type("600");
      sel.saveLineItem().click();
      sel.submit("Update Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(650);
      });
    });

    it("saves a removed item", () => {
      sel.deleteLineItem("Uber to and fro").click();
      sel.submit("Update Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.items).to.have.length(1);
        expect(request.body.total_amount).to.eq(500);
      });
    });

    it("refuses to save a draft stripped of every item", () => {
      sel.deleteLineItem("Vaccination").click();
      sel.deleteLineItem("Uber to and fro").click();
      sel.submit("Update Invoice").click();

      cy.assertPopover("Please add at least one invoice item");
      cy.assertNoRequest("@updateInvoice");
    });

  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Finalizing
  // ──────────────────────────────────────────────────────────────────────────

  describe("Finalize Invoice", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
    });

    it("moves the invoice to DUE", () => {
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.url).to.contain("/v1/revops/invoice/107");
        expect(request.body.status).to.eq("DUE");
      });
    });

    it("keeps everything else about the invoice", () => {
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.invoice_id).to.eq("INV_2026_09_107");
        expect(request.body.user_id).to.eq(SHELDON);
        expect(request.body.total_amount).to.eq(550);
        expect(request.body.items).to.have.length(2);
      });
    });

    it("confirms the change", () => {
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Invoice finalized successfully!");
    });

    it("closes the menu", () => {
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice");
      sel.menuItem("Finalize Invoice").should("not.exist");
    });

    it("reports a refusal", () => {
      cy.intercept("PUT", "**/v1/revops/invoice/**", {
        statusCode: 400,
        body: { error: "Invoice already finalized" },
      }).as("updateInvoice");
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Invoice already finalized");
    });

    it("falls back to a generic message", () => {
      cy.intercept("PUT", "**/v1/revops/invoice/**", { statusCode: 500, body: {} }).as(
        "updateInvoice"
      );
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Failed to finalize invoice.");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Voiding
  // ──────────────────────────────────────────────────────────────────────────

  describe("Void Invoice", () => {
    it("voids a draft", () => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Void Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("VOID");
        expect(request.url).to.contain("/v1/revops/invoice/107");
      });
    });

    it("voids a finalized invoice", () => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
      openMenu("INV_2026_09_108");
      sel.menuItem("Void Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("VOID");
      });
    });

    it("keeps the invoice's figures", () => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Void Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(550);
        expect(request.body.items).to.have.length(2);
      });
    });

    it("confirms the void", () => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Void Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Invoice voided successfully!");
    });

    it("reports a refusal", () => {
      cy.intercept("PUT", "**/v1/revops/invoice/**", {
        statusCode: 400,
        body: { error: "Cannot void a paid invoice" },
      }).as("updateInvoice");
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Void Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Cannot void a paid invoice");
    });

    it("[as-built] voids without asking for confirmation", () => {
      // There is no confirm step on this one, unlike deletes elsewhere in the
      // app — one click on a menu entry voids the invoice outright.
      stubWrites();
      visitBilling([DRAFT_INVOICE]);
      openMenu("INV_2026_09_107");
      sel.menuItem("Void Invoice").click();
      cy.wait("@updateInvoice");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Adjusting a finalized invoice
  // ──────────────────────────────────────────────────────────────────────────

  describe("Adjust Invoice", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
      openMenu("INV_2026_09_108");
      sel.menuItem("Adjust Invoice").click();
    });

    it("opens the adjustment form", () => {
      sel.modalTitle("Adjust Invoice").should("be.visible");
    });

    it("carries the original's items over", () => {
      cy.contains("Vaccination").should("be.visible");
      cy.contains("Uber to and fro").should("be.visible");
      sel.totalAmount().should("contain.text", "$550");
    });

    it("carries the resident and the period", () => {
      sel.resident().should("have.value", SHELDON);
      sel.billingPeriod().should("have.value", THIS_PERIOD);
    });

    it("does not offer to update a draft", () => {
      cy.contains("A draft invoice already exists").should("not.exist");
    });

    it("refuses an adjustment that changes nothing", () => {
      sel.submit("Create Invoice").click();
      cy.assertPopover(
        "No changes made. Please make changes before adjusting the invoice."
      );
      cy.assertNoRequest("@createInvoice");
    });

    it("creates a replacement invoice", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(625);
        expect(request.body.items).to.have.length(3);
      });
    });

    it("raises the replacement straight to DUE", () => {
      // An adjustment is not a draft — it replaces a live invoice.
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DUE");
      });
    });

    it("points the replacement at the invoice it replaces", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.parent_invoice_id).to.eq(108);
      });
    });

    it("voids the original once the replacement is raised", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice");
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.url).to.contain("/v1/revops/invoice/108");
        expect(request.body.status).to.eq("VOID");
        expect(request.body.total_amount).to.eq(550);
      });
    });

    it("confirms both halves", () => {
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Adjusted and voided previous invoice successfully!");
    });

    it("does not void the original when the replacement is refused", () => {
      cy.intercept("POST", "**/v1/revops/invoice", {
        statusCode: 500,
        body: { error: "Could not raise adjustment" },
      }).as("createInvoice");
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice");
      cy.assertPopover("Could not raise adjustment");
      cy.assertNoRequest("@updateInvoice");
    });

    it("[as-built] says so distinctly when only the void half fails", () => {
      // The replacement exists but the original is still live — two invoices
      // for one period. The message is deliberately different so the operator
      // knows to void the original by hand.
      cy.intercept("PUT", "**/v1/revops/invoice/**", { statusCode: 500, body: {} }).as(
        "updateInvoice"
      );
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@updateInvoice");
      cy.assertPopover("Adjustment created but failed to void original invoice.");
    });

    it("counts a changed due date as a change", () => {
      sel.dueDate().clear().type("2026-10-20");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
    });

    it("counts changed notes as a change", () => {
      sel.notes().clear().type("Corrected billing");
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice");
    });

    it("counts a removed item as a change", () => {
      sel.deleteLineItem("Uber to and fro").click();
      sel.submit("Create Invoice").click();
      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.total_amount).to.eq(500);
      });
    });

    it("keeps an already-adjusted invoice pointing at the first parent", () => {
      // Adjusting an adjustment chains back to the original, not to the
      // intermediate one.
      stubWrites();
      visitBilling([
        buildInvoice({
          id: 110,
          invoice_id: "INV_2026_09_110",
          status: "DUE",
          parent_invoice_id: 99,
        }),
      ]);
      openMenu("INV_2026_09_110");
      sel.menuItem("Adjust Invoice").click();
      addItem("Physio", "75", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.parent_invoice_id).to.eq(99);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Marking as paid
  // ──────────────────────────────────────────────────────────────────────────

  describe("Mark as Paid", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
      openMenu("INV_2026_09_108");
      sel.menuItem("Mark as Paid").click();
      cy.contains("Mark as Paid").should("be.visible");
    });

    it("opens the payment form", () => {
      cy.contains("Record a manual payment for invoice").should("be.visible");
      cy.contains("#INV_2026_09_108").should("be.visible");
    });

    it("summarises the invoice", () => {
      cy.contains("Invoice Number").should("be.visible");
      cy.contains("Billing Period").should("be.visible");
      cy.contains("Due Date").should("be.visible");
      cy.contains("Total Amount").should("be.visible");
    });

    it("shows the amount owed", () => {
      cy.contains("$550").should("be.visible");
    });

    it("asks for a payment type, a date and a reference", () => {
      sel.paymentType().should("exist");
      sel.paidDate().should("exist");
      sel.referenceId().should("exist");
    });

    it("locks the amount", () => {
      sel.paidAmount().should("have.attr", "readonly");
    });

    it("refuses a future paid date", () => {
      sel.paidDate().should("have.attr", "max", "2026-09-14");
    });

    it("refuses a payment with no reference", () => {
      sel.referenceId().clear();
      cy.contains("button", "Mark as Paid").last().click();
      cy.assertPopover("Please enter a reference ID");
      cy.assertNoRequest("@createPayment");
    });

    it("refuses a payment with no date", () => {
      sel.referenceId().type("TXN-2026-001");
      sel.paidDate().clear();
      cy.contains("button", "Mark as Paid").last().click();
      cy.assertPopover("Please select the paid date");
      cy.assertNoRequest("@createPayment");
    });

    it("records the payment first", () => {
      sel.referenceId().type("TXN-2026-001");
      sel.paidDate().clear().type("2026-09-14");
      cy.contains("button", "Mark as Paid").last().click();

      cy.wait("@createPayment").then(({ request }) => {
        expect(request.body.subject_type).to.eq("INVOICE");
        expect(request.body.subject_public_id).to.eq("INV_2026_09_108");
        expect(request.body.provider).to.eq("MANUAL");
        expect(request.body.manual_reference).to.eq("TXN-2026-001");
        expect(request.body.payer_user_id).to.eq(SHELDON);
      });
    });

    it("marks the invoice paid once the payment is recorded", () => {
      sel.referenceId().type("TXN-2026-001");
      sel.paidDate().clear().type("2026-09-14");
      cy.contains("button", "Mark as Paid").last().click();

      cy.wait("@createPayment");
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("PAID");
        expect(request.url).to.contain("/v1/revops/invoice/108");
      });
    });

    it("confirms the payment", () => {
      sel.referenceId().type("TXN-2026-001");
      sel.paidDate().clear().type("2026-09-14");
      cy.contains("button", "Mark as Paid").last().click();
      cy.wait("@updateInvoice");
      cy.assertPopover("Invoice marked as paid successfully!");
    });

    it("does not mark the invoice paid when the payment is refused", () => {
      cy.intercept("POST", "**/v1/revops/payment", {
        statusCode: 500,
        body: { error: "Payment gateway unavailable" },
      }).as("createPayment");
      sel.referenceId().type("TXN-2026-001");
      sel.paidDate().clear().type("2026-09-14");
      cy.contains("button", "Mark as Paid").last().click();

      cy.wait("@createPayment");
      cy.assertPopover("Payment gateway unavailable");
      cy.assertNoRequest("@updateInvoice");
    });

    it("closes on Cancel without recording anything", () => {
      sel.cancel().click();
      cy.assertNoRequest("@createPayment");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. The Residents tab
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Residents tab", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
      sel.tab("Residents").click();
    });

    it("gives every resident a card", () => {
      cy.contains("Sheldon Cooper").should("be.visible");
      cy.contains("Teja Senior").should("be.visible");
    });

    it("shows the room number", () => {
      sel.residentCard("Sheldon Cooper").should("contain.text", "Room 10");
    });

    it("labels the three figures", () => {
      ["Monthly Rate", "Total Paid", "Outstanding"].forEach((label) =>
        sel.residentCard("Sheldon Cooper").should("contain.text", label)
      );
    });

    it("offers a New Invoice on every card", () => {
      sel.newInvoice("Sheldon Cooper").should("be.visible");
      sel.newInvoice("Teja Senior").should("be.visible");
    });

    it("leaves a deleted resident out", () => {
      visitBilling([DUE_INVOICE], {
        residents: [SHELDON_RESIDENT, { ...TEJA_RESIDENT, isDeleted: true }],
      });
      sel.tab("Residents").click();
      cy.contains("Sheldon Cooper").should("be.visible");
      cy.contains("Teja Senior").should("not.exist");
    });

    it("says so when the home has no contracted residents", () => {
      visitBilling([], { residents: [] });
      sel.tab("Residents").click();
      cy.contains("No active residents found").should("be.visible");
    });

    it("asks for residents at the contract milestone", () => {
      cy.get("@getUsers.all").should((interceptions: any) => {
        const contracted = interceptions.some((i: any) =>
          new URL(i.request.url).searchParams.get("milestone")
        );
        expect(contracted, "a milestone-scoped residents query").to.eq(true);
      });
    });
  });

  describe("A resident's figures", () => {
    const openResidents = (invoices: any[]) => {
      stubWrites();
      visitBilling(invoices);
      sel.tab("Residents").click();
      cy.contains("Sheldon Cooper").should("be.visible");
    };

    it("counts a finalized invoice as outstanding", () => {
      openResidents([DUE_INVOICE]);
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$550");
    });

    it("counts nothing paid until something is", () => {
      openResidents([DUE_INVOICE]);
      sel.stat("Sheldon Cooper", "Total Paid").should("contain.text", "$0");
    });

    it("counts a paid invoice as paid", () => {
      openResidents([buildInvoice({ status: "PAID" })]);
      sel.stat("Sheldon Cooper", "Total Paid").should("contain.text", "$550");
    });


    it("ignores a draft invoice entirely", () => {
      // Only a finalized invoice is money owed; a draft is not yet a claim.
      openResidents([DRAFT_INVOICE]);
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$0");
    });

    it("ignores a voided invoice", () => {
      openResidents([buildInvoice({ status: "VOID" })]);
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$0");
    });

    it("adds several finalized invoices together", () => {
      openResidents([
        DUE_INVOICE,
        buildInvoice({
          id: 111,
          invoice_id: "INV_2026_09_111",
          status: "DUE",
          total_amount: 200,
        }),
      ]);
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$750");
    });

    it("keeps one resident money off another card", () => {
      openResidents([buildInvoice({ status: "DUE", user_id: TEJA })]);
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$0");
      sel.stat("Teja Senior", "Outstanding").should("contain.text", "$550");
    });


  });

  describe("New Invoice from a resident card", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([]);
      sel.tab("Residents").click();
      cy.contains("Sheldon Cooper").should("be.visible");
      sel.newInvoice("Sheldon Cooper").click();
    });

    it("opens the same Create Invoice form", () => {
      sel.modalTitle("Create Invoice").should("be.visible");
    });

    it("pre-selects the resident whose card was used", () => {
      sel.resident().should("have.value", SHELDON);
    });

    it("pre-selects a different resident from a different card", () => {
      sel.cancel().click();
      sel.newInvoice("Teja Senior").click();
      sel.resident().should("have.value", TEJA);
    });

    it("leaves the billing period to be chosen", () => {
      sel.billingPeriod().invoke("val").should("not.be.ok");
    });

    it("offers everything the Create Invoice form offers", () => {
      sel.dueDate().should("exist");
      sel.itemDescription().should("exist");
      sel.addItem().should("be.visible");
      sel.notes().should("exist");
    });

    it("raises the invoice against that resident", () => {
      sel.billingPeriod().select(THIS_PERIOD);
      addItem("Vaccination", "500", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.user_id).to.eq(SHELDON);
        expect(request.body.status).to.eq("DRAFT");
      });
    });

    it("closes on Cancel", () => {
      sel.cancel().click();
      sel.modalTitle("Create Invoice").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. The Payment History tab
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Payment History tab", () => {
    const PAID_INVOICE = buildInvoice({
      status: "PAID",
      updated_at: "2026-09-12T10:00:00.000Z",
    });

    const openHistory = (invoices: any[] = [PAID_INVOICE]) => {
      visitBilling(invoices);
      sel.tab("Payment History").click();
    };

    it("heads the tab", () => {
      openHistory();
      cy.contains("Record of all received payments").should("be.visible");
    });

    it("names every column", () => {
      openHistory();
      ["Date", "Invoice", "Resident", "Amount", "Billing Period", "Status"].forEach(
        (header) => cy.contains(header).should("be.visible")
      );
    });

    it("asks the API only for paid invoices", () => {
      openHistory();
      cy.get("@getInvoices.all").should((interceptions: any) => {
        const paidOnly = interceptions.some(
          (i: any) => new URL(i.request.url).searchParams.get("status") === "PAID"
        );
        expect(paidOnly, "a PAID-scoped invoices query").to.eq(true);
      });
    });

    it("lists a settled invoice", () => {
      openHistory();
      cy.contains("INV_2026_09_107").should("be.visible");
    });

    it("names the resident who paid", () => {
      openHistory();
      cy.contains("Sheldon Cooper").should("be.visible");
    });

    it("shows the amount to the cent", () => {
      openHistory();
      cy.contains("$550.00").should("be.visible");
    });

    it("shows the billing period as a month", () => {
      openHistory();
      cy.contains(THIS_PERIOD_LABEL).should("be.visible");
    });

    it("marks every row PAID", () => {
      openHistory();
      cy.contains("span", "PAID").should("be.visible");
    });

    it("says so when nothing has been received this month", () => {
      openHistory([]);
      cy.contains("No payments received yet for this month.").should("be.visible");
    });

    it("says Unknown for a resident it cannot resolve", () => {
      openHistory([buildInvoice({ status: "PAID", user_id: "someone-who-left" })]);
      cy.contains("Unknown").should("be.visible");
    });

    it("offers no row actions — this is a record, not a worklist", () => {
      openHistory();
      cy.get('div[title="View Invoice"]').should("not.exist");
    });
  });

  describe("Moving between the tabs", () => {
    beforeEach(() => {
      stubWrites();
      visitBilling([DUE_INVOICE]);
    });

    it("opens on Invoices", () => {
      cy.contains("Invoice #").should("be.visible");
    });

    it("offers all three tabs", () => {
      ["Invoices", "Residents", "Payment History"].forEach((label) =>
        sel.tab(label).should("be.visible")
      );
    });

    it("switches to Residents", () => {
      sel.tab("Residents").click();
      cy.contains("Monthly Rate").should("be.visible");
      cy.contains("Invoice #").should("not.exist");
    });

    it("switches to Payment History", () => {
      sel.tab("Payment History").click();
      cy.contains("Record of all received payments").should("be.visible");
    });

    it("comes back to Invoices", () => {
      sel.tab("Residents").click();
      sel.tab("Invoices").click();
      cy.contains("Invoice #").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — an invoice is raised from nothing", () => {
      stubWrites();
      visitBilling([]);

      sel.createInvoice().click();
      sel.resident().select(SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);

      addItem("Vaccination", "500", "MEDICAL");
      sel.totalAmount().should("contain.text", "$500");
      addItem("Uber to and fro", "50", "TRANSPORT");
      sel.totalAmount().should("contain.text", "$550");

      sel.notes().type("September extras");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DRAFT");
        expect(request.body.total_amount).to.eq(550);
        expect(request.body.items).to.have.length(2);
        expect(request.body.notes).to.eq("September extras");
      });
      cy.assertPopover("Invoice created successfully!");
    });

    it("E2E — a draft is corrected, then finalized", () => {
      stubWrites();
      visitBilling([DRAFT_INVOICE]);

      openMenu("INV_2026_09_107");
      sel.menuItem("Edit Invoice").click();
      sel.editLineItem("Vaccination").click();
      sel.editItemAmount().clear().type("450");
      sel.saveLineItem().click();
      sel.totalAmount().should("contain.text", "$500");
      sel.submit("Update Invoice").click();

      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DRAFT");
        expect(request.body.total_amount).to.eq(500);
      });
      cy.dismissPopover();

      openMenu("INV_2026_09_107");
      sel.menuItem("Finalize Invoice").click();
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DUE");
      });
      cy.assertPopover("Invoice finalized successfully!");
    });

    it("E2E — a live invoice is adjusted and the original voided", () => {
      stubWrites();
      visitBilling([DUE_INVOICE]);

      openMenu("INV_2026_09_108");
      sel.menuItem("Adjust Invoice").click();
      sel.modalTitle("Adjust Invoice").should("be.visible");

      sel.deleteLineItem("Uber to and fro").click();
      addItem("Taxi", "30", "TRANSPORT");
      sel.totalAmount().should("contain.text", "$530");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("DUE");
        expect(request.body.parent_invoice_id).to.eq(108);
        expect(request.body.total_amount).to.eq(530);
      });
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("VOID");
      });
      cy.assertPopover("Adjusted and voided previous invoice successfully!");
    });

    it("E2E — a live invoice is settled", () => {
      stubWrites();
      visitBilling([DUE_INVOICE]);

      openMenu("INV_2026_09_108");
      sel.menuItem("Mark as Paid").click();

      sel.referenceId().type("CHK-4471");
      sel.paidDate().clear().type("2026-09-12");
      cy.contains("button", "Mark as Paid").last().click();

      cy.wait("@createPayment").then(({ request }) => {
        expect(request.body.manual_reference).to.eq("CHK-4471");
      });
      cy.wait("@updateInvoice").then(({ request }) => {
        expect(request.body.status).to.eq("PAID");
      });
      cy.assertPopover("Invoice marked as paid successfully!");
    });

    it("E2E — an invoice raised from a resident card lands on that resident", () => {
      stubWrites();
      visitBilling([]);

      sel.tab("Residents").click();
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$0");
      sel.newInvoice("Sheldon Cooper").click();

      sel.resident().should("have.value", SHELDON);
      sel.billingPeriod().select(THIS_PERIOD);
      addItem("Vaccination", "500", "MEDICAL");
      sel.submit("Create Invoice").click();

      cy.wait("@createInvoice").then(({ request }) => {
        expect(request.body.user_id).to.eq(SHELDON);
      });
      cy.assertPopover("Invoice created successfully!");
    });

    it("E2E — money owed becomes money received across the three tabs", () => {
      stubWrites();
      visitBilling([DUE_INVOICE]);

      // Invoices: it is live and owed.
      sel.status("INV_2026_09_108").should("contain.text", "DUE");

      // Residents: the same money shows as outstanding against the resident.
      sel.tab("Residents").click();
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$550");
      sel.stat("Sheldon Cooper", "Total Paid").should("contain.text", "$0");

      // Payment History: nothing received yet.
      sel.tab("Payment History").click();
      // The intermediate Payment History state is not asserted here: the list
      // stub answers every invoice query with the same body, so it cannot show
      // the tab's `status=PAID` filter emptying it. `The Payment History tab`
      // covers that with a stub scoped to the query.

      // Once the API reports it settled, all three move together.
      const settled = buildInvoice({
        id: 108,
        invoice_id: "INV_2026_09_108",
        status: "PAID",
      });
      visitBilling([settled]);

      // Invoices drops it — a paid invoice is no longer a worklist item.
      cy.contains("INV_2026_09_108").should("not.exist");

      sel.tab("Residents").click();
      sel.stat("Sheldon Cooper", "Total Paid").should("contain.text", "$550");
      // Not $0 — see "drives the outstanding balance negative once an invoice
      // is paid". The DUE side empties and the PAID side is subtracted from it.
      sel.stat("Sheldon Cooper", "Outstanding").should("contain.text", "$-550");

      sel.tab("Payment History").click();
      cy.contains("INV_2026_09_108").should("be.visible");
    });
  });
});
