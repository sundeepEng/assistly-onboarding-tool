/// <reference types="cypress" />

/**
 * CRM — Compliance Guests (pages/crm/complianceguest/index.tsx)
 *
 *   components/compliance/compliance-guest-home.tsx          the table
 *   components/compliance/compliance-guest-cell.tsx          the name cell
 *   components/compliance/compliance-guest-actions-cell.tsx  Onboard and Delete
 *
 * A compliance guest is an outside auditor given a login that can see the
 * Compliance module and nothing else.
 *
 * THIS SCREEN IS GATED TWICE FOR A PCHO
 *   `CRM_COMPLIANCE_HOME` EDIT is only half of it. For a PCHO the page also
 *   reads its OWN user record and requires `isCompliancePartner === true`:
 *
 *     hasRoleAccess && isCompliancePartner  →  the list
 *     hasRoleAccess && !isCompliancePartner →  Access Denied, no redirect
 *     !hasRoleAccess                        →  redirected away
 *
 *   A home that has not bought the compliance-partner add-on therefore sees the
 *   Access Denied card even though its role grants the feature. That flag
 *   defaults to `false` when absent, so a spec that forgets to set it gets the
 *   restricted card and every list assertion fails for the wrong reason.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const GUESTS = "/crm/complianceguest";

const GUEST_ID = "33333333-3333-4333-8333-333333333333";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const guest = (overrides: Record<string, any> = {}) => ({
  userId: GUEST_ID,
  name: "Gavin Guest",
  email: "gavin.guest@auditors.com",
  mobile: "5553330003",
  role: "ComplianceGuest",
  homeId: TEST_HOME_ID,
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  heading: () => cy.contains("Compliance Guests"),
  addNew: () => cy.contains("button", "Add New"),
  row: (text: string) => cy.contains(text).closest('div[class*="border-b"]'),
};

// ── Setup ────────────────────────────────────────────────────────────────────

type VisitOpts = {
  role?: any;
  guests?: any[];
  /** `isCompliancePartner` on the signed-in PCHO's own record. */
  compliancePartner?: boolean;
  home?: any;
};

const visitGuests = (opts: VisitOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());

  // The page reads its own user record to find `isCompliancePartner`.
  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: {
      userId: TEST_USER_ID,
      name: "Test User",
      role: "PCHO",
      homeId: TEST_HOME_ID,
      isCompliancePartner: opts.compliancePartner ?? true,
    },
  }).as("getPcho");

  cy.intercept("GET", "**/v1/users*", {
    statusCode: 200,
    body: { users: opts.guests ?? [] },
  }).as("getGuests");

  cy.visit(GUESTS);
};

const stubOnboard = (statusCode = 200, body: any = {}) => {
  cy.intercept("POST", "**/signup", { statusCode, body }).as("signup");
};

const stubDelete = (statusCode = 200, body: any = {}) => {
  cy.intercept("DELETE", "**/v1/user/**", { statusCode, body }).as("deleteGuest");
};

// ═══════════════════════════════════════════════════════════════════════════

describe("CRM — Compliance Guests", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The queries", () => {
    it("asks for the home's compliance guests", () => {
      visitGuests();
      cy.wait("@getGuests");
      cy.assertQuery("@getGuests", { userType: "ComplianceGuest" });
    });

    it("scopes the query to the signed-in user's home", () => {
      visitGuests();
      cy.wait("@getGuests");
      cy.assertQuery("@getGuests", { homeId: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      visitGuests();
      cy.wait("@getGuests");
      cy.assertAuthorized("@getGuests");
    });

    it("reads the signed-in PCHO's own record for the partner flag", () => {
      visitGuests();
      cy.wait("@getPcho");
      cy.assertAuthorized("@getPcho");
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The screen", () => {
    beforeEach(() => {
      visitGuests({ guests: [guest()] });
      cy.wait("@getGuests");
    });

    it("renders the page heading", () => {
      sel.heading().should("be.visible");
    });

    it("counts the guests", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("offers an Add New button", () => {
      sel.addNew().should("be.visible");
    });

    it("renders the three named columns", () => {
      ["Name", "Email", "Phone"].forEach((header) => {
        cy.contains(header).should("be.visible");
      });
    });
  });

  // ── The list ───────────────────────────────────────────────────────────────

  describe("The list", () => {
    it("lists a guest", () => {
      visitGuests({ guests: [guest()] });
      cy.contains("Gavin Guest").should("be.visible");
    });

    it("shows the email", () => {
      visitGuests({ guests: [guest()] });
      sel.row("Gavin Guest").should("contain.text", "gavin.guest@auditors.com");
    });

    it("shows the phone number", () => {
      visitGuests({ guests: [guest()] });
      sel.row("Gavin Guest").should("contain.text", "5553330003");
    });

    it("shows a dash for a missing email", () => {
      visitGuests({ guests: [guest({ email: undefined })] });
      sel.row("Gavin Guest").should("contain.text", "-");
    });

    it("shows a dash for a missing phone number", () => {
      visitGuests({ guests: [guest({ mobile: undefined })] });
      sel.row("Gavin Guest").should("contain.text", "-");
    });

    it("truncates a long email at 38 characters", () => {
      const long = "g".repeat(40) + "@auditors.com";
      visitGuests({ guests: [guest({ email: long })] });
      sel.row("Gavin Guest").should("contain.text", long.substring(0, 38) + "...");
    });

    it("truncates a long name at 15 characters", () => {
      visitGuests({ guests: [guest({ name: "Gavin Gregory Guestworth" })] });
      cy.contains("Gavin Gregory G...").should("be.visible");
    });

    it("keeps the full name on a title attribute", () => {
      visitGuests({ guests: [guest({ name: "Gavin Gregory Guestworth" })] });
      cy.get('[title="Gavin Gregory Guestworth"]').should("exist");
    });

    it("lists several guests", () => {
      visitGuests({
        guests: [
          guest({ userId: "a", name: "Guest One" }),
          guest({ userId: "b", name: "Guest Two" }),
        ],
      });
      cy.contains("Guest One").should("be.visible");
      cy.contains("Guest Two").should("be.visible");
    });

    it("counts several guests", () => {
      visitGuests({
        guests: [
          guest({ userId: "a", name: "Guest One" }),
          guest({ userId: "b", name: "Guest Two" }),
        ],
      });
      cy.contains("2 Team members").should("be.visible");
    });

    it("says so when none have been added", () => {
      visitGuests({ guests: [] });
      cy.contains("No Compliance Guests added yet.").should("be.visible");
    });

    it("still offers Add New with an empty list", () => {
      visitGuests({ guests: [] });
      sel.addNew().should("be.visible");
    });
  });

  // ── The row menu ───────────────────────────────────────────────────────────

  describe("The row menu", () => {
    beforeEach(() => {
      visitGuests({ guests: [guest()] });
      cy.openRowMenu("Gavin Guest");
    });

    it("offers Onboard", () => {
      cy.contains("Onboard").should("be.visible");
    });

    it("offers Delete", () => {
      cy.contains("Delete").should("be.visible");
    });

    it("offers nothing else", () => {
      cy.contains("Move to Clinical").should("not.exist");
      cy.contains("Initiate e-sign").should("not.exist");
    });
  });

  // ── Onboarding ─────────────────────────────────────────────────────────────

  describe("Onboarding a guest", () => {
    const openOnboard = (guests = [guest()]) => {
      visitGuests({ guests });
      stubOnboard();
      cy.openRowMenu(guests[0].name);
      cy.contains("Onboard").click();
    };

    it("asks for confirmation first", () => {
      openOnboard();
      cy.contains("Onboard Compliance Guest").should("be.visible");
    });

    it("explains that an email will be sent", () => {
      openOnboard();
      cy.contains("An email will be sent to the Compliance Guest").should("be.visible");
    });

    it("sends nothing until Confirm is pressed", () => {
      openOnboard();
      cy.assertNoRequest("@signup");
    });

    it("POSTs to /signup on Confirm", () => {
      openOnboard();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.method").should("eq", "POST");
    });

    it("sends the guest's email", () => {
      openOnboard();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.body.email").should("eq", "gavin.guest@auditors.com");
    });

    it("sends the guest's role", () => {
      openOnboard();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.body.role").should("eq", "ComplianceGuest");
    });

    it("confirms with a popover", () => {
      openOnboard();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Mail Sent!");
    });

    it("reads an already-registered guest as success rather than failure", () => {
      openOnboard();
      cy.intercept("POST", "**/signup", {
        statusCode: 400,
        body: { error: { name: "UsernameExistsException" } },
      }).as("signup");
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Compliance Guest registered!");
    });

    it("reports any other server error", () => {
      openOnboard();
      cy.intercept("POST", "**/signup", {
        statusCode: 500,
        body: { message: "Mail service unavailable" },
      }).as("signup");
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Mail service unavailable");
    });

    it("refuses a guest with no email, without calling the API", () => {
      openOnboard([guest({ email: undefined })]);
      cy.contains("button", "Confirm").click();
      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("sends nothing on Cancel", () => {
      openOnboard();
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@signup");
    });
  });

  // ── Deleting ───────────────────────────────────────────────────────────────

  describe("Deleting a guest", () => {
    const openDelete = () => {
      visitGuests({ guests: [guest()] });
      stubDelete();
      cy.openRowMenu("Gavin Guest");
      cy.contains("Delete").click();
    };

    it("asks for confirmation first", () => {
      openDelete();
      cy.contains("Delete Compliance Guest").should("be.visible");
    });

    it("warns that it is permanent", () => {
      openDelete();
      cy.contains("permanently delete this Compliance Guest").should("be.visible");
    });

    it("sends nothing until Confirm is pressed", () => {
      openDelete();
      cy.assertNoRequest("@deleteGuest");
    });

    it("sends nothing on Cancel", () => {
      openDelete();
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@deleteGuest");
    });

    it("DELETEs the guest's own record", () => {
      openDelete();
      cy.contains("button", "Confirm").click();
      cy.wait("@deleteGuest").its("request.url").should("include", `/v1/user/${GUEST_ID}`);
    });

    it("uses the DELETE method", () => {
      openDelete();
      cy.contains("button", "Confirm").click();
      cy.wait("@deleteGuest").its("request.method").should("eq", "DELETE");
    });

    it("confirms with a popover", () => {
      openDelete();
      cy.contains("button", "Confirm").click();
      cy.wait("@deleteGuest");
      cy.assertPopover("Compliance Guest deleted successfully!");
    });

    it("reports a server error", () => {
      openDelete();
      cy.intercept("DELETE", "**/v1/user/**", {
        statusCode: 500,
        body: { error: "Guest has open audits" },
      }).as("deleteGuest");
      cy.contains("button", "Confirm").click();
      cy.wait("@deleteGuest");
      cy.assertPopover("Guest has open audits");
    });

    it("does not onboard when Delete was the action chosen", () => {
      visitGuests({ guests: [guest()] });
      stubDelete();
      stubOnboard();
      cy.openRowMenu("Gavin Guest");
      cy.contains("Delete").click();
      cy.contains("button", "Confirm").click();
      cy.wait("@deleteGuest");
      cy.assertNoRequest("@signup");
    });
  });

  // ── The compliance-partner gate ────────────────────────────────────────────

  describe("The compliance-partner flag", () => {
    it("shows the list to a PCHO that is a compliance partner", () => {
      visitGuests({ compliancePartner: true, guests: [guest()] });
      sel.heading().should("be.visible");
    });

    it("shows Access Denied to a PCHO that is not", () => {
      visitGuests({ compliancePartner: false, guests: [guest()] });
      cy.assertRestricted();
    });

    it("does not redirect that PCHO away — the role still grants the route", () => {
      visitGuests({ compliancePartner: false });
      cy.location("pathname", { timeout: 10000 }).should("eq", GUESTS);
    });

    it("hides the list entirely when the flag is off", () => {
      visitGuests({ compliancePartner: false, guests: [guest()] });
      cy.contains("Gavin Guest").should("not.exist");
    });

    it("treats a missing flag as not a partner", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: { userId: TEST_USER_ID, name: "Test User", role: "PCHO", homeId: TEST_HOME_ID },
      }).as("getPcho");
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [guest()] },
      }).as("getGuests");
      cy.visit(GUESTS);

      cy.assertRestricted();
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────

  /**
   * The redirect in this page is unreachable.
   *
   * Its effect opens with `if (finalRole !== userRoles.PCHO) { …; return; }`,
   * so a non-PCHO never reaches the `hasAccess` check or the `router.push`
   * below it. `roleAccess` stays at its initial `false` and the Access Denied
   * card renders instead — on the URL, not away from it. Every other screen in
   * the app redirects; this one does not.
   */
  describe("Role gating", () => {
    it("[as-built] shows a PCG Access Denied rather than redirecting", { tags: [Tags.PCG] }, () => {
      visitGuests({ role: "PCG" });
      cy.assertRestricted();
    });

    it("[as-built] leaves that PCG on the route", { tags: [Tags.PCG] }, () => {
      visitGuests({ role: "PCG" });
      cy.location("pathname", { timeout: 10000 }).should("eq", GUESTS);
    });

    it("[as-built] shows a Nurse Access Denied", { tags: [Tags.NURSE] }, () => {
      visitGuests({ role: "Nurse" });
      cy.assertRestricted();
    });

    it("[as-built] shows a Lead Access Denied", () => {
      visitGuests({ role: "Lead" });
      cy.assertRestricted();
    });

    it("never lists a guest to a role without the feature", { tags: [Tags.PCG] }, () => {
      visitGuests({ role: "PCG", guests: [guest()] });
      cy.contains("Gavin Guest").should("not.exist");
    });
  });
});
