/// <reference types="cypress" />

/**
 * Home dashboard — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE, like its clinical, CRM, HCM and
 * RevOps counterparts. Each asserts the behaviour the app SHOULD have against
 * code that does something else.
 *
 * A test here turning green means the bug is fixed: move it into
 * home-dashboard.cy.ts rather than deleting it. Never weaken an assertion to
 * match the code — if the behaviour turns out to be intended, delete the test
 * and record the decision in the owning spec.
 *
 * WHAT IS IN HERE AND WHAT IS NOT
 *   The dashboard carries 11 pinned findings; most are `[as-built]` tests in
 *   home-dashboard.cy.ts recording how it behaves when a query fails (it hangs
 *   on the spinner with no message and no retry). Whether that should be a
 *   toast, an inline error or a retry button is a product decision, so those
 *   stay as passing pins.
 *
 *   The two below are not a matter of opinion: a soft-deleted person is
 *   counted as present, and a home reads "documents complete" while a required
 *   document is missing.
 *
 *   npx cypress run --spec cypress/e2e/dashboard/known-defects.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const HOME = "/";

/** Thu 17 Sep 2026, midday local — the instant home-dashboard.cy.ts uses. */
const FROZEN_NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

const person = (role: string, overrides: Record<string, any> = {}) => ({
  userId: `${role}-1`,
  name: `${role} One`,
  firstName: role,
  lastName: "One",
  email: `${role.toLowerCase()}@assistly.com`,
  mobile: "5550000000",
  role,
  homeId: TEST_HOME_ID,
  createdAt: "2026-09-02T10:00:00.000Z",
  contractCompletedOn: "2026-09-02T10:00:00.000Z",
  documents: [],
  ...overrides,
});

const sel = {
  welcome: () => cy.contains(/^Welcome to /),
  statCard: (title: string) =>
    cy.get(`[title="${title}"]`).closest('div[class*="rounded-[10px]"]'),
};

const visitDashboard = (
  opts: { users?: Record<string, any[]>; home?: any } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(opts.home ?? buildHome());

  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = (req.query.userType as string | undefined) ?? "";
    req.reply({ statusCode: 200, body: { users: opts.users?.[userType] ?? [] } });
  }).as("getUsers");

  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: {
      userId: TEST_USER_ID,
      name: "Test User",
      role: "PCHO",
      homeId: TEST_HOME_ID,
      documents: [],
    },
  }).as("getMe");

  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );

  cy.stubPresign();
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(HOME);
};

const settled = () => sel.welcome().should("be.visible");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Deleted people are still counted
// ─────────────────────────────────────────────────────────────────────────────

describe("Home dashboard known defects — the headcount cards", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("excludes a deleted referral agent from the count", () => {
    // `dashboard.tsx` rebuilds `filteredUsersData` for leads, seniors, PCGs,
    // nurseLeads and nurses — and drops referrals and PCGLeads on the floor.
    // The delete flag is never consulted for those two, so a home that has
    // removed an agent still reports them as active.
    visitDashboard({
      users: {
        Referral: [
          person("Referral"),
          person("Referral", { userId: "Referral-2", isDeleted: true }),
        ],
      },
    });
    settled();
    sel.statCard("Referral Agents").should("contain.text", "1");
  });

  it("excludes a deleted care lead from the count", () => {
    // The same omission, and the more consequential of the two: Care Leads is
    // the staff-applications figure a manager works from.
    visitDashboard({
      users: {
        PCGLead: [
          person("PCGLead"),
          person("PCGLead", { userId: "PCGLead-2", isDeleted: true }),
        ],
      },
    });
    settled();
    sel.statCard("Care Leads").should("contain.text", "1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. A home reads compliant while a required document is missing
// ─────────────────────────────────────────────────────────────────────────────

describe("Home dashboard known defects — Pending Documents", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("counts document TYPES, not uploaded rows", () => {
    // `summarizeDocsBrief` reduces over the uploaded list and adds 1 for every
    // row whose name matches a required constant — so the SAME document twice
    // counts twice.
    //
    // HOMEDOCUMENTS has four required entries. Uploading two copies of one of
    // them makes the panel read "2/4" when only ONE of the four types is
    // actually on file. Four copies would read "4/4" and declare the home
    // ready for inspection with three required documents missing.
    //
    // Its per-user siblings (`summarizePCHORequiredDocs`,
    // `calculatePendingDocsForUser`) both de-duplicate by type; only the home
    // one double counts. Pinned at unit level too, in
    // __tests__/unit/compliance/compliance-document-summaries.test.ts.
    const copy = (documentId: string) => ({
      documentId,
      documentName: "Fire Alarm Inspection Report",
      documentType: ".pdf",
      documentUrl: `https://bucket/${documentId}.pdf`,
      documentExpiryDate: "2030-01-01",
    });

    visitDashboard({ home: buildHome({ documents: [copy("d1"), copy("d2")] }) });
    settled();

    cy.contains("Pending Documents").should("be.visible");
    cy.contains("Home Documents").click();
    // One type on file out of four required.
    cy.contains(/^Missing Documents \(1\/4\)$/).should("exist");
  });
});
