/// <reference types="cypress" />

/**
 * CRM — API contract suite
 *
 * Asserts what the CRM screens send and how they react to what comes back:
 * endpoint, method, query parameters, Authorization header, request body, and
 * the handling of each error status. The companion spec (senior-leads-board.cy.ts)
 * covers the user-facing journeys.
 *
 * Routes under test:
 *   /crm                  Senior Leads      GET /v1/users?userType=Lead
 *   /crm/referral         Referral Agents   GET /v1/users?userType=REFERRAL
 *   /crm/pcg              Care Leads        GET /v1/users?userType=PCGLead
 *   /crm/nurse            Nurse Leads       GET /v1/users?userType=NurseLead
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildUserRow,
  TEST_HOME_ID,
  TEST_LEAD_ID,
} from "../../framework/module-commands";

const CRM_PATH = "/crm";
const REFERRAL_PATH = "/crm/referral";

describe("CRM — API contract", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Listing CRM records — GET /v1/users
  // ──────────────────────────────────────────────────────────────────────────

  describe("GET /v1/users — listing leads", () => {
    it("requests the leads list on load", () => {
      cy.visitAs(CRM_PATH);

      cy.wait("@getUsers").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/users");
      });
    });

    it("filters by userType=Lead and the signed-in user's homeId", () => {
      // Without the homeId filter a PCHO would see every home's leads.
      cy.visitAs(CRM_PATH);

      cy.wait("@getUsers");
      cy.assertQuery("@getUsers", { userType: "Lead", homeId: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      cy.visitAs(CRM_PATH);

      cy.wait("@getUsers");
      cy.assertAuthorized("@getUsers");
    });

    it("sends no request body on the list call", () => {
      cy.visitAs(CRM_PATH);

      cy.wait("@getUsers").then(({ request }) => {
        expect(request.body).to.satisfy(
          (body: unknown) => body === "" || body === null || body === undefined
        );
      });
    });

    it("renders every row the API returns", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([
        buildUserRow({ name: "Jane Doe" }),
        buildUserRow({ userId: "lead-2", name: "Arthur Bean" }),
        buildUserRow({ userId: "lead-3", name: "Mary Shaw" }),
      ]);
      cy.visit(CRM_PATH);

      cy.wait("@getUsers");
      cy.contains("Jane Doe").should("be.visible");
      cy.contains("Arthur Bean").should("be.visible");
      cy.contains("Mary Shaw").should("be.visible");
    });

    it("renders an empty list without erroring", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([]);
      cy.visit(CRM_PATH);

      cy.wait("@getUsers");
      cy.contains("Senior Leads").should("be.visible");
    });

    it("surfaces a 500 in the exception popover", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsersFailure(500, "Failed to fetch users");
      cy.visit(CRM_PATH);

      cy.waitForQueryFailure("@getUsers");
      cy.assertPopover("Failed to fetch users");
    });

    it("keeps the page usable after a 403", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsersFailure(403, "Forbidden");
      cy.visit(CRM_PATH);

      cy.wait("@getUsers");
      // The heading is rendered by the page shell, not the query, so an API
      // failure must not blank the whole screen.
      cy.contains("Senior Leads").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Sub-sections filter on their own userType
  // ──────────────────────────────────────────────────────────────────────────

  describe("CRM sub-sections request their own record type", () => {
    it("Referral Agents filters on the Referral record type", () => {
      // `userRoles.REFERRAL` is the string "Referral" — the SCREAMING_CASE key
      // in utils/constants.ts is not the value that reaches the API.
      cy.visitAs(REFERRAL_PATH);

      cy.wait("@getUsers");
      cy.assertQuery("@getUsers", { userType: "Referral", homeId: TEST_HOME_ID });
    });

    it("Care Leads filters on the PCG-lead record type", () => {
      cy.visitAs("/crm/pcg");

      cy.wait("@getUsers").then(({ request }) => {
        const userType = new URL(request.url).searchParams.get("userType");
        expect(userType, "care-leads userType").to.match(/PCG/);
      });
    });

    it("Nurse Leads filters on the nurse-lead record type", () => {
      cy.visitAs("/crm/nurse");

      cy.wait("@getUsers").then(({ request }) => {
        const userType = new URL(request.url).searchParams.get("userType");
        expect(userType, "nurse-leads userType").to.match(/Nurse/i);
      });
    });

    it("Compliance Guests filters on the compliance-guest record type", () => {
      cy.visitAs("/crm/complianceguest");

      cy.wait("@getUsers").then(({ request }) => {
        const userType = new URL(request.url).searchParams.get("userType");
        expect(userType, "compliance-guest userType").to.match(/Compliance/i);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Home configuration — GET /v1/home/{id}
  // ──────────────────────────────────────────────────────────────────────────

  describe("GET /v1/home/{id} — home configuration", () => {
    it("requests the signed-in user's home, authenticated", () => {
      cy.visitAs(CRM_PATH);

      cy.wait("@getHome").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include(`/v1/home/${TEST_HOME_ID}`);
      });
      cy.assertAuthorized("@getHome");
    });

    it("does not request a home when the session carries no homeId", () => {
      // AS-BUILT: the session guard treats a missing homeId as an
      // unauthenticated session and bounces to /login — so the pin is that
      // `/v1/home/undefined` is never requested, not that the board renders.
      cy.clearAuthSession();
      cy.setCookie("idToken", "");
      cy.stubHome();
      cy.stubUsers();
      cy.setAuthSession("PCHO");
      cy.clearCookie("homeId");
      cy.visit(CRM_PATH);

      cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
      cy.get("@getHome.all").then((calls: any) => {
        calls.forEach((c: any) =>
          expect(c.request.url).to.not.include("/v1/home/undefined")
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Creating a lead — POST /v1/user
  // ──────────────────────────────────────────────────────────────────────────

  describe("POST /v1/user — creating a senior lead", () => {
    const openAddLead = () => {
      cy.contains("button", "Add New").click();
      cy.get('input[name="firstName"]').should("be.visible");
      // The form is rebuilt as each lead-owner query lands; wait it out before
      // typing, or the field is detached mid-command.
      cy.settleForm();
    };

    const fillLead = ({
      firstName = "Nora",
      lastName = "Bennett",
      email = "nora.bennett@assistly.com",
      mobile = "5557654321",
    } = {}) => {
      cy.typeField("firstName", firstName);
      cy.typeField("lastName", lastName);
      cy.typeField("email", email);
      cy.typeField("mobile", mobile);
    };

    beforeEach(() => {
      cy.visitAs(CRM_PATH);
      cy.wait("@getUsers");
    });

    it("POSTs to /v1/user with the bearer token", () => {
      cy.stubPost("/v1/user", "createLead", 201, { userId: "new-lead" });

      openAddLead();
      fillLead();
      cy.contains("button", "Save").click();

      cy.wait("@createLead").then(({ request }) => {
        expect(request.method).to.eq("POST");
        expect(request.url).to.include("/v1/user");
      });
      cy.assertAuthorized("@createLead");
    });

    it("sends the typed fields, the lowercased email and the derived name", () => {
      cy.stubPost("/v1/user", "createLead", 201, {});

      openAddLead();
      fillLead({ email: "Nora.Bennett@Assistly.com" });
      cy.contains("button", "Save").click();

      cy.wait("@createLead").then(({ request }) => {
        expect(request.body).to.include({
          firstName: "Nora",
          lastName: "Bennett",
          mobile: "5557654321",
          email: "nora.bennett@assistly.com",
          name: "Nora Bennett",
        });
      });
    });

    it("stamps the new lead with the creator's home, the Lead role and the first milestone", () => {
      cy.stubPost("/v1/user", "createLead", 201, {});

      openAddLead();
      fillLead();
      cy.contains("button", "Save").click();

      cy.wait("@createLead").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.home).to.eq("Comfort Cove");
        expect(request.body.role).to.eq("Lead");
        expect(request.body.milestone).to.deep.eq(["initial contact"]);
      });
    });

    it("does not call the API when the form is invalid", () => {
      cy.intercept("POST", "**/v1/user").as("createLead");

      openAddLead();
      cy.contains("button", "Save").click();

      cy.contains("First Name is required").should("be.visible");
      cy.assertNoRequest("@createLead");
    });

    it("surfaces a 400 from the API", () => {
      cy.stubPost("/v1/user", "createLead", 400, { error: "Email already exists" });

      openAddLead();
      fillLead();
      cy.contains("button", "Save").click();

      cy.wait("@createLead");
      cy.assertPopover("Email already exists");
    });

    it("surfaces a 500 from the API", () => {
      cy.stubPost("/v1/user", "createLead", 500, { error: "Internal Server Error" });

      openAddLead();
      fillLead();
      cy.contains("button", "Save").click();

      cy.wait("@createLead");
      cy.assertPopover("Internal Server Error");
    });

    it("refreshes the leads list after a successful create", () => {
      // `useCreate` invalidates the Lead query key; without that the new lead
      // would not appear until a manual reload.
      cy.stubPost("/v1/user", "createLead", 201, {});

      openAddLead();
      fillLead();
      cy.contains("button", "Save").click();

      cy.wait("@createLead");
      cy.get("@getUsers.all").should("have.length.greaterThan", 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Deleting a lead — DELETE /v1/user/{id}
  // ──────────────────────────────────────────────────────────────────────────

  describe("DELETE /v1/user/{id} — deleting a senior lead", () => {
    const openRowMenu = () => cy.openRowMenu("Jane Doe");

    beforeEach(() => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([buildUserRow({ name: "Jane Doe" })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
    });

    it("DELETEs /v1/user/{id} once the deletion is confirmed", () => {
      cy.stubDelete("/v1/user", "deleteLead", 200, { deleted: true });

      openRowMenu();
      cy.contains("Delete").click();
      cy.contains("Are you sure you want to permanently delete this Senior Lead?").should(
        "be.visible"
      );
      cy.contains("button", "Confirm").click();

      cy.wait("@deleteLead").then(({ request }) => {
        expect(request.method).to.eq("DELETE");
        expect(request.url).to.include(`/v1/user/${TEST_LEAD_ID}`);
      });
      cy.assertAuthorized("@deleteLead");
      cy.assertPopover("Senior Lead deleted successfully!");
    });

    it("does not call the API when the confirmation is cancelled", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteLead");

      openRowMenu();
      cy.contains("Delete").click();
      cy.contains("button", "Cancel").click();

      cy.assertNoRequest("@deleteLead");
    });

    it("surfaces a 403 from the delete endpoint", () => {
      cy.stubDelete("/v1/user", "deleteLead", 403, { error: "Not permitted" });

      openRowMenu();
      cy.contains("Delete").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@deleteLead");
      cy.assertPopover("Not permitted");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Onboarding a lead — POST /signup
  // ──────────────────────────────────────────────────────────────────────────

  describe("POST /signup — onboarding a senior lead", () => {
    const openRowMenu = () => cy.openRowMenu("Jane Doe");

    beforeEach(() => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
    });

    it("sends the lead's email and role, authenticated with the admin's token", () => {
      // Unlike /signin, /signup runs on behalf of a signed-in admin and must
      // carry the Authorization header.
      cy.stubUsers([buildUserRow({ name: "Jane Doe" })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.stubPost("/signup", "signupLead", 200, { message: "Email sent" });

      openRowMenu();
      cy.contains(/^Onboard$/).click();
      cy.contains("button", "Confirm").click();

      cy.wait("@signupLead").then(({ request }) => {
        expect(request.body).to.deep.eq({
          email: "jane.doe@assistly.com",
          role: "Lead",
        });
      });
      cy.assertAuthorized("@signupLead");
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses to onboard a lead with no email address, without calling the API", () => {
      cy.stubUsers([buildUserRow({ name: "No Email", email: "" })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.intercept("POST", "**/signup").as("signupLead");

      cy.openRowMenu("No Email");
      cy.contains(/^Onboard$/).click();
      cy.contains("button", "Confirm").click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signupLead");
    });

    it("surfaces a signup failure", () => {
      cy.stubUsers([buildUserRow({ name: "Jane Doe" })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.stubPost("/signup", "signupLead", 400, { error: "User already registered" });

      openRowMenu();
      cy.contains(/^Onboard$/).click();
      cy.contains("button", "Confirm").click();

      cy.wait("@signupLead");
      cy.assertPopover("User already registered");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Home type drives the In-Home-Care rules
  // ──────────────────────────────────────────────────────────────────────────

  describe("home type changes the Add Lead contract", () => {
    it("makes the phone number mandatory for an In-Home Care home", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ homeType: "In Home Care" }));
      cy.stubUsers();
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.intercept("POST", "**/v1/user").as("createLead");

      cy.contains("button", "Add New").click();
      cy.contains("Phone Number *").should("be.visible");
      cy.settleForm();

      cy.typeField("firstName", "Nora");
      cy.typeField("lastName", "Bennett");
      cy.contains("button", "Save").click();

      cy.assertNoRequest("@createLead");
    });

    it("leaves the phone number optional for a residential home", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ homeType: "Residential" }));
      cy.stubUsers();
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.stubPost("/v1/user", "createLead", 201, {});

      cy.contains("button", "Add New").click();
      cy.contains("Phone Number").should("be.visible");
      cy.settleForm();

      cy.typeField("firstName", "Nora");
      cy.typeField("lastName", "Bennett");
      cy.contains("button", "Save").click();

      cy.wait("@createLead").then(({ request }) => {
        expect(request.body.firstName).to.eq("Nora");
      });
    });
  });
});
