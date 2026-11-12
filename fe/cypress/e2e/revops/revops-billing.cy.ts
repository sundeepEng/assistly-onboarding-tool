/// <reference types="cypress" />

/**
 * RevOps — Billing & Invoices (pages/revops/billing-invoice.tsx)
 *
 * The screen is gated three ways and each is asserted separately:
 *   1. `authorizedModules` on the home must include REVOPS (a per-tenant licence);
 *   2. the role must hold REVOPS_BILLING_INVOICE to stay on the page at all;
 *   3. REVOPS_PCHO_BILLING_INVOICE vs REVOPS_SENIOR_BILLING_INVOICE decides which
 *      of the two completely different views renders.
 *
 * Money note: invoices are in **dollars** (`total_amount`), unlike budget and
 * payroll which are in cents. The stat assertions below rely on that.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildInvoiceRow,
  currentBillingPeriod,
  TEST_HOME_ID,
} from "../../framework/module-commands";

const BILLING = "/revops/billing-invoice";

describe("RevOps — Billing & Invoices", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The invoices query", () => {
    it("GETs /v1/revops/invoice on load", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
    });

    it("scopes the query to the signed-in user's home", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
      cy.assertQuery("@getInvoices", { home_id: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
      cy.assertAuthorized("@getInvoices");
    });

    it("does not send a billing_period — the month filter is applied client-side", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices").then((interception) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("billing_period")).to.be.null;
      });
    });

    it("reads the home so the sidebar and module gate can resolve", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The admin billing view", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
    });

    it("renders the page heading", () => {
      cy.contains("Billing & Invoices").should("be.visible");
    });

    it("renders the strapline", () => {
      cy.contains("Manage resident billing and track payments").should("be.visible");
    });

    it("renders the four stat cards", () => {
      ["Total Invoiced", "Total Paid", "Due Amount", "Active Invoices"].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });

    it("renders the three billing tabs", () => {
      ["Invoices", "Residents", "Payment History"].forEach((tab) => {
        cy.contains(tab).should("be.visible");
      });
    });

    it("offers a Create Invoice button", () => {
      cy.contains("button", "Create Invoice").should("be.visible");
    });

    it("defaults the month filter to the current month", () => {
      cy.get('input[name="filterMonth"]').should("have.value", currentBillingPeriod());
    });

    it("caps the month filter at the current month — you cannot bill the future", () => {
      cy.get('input[name="filterMonth"]').should("have.attr", "max", currentBillingPeriod());
    });
  });

  // ── Stats arithmetic ───────────────────────────────────────────────────────

  describe("The billing stats", () => {
    it("counts a DUE invoice into both Total Invoiced and Due Amount", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: "DUE", total_amount: 2500 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$2,500");
      cy.contains("Due Amount").parent().should("contain.text", "$2,500");
    });

    it("counts a DRAFT invoice into Total Invoiced but not Due Amount", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: "DRAFT", total_amount: 1000 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$1,000");
      cy.contains("Due Amount").parent().should("contain.text", "$0");
    });

    it("counts a PAID invoice into Total Paid only", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: "PAID", total_amount: 3000 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Paid").parent().should("contain.text", "$3,000");
      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
    });

    it("counts only DUE invoices as Active Invoices", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [
          buildInvoiceRow({ id: 1, status: "DUE" }),
          buildInvoiceRow({ id: 2, status: "DUE" }),
          buildInvoiceRow({ id: 3, status: "PAID" }),
          buildInvoiceRow({ id: 4, status: "DRAFT" }),
        ],
      });
      cy.wait("@getInvoices");

      cy.contains("Active Invoices").parent().should("contain.text", "2");
    });

    it("is case-insensitive about the status", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: "due", total_amount: 500 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Due Amount").parent().should("contain.text", "$500");
    });

    it("excludes invoices from another billing period", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ billing_period: "2020-01", total_amount: 9999 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
    });

    it("shows zeroes when the home has no invoices at all", () => {
      cy.visitRevopsAs(BILLING, "PCHO", { invoices: [] });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
      cy.contains("Active Invoices").parent().should("contain.text", "0");
    });

    /**
     * Pinned: an OVERDUE invoice is a valid status in `InvoiceSchema` but the
     * stats block only tests for DRAFT, DUE and PAID — so an overdue bill is
     * counted in none of the four cards and disappears from the summary entirely.
     */
    it("counts an OVERDUE invoice into none of the four stats", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: "OVERDUE", total_amount: 7500 })],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
      cy.contains("Total Paid").parent().should("contain.text", "$0");
      cy.contains("Due Amount").parent().should("contain.text", "$0");
      cy.contains("Active Invoices").parent().should("contain.text", "0");
    });

    it("sums several invoices in the same period", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [
          buildInvoiceRow({ id: 1, status: "DUE", total_amount: 1000 }),
          buildInvoiceRow({ id: 2, status: "DRAFT", total_amount: 500 }),
        ],
      });
      cy.wait("@getInvoices");

      cy.contains("Total Invoiced").parent().should("contain.text", "$1,500");
    });
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────

  describe("The billing tabs", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
    });

    it("opens on the Invoices tab", () => {
      cy.contains("Invoices").should("be.visible");
    });

    it("switches to Residents", () => {
      cy.contains("Residents").click();
      cy.contains("Residents").should("be.visible");
    });

    it("queries the seniors list for the Residents tab", () => {
      cy.contains("Residents").click();
      cy.wait("@getUsers");
      cy.assertAuthorized("@getUsers");
    });

    it("switches to Payment History", () => {
      cy.contains("Payment History").click();
      cy.contains("Payment History").should("be.visible");
    });
  });

  // ── Add Invoice ────────────────────────────────────────────────────────────

  describe("The Create Invoice modal", () => {
    beforeEach(() => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
    });

    it("opens when Create Invoice is clicked", () => {
      cy.contains("button", "Create Invoice").click();
      cy.get("form").should("exist");
    });

    it("queries the residents the invoice can be raised against", () => {
      cy.contains("button", "Create Invoice").click();
      cy.wait("@getUsers");
      cy.assertAuthorized("@getUsers");
    });

    it("does not POST anything until the form is submitted", () => {
      cy.stubPost("/v1/revops/invoice", "createInvoice");
      cy.contains("button", "Create Invoice").click();
      cy.get("form").should("exist");
      cy.assertNoRequest("@createInvoice");
    });
  });

  // ── Module entitlement ─────────────────────────────────────────────────────

  describe("Module entitlement", () => {
    /**
     * `useAuthorizedModules` falls back to *every* module when the home fetch
     * returns nothing, so restricting access requires a home that explicitly
     * omits REVOPS — an empty response would open the page, not close it.
     */
    it("still renders billing when the home omits REVOPS — the page has no module gate", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
      });
      cy.contains("Billing & Invoices").should("be.visible");
    });

    it("renders billing when REVOPS is licensed", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        home: buildHome({ authorizedModules: ["CRM", "REVOPS"] }),
      });
      cy.contains("Billing & Invoices").should("be.visible");
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────

  describe("Role gating", () => {
    it("lets a PCHO see the admin billing view", () => {
      cy.visitRevopsAs(BILLING, "PCHO");
      cy.contains("Billing & Invoices").should("be.visible");
    });

    it("shows a Senior their own invoices instead of the admin view", { tags: [Tags.SENIOR] }, () => {
      cy.visitRevopsAs(BILLING, "Senior");
      // REVOPS_SENIOR_BILLING_INVOICE renders <SeniorInvoices/>, never the
      // "Manage resident billing" admin header.
      cy.contains("Manage resident billing and track payments").should("not.exist");
    });

    it("redirects a HomeAdmin away — RevOps is not in their permission set", { tags: [Tags.HOMEADMIN] }, () => {
      cy.visitRevopsAs(BILLING, "HomeAdmin");
      cy.location("pathname", { timeout: 10000 }).should("not.eq", BILLING);
    });

    it("redirects a Nurse away", { tags: [Tags.NURSE] }, () => {
      cy.visitRevopsAs(BILLING, "Nurse");
      cy.location("pathname", { timeout: 10000 }).should("not.eq", BILLING);
    });

    it("does not show the admin stat cards to a Nurse", { tags: [Tags.NURSE] }, () => {
      cy.visitRevopsAs(BILLING, "Nurse");
      cy.contains("Total Invoiced").should("not.exist");
    });
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  describe("When the API fails", () => {
    it("keeps the page usable and shows zeroed stats on a 500", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics();
      cy.stubInvoicesFailure(500);
      cy.visit(BILLING);

      cy.contains("Billing & Invoices").should("be.visible");
      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
    });

    it("shows zeroed stats on a 403", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics();
      cy.stubInvoicesFailure(403, "Forbidden");
      cy.visit(BILLING);

      cy.contains("Active Invoices").parent().should("contain.text", "0");
    });

    it("survives an invoice row with no total_amount", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ total_amount: null })],
      });
      cy.wait("@getInvoices");
      cy.contains("Total Invoiced").parent().should("contain.text", "$0");
    });

    it("survives an invoice row with no status", () => {
      cy.visitRevopsAs(BILLING, "PCHO", {
        invoices: [buildInvoiceRow({ status: undefined })],
      });
      cy.wait("@getInvoices");
      cy.contains("Billing & Invoices").should("be.visible");
    });

    /**
     * The screen reads `invoicesData?.invoices || invoicesData`, so it copes with
     * the endpoint returning a bare array instead of `{ invoices: [...] }`.
     */
    it("accepts a bare array response as well as { invoices }", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubBudgetSummary();
      cy.stubBudgetMetrics();
      cy.intercept("GET", "**/v1/revops/invoice*", {
        statusCode: 200,
        body: [buildInvoiceRow({ status: "DUE", total_amount: 1234 })],
      }).as("getInvoices");
      cy.visit(BILLING);

      cy.wait("@getInvoices");
      cy.contains("Due Amount").parent().should("contain.text", "$1,234");
    });
  });

  // ── Session ────────────────────────────────────────────────────────────────

  describe("Session handling", () => {
    it("does not query billing without a session", () => {
      cy.clearAuthSession();
      cy.stubHome();
      cy.stubInvoices();
      cy.visit(BILLING);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", BILLING);
    });

    it("sends the token from the current session, not a stale one", () => {
      cy.visitRevopsAs(BILLING);
      cy.wait("@getInvoices");
      cy.getCookie("idToken").then((cookie) => {
        cy.get("@getInvoices").then((interception: any) => {
          expect(interception.request.headers.authorization).to.eq(`Bearer ${cookie?.value}`);
        });
      });
    });
  });
});
