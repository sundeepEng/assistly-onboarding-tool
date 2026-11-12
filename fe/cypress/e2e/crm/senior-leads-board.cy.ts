/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * CRM — Senior Leads board
 *
 * Covers what a signed-in user actually does on the board itself: land on it,
 * read the table, add a lead, move it through the pipeline, and hit the access
 * boundaries.
 *
 * Neighbouring specs, all named senior-leads-*: the row ⋮ menu is in
 * -row-actions, the milestone icons in -home-tour and -onboarding, and the
 * campaign wizard in -bulk-campaign. API-level contracts (payloads, headers,
 * status handling) live in api-contracts.cy.ts.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildUserRow,
  TEST_HOME_ID,
  TEST_LEAD_ID,
} from "../../framework/module-commands";

const CRM_PATH = "/crm";

const sel = {
  addNewButton: () => cy.contains("button", "Add New"),
  saveButton: () => cy.contains("button", "Save"),
  bulkCampaignButton: () => cy.contains("button", "Send Bulk Campaign"),
  pageHeading: () => cy.contains("Senior Leads"),
  fieldError: (name: string) =>
    cy
      .get(`input[name="${name}"]`)
      .closest("div.self-stretch")
      .find('div[class*="text-[red]"]'),
};

const openAddLead = () => {
  sel.addNewButton().click();
  cy.get('input[name="firstName"]').should("be.visible");
  // The form is rebuilt as each lead-owner query lands; wait it out before
  // typing, or the field is detached mid-command.
  cy.settleForm();
};

const fillLead = ({
  firstName = "Nora",
  middleName = "",
  lastName = "Bennett",
  email = "nora.bennett@assistly.com",
  mobile = "5557654321",
} = {}) => {
  cy.typeField("firstName", firstName);
  if (middleName) cy.typeField("middleName", middleName);
  cy.typeField("lastName", lastName);
  cy.typeField("email", email);
  cy.typeField("mobile", mobile);
};

describe("CRM workflows", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // -------------------------------------------------------------------------
  // 1. Senior Leads board
  // -------------------------------------------------------------------------

  describe("Senior Leads board", () => {
    beforeEach(() => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([
        buildUserRow({
          name: "Jane Doe",
          createdAt: "2026-01-15T10:00:00.000Z",
          milestone: ["initial contact"],
        }),
        buildUserRow({
          userId: "lead-2",
          name: "Arthur Bean",
          createdAt: "2026-02-01T10:00:00.000Z",
          milestone: ["initial contact", "tour"],
        }),
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
    });

    it("shows the Senior Leads heading", () => {
      sel.pageHeading().should("be.visible");
    });

    it("reports how many leads the home has", () => {
      cy.contains("2 Team members").should("be.visible");
    });

    it("leaves lost leads out of the count", () => {
      cy.stubUsers([
        buildUserRow({ name: "Jane Doe", milestone: ["initial contact"] }),
        buildUserRow({ userId: "lead-2", name: "Arthur Bean", milestone: ["tour"] }),
        buildUserRow({
          userId: "lead-3",
          name: "Gone Away",
          milestone: ["initial contact", "lost"],
        }),
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      cy.contains("2 Team members").should("be.visible");
    });

    it("renders the table's column headers", () => {
      ["Name", "Added", "Milestones", "Contacted"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("renders each lead's name", () => {
      cy.contains("Jane Doe").should("be.visible");
      cy.contains("Arthur Bean").should("be.visible");
    });

    it("formats the 'Added' date as MM/DD/YYYY", () => {
      cy.contains("01/15/2026").should("be.visible");
      cy.contains("02/01/2026").should("be.visible");
    });

    it("renders the 'Contacted' column as a relative age", () => {
      cy.contains(/\d+ days? ago/).should("be.visible");
    });

    it("offers the Add New action to a PCHO", () => {
      sel.addNewButton().should("be.visible");
    });

    it("disables Send Bulk Campaign until leads are selected", () => {
      sel.bulkCampaignButton().should("be.disabled");
    });

    it("enables Send Bulk Campaign once a lead is selected", () => {
      cy.get('input[type="checkbox"]').eq(1).click({ force: true });
      sel.bulkCampaignButton().should("not.be.disabled");
    });

    it("offers the Contacts / Campaign History toggle to a PCHO", () => {
      // Rendered only for roles holding SMART_CRM.
      cy.contains("Contacts").should("be.visible");
      cy.contains("Campaign History").should("be.visible");
    });

    it("switches to Campaign History", () => {
      cy.contains("Campaign History").click();
      // No campaigns are stubbed for this home, so BaseTable shows its empty
      // state rather than the column headers.
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("keeps Add New available on Campaign History", () => {
      // The heading, milestone filter and Add New now live in the page header
      // (pages/crm/index.tsx), outside the toggle — so switching views no
      // longer takes the action away.
      cy.contains("Campaign History").click();
      cy.contains("Nothing added yet.").should("be.visible");
      sel.addNewButton().should("be.visible");
    });

    it("offers the milestone filter", () => {
      cy.get('select[name="milestoneFilter"]').should("be.visible");
      ["All", "Initial Contact", "Home Tour", "Onboarding", "Contract"].forEach(
        (option) =>
          cy.get('select[name="milestoneFilter"]').contains(option).should("exist")
      );
    });

    it("sorts leads at the chosen milestone to the top rather than hiding the rest", () => {
      // components/leads-table.tsx partitions into [matching, non-matching, lost]
      // — the filter reorders and highlights, it does not exclude.
      cy.get('select[name="milestoneFilter"]').select("Home Tour");

      cy.contains("Arthur Bean").should("be.visible"); // has reached 'tour'
      cy.contains("Jane Doe").should("be.visible"); // has not, but still listed

      cy.get('div[class*="border-b"]')
        .contains("Arthur Bean")
        .closest('div[class*="border-b"]')
        .should("have.class", "bg-primary/10");
    });

    it("greys out and sinks lost leads", () => {
      cy.stubUsers([
        buildUserRow({ name: "Jane Doe", milestone: ["initial contact"] }),
        buildUserRow({
          userId: "lead-3",
          name: "Gone Away",
          milestone: ["initial contact", "lost"],
        }),
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      cy.contains("Gone Away")
        .closest('div[class*="border-b"]')
        .should("have.class", "opacity-50");
    });

    it("lists the home's senior campaigns under Campaign History", () => {
      cy.stubHome(
        buildHome({
          campaigns: [
            {
              campaignType: "SENIOR",
              campaignChannel: "EMAIL",
              campaignCreatedByUserId: "user-123",
              campaignMetadata: { subject: "Spring open house" },
              campaignUsers: ["a", "b"],
              createdAt: "2026-02-10T10:00:00.000Z",
            },
          ],
        })
      );
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      cy.contains("Campaign History").click();
      cy.contains("Channel").should("be.visible");
      cy.contains("EMAIL").should("be.visible");
      cy.contains("Spring open house").should("be.visible");
      cy.contains("02/10/2026").should("be.visible");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Add Lead - form behaviour
  // -------------------------------------------------------------------------

  describe("Add Lead form", () => {
    beforeEach(() => {
      cy.visitAs(CRM_PATH);
      cy.wait("@getUsers");
      openAddLead();
    });

    it("renders every lead field", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        cy.get(`input[name="${name}"]`).should("exist")
      );
      sel.saveButton().should("be.visible");
    });

    it("marks first and last name as required", () => {
      cy.contains("First Name *").should("be.visible");
      cy.contains("Last Name *").should("be.visible");
    });

    it("flags both names when an empty form is submitted", () => {
      sel.saveButton().click();
      sel.fieldError("firstName").should("have.text", "First Name is required");
      sel.fieldError("lastName").should("have.text", "Last Name is required");
    });

    it("rejects a name containing punctuation", () => {
      fillLead({ firstName: "Jane@" });
      sel.saveButton().click();
      cy.contains("First Name accepts only alphabets and numbers").should("be.visible");
    });

    it("rejects a malformed email", () => {
      fillLead({ email: "not-an-email" });
      sel.saveButton().click();
      cy.contains("Invalid email").should("be.visible");
    });

    it("rejects a phone number that is not exactly 10 digits", () => {
      fillLead({ mobile: "55512" });
      sel.saveButton().click();
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("rejects a formatted phone number", () => {
      fillLead({ mobile: "555-123-4567" });
      sel.saveButton().click();
      cy.contains("Only numbers are allowed").should("be.visible");
    });

    it("clears the error once the field is corrected", () => {
      fillLead({ email: "bad" });
      sel.saveButton().click();
      cy.contains("Invalid email").should("be.visible");

      cy.typeField("email", "nora.bennett@assistly.com");
      cy.contains("Invalid email").should("not.exist");
    });

    it("accepts a lead with no contact details at a residential home", () => {
      cy.stubPost("/v1/user", "createLead", 201, {});

      cy.typeField("firstName", "Walk");
      cy.typeField("lastName", "In");
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("New Senior Lead added successfully!");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Add Lead - outcomes
  // -------------------------------------------------------------------------

  describe("Add Lead outcomes", () => {
    beforeEach(() => {
      cy.visitAs(CRM_PATH);
      cy.wait("@getUsers");
    });

    it("confirms success and closes the modal", () => {
      cy.stubPost("/v1/user", "createLead", 201, { userId: "new-lead" });

      openAddLead();
      fillLead();
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("New Senior Lead added successfully!");
      cy.get('input[name="firstName"]').should("not.exist");
    });

    it("keeps the modal open and reports the error when the API rejects the lead", () => {
      cy.stubPost("/v1/user", "createLead", 400, { error: "Email already exists" });

      openAddLead();
      fillLead();
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("Email already exists");
      cy.dismissPopover();
      cy.get('input[name="firstName"]').should("have.value", "Nora");
    });

    it("lets the user correct the error and save successfully", () => {
      cy.stubPost("/v1/user", "createLead", 400, { error: "Email already exists" });

      openAddLead();
      fillLead();
      sel.saveButton().click();
      cy.wait("@createLead");
      cy.assertPopover("Email already exists");
      cy.dismissPopover();

      cy.stubPost("/v1/user", "createLead", 201, {});
      cy.typeField("email", "different.address@assistly.com");
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("New Senior Lead added successfully!");
    });

    it("shows the new lead in the list after the refetch", () => {
      cy.stubPost("/v1/user", "createLead", 201, {});

      openAddLead();
      fillLead();

      // Swap the list response so the refetch returns the newly created lead.
      cy.stubUsers([buildUserRow(), buildUserRow({ userId: "new", name: "Nora Bennett" })]);
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.contains("Nora Bennett", { timeout: 10000 }).should("be.visible");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Lead pipeline actions
  // -------------------------------------------------------------------------

  describe("Lead pipeline actions", () => {
    const openRowMenu = () => cy.openRowMenu("Jane Doe");

    beforeEach(() => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([buildUserRow({ name: "Jane Doe" })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
    });

    it("offers the pipeline actions in the row menu", () => {
      openRowMenu();
      ["Onboard", "Move to Clinical", "Initiate e-sign", "Delete"].forEach((action) =>
        cy.contains(action).should("be.visible")
      );
    });

    it("asks for confirmation before onboarding", () => {
      openRowMenu();
      cy.contains(/^Onboard$/).click();
      cy.contains("Are you sure you want to onboard this Senior Lead?").should(
        "be.visible"
      );
    });

    it("asks for confirmation before moving the lead to clinical", () => {
      openRowMenu();
      cy.contains("Move to Clinical").click();
      cy.contains("Are you sure you want to move this Senior Lead to clinical?").should(
        "be.visible"
      );
    });

    it("moves the lead to clinical and navigates there", { tags: [Tags.SENIOR] }, () => {
      // Two PUTs: the clinical record first, then the CRM record with the
      // contract milestone and the Senior role.
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      cy.stubPut("/v1/user", "updateCrm", 200, {});

      openRowMenu();
      cy.contains("Move to Clinical").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@updateClinical");
      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.role).to.eq("Senior");
        expect(request.body.milestone).to.include("contract");
      });
      cy.assertPopover("Senior Lead moved to clincial!");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical");
    });

    it("reports a failure to move the lead and stays on the CRM board", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { error: "Clinical service unavailable" },
      }).as("updateClinical");

      openRowMenu();
      cy.contains("Move to Clinical").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@updateClinical");
      cy.assertPopover("Clinical service unavailable");
      cy.location("pathname").should("eq", CRM_PATH);
    });

    it("initiates e-sign for a lead with an email", () => {
      cy.stubPost("/v1/initiate-esign", "initiateESign", 201, {});

      openRowMenu();
      cy.contains("Initiate e-sign").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@initiateESign").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.recipientUserId).to.eq(TEST_LEAD_ID);
      });
      cy.assertPopover("E-sign initiated. Check dashboard for details.");
    });

    it("refuses to re-send an e-sign for an already signed contract", () => {
      cy.stubUsers([
        buildUserRow({ name: "Signed Lead", onboardingESignEnvelopeStatus: "completed" }),
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.intercept("POST", "**/v1/initiate-esign").as("initiateESign");

      cy.openRowMenu("Signed Lead");
      cy.contains("Initiate e-sign").click();
      cy.contains("button", "Confirm").click();

      cy.assertPopover("This contract has already been signed.");
      cy.assertNoRequest("@initiateESign");
    });

    it("deletes a lead after confirmation", () => {
      cy.stubDelete("/v1/user", "deleteLead", 200, {});

      openRowMenu();
      cy.contains("Delete").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@deleteLead");
      cy.assertPopover("Senior Lead deleted successfully!");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Access control
  // -------------------------------------------------------------------------

  describe("Access control", () => {
    it("sends a Lead to their own record instead of the board", () => {
      // utils/roles.ts: a Lead holds CRM_BIOGRAPHY but not CRM_DASHBOARD.
      cy.setAuthSession("Lead");
      cy.stubHome();
      cy.stubUsers();
      cy.stubUser(buildUserRow({ role: "Lead" }));
      cy.visit(CRM_PATH);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", CRM_PATH);
      cy.location("pathname").should("match", /^\/crm\//);
    });

    it("sends a Nurse to the clinical dashboard", { tags: [Tags.NURSE] }, () => {
      cy.setAuthSession("Nurse");
      cy.stubHome();
      cy.stubUsers();
      cy.visit(CRM_PATH);

      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical");
    });

    it("sends a ComplianceGuest to compliance training", () => {
      cy.setAuthSession("ComplianceGuest");
      cy.stubHome();
      cy.stubUsers();
      cy.visit(CRM_PATH);

      cy.location("pathname", { timeout: 10000 }).should("eq", "/compliance/training");
    });

    it("bounces an unauthenticated visitor off the CRM board", () => {
      cy.stubHome();
      cy.stubUsers();
      cy.visit(CRM_PATH);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", CRM_PATH);
    });

    it("hides the campaign toggle from a role without SMART_CRM", () => {
      cy.setAuthSession("PCGLead");
      cy.stubHome();
      cy.stubUsers();
      cy.visit("/crm/pcg");

      cy.contains("Campaign History").should("not.exist");
    });
  });

  // -------------------------------------------------------------------------
  // 6. End-to-end journeys
  // -------------------------------------------------------------------------

  describe("End-to-end journeys", () => {
    it("E2E - PCHO logs in, lands on the dashboard, opens CRM and adds a lead", () => {
      cy.stubHome();
      cy.stubUsers();
      cy.stubPost("/v1/user", "createLead", 201, {});

      cy.loginAs("PCHO");
      // A non-sales home lands the PCHO straight on the senior leads list.
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");

      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      sel.pageHeading().should("be.visible");

      openAddLead();
      fillLead();
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("New Senior Lead added successfully!");
      cy.location("pathname").should("eq", CRM_PATH);
    });

    it("E2E - validation error is corrected and the lead is then created", () => {
      cy.visitAs(CRM_PATH);
      cy.wait("@getUsers");

      openAddLead();
      fillLead({ email: "bademail" });
      sel.saveButton().click();
      cy.contains("Invalid email").should("be.visible");

      cy.stubPost("/v1/user", "createLead", 201, {});
      cy.typeField("email", "nora.bennett@assistly.com");
      sel.saveButton().click();

      cy.wait("@createLead");
      cy.assertPopover("New Senior Lead added successfully!");
    });

    it("E2E - an In-Home Care home requires a phone number before the lead is accepted", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ homeType: "In Home Care" }));
      cy.stubUsers();
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.intercept("POST", "**/v1/user").as("createLead");

      openAddLead();
      cy.contains("Phone Number *").should("be.visible");
      cy.typeField("firstName", "Nora");
      cy.typeField("lastName", "Bennett");
      sel.saveButton().click();
      cy.assertNoRequest("@createLead");

      cy.stubPost("/v1/user", "createLead", 201, {});
      cy.typeField("mobile", "5557654321");
      sel.saveButton().click();

      cy.wait("@createLead").then(({ request }) => {
        expect(request.body.mobile).to.eq("5557654321");
      });
      cy.assertPopover("New Senior Lead added successfully!");
    });
  });
});
