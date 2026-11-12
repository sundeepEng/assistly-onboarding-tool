/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Staff Management — Scheduling: Add Team Member
 *
 *   components/hcm/schedule/week-view.tsx:1082  the button, below the grid
 *   components/nav.tsx:369                      the modal it opens
 *   components/pcg/add-pcg.tsx                  the form inside it
 *   model/crm/user.model.ts                     CreatePCHOOrPCGLeadSchema
 *
 * The button says "Add Team Member"; the dialog it opens says **"Add Care
 * Lead"**, and what it creates is a `PCGLead` — not a `PCG`, and not anything
 * scoped to the schedule. It is the same `AddPCG` form the CRM sidebar opens,
 * reached from a second place; nothing about it is scheduling-specific.
 *
 * That matters for what a save does: on success it dispatches the popover and
 * then **routes to /crm/pcg**, so adding a team member from the schedule board
 * navigates the user out of Staff Management entirely. Pinned as built below.
 *
 * WHAT THE SCHEMA ACTUALLY ALLOWS
 *   nameRegex is `/^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]+$/` — letters, digits and
 *   spaces, with at least one alphanumeric. So hyphens and apostrophes are
 *   rejected: "Shaw-Bean" and "O'Brien" cannot be entered as names. Pinned as
 *   built rather than assumed to be a bug, but flagged in the README.
 *
 *   mobile is digits only and **exactly** ten — no punctuation is stripped
 *   first, unlike `phoneDigits10` elsewhere in the codebase, so "(706) 518-3473"
 *   is rejected outright rather than normalised.
 *
 * The onboarding-document lookup (`createDocumentObjectsFromS3Folder`) hits
 * /api/s3/list-objects and returns [] on any failure, so it never blocks a
 * save — it is stubbed here only to keep the payload deterministic.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SCHEDULING_PATH = "/hcm/scheduling";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const PRIYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PRIYA_ROW = {
  userId: PRIYA,
  name: "Priya Patel",
  firstName: "Priya",
  lastName: "Patel",
  email: "priya.patel@assistly.com",
  mobile: "5551112222",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
};

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  addTeamMember: () => cy.contains("button", "Add Team Member"),
  modal: () => cy.contains("Add Care Lead"),
  field: (name: string) => cy.get(`input[name="${name}"]`),
  save: () => cy.contains("button", /^Save$/),
  /** The red line under a field; each input renders its own. */
  errorUnder: (name: string) =>
    sel.field(name).parent().parent().find('div[class*="text-[red]"]'),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const visitBoard = (role: any = "PCHO") => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? [PRIYA_ROW] : [] },
    });
  }).as("getStaff");
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: [] },
  }).as("getShifts");
  // The onboarding-template lookup; [] keeps the saved payload deterministic.
  cy.intercept("POST", "/api/s3/list-objects", {
    statusCode: 200,
    body: { contents: [] },
  }).as("listObjects");
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SCHEDULING_PATH);
  cy.contains("Tue 08").should("be.visible");
};

const openForm = () => {
  sel.addTeamMember().click();
  sel.modal().should("be.visible");
};

const stubCreateUser = (statusCode = 201, body: any = {}) =>
  cy.intercept("POST", "**/v1/user", { statusCode, body }).as("createUser");

/** Fill every required field with something the schema accepts. */
const fillValid = (overrides: Record<string, string> = {}) => {
  const values = {
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace.hopper@assistly.com",
    mobile: "5551234567",
    ...overrides,
  };
  Object.entries(values).forEach(([name, value]) => {
    if (value) sel.field(name).clear().type(value);
  });
};

describe("Staff Management — Scheduling: Add Team Member", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The button
  // ──────────────────────────────────────────────────────────────────────────

  describe("The button", () => {
    it("sits below the schedule grid", () => {
      visitBoard();
      sel.addTeamMember().should("be.visible");
    });

    it("is withheld from a role without HCM_SCHEDULING", { tags: [Tags.SENIOR] }, () => {
      visitBoard("Senior");
      sel.addTeamMember().should("not.exist");
    });

    it("opens the form", () => {
      visitBoard();
      openForm();
    });

    it("sends nothing merely by opening", () => {
      cy.intercept("POST", "**/v1/user").as("createUser");
      visitBoard();
      openForm();
      cy.assertNoRequest("@createUser");
    });

    it("[as-built] opens a dialog titled Add Care Lead", () => {
      // The button and the dialog disagree: "Add Team Member" opens
      // "Add Care Lead", and what it creates is a PCGLead.
      visitBoard();
      sel.addTeamMember().click();
      cy.contains("Add Care Lead").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The form
  // ──────────────────────────────────────────────────────────────────────────

  describe("The form", () => {
    beforeEach(() => {
      visitBoard();
      openForm();
    });

    it("asks for five fields", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        sel.field(name).should("exist")
      );
    });

    it("marks the four required ones", () => {
      ["First Name *", "Last Name *", "Email *", "Phone Number *"].forEach((label) =>
        cy.contains(label).should("be.visible")
      );
    });

    it("leaves the middle name unmarked", () => {
      cy.contains("Middle Name").should("be.visible");
      cy.contains("Middle Name *").should("not.exist");
    });

    it("prompts in every field", () => {
      const prompts: Record<string, string> = {
        firstName: "Enter First Name",
        middleName: "Enter Middle Name",
        lastName: "Enter Last Name",
        email: "Enter Email",
        mobile: "Enter Phone Number",
      };
      Object.entries(prompts).forEach(([name, placeholder]) =>
        sel.field(name).should("have.attr", "placeholder", placeholder)
      );
    });

    it("starts empty", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        sel.field(name).should("have.value", "")
      );
    });

    it("offers a Save", () => {
      sel.save().should("be.visible");
    });

    it("can be abandoned", () => {
      cy.get("body").find("svg").last().click({ force: true });
      cy.contains("Add Care Lead").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. What it refuses
  // ──────────────────────────────────────────────────────────────────────────

  describe("Validation", () => {
    beforeEach(() => {
      cy.intercept("POST", "**/v1/user").as("createUser");
      visitBoard();
      openForm();
    });

    it("refuses an empty form", () => {
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("says what an empty form is missing", () => {
      sel.save().click();
      cy.contains("First Name is required").should("be.visible");
    });

    it("refuses a missing first name", () => {
      fillValid({ firstName: "" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a missing last name", () => {
      fillValid({ lastName: "" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a missing email", () => {
      fillValid({ email: "" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a missing phone number", () => {
      fillValid({ mobile: "" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses an email with no @", () => {
      fillValid({ email: "grace.assistly.com" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");
      cy.assertNoRequest("@createUser");
    });

    it("refuses an email with no domain", () => {
      fillValid({ email: "grace@" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses an email with no top-level domain", () => {
      fillValid({ email: "grace@assistly" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a phone number with letters", () => {
      fillValid({ mobile: "555ABC1234" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a phone number that is too short", () => {
      fillValid({ mobile: "555123456" });
      sel.save().click();
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
      cy.assertNoRequest("@createUser");
    });

    it("refuses a phone number that is too long", () => {
      fillValid({ mobile: "55512345678" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("[as-built] refuses a punctuated phone number rather than cleaning it", () => {
      // `phoneDigits10` elsewhere strips punctuation before counting; this
      // schema does not, so a pasted "(555) 123-4567" is simply rejected.
      fillValid({ mobile: "(555) 123-4567" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("[as-built] refuses a hyphenated surname", () => {
      // nameRegex allows only letters, digits and spaces.
      fillValid({ lastName: "Shaw-Bean" });
      sel.save().click();
      cy.contains("Last Name accepts only alphabets and numbers").should("be.visible");
      cy.assertNoRequest("@createUser");
    });

    it("[as-built] refuses an apostrophe in a name", () => {
      fillValid({ firstName: "O'Brien" });
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("refuses a punctuated middle name", () => {
      fillValid();
      sel.field("middleName").type("St.");
      sel.save().click();
      cy.assertNoRequest("@createUser");
    });

    it("accepts a name with a space in it", () => {
      stubCreateUser();
      fillValid({ firstName: "Mary Jane" });
      sel.save().click();
      cy.wait("@createUser");
    });

    it("accepts a name with digits in it", () => {
      stubCreateUser();
      fillValid({ lastName: "Hopper2" });
      sel.save().click();
      cy.wait("@createUser");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. What it saves
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving", () => {
    beforeEach(() => {
      stubCreateUser();
      visitBoard();
      openForm();
    });

    it("creates the user", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.firstName).to.eq("Grace");
        expect(request.body.lastName).to.eq("Hopper");
        expect(request.body.email).to.eq("grace.hopper@assistly.com");
        expect(request.body.mobile).to.eq("5551234567");
      });
    });

    it("creates them as a Care Lead", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.role).to.eq("PCGLead");
      });
    });

    it("scopes them to the home", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.home).to.eq("Comfort Cove");
      });
    });

    it("composes the full name from the parts", () => {
      fillValid();
      sel.field("middleName").type("Brewster");
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.name).to.eq("Grace Brewster Hopper");
      });
    });

    it("leaves the middle name out of the full name when it is blank", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.name).to.eq("Grace Hopper");
      });
    });

    it("saves without a middle name at all", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.middleName).to.not.be.ok;
      });
    });

    it("lower-cases the email", () => {
      fillValid({ email: "Grace.Hopper@Assistly.COM" });
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.email).to.eq("grace.hopper@assistly.com");
      });
    });

    it("[as-built] refuses a padded email rather than trimming it", () => {
      // `handleSubmitPCGData` does `email?.trim().toLowerCase()`, but the schema
      // regex is anchored (`^...$`) and runs first, so a pasted address with a
      // stray leading or trailing space is rejected and the trim never sees it.
      // The lower-casing on the same line still matters; the trim is dead code
      // for this case.
      cy.intercept("POST", "**/v1/user").as("blocked");
      fillValid({ email: "  grace.hopper@assistly.com  " });
      sel.save().click();

      cy.contains("Invalid email").should("be.visible");
      cy.assertNoRequest("@blocked");
    });

    it("attaches the onboarding documents it found", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.documents).to.be.an("array");
      });
    });

    it("authorises the request with the session token", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.assertAuthorized("@createUser");
    });

    it("confirms the save", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.assertPopover("Care Lead Added Successfully");
    });

    it("closes the form", () => {
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.contains("Add Care Lead").should("not.exist");
    });

    it("[as-built] leaves Staff Management for the CRM board", () => {
      // `router.push("/crm/pcg")` on success — adding a team member from the
      // schedule navigates the user out of the module they were working in.
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/pcg");
    });

    it("reports a rejected save", () => {
      cy.intercept("POST", "**/v1/user", {
        statusCode: 400,
        body: { error: "A user with that email already exists" },
      }).as("createUser");
      fillValid();
      sel.save().click();

      cy.wait("@createUser");
      cy.assertPopover("A user with that email already exists");
    });

    it("keeps the form open after a rejected save", () => {
      cy.intercept("POST", "**/v1/user", { statusCode: 500, body: {} }).as(
        "createUser"
      );
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.dismissPopover();

      cy.contains("Add Care Lead").should("be.visible");
      sel.field("firstName").should("have.value", "Grace");
    });

    it("stays on the schedule after a rejected save", () => {
      cy.intercept("POST", "**/v1/user", { statusCode: 500, body: {} }).as(
        "createUser"
      );
      fillValid();
      sel.save().click();
      cy.wait("@createUser");
      cy.location("pathname").should("eq", SCHEDULING_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. End-to-end
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end", () => {
    it("E2E — a care lead is added from the schedule board", () => {
      stubCreateUser();
      visitBoard();

      sel.addTeamMember().click();
      cy.contains("Add Care Lead").should("be.visible");

      sel.field("firstName").type("Grace");
      sel.field("middleName").type("Brewster");
      sel.field("lastName").type("Hopper");
      sel.field("email").type("grace.hopper@assistly.com");
      sel.field("mobile").type("5551234567");
      sel.save().click();

      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.name).to.eq("Grace Brewster Hopper");
        expect(request.body.role).to.eq("PCGLead");
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
      });
      cy.assertPopover("Care Lead Added Successfully");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/pcg");
    });

    it("E2E — a rejected save is corrected and retried", () => {
      cy.intercept("POST", "**/v1/user", {
        statusCode: 400,
        body: { error: "Invalid email" },
      }).as("createUser");
      visitBoard();
      openForm();

      fillValid({ email: "grace@assistly.com" });
      sel.save().click();
      cy.wait("@createUser");
      cy.assertPopover("Invalid email");
      cy.dismissPopover();

      stubCreateUser();
      sel.field("email").clear().type("grace.hopper@assistly.com");
      sel.save().click();
      cy.wait("@createUser").then(({ request }) => {
        expect(request.body.email).to.eq("grace.hopper@assistly.com");
      });
      cy.assertPopover("Care Lead Added Successfully");
    });
  });
});
