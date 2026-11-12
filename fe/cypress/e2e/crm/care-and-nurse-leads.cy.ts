/// <reference types="cypress" />

/**
 * CRM — Care Leads and Nurse Leads
 *
 * The two staff boards under CRM. They are near-copies of each other:
 *
 *   /crm/pcg    Care Leads   components/pcg/pcg-home-page.tsx + pcg-action-cell.tsx
 *   /crm/nurse  Nurse Leads  components/nurse/nurse-home-page.tsx + nurse-action-cell.tsx
 *
 * Both offer Add New and a per-row ⋮ menu. Unlike Senior Leads, Move to Clinical
 * here is a *single* PUT that re-roles the record — there is no clinical write —
 * and it routes to the matching clinical board rather than /clinical.
 *
 * Note the two boards' menus are NOT identical: Nurse Leads has no Initiate
 * e-sign, because that entry is commented out in nurse-action-cell.tsx. That
 * asymmetry is pinned below rather than papered over.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserRow, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const PCG_PATH = "/crm/pcg";
const NURSE_PATH = "/crm/nurse";

const CARE_LEAD = "Priya Patel";
const NURSE_LEAD = "Sam Okonkwo";

const buildCareLead = (overrides: Record<string, any> = {}) =>
  buildUserRow({
    userId: "pppppppp-0001-4ppp-8ppp-pppppppppppp",
    name: CARE_LEAD,
    firstName: "Priya",
    lastName: "Patel",
    email: "priya@assistly.com",
    mobile: "5550000011",
    role: "PCGLead",
    milestone: [],
    ...overrides,
  });

const buildNurseLead = (overrides: Record<string, any> = {}) =>
  buildUserRow({
    userId: "nnnnnnnn-0001-4nnn-8nnn-nnnnnnnnnnnn",
    name: NURSE_LEAD,
    firstName: "Sam",
    lastName: "Okonkwo",
    email: "sam@assistly.com",
    mobile: "5550000022",
    role: "NurseLead",
    milestone: [],
    ...overrides,
  });

const sel = {
  addNew: () => cy.contains("button", "Add New"),
  save: () => cy.contains("button", "Save"),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
};

const visitBoard = (
  path: string,
  users: any[],
  opts: { home?: ReturnType<typeof buildHome>; role?: any } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers(users);
  cy.visit(path);
  cy.wait("@getUsers");
};

/** Open a row's menu and start an action, landing on its confirmation dialog. */
const startAction = (path: string, users: any[], row: string, label: string) => {
  visitBoard(path, users);
  cy.openRowMenu(row);
  sel.item(label).click();
};

/** The Add form is shared shape across both boards. */
const fillStaffForm = ({
  firstName = "Alex",
  lastName = "Rivera",
  email = "alex.rivera@assistly.com",
  mobile = "5559990001",
} = {}) => {
  cy.typeField("firstName", firstName);
  cy.typeField("lastName", lastName);
  cy.typeField("email", email);
  cy.typeField("mobile", mobile);
};

describe("CRM — Care Leads and Nurse Leads", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Care Leads — the board
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads board", () => {
    beforeEach(() => visitBoard(PCG_PATH, [buildCareLead()]));

    it("names the board", () => {
      cy.contains("Care Leads").should("be.visible");
    });

    it("counts the members the home has", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("renders every column header", () => {
      ["Name", "Email", "Phone", "Contract Status"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("renders the member's details", () => {
      cy.contains(CARE_LEAD).should("be.visible");
      cy.contains("5550000011").should("be.visible");
    });

    it("offers Add New", () => {
      sel.addNew().should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Care Leads — the row menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads row menu", () => {
    it("offers all four actions", () => {
      visitBoard(PCG_PATH, [buildCareLead()]);
      cy.openRowMenu(CARE_LEAD);
      ["Onboard", "Move to Clinical", "Initiate e-sign", "Delete"].forEach((label) =>
        sel.item(label).should("be.visible")
      );
    });

    it("greys out Onboard for a member who has already signed in", () => {
      visitBoard(PCG_PATH, [
        buildCareLead({ lastLoginTimestamp: "2026-02-01T10:00:00.000Z" }),
      ]);
      cy.openRowMenu(CARE_LEAD);
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("hides Move to Clinical when the home has no Clinical module", () => {
      visitBoard(PCG_PATH, [buildCareLead()], {
        home: buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT"] }),
      });
      cy.openRowMenu(CARE_LEAD);
      sel.item("Move to Clinical").should("not.exist");
      sel.item("Delete").should("be.visible");
    });

    it("hides Move to Clinical for a Care Team member rather than a Care Lead", { tags: [Tags.PCG] }, () => {
      // pcg-action-cell.tsx gates the entry on `role === PCGLead`.
      visitBoard(PCG_PATH, [buildCareLead({ role: "PCG" })]);
      cy.openRowMenu(CARE_LEAD);
      sel.item("Move to Clinical").should("not.exist");
    });

    it("bounces a role without CRM_PCG_HOME off the board", () => {
      // The menu is gated on CRM_ACTIONS, but no role in utils/roles.ts can
      // reach this board without it — PCHO and HomeAdmin are the only two with
      // CRM_PCG_HOME and both hold CRM_ACTIONS. The reachable boundary is the
      // page itself, which redirects anyone else away.
      cy.clearAuthSession();
      cy.setAuthSession("SalesRepresentative");
      cy.stubHome();
      cy.stubUsers([buildCareLead()]);
      cy.visit(PCG_PATH);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", PCG_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Care Leads — Onboard
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads — Onboard", () => {
    it("asks for confirmation first", () => {
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Onboard");
      cy.contains("Are you sure you want to onboard this").should("be.visible");
    });

    it("invites the member to register", () => {
      cy.stubPost("/signup", "signup", 201, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Onboard");
      sel.confirm().click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq("priya@assistly.com");
        expect(request.body.role).to.eq("PCGLead");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses a member with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction(PCG_PATH, [buildCareLead({ email: "" })], CARE_LEAD, "Onboard");
      sel.confirm().click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("reports a rejected signup", () => {
      cy.stubPost("/signup", "signup", 400, { error: "User already exists" });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Onboard");
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("User already exists");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Onboard");
      sel.cancel().click();
      cy.assertNoRequest("@signup");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Care Leads — Move to Clinical
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads — Move to Clinical", () => {
    it("asks for confirmation first", () => {
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Move to Clinical");
      cy.contains("Are you sure you want to move").should("be.visible");
    });

    it("re-roles the record to Care Team and stamps the contract", { tags: [Tags.PCG] }, () => {
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.role).to.eq("PCG");
        expect(request.body.contractCompletedOn, "contractCompletedOn").to.match(
          /^\d{4}-\d{2}-\d{2}$/
        );
      });
      cy.assertPopover("Care Lead moved to clinical!");
    });

    it("writes no clinical record, unlike a Senior Lead", () => {
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.assertNoRequest("@updateClinical");
    });

    it("lands on the clinical care board", () => {
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical/pcg");
    });

    it("reports a rejected move and stays put", () => {
      cy.stubPut("/v1/user", "updateCrm", 500, { error: "Nope" });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      // The handler ignores the API's message and always says this.
      cy.assertPopover("Not able to complete contract! try again later!");
      cy.location("pathname").should("eq", PCG_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Care Leads — Initiate e-sign
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads — Initiate e-sign", () => {
    it("asks for confirmation first", () => {
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Initiate e-sign");
      cy.contains("Are you sure you want to initiate e-sign").should("be.visible");
    });

    it("names the home, the sender and the recipient", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 201, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.senderUserId).to.eq(TEST_USER_ID);
        expect(request.body.recipientUserId).to.eq(buildCareLead().userId);
      });
      cy.assertPopover("E-sign initiated. Check dashboard for details.");
    });

    it("translates a missing file into an instruction to edit the documents", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 400, { error: "File not found" });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("Please edit all documents before starting e-sign.");
    });

    it("translates an already-signed contract", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 400, {
        error: "Contract is already sent and signed",
      });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("This contract has already been signed.");
    });

    it("falls back to a generic message for an unrecognised error", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 500, { error: "boom" });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("Error in initiating e-sign. Please try again.");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Care Leads — Delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads — Delete", () => {
    it("asks for confirmation first", () => {
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Delete");
      cy.contains("permanently delete this Care Lead").should("be.visible");
    });

    it("deletes the member by id", () => {
      cy.stubDelete("/v1/user", "deleteCareLead", 200, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Delete");
      sel.confirm().click();

      cy.wait("@deleteCareLead").then(({ request }) => {
        expect(request.url).to.contain(buildCareLead().userId);
      });
      cy.assertPopover("deleted successfully!");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteCareLead");
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Delete");
      sel.cancel().click();
      cy.assertNoRequest("@deleteCareLead");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteCareLead", 500, { error: "Delete failed" });
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Delete");
      sel.confirm().click();

      cy.wait("@deleteCareLead");
      cy.assertPopover("Delete failed");
    });

    it("calls a Care Team member by their own name in the dialog", { tags: [Tags.PCG] }, () => {
      startAction(PCG_PATH, [buildCareLead({ role: "PCG" })], CARE_LEAD, "Delete");
      cy.contains("delete this Care Team").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Care Leads — Add New
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Leads — Add New", () => {
    const openAdd = () => {
      sel.addNew().click();
      cy.contains("Add Care Lead").should("be.visible");
      cy.settleForm();
    };

    beforeEach(() => {
      visitBoard(PCG_PATH, [buildCareLead()]);
      openAdd();
    });

    it("renders every field", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        cy.get(`input[name="${name}"]`).should("exist")
      );
    });

    it("marks the required fields", () => {
      ["First Name *", "Last Name *", "Email *", "Phone Number *"].forEach((label) =>
        cy.contains(label).should("be.visible")
      );
    });

    it("refuses an empty form", () => {
      cy.intercept("POST", "**/v1/user").as("createCareLead");
      sel.save().click();
      cy.assertNoRequest("@createCareLead");
    });

    it("refuses a malformed email", () => {
      fillStaffForm({ email: "not-an-email" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");
    });

    it("refuses a phone number that is not ten digits", () => {
      fillStaffForm({ mobile: "5551" });
      sel.save().click();
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("refuses a name containing punctuation", () => {
      fillStaffForm({ firstName: "Alex@" });
      sel.save().click();
      cy.contains("First Name accepts only alphabets and numbers").should("be.visible");
    });

    it("creates the care lead", () => {
      cy.stubPost("/v1/user", "createCareLead", 201, {});
      fillStaffForm();
      sel.save().click();

      cy.wait("@createCareLead").then(({ request }) => {
        expect(request.body.role).to.eq("PCGLead");
        expect(request.body.email).to.eq("alex.rivera@assistly.com");
      });
      cy.assertPopover("Care Lead Added Successfully");
    });

    it("reports a rejected create", () => {
      cy.stubPost("/v1/user", "createCareLead", 400, { error: "Email already exists" });
      fillStaffForm();
      sel.save().click();

      cy.wait("@createCareLead");
      cy.assertPopover("Email already exists");
    });

    it("clears the error once the field is corrected", () => {
      fillStaffForm({ email: "bad" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");

      cy.typeField("email", "alex.rivera@assistly.com");
      cy.contains("Invalid email").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Nurse Leads — the board
  // ──────────────────────────────────────────────────────────────────────────

  describe("Nurse Leads board", () => {
    beforeEach(() => visitBoard(NURSE_PATH, [buildNurseLead()]));

    it("names the board", () => {
      cy.contains("Nurse Leads").should("be.visible");
    });

    it("counts the members the home has", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("renders every column header", () => {
      ["Name", "Email", "Phone", "Contract Status"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("renders the member's details", () => {
      cy.contains(NURSE_LEAD).should("be.visible");
      cy.contains("5550000022").should("be.visible");
    });

    it("offers Add New", () => {
      sel.addNew().should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Nurse Leads — the row menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("Nurse Leads row menu", () => {
    it("offers Onboard, Move to Clinical and Delete", () => {
      visitBoard(NURSE_PATH, [buildNurseLead()]);
      cy.openRowMenu(NURSE_LEAD);
      ["Onboard", "Move to Clinical", "Delete"].forEach((label) =>
        sel.item(label).should("be.visible")
      );
    });

    it("does not offer Initiate e-sign", () => {
      // The entry exists in nurse-action-cell.tsx but is commented out, so the
      // Nurse board's menu is one action shorter than the Care Leads board's.
      // Confirmed intended — this is not a gap to be filled in, so there is
      // deliberately no matching entry in known-defects.cy.ts. If e-sign is ever
      // wanted here, uncomment the block and this test is what will flag it.
      visitBoard(NURSE_PATH, [buildNurseLead()]);
      cy.openRowMenu(NURSE_LEAD);
      sel.item("Initiate e-sign").should("not.exist");
    });

    it("does not offer Assign Seniors outside the clinical module", () => {
      // Gated on `router.pathname.startsWith("/clinical")`.
      visitBoard(NURSE_PATH, [buildNurseLead()]);
      cy.openRowMenu(NURSE_LEAD);
      sel.item("Assign Seniors").should("not.exist");
    });

    it("greys out Onboard for a member who has already signed in", () => {
      visitBoard(NURSE_PATH, [
        buildNurseLead({ lastLoginTimestamp: "2026-02-01T10:00:00.000Z" }),
      ]);
      cy.openRowMenu(NURSE_LEAD);
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("hides Move to Clinical when the home has no Clinical module", () => {
      visitBoard(NURSE_PATH, [buildNurseLead()], {
        home: buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT"] }),
      });
      cy.openRowMenu(NURSE_LEAD);
      sel.item("Move to Clinical").should("not.exist");
    });

    it("bounces a role without CRM_NURSE_HOME off the board", () => {
      cy.clearAuthSession();
      cy.setAuthSession("SalesRepresentative");
      cy.stubHome();
      cy.stubUsers([buildNurseLead()]);
      cy.visit(NURSE_PATH);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", NURSE_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Nurse Leads — actions
  // ──────────────────────────────────────────────────────────────────────────

  describe("Nurse Leads — Onboard", () => {
    it("invites the member to register", () => {
      cy.stubPost("/signup", "signup", 201, {});
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Onboard");
      sel.confirm().click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq("sam@assistly.com");
        expect(request.body.role).to.eq("NurseLead");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses a member with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction(NURSE_PATH, [buildNurseLead({ email: "" })], NURSE_LEAD, "Onboard");
      sel.confirm().click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Onboard");
      sel.cancel().click();
      cy.assertNoRequest("@signup");
    });
  });

  describe("Nurse Leads — Move to Clinical", () => {
    it("asks for confirmation first", () => {
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Move to Clinical");
      cy.contains("Are you sure you want to move Nurse Lead to clinical?").should(
        "be.visible"
      );
    });

    it("re-roles the record to Nurse and stamps the contract", { tags: [Tags.NURSE] }, () => {
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.role).to.eq("Nurse");
        expect(request.body.contractCompletedOn, "contractCompletedOn").to.match(
          /^\d{4}-\d{2}-\d{2}$/
        );
      });
      cy.assertPopover("Nurse Lead moved to clinical!");
    });

    it("lands on the clinical nurse board", () => {
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical/nurse");
    });

    it("reports a rejected move and stays put", () => {
      cy.stubPut("/v1/user", "updateCrm", 500, { error: "Nope" });
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.assertPopover("Not able to complete contract! try again later!");
      cy.location("pathname").should("eq", NURSE_PATH);
    });
  });

  describe("Nurse Leads — Delete", () => {
    it("asks for confirmation first", () => {
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Delete");
      cy.contains("permanently delete this Nurse Lead").should("be.visible");
    });

    it("deletes the member by id", () => {
      cy.stubDelete("/v1/user", "deleteNurseLead", 200, {});
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Delete");
      sel.confirm().click();

      cy.wait("@deleteNurseLead").then(({ request }) => {
        expect(request.url).to.contain(buildNurseLead().userId);
      });
      cy.assertPopover("Nurse Lead deleted successfully!");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteNurseLead");
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Delete");
      sel.cancel().click();
      cy.assertNoRequest("@deleteNurseLead");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteNurseLead", 500, { error: "Delete failed" });
      startAction(NURSE_PATH, [buildNurseLead()], NURSE_LEAD, "Delete");
      sel.confirm().click();

      cy.wait("@deleteNurseLead");
      cy.assertPopover("Delete failed");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Nurse Leads — Add New
  // ──────────────────────────────────────────────────────────────────────────

  describe("Nurse Leads — Add New", () => {
    const openAdd = () => {
      sel.addNew().click();
      cy.contains("Add Nurse Lead").should("be.visible");
      cy.settleForm();
    };

    beforeEach(() => {
      visitBoard(NURSE_PATH, [buildNurseLead()]);
      openAdd();
    });

    it("renders every field", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        cy.get(`input[name="${name}"]`).should("exist")
      );
    });

    it("refuses an empty form", () => {
      cy.intercept("POST", "**/v1/user").as("createNurseLead");
      sel.save().click();
      cy.assertNoRequest("@createNurseLead");
    });

    it("refuses a malformed email", () => {
      fillStaffForm({ email: "not-an-email" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");
    });

    it("refuses a phone number that is not ten digits", () => {
      fillStaffForm({ mobile: "5551" });
      sel.save().click();
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("creates the nurse lead", () => {
      cy.stubPost("/v1/user", "createNurseLead", 201, {});
      fillStaffForm();
      sel.save().click();

      cy.wait("@createNurseLead").then(({ request }) => {
        expect(request.body.role).to.eq("NurseLead");
        expect(request.body.email).to.eq("alex.rivera@assistly.com");
      });
      cy.assertPopover("Nurse Lead Added Successfully");
    });

    it("reports a rejected create", () => {
      cy.stubPost("/v1/user", "createNurseLead", 400, { error: "Email already exists" });
      fillStaffForm();
      sel.save().click();

      cy.wait("@createNurseLead");
      cy.assertPopover("Email already exists");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a care lead is added, then appears on the board", () => {
      visitBoard(PCG_PATH, []);
      cy.stubPost("/v1/user", "createCareLead", 201, {});

      sel.addNew().click();
      cy.settleForm();
      fillStaffForm();

      cy.stubUsers([buildCareLead({ name: "Alex Rivera" })]);
      sel.save().click();

      cy.wait("@createCareLead");
      cy.assertPopover("Care Lead Added Successfully");
      cy.contains("Alex Rivera", { timeout: 10000 }).should("be.visible");
    });

    it("E2E — a care lead is onboarded and then moved to clinical", { tags: [Tags.PCG] }, () => {
      cy.stubPost("/signup", "signup", 201, {});
      startAction(PCG_PATH, [buildCareLead()], CARE_LEAD, "Onboard");
      sel.confirm().click();
      cy.wait("@signup");
      cy.assertPopover("Email sent successfully.");
      cy.dismissPopover();

      cy.stubPut("/v1/user", "updateCrm", 200, {});
      cy.openRowMenu(CARE_LEAD);
      sel.item("Move to Clinical").click();
      sel.confirm().click();

      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.role).to.eq("PCG");
      });
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical/pcg");
    });

    it("E2E — a nurse lead's validation error is corrected and the record is created", () => {
      visitBoard(NURSE_PATH, [buildNurseLead()]);
      sel.addNew().click();
      cy.settleForm();

      fillStaffForm({ email: "bademail" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");

      cy.stubPost("/v1/user", "createNurseLead", 201, {});
      cy.typeField("email", "alex.rivera@assistly.com");
      sel.save().click();

      cy.wait("@createNurseLead");
      cy.assertPopover("Nurse Lead Added Successfully");
    });
  });
});
