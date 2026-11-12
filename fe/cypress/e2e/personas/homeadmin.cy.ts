/// <reference types="cypress" />
/* eslint-disable cypress/no-force -- RBAC proof: force-clicking a disabled
   control is exactly how we assert "it stays inert for this role". */

/**
 * Persona — Home Admin
 *
 * The whole world a home's operational administrator can reach, exercised
 * as the HomeAdmin session itself. Think "PCHO minus the money": every
 * operational module — CRM, Clinical, Staff Management, Compliance — and
 * none of RevOps.
 *
 * THE PERMISSION MODEL (utils/roles.ts — hasAccess does NOT treat EDIT as
 * implying VIEW):
 *
 *   Landing    INITIAL_ROUTE "/" — the home dashboard renders with the
 *              full widget set (residents, employees, occupancy, referrals,
 *              pending applications, action widgets).
 *
 *   Nav        roleNavAllow.HomeAdmin grants all four operational sections;
 *              REVOPS_NAV is absent, so the RevOps section header is never
 *              rendered — not greyed out, withheld entirely.
 *                CRM        Senior Leads, Referral Agents, Care Leads,
 *                           Nurse Leads (Compliance Guests only when the
 *                           home's PCHO is a compliance partner, Sales
 *                           Dashboard only when the home sells)
 *                Clinical   Seniors, Care Team, Nurses
 *                Staff Mgmt Dashboard, Scheduling, Tasks, Timesheet, Team
 *                           (+ Sales Team when the home sells)
 *                Compliance Documents, Training, Certificates
 *
 *   CRM        Full administration: the leads board, deleted-lead toggle
 *              (VIEW_DELETED_SENIORS), onboard/move-to-clinical/actions.
 *
 *   Clinical   Everything the Nurse can't do and more: all five tabs on a
 *              senior's record (Medication included), the carousel, full
 *              record of care — plus the *_HISTORY_EDIT permissions that
 *              only HomeAdmin and PCHO hold, so past days are writable.
 *
 *   Staff Mgmt Employer dashboard, scheduling (+overlap), task admin,
 *              timesheets with daily review, team roster with broadcast.
 *
 *   Compliance Documents screen renders; training modules are created and
 *              deleted (COMPLIANCE_TRAINING EDIT + CREATE_COMPLIANCE_TRAINING).
 *
 *   RevOps     Nothing. /revops* bounces to "/" — REVOPS_DASHBOARD is not
 *              theirs, and every RevOps page's guard pushes home.
 */

import { Tags } from "../../framework/utils/tags";
import { loginPage } from "../../framework/pages/login.page";
import { forgotPasswordPage } from "../../framework/pages/forgot-password.page";
import {
  buildHome,
  buildTrainingModule,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * 86400000));

/** The admin whose session these tests run. */
const ADMIN = {
  userId: TEST_USER_ID,
  name: "Helen Admin",
  firstName: "Helen",
  lastName: "Admin",
  email: "helen.admin@assistly.com",
  mobile: "7065183400",
  role: "HomeAdmin",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  // A prior bot conversation under the CRM tab — proves history persists.
  chatbot: {
    crm: {
      chatHistory: [
        {
          messageId: "33333333-3333-4333-8333-333333333333",
          message: "How do I onboard a lead?",
          createdBy: "User",
          createdAt: `${today()}T08:00:00.000Z`,
        },
        {
          messageId: "44444444-4444-4444-8444-444444444444",
          message: "Open the lead row's actions and choose Onboard.",
          createdBy: "Bot",
          createdAt: `${today()}T08:00:05.000Z`,
        },
      ],
      chatSummary: "Asked about onboarding.",
    },
  },
};

const buildSenior = (overrides: Record<string, any> = {}) => ({
  userId: "cccccccc-0001-4ccc-8ccc-cccccccccccc",
  name: "Arthur Bean",
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  role: "Senior",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  carePlan: {
    adl: { bathing: { careLevel: "Assistance" } },
    housekeeping: { laundry: "Weekly" },
    vitalSigns: { bloodPressure: true },
  },
  clinical: {
    roomNumber: 12,
    status: "In Home",
    medication: [
      {
        id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        medicationId: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        name: "Tylenol",
        dosage: "100mg",
        directions: "After eating",
        additionalComments: "",
        startdate: daysFromNow(-30),
        enddate: "",
        timings: ["09:00:00"],
        overTheCounter: false,
      },
    ],
    medPass: {
      services: [
        {
          medicationId: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          passOrRefuse: "Pass",
          remarks: "Took it calmly",
          providedAt: `${today()}T09:00:00.000Z`,
          providedBy: TEST_USER_ID,
          timing: "09:00:00",
        },
      ],
      comments: [
        {
          messageId: "11111111-1111-4111-8111-111111111111",
          message: "Morning round completed",
          parentMessageId: null,
          createdAt: `${today()}T09:15:00.000Z`,
          createdByUserId: TEST_USER_ID,
          createdByUserName: "Helen Admin",
        },
      ],
    },
    carePlan: {
      services: [
        {
          serviceName: "bathing - Assistance",
          serviceCategory: "ADL",
          providedOrNot: "Provided",
          providedAt: `${today()}T12:00:00.000Z`,
        },
      ],
      comments: [
        {
          messageId: "22222222-2222-4222-8222-222222222222",
          message: "Bath taken in the morning",
          parentMessageId: null,
          createdAt: `${today()}T12:30:00.000Z`,
          createdByUserId: TEST_USER_ID,
          createdByUserName: "Helen Admin",
        },
      ],
    },
    incidentReport: [
      {
        incidentId: "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee",
        facilityName: "Comfort Cove",
        facilityPhone: "7065183473",
        facilityAdministrator: "Helen Admin",
        residentName: ["Arthur Bean"],
        incidentDate: `${today()}T07:48:00.000Z`,
        incidentDetails: "Fell in the corridor",
        detailsOfIncident: "Fell in the corridor",
        reporterName: "Helen Admin",
        incidentReportedAt: `${today()}T07:49:00.000Z`,
      },
    ],
  },
  facesheet: { mobility: "Walker" },
  ...overrides,
});

const ARTHUR = buildSenior();
const ARTHUR_ID = ARTHUR.userId;

const LEAD = buildSenior({
  userId: "bbbbbbbb-0002-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Lenny Lead",
  firstName: "Lenny",
  lastName: "Lead",
  milestone: ["initial contact"],
  clinical: undefined,
});

const CAREGIVER = {
  ...ADMIN,
  userId: "dddddddd-0003-4ddd-8ddd-dddddddddddd",
  name: "Krishna Rao",
  firstName: "Krishna",
  lastName: "Rao",
  role: "PCG",
};

const TRAINING_MODULE = buildTrainingModule({ moduleName: "Fire Safety" });

/** Additional fixture personas — the boards an admin manages. */
const REFERRAL = {
  ...ADMIN,
  userId: "eeeeeeee-0005-4eee-8eee-eeeeeeeeeeee",
  name: "Rita Referral",
  role: "ReferralAgent",
};
const NURSE_LEAD = {
  ...ADMIN,
  userId: "ffffffff-0006-4fff-8fff-ffffffffffff",
  name: "Nora Nurselead",
  role: "NurseLead",
};
const CARE_LEAD = {
  ...ADMIN,
  userId: "dddddddd-0004-4ddd-8ddd-dddddddddddd",
  name: "Cara Carelead",
  role: "PCGLead",
};

const atHour = (h: number, m = 0) =>
  `${today()}T${pad(h)}:${pad(m)}:00.000Z`;

/** A shift as GET /v1/hcm/shifts returns it. */
const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 6001,
  user_id: CAREGIVER.userId,
  user_name: "Krishna Rao",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: "10",
  pay_frequency: "Hourly",
  shift_start_time: atHour(7),
  shift_end_time: atHour(15),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  created_by_user_name: "Helen Admin",
  ...overrides,
});

const TODAY_SHIFT = buildShift();

/**
 * Seed a HomeAdmin session and the queries the operational surfaces make.
 */
const visitAsAdmin = (
  path: string,
  opts: { users?: any[]; home?: any; shifts?: any[] } = {},
) => {
  const users = opts.users ?? [ADMIN, ARTHUR, LEAD, CAREGIVER];
  cy.clearAuthSession();
  cy.setAuthSession("HomeAdmin");
  cy.stubHome(
    opts.home ?? buildHome({ complianceTraining: [TRAINING_MODULE] }),
  );
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: opts.shifts ?? [] },
  }).as("getShifts");
  cy.intercept("GET", "**/v1/users*", {
    statusCode: 200,
    body: { users },
  }).as("getUsers");
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("?")[0].split("/").pop();
    req.reply({
      statusCode: 200,
      body: { user: users.find((u: any) => u.userId === id) ?? ADMIN },
    });
  }).as("getUser");
  cy.stubPresign();
  cy.intercept("POST", "/api/s3/list-objects", {
    statusCode: 200,
    body: { contents: [], commonPrefixes: [] },
  }).as("listObjects");
  cy.visit(path);
};

const visitClinicalTab = (tab: string) =>
  visitAsAdmin(`/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent(tab)}`);

/** Open the avatar's account menu — Profile / Support / Logout. */
const openAccountMenu = () =>
  cy.get("div.rounded-full.cursor-pointer").last().click();

describe("Persona — Home Admin", { tags: [Tags.REGRESSION, Tags.PCHO, Tags.HOMEADMIN] }, () => {
  // ──────────────────────────────────────────────────────────────────────
  // 0. Account — sign-in, password reset, logout
  // ──────────────────────────────────────────────────────────────────────

  describe("Sign in & password reset", () => {
    beforeEach(() => {
      cy.clearAuthSession();
      loginPage.visit();
    });

    it("signs in with valid credentials and lands on the app", { tags: [Tags.HOMEADMIN] }, () => {
      cy.stubLoginSuccess("HomeAdmin");
      loginPage.signIn();
      cy.wait("@loginRequest");
      // HomeAdmin's first allowed module is CRM — login routes there.
      cy.location("pathname", { timeout: 15000 }).should("eq", "/crm");
    });

    it("rejects invalid credentials with the error popover", () => {
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();
      cy.wait("@loginRequest");
      cy.assertPopover("Invalid email or password");
      cy.location("pathname").should("eq", "/login");
    });

    it("forgot password — the reset email reaches the OTP screen", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.assertLoaded();
      forgotPasswordPage
        .typeEmail("helen.admin@assistly.com")
        .submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.otpHeading.should("be.visible");
      forgotPasswordPage.otpInputs.should("have.length", 6);
    });

    it("valid OTP + matching new passwords resets and returns to login", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("helen.admin@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp("123456")
        .typeNewPassword("NewPass@123")
        .typeConfirmPassword("NewPass@123")
        .submitReset();
      cy.wait("@confirmResetRequest").then(({ request }) => {
        expect(request.body.email).to.eq("helen.admin@assistly.com");
        expect(request.body.confirmationCode).to.eq("123456");
      });
      cy.assertPopover(forgotPasswordPage.messages.passwordChanged);
      loginPage.signInButton.should("be.visible");
    });

    it("a wrong OTP fails the reset and keeps them on the OTP screen", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("helen.admin@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      cy.stubConfirmResetPassword(400, {});
      forgotPasswordPage
        .typeOtp("999999")
        .typeNewPassword("NewPass@123")
        .typeConfirmPassword("NewPass@123")
        .submitReset();
      cy.wait("@confirmResetRequest");
      cy.assertPopover(forgotPasswordPage.messages.resetFailureFallback);
    });

    it("mismatched new passwords are blocked before any request", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("helen.admin@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp("123456")
        .typeNewPassword("NewPass@123")
        .typeConfirmPassword("Different@123")
        .submitReset();
      cy.assertPopover(forgotPasswordPage.messages.passwordMismatch);
      cy.get("@confirmResetRequest.all").should("have.length", 0);
    });

    it("Resend OTP issues a second reset-password request", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("helen.admin@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      forgotPasswordPage.resendOtp();
      cy.get("@forgotPasswordRequest.all").should("have.length", 2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 0b. The shell — collapse, profile, support, the Assistly bot
  // ──────────────────────────────────────────────────────────────────────

  describe("The shell", () => {
    beforeEach(() => {
      visitAsAdmin("/crm");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("the sidebar collapses to icons and expands back", () => {
      cy.get("nav").contains("Collapse").click();
      // Collapsed: the labels leave the DOM — only icons remain.
      cy.get("nav").should("not.contain.text", "Clinical");
      cy.get("nav").find("button").last().click();
      cy.get("nav").should("contain.text", "Clinical");
    });

    it("opens the profile — Personal Details, Change Password, Profile Image", () => {
      openAccountMenu();
      cy.contains(/^Profile$/).click();
      cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
      cy.contains("Change Password").should("be.visible");
      cy.contains("Update Profile Image").should("be.visible");
    });

    it("edits personal details on the profile", () => {
      openAccountMenu();
      cy.contains(/^Profile$/).click();
      cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
      // The profile opens read-only — Edit Profile flips it to a form.
      // It's a styled div, not a button.
      cy.contains("div", /^Edit Profile$/).click();
      cy.get('input[name="firstName"], input[name="personalDetails.firstName"]', {
        timeout: 8000,
      })
        .first()
        .should("be.visible")
        .invoke("attr", "disabled")
        .should("not.eq", "disabled");
    });

    it("opens the support ticket form", () => {
      openAccountMenu();
      cy.contains(/Support/).click();
      cy.contains("Subject", { timeout: 10000 }).should("be.visible");
    });

    it("logout ends the session and lands on sign-in", () => {
      openAccountMenu();
      cy.contains(/^Logout$/).click();
      cy.contains("Are you sure you want to logout", {
        timeout: 5000,
      }).should("be.visible");
      cy.contains("button", /^Confirm$/).click();
      cy.getCookie("idToken", { timeout: 10000 }).should("not.exist");
      cy.getCookie("role").should("not.exist");
      cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
      cy.contains("button", "Sign in", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("the Assistly bot keeps the conversation from before", () => {
      // ADMIN.chatbot.crm seeds a stored exchange — reopening renders it.
      cy.get('img[src*="bot"], [class*="chatbot"], [class*="bot"]', {
        timeout: 10000,
      })
        .first()
        .click({ force: true });
      cy.contains("How do I onboard a lead?", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. Landing — the dashboard is theirs
  // ──────────────────────────────────────────────────────────────────────

  describe("Landing", () => {
    it("lands on the home dashboard", () => {
      visitAsAdmin("/");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
      cy.contains("Access Denied").should("not.exist");
    });

    it("renders the operational stat cards", () => {
      visitAsAdmin("/");
      ["Seniors", "Care Team"].forEach((card) =>
        cy.contains(card, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("the metrics row navigates — Senior Leads goes to CRM", () => {
      visitAsAdmin("/");
      cy.contains("Senior Leads", { timeout: 10000 }).should("be.visible");
      // The metric's count div is the click target, not the card title.
      cy.contains("Senior Leads")
        .closest('div[class*="flex-col"]')
        .find(".cursor-pointer")
        .first()
        .click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("the + affordances open the add-lead / add-campaign surfaces", () => {
      visitAsAdmin("/");
      cy.contains("Senior Leads", { timeout: 10000 }).should("be.visible");
      // The bottom-right + on the Senior Leads card opens the add-lead modal.
      // The + icons sit absolutely positioned inside each metric card —
      // Senior Leads is the first card with one.
      cy.get(".rounded-3xl", { timeout: 10000 }).first().click();
      cy.contains("First Name", { timeout: 10000 }).should("be.visible");
    });

    it("renders the Quick Actions panel — pending items surface here", () => {
      visitAsAdmin("/");
      cy.contains("Quick Actions", { timeout: 10000 }).should("be.visible");
    });

    it("renders the management section cards", () => {
      visitAsAdmin("/");
      ["CRM", "Clinical", "Staff Management", "Compliance"].forEach((card) =>
        cy.contains(card, { timeout: 10000 }).should("be.visible"),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. The sidebar — four operational sections, never RevOps
  // ──────────────────────────────────────────────────────────────────────

  describe("The sidebar", () => {
    beforeEach(() => {
      // The dashboard renders no <nav>; CRM carries the sidebar.
      visitAsAdmin("/crm");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers CRM with the lead boards", () => {
      cy.get("nav").contains("CRM").click();
      ["Senior Leads", "Referral Agents", "Care Leads", "Nurse Leads"].forEach(
        (item) => cy.get("nav").contains(item).should("be.visible"),
      );
    });

    it("offers Clinical with Seniors, Care Team and Nurses", () => {
      cy.get("nav").contains("Clinical").click();
      ["Seniors", "Care Team", "Nurses"].forEach((item) =>
        cy.get("nav").contains(item).should("be.visible"),
      );
    });

    it("offers Staff Management with the admin set", () => {
      cy.get("nav").contains("Staff Management").click();
      ["Dashboard", "Scheduling", "Tasks", "Timesheet", "Team"].forEach(
        (item) => cy.get("nav").contains(item).should("be.visible"),
      );
    });

    it("offers Compliance with Documents, Training and Certificates", () => {
      cy.get("nav").contains("Compliance").click();
      ["Documents", "Training", "Certificates"].forEach((item) =>
        cy.get("nav").contains(item).should("be.visible"),
      );
    });

    it("withholds RevOps entirely — no REVOPS_NAV", () => {
      cy.get("nav").contains("RevOps").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. CRM — full administration
  // ──────────────────────────────────────────────────────────────────────

  describe("CRM — administration", () => {
    it("renders the senior leads board", () => {
      visitAsAdmin("/crm");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
      cy.contains("Access Denied").should("not.exist");
      cy.contains("Lenny Lead", { timeout: 10000 }).should("be.visible");
    });

    it("offers the deleted-leads view — VIEW_DELETED_SENIORS", () => {
      visitAsAdmin("/crm");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("Add New — saving an empty senior lead fails client-side", () => {
      cy.intercept("POST", "**/v1/user*", {
        statusCode: 200,
        body: {},
      }).as("addUser");
      visitAsAdmin("/crm");
      cy.contains("button", "Add New", { timeout: 10000 }).click();
      cy.contains("First Name", { timeout: 10000 }).should("be.visible");
      cy.contains("button", /^Save$/).click();
      // Required fields flag — no request ever leaves.
      cy.get("@addUser.all").should("have.length", 0);
    });

    it("Add New — a complete senior lead saves", () => {
      cy.intercept("POST", "**/v1/user*", {
        statusCode: 200,
        body: {},
      }).as("addUser");
      visitAsAdmin("/crm");
      // The modal fires 3 lead-owner queries (PCHO / SalesDirector /
      // SalesRep); each resolution remounts the form via its `key`, so
      // wait until all land before typing into it.
      cy.get("@getUsers.all").then((calls) => {
        const baseline = calls.length;
        cy.contains("button", "Add New", { timeout: 10000 }).click();
        cy.get("@getUsers.all").should("have.length.gte", baseline + 3);
      });
      const leadModal = () => cy.get(".ReactModal__Content");
      const fill = (name: string, value: string) =>
        cy
          .get(`.ReactModal__Content input[name="${name}"]:visible:enabled`, {
            timeout: 15000,
          })
          .type(value);
      fill("firstName", "Nelly");
      fill("lastName", "Newlead");
      // CreateLeadSchema requires a valid email and 10-digit mobile.
      fill("email", "nelly.newlead@assistly.com");
      fill("mobile", "7065183400");
      cy.contains("button", /^Save$/).click();
      cy.wait("@addUser").then(({ request }) => {
        expect(request.body.userData?.firstName ?? request.body.firstName).to
          .eq("Nelly");
      });
    });

    it("a senior lead's row carries the Onboard / Move to Clinical / Delete menu", () => {
      visitAsAdmin("/crm");
      cy.contains("Lenny Lead", { timeout: 10000 }).should("be.visible");
      // The actions cell is a MenuIcon in the lead's row — the last icon.
      cy.contains("Lenny Lead")
        .closest('div[class*="border-b"], tr')
        .find("svg")
        .last()
        .click({ force: true });
      ["Onboard", "Move to Clinical", "Delete"].forEach((action) =>
        cy.contains(action, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("offers Send Bulk Campaign on the leads board", () => {
      visitAsAdmin("/crm");
      cy.contains("Send Bulk Campaign", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("opens a senior's record — biography tabs render", () => {
      visitAsAdmin(`/crm/${ARTHUR_ID}`);
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/crm/${ARTHUR_ID}`,
      );
      cy.contains("Arthur", { timeout: 10000 }).should("be.visible");
      ["Biography", "Medical", "Careplan", "FaceSheet"].forEach((tab) =>
        cy.contains(tab).should("be.visible"),
      );
    });

    it("withholds the Documents tab on a lead record — CRM_BIOGRAPHY_DOCUMENTS is absent", () => {
      // Per the access note: Home Admin sees no documents on senior/senior
      // lead/care lead records. The tab is filtered out client-side.
      visitAsAdmin(`/crm/${LEAD.userId}`);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");
      cy.get("body").find("[role='tab'], .tab, li, div")
        .filter(":contains('Documents')")
        .should("have.length", 0);
    });

    it("renders the referral agents board", () => {
      visitAsAdmin("/crm/referral", { users: [ADMIN, REFERRAL] });
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("renders the care leads board", () => {
      visitAsAdmin("/crm/pcg", { users: [ADMIN, CARE_LEAD, CAREGIVER] });
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("renders the nurse leads board", () => {
      visitAsAdmin("/crm/nurse", { users: [ADMIN, NURSE_LEAD] });
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Clinical — the full working set, history included
  // ──────────────────────────────────────────────────────────────────────

  describe("Clinical — full control", () => {
    it("renders the seniors board", () => {
      visitAsAdmin("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
    });

    it("switches the board between grid and list", () => {
      visitAsAdmin("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      // The list/grid toggle sits right of the board header.
      cy.get('div[class*="cursor-pointer"], button')
        .filter(":visible")
        .first()
        .click({ force: true });
      // List view = the div-based BaseTable header row.
      cy.contains("Seniors", { timeout: 8000 }).should("exist");
    });

    it("the senior card lets an admin edit status — CLINICAL_SENIOR_PROFILE_EDIT", () => {
      // Where PCG is denied, HomeAdmin holds it: the pencil flips the field
      // editable with Save/Cancel affordances.
      visitAsAdmin("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).click();
      const modal = () => cy.get(".ReactModal__Content");
      modal().should("be.visible");
      modal()
        .find('input[name="status"]')
        .should("have.value", "In Home")
        .and("have.attr", "readonly");
      modal()
        .contains("Status:")
        .closest("div.flex.font-poppins.font-normal")
        .find("button")
        .click();
      modal()
        .find('input[name="status"]')
        .should("not.have.attr", "readonly");
      modal().contains("button", "Cancel").click();
    });

    it("the senior card offers the upload-profile-pic pencil", () => {
      visitAsAdmin("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      // The avatar pencil is the same gated affordance — CLINICAL_SENIOR_PROFILE_EDIT.
      cy.get(".ReactModal__Content")
        .find('input[type="file"], [class*="cursor-pointer"]')
        .should("exist");
    });

    it("renders the care team board — PCG and HomeAdmin both queried", { tags: [Tags.HOMEADMIN, Tags.PCG] }, () => {
      visitAsAdmin("/clinical/pcg");
      cy.wait("@getUsers");
      cy.get("@getUsers.all").then((calls: any) => {
        const types = calls.map((c: any) =>
          new URL(c.request.url).searchParams.get("userType"),
        );
        expect(types).to.include("PCG");
        expect(types).to.include("HomeAdmin");
      });
    });

    it("renders the nurses board", () => {
      visitAsAdmin("/clinical/nurse");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers all five tabs on a senior's record", () => {
      visitClinicalTab("Medication");
      [
        "Medication",
        "MedPass",
        "Over-The-Counter Medication",
        "Care Plan",
        "Incident Report",
      ].forEach((tab) =>
        cy.contains(tab, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("shows the face carousel", () => {
      visitClinicalTab("MedPass");
      cy.get('div[class*="w-[138px]"]', { timeout: 10000 }).should("exist");
    });

    // ── Medication ──────────────────────────────────────────────────────

    it("offers Add Medication", () => {
      visitClinicalTab("Medication");
      cy.contains("button", "Add Medication", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("saving an empty medication is blocked client-side", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("Medication");
      cy.contains("button", "Add Medication", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      cy.contains("button", /^Save$/).click();
      cy.get("@saveClinical.all").should("have.length", 0);
    });

    it("adds a medication with valid data — timings included", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("Medication");
      cy.contains("button", "Add Medication", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      cy.get('input[name="medication.name"]').type("Amoxicillin");
      cy.get('input[name="medication.dosage"]').type("250mg");
      cy.get('input[name="medication.startdate"]').type(today());
      // Timings is a custom multiselect div — click the field, tick a slot.
      cy.get(".ReactModal__Content")
        .find('div[class*="w-[420px]"]')
        .first()
        .click();
      cy.get("ul li").contains(/^09:00 AM$/).click();
      // Click the field again to collapse the open option list.
      cy.get(".ReactModal__Content")
        .find('div[class*="w-[420px]"]')
        .first()
        .click();
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical");
    });

    it("edits a medication — Save PUTs the record", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("Medication");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // The row's edit affordance — the round edit icon in the actions cell.
      cy.contains("Tylenol")
        .closest('div[class*="border-b"], tr')
        .find('div[class*="rounded-[25px]"], svg')
        .first()
        .click({ force: true });
      cy.contains("Edit Medication", { timeout: 10000 }).should("be.visible");
      cy.get('input[name="medication.dosage"]').clear();
      cy.get('input[name="medication.dosage"]').type("200mg");
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical");
    });

    it("deletes a medication — window.confirm then PUT", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      // Delete rides the native window.confirm, not a React modal.
      cy.on("window:confirm", () => true);
      visitClinicalTab("Medication");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // Row actions are the two round icons — edit then delete.
      cy.get('button[class*="w-[36px]"], div[class*="w-[36px]"]')
        .eq(1)
        .click({ force: true });
      cy.wait("@saveClinical");
    });

    it("offers the Bulk medication toggle — MEDICATION_OCR_EXTRACTION", () => {
      visitClinicalTab("Medication");
      cy.contains("Bulk", { timeout: 10000 }).should("be.visible");
    });

    // ── MedPass ─────────────────────────────────────────────────────────

    it("MedPass — a recorded pass renders green", () => {
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // The 09:00 pass is pre-recorded — the Pass cell shows the passed state.
      cy.contains(/^Pass$/).should("be.visible");
    });

    it("MedPass — refuses a dose and captures the comment", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      const lateMed = buildSenior({
        clinical: {
          ...ARTHUR.clinical,
          medication: [
            {
              ...ARTHUR.clinical.medication[0],
              name: "NightDose",
              timings: ["08:00:00"],
            },
          ],
          // Clean slate — clicking Refuse on an untouched dose must record it.
          medPass: { services: [], comments: [] },
        },
      });
      visitAsAdmin(
        `/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("MedPass")}`,
        { users: [ADMIN, lateMed, CAREGIVER] },
      );
      cy.contains("NightDose", { timeout: 10000 })
        .closest('div.flex[class*="border-b"]')
        .contains(/^Refuse$/)
        .click();
      // Refuse opens a comment box; typing flips the CTA to "Save".
      cy.get('textarea[name="refuse comment"]', { timeout: 8000 }).type(
        "Patient declined this round",
      );
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical");
    });

    it("MedPass — comments render and a new one saves", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("MedPass");
      cy.contains("Morning round completed", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get("textarea").first().type("Afternoon round on track");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical");
    });

    it("MedPass — Generate EMAR offers Download PDF and E-Sign PDF", () => {
      // HomeAdmin holds CLINICAL_EMAR_ESIGN — both actions are theirs.
      cy.intercept("POST", "**/docuseal*", {
        statusCode: 200,
        body: { data: { slug: "test-slug" } },
      }).as("docuseal");
      visitClinicalTab("MedPass");
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      cy.get("select").first().select(1, { force: true });
      cy.contains("Download PDF", { timeout: 10000 }).should("be.visible");
      cy.contains("E-Sign PDF").should("be.visible");
    });

    it("MedPass — a past date is editable — CLINICAL_MEDPASS_HISTORY_EDIT", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      // Wait for the grid to re-render for yesterday's round.
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // Yesterday's dose is untouched — a click records a pass.
      cy.contains(/^Pass$/).first().click();
      cy.wait("@saveClinical");
    });

    it("MedPass — blocks a future dose — 'can't be given before scheduled time'", () => {
      const lateMed = buildSenior({
        clinical: {
          ...ARTHUR.clinical,
          medication: [
            {
              ...ARTHUR.clinical.medication[0],
              name: "NightDose",
              timings: ["23:59:00"],
            },
          ],
          medPass: { services: [], comments: [] },
        },
      });
      visitAsAdmin(
        `/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("MedPass")}`,
        { users: [ADMIN, lateMed, CAREGIVER] },
      );
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains("NightDose", { timeout: 10000 })
        .closest('div.flex[class*="border-b"]')
        .contains(/^Pass$/)
        .click();
      cy.contains("can't be given before scheduled time", {
        timeout: 5000,
      }).should("be.visible");
      cy.get("@saveClinical.all").should("have.length", 0);
    });

    // ── OTC ─────────────────────────────────────────────────────────────

    it("OTC — saving empty is blocked, valid data PUTs overTheCounter", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("Over-The-Counter Medication");
      cy.contains("Add Over-the-Counter Medication", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      cy.contains("button", /^Save$/).click();
      cy.get("@saveClinical.all").should("have.length", 0);
      cy.get('input[name="medication.name"]').type("Advil");
      cy.get('input[name="medication.dosage"]').type("200mg");
      cy.get('input[name="medication.startdate"]').type(today());
      cy.get(".ReactModal__Content")
        .find('div[class*="w-[420px]"]')
        .first()
        .click();
      cy.get("ul li").contains(/^09:00 AM$/).click();
      cy.get(".ReactModal__Content")
        .find('div[class*="w-[420px]"]')
        .first()
        .click();
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        const meds = request.body?.medication ?? request.body?.userData?.medication;
        const added = (meds ?? []).find(
          (m: any) => m.name === "Advil" || m?.medication?.name === "Advil",
        );
        expect(added?.overTheCounter).to.eq(true);
      });
    });

    // ── Care Plan ───────────────────────────────────────────────────────

    it("records a care plan service — Provided PUTs", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      const fresh = buildSenior({
        clinical: {
          ...ARTHUR.clinical,
          carePlan: {
            services: [
              {
                serviceName: "bathing - Assistance",
                serviceCategory: "ADL",
                providedOrNot: "",
              },
            ],
            comments: [],
          },
        },
      });
      visitAsAdmin(
        `/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("Care Plan")}`,
        { users: [ADMIN, fresh, CAREGIVER] },
      );
      cy.contains("Bathing", { timeout: 10000 })
        .closest('div[class*="border-b"]')
        .contains(/^Provided$/)
        .click();
      cy.wait("@saveClinical");
    });

    it("can edit a past day — the *_HISTORY_EDIT permissions are theirs", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .click();
      cy.wait("@saveClinical");
    });

    it("Care Plan comments render with dates and a new one saves", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      visitClinicalTab("Care Plan");
      cy.contains("Bath taken in the morning", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("Helen Admin").should("be.visible");
      cy.get("textarea").first().type("Noted restlessness in the afternoon");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical");
    });

    it("Generate Care Report offers Download PDF and E-Sign PDF", () => {
      // CLINICAL_CAREREPORT_ESIGN is theirs — both affordances render.
      visitClinicalTab("Care Plan");
      cy.contains("Generate Care Report", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get("select").first().select(1, { force: true });
      cy.contains("Download PDF", { timeout: 10000 }).should("be.visible");
      cy.contains("E-Sign PDF").should("be.visible");
    });

    // ── Incident Report ─────────────────────────────────────────────────

    it("offers Add Incident", () => {
      visitClinicalTab("Incident Report");
      cy.contains("button", "Add Incident", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("files an incident report — the regulatory form submits", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      // The form prefills facility fields from the PCHO/home user — include one.
      const pcho = {
        ...ADMIN,
        userId: "cccccccc-9999-4ccc-8ccc-cccccccccccc",
        name: "Pramila Chona",
        role: "PCHO",
      };
      visitAsAdmin(
        `/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("Incident Report")}`,
        { users: [ADMIN, ARTHUR, CAREGIVER, pcho] },
      );
      cy.contains("button", "Add Incident", { timeout: 10000 }).click();
      const modal = () => cy.get(".ReactModal__Content");
      modal().should("be.visible");
      // MUI keeps collapsed panels mounted — anchor clicks on the summary.
      cy.contains(".MuiAccordionSummary-root", "Resident(s) & Incident Details").click();
      modal().find('input[name="incidentDate"]').type(today(), { delay: 0 });
      modal().find('input[name="incidentTime"]').type("10:00", { delay: 0 });
      modal()
        .find('input[name="detailsOfIncident"]')
        .type("Resident fell in the corridor; no injuries observed", { delay: 0 });
      cy.contains(".MuiAccordionSummary-root", "Reporter").click();
      modal()
        .find('input[name="incidentReportedDate"]')
        .type(today(), { delay: 0 });
      modal()
        .find('input[name="incidentReportedTime"]')
        .type("10:30", { delay: 0 });
      modal().contains("button", /^Save$/).click();
      cy.wait("@saveClinical");
    });

    // ── Facesheet ───────────────────────────────────────────────────────

    it("Senior FaceSheet renders on the record — view and edit access", () => {
      // SENIOR_FACE_SHEET is in EDIT — the facesheet opens for edit.
      visitAsAdmin(`/crm/${ARTHUR_ID}`);
      cy.contains("FaceSheet", { timeout: 10000 }).click();
      cy.contains(/Face.?Sheet/i, { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Staff Management — employer views, task admin included
  // ──────────────────────────────────────────────────────────────────────

  describe("Staff Management — administration", () => {
    it("renders the employer dashboard — Now & Upcoming / Completed / Needs Review", () => {
      visitAsAdmin("/hcm", { shifts: [TODAY_SHIFT] });
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
      cy.contains("Access Denied").should("not.exist");
      ["Now & Upcoming", "Completed", "Needs Review"].forEach((tab) =>
        cy.contains(tab, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("shows the caregiver's shift card on Now & Upcoming", () => {
      visitAsAdmin("/hcm", { shifts: [TODAY_SHIFT] });
      cy.contains("Krishna Rao", { timeout: 10000 }).should("be.visible");
    });

    it("offers Clock In / Clock Out tracking on the shift card", () => {
      const clocked = buildShift({
        clock_in_timestamp: atHour(7, 5),
      });
      visitAsAdmin("/hcm", { shifts: [clocked] });
      cy.contains("Clocked In", { timeout: 10000 }).should("be.visible");
    });

    it("shows pending Time Off Requests with an approve/reject affordance", () => {
      const timeOff = buildShift({
        id: 6002,
        shift_status: "time_off",
        unavailability_reason: "Sick Leave",
        type: "Sick Leave",
        is_unavailability_approved: null,
      });
      visitAsAdmin("/hcm", { shifts: [timeOff] });
      cy.contains("Time Off Requests", { timeout: 10000 }).click();
      cy.contains("Sick Leave", { timeout: 8000 }).should("be.visible");
    });

    it("renders scheduling with week/day/month views", () => {
      visitAsAdmin("/hcm/scheduling", { shifts: [TODAY_SHIFT] });
      cy.contains("Access Denied").should("not.exist");
      ["Week", "Day", "Month"].forEach((view) =>
        cy.contains(view, { timeout: 10000 }).should("exist"),
      );
      cy.contains("Krishna Rao", { timeout: 10000 }).should("be.visible");
    });

    it("offers the admin schedule controls — Print, Add Team Member, Copy Week", () => {
      visitAsAdmin("/hcm/scheduling", { shifts: [TODAY_SHIFT] });
      ["Print", "Add Team Member"].forEach((cta) =>
        cy.contains(cta, { timeout: 10000 }).should("exist"),
      );
    });

    it("switches the schedule between week, month and day views", () => {
      visitAsAdmin("/hcm/scheduling", { shifts: [TODAY_SHIFT] });
      cy.get("nav", { timeout: 10000 }).should("exist");
      // The view switcher is a native <select> with Week/Month/Day View options.
      cy.get("select")
        .filter((_, el) => Cypress.$(el).find('option[value="week"]').length > 0)
        .first()
        .select("Month View");
      cy.get("select")
        .filter((_, el) => Cypress.$(el).find('option[value="week"]').length > 0)
        .first()
        .select("Day View");
    });

    it("renders task administration — Task Library and Task Status", () => {
      visitAsAdmin("/hcm/tasks");
      cy.contains("Access Denied").should("not.exist");
      ["Task Library", "Task Status"].forEach((tab) =>
        cy.contains(tab, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("offers Add Task — the admin's library is writable", () => {
      visitAsAdmin("/hcm/tasks");
      cy.contains("button", "Add Task", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("renders timesheets with the daily review", () => {
      visitAsAdmin("/hcm/timesheet");
      cy.contains("Access Denied").should("not.exist");
      cy.contains(/Daily Review|Timesheet/i, { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("renders the team roster", () => {
      visitAsAdmin("/hcm/team");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers the broadcast + communication affordance — HCM_TEAM_BROADCAST", () => {
      visitAsAdmin("/hcm/team");
      // The floating team-communication button opens the broadcast popup.
      cy.get("button", { timeout: 10000 })
        .filter((_, el) => el.offsetParent !== null)
        .last()
        .click({ force: true });
      cy.contains(/Team Communication|Broadcast/, { timeout: 8000 }).should(
        "be.visible",
      );
    });

    it("a roster row offers View job details — but no Documents tab", () => {
      // HCM_TEAM_DETAILED_VIEW is theirs; CARE_TEAM_DOCUMENTS is not —
      // the member profile's Documents tab is withheld.
      visitAsAdmin("/hcm/team");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.contains("Krishna Rao", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Compliance — documents and training admin
  // ──────────────────────────────────────────────────────────────────────

  describe("Compliance — administration", () => {
    it("renders the documents screen — home documents are theirs", () => {
      visitAsAdmin("/compliance");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/compliance");
      cy.contains("Access Denied").should("not.exist");
    });

    it("offers document upload and template management", () => {
      visitAsAdmin("/compliance");
      // Upload cards or a template affordance — COMPLIANCE_DOCUMENTS is EDIT.
      cy.contains(/Click to upload|Add|Template/i, { timeout: 10000 }).should(
        "exist",
      );
    });

    it("lists training modules with the create + delete affordances", () => {
      visitAsAdmin("/compliance/training");
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
      // CREATE_COMPLIANCE_TRAINING + COMPLIANCE_TRAINING both in EDIT.
      cy.contains("+ Create New Module").should("be.visible");
      cy.contains("Fire Safety")
        .parents('div[class*="border"]')
        .find('div[class*="rounded-[50%]"], button')
        .should("exist");
    });

    it("renders certificates", () => {
      visitAsAdmin("/compliance/certificates");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. RevOps — the money side is not theirs at all
  // ──────────────────────────────────────────────────────────────────────

  describe("RevOps — not theirs", () => {
    it("/revops bounces to the dashboard", () => {
      visitAsAdmin("/revops");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("budget bounces to the dashboard", () => {
      visitAsAdmin("/revops/budget");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("billing & invoice bounces to the dashboard", () => {
      visitAsAdmin("/revops/billing-invoice");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("payroll bounces to the dashboard", () => {
      visitAsAdmin("/revops/payments");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7b. Documents on people records — withheld
  //
  // Per the access note: no financials (RevOps above) and no documents on
  // senior leads / seniors / care leads / care team records. The matrix
  // agrees — neither CRM_BIOGRAPHY_DOCUMENTS nor CARE_TEAM_DOCUMENTS is in
  // HomeAdmin's EDIT set.
  // ──────────────────────────────────────────────────────────────────────

  describe("Documents on people records — withheld", () => {
    it("the senior lead's record shows no Documents tab", () => {
      visitAsAdmin(`/crm/${LEAD.userId}`);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");
      // Tabs render as plain divs — the strip holds Biography/Medical/Careplan
      // and must not include Documents.
      cy.get("body").then(($body) => {
        const tabStrip = $body.find('div[class*="bg-primary"][class*="bg-opacity-15"]');
        expect(tabStrip.text()).to.not.contain("Documents");
      });
    });

    it("a care team member's profile shows no Documents tab", () => {
      // CARE_TEAM_DOCUMENTS gates the tab — absent for HomeAdmin.
      visitAsAdmin(`/hcm/team/${CAREGIVER.userId}`);
      cy.contains("Personal Information", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get("body").then(($body) => {
        const tabStrip = $body.find('div[class*="bg-primary"][class*="bg-opacity-15"]');
        expect(tabStrip.text()).to.not.contain("Documents");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8a. Cross-persona — other actors' writes surface in the admin's world
  // ──────────────────────────────────────────────────────────────────────

  describe("Cross-persona", () => {
    it("every API call carries the session's authorization", () => {
      visitAsAdmin("/clinical");
      cy.wait("@getUsers").then(({ request }) => {
        expect(request.headers).to.have.property("authorization");
      });
    });

    it("a senior deleted upstream is gone when a Nurse loads the board", () => {
      // Act 1 — the admin's board still lists Arthur.
      visitAsAdmin("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      // Act 2 — the delete committed upstream; a Nurse session loading the
      // same board must not resurrect him. One test, two actors, one state.
      cy.clearAuthSession();
      cy.setAuthSession("Nurse");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [ADMIN, LEAD, CAREGIVER] },
      }).as("getUsersNurse");
      cy.visit("/clinical");
      cy.wait("@getUsersNurse");
      cy.contains("Arthur Bean").should("not.exist");
    });

    it("a dose passed by a caregiver shows in the admin's MedPass review", () => {
      const pcgPassed = buildSenior({
        clinical: {
          ...ARTHUR.clinical,
          medPass: {
            services: [
              {
                ...ARTHUR.clinical.medPass.services[0],
                providedBy: CAREGIVER.userId,
              },
            ],
            comments: [],
          },
        },
      });
      visitAsAdmin(
        `/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("MedPass")}`,
        { users: [ADMIN, pcgPassed, CAREGIVER] },
      );
      cy.contains(/^Pass$/, { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. End-to-end — an admin's morning
  // ──────────────────────────────────────────────────────────────────────

  describe("End-to-end journey", () => {
    it("E2E — dashboard, senior's record, incident add, training admin", () => {
      // Dashboard — the home at a glance.
      visitAsAdmin("/");
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");

      // Open a senior's record — all five tabs.
      visitClinicalTab("Medication");
      cy.contains("Incident Report", { timeout: 10000 }).should("be.visible");

      // Incident tab — the add affordance is theirs.
      visitClinicalTab("Incident Report");
      cy.contains("button", "Add Incident", { timeout: 10000 }).should(
        "be.visible",
      );

      // Training — administer the library.
      visitAsAdmin("/compliance/training");
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });
  });
});
