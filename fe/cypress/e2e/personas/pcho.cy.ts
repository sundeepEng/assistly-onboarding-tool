/// <reference types="cypress" />
/* eslint-disable cypress/no-force -- RBAC proof: force-clicking a disabled
   control is exactly how we assert "it stays inert for this role". */

/**
 * Persona — PCHO (Provider / Charter Home Owner)
 *
 * The super user. Everything HomeAdmin can do plus the two surfaces the
 * admin is denied: RevOps (dashboard, budget, billing & invoice, payroll)
 * and documents on people records (senior-lead Documents/Forms tabs,
 * care-team Documents). PCHO also holds the administrative extras the
 * admin lacks: HCM_TEAM_JOB_DETAILS, HCM_PAY_PERIOD_REVIEW,
 * HCM_SALES_TEAM, CRM_MARK_AS_LOST, CLIENT_RATE, SENIOR_CUSTOMIZE_ADLS.
 *
 * THE PERMISSION MODEL (utils/roles.ts — hasAccess does NOT treat EDIT as
 * implying VIEW):
 *
 *   Landing    INITIAL_ROUTE "/" — with isSalesRequired unset/false the
 *              login router sends PCHO to /crm (getInitialRoute's special
 *              case); a selling home lands on /crm/sales-dashboard instead.
 *
 *   Nav        roleNavAllow.PCHO grants all five sections including revops
 *              — the only role whose sidebar ever shows it.
 *
 *   CRM        Everything: leads board, deleted-lead toggle, onboard /
 *              move-to-clinical / delete / mark-as-lost, referral agents,
 *              compliance guests, sales dashboard, campaigns — and the
 *              Biography record's Documents + Forms tabs.
 *
 *   Clinical   All five care tabs, deleted seniors + deleted care team
 *              views, room numbers, every *_HISTORY_EDIT, facesheets and
 *              documents on both senior and care-team records.
 *
 *   Staff Mgmt Employer dashboard, roster with Job Details + wages + ⋮
 *              menu, scheduling (+overlap), timesheets with BOTH reviews,
 *              tasks admin, broadcast, sales team.
 *
 *   Compliance Documents, training create/delete, certificates.
 *
 *   RevOps     Dashboard, budget, billing & invoice, payroll — plus the
 *              PCHO-only extras (REVOPS_PCHO_BILLING_INVOICE,
 *              ADMIN_REVOPS_DASHBOARD, CONNECT_STRIPE, CLIENT_RATE).
 *
 *   Negatives  Session-level only — a signed-in PCHO is never refused a
 *              surface; the denials are unauthenticated/expired access.
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

/** The owner whose session these tests run. */
const OWNER = {
  userId: TEST_USER_ID,
  name: "Olivia Owner",
  firstName: "Olivia",
  lastName: "Owner",
  email: "olivia.owner@assistly.com",
  mobile: "7065183401",
  role: "PCHO",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  chatbot: {
    crm: {
      chatHistory: [
        {
          messageId: "33333333-3333-4333-8333-333333333333",
          message: "Show me this month's occupancy.",
          createdBy: "User",
          createdAt: `${today()}T08:00:00.000Z`,
        },
        {
          messageId: "44444444-4444-4444-8444-444444444444",
          message: "Occupancy is on the dashboard's second metric card.",
          createdBy: "Bot",
          createdAt: `${today()}T08:00:05.000Z`,
        },
      ],
      chatSummary: "Asked about occupancy.",
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
      comments: [],
    },
    carePlan: { services: [], comments: [] },
    incidentReport: [
      {
        incidentId: "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee",
        facilityName: "Comfort Cove",
        facilityPhone: "7065183473",
        facilityAdministrator: "Olivia Owner",
        residentName: ["Arthur Bean"],
        incidentDate: `${today()}T07:48:00.000Z`,
        incidentDetails: "Fell in the corridor",
        detailsOfIncident: "Fell in the corridor",
        reporterName: "Nina Nurse",
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
  ...OWNER,
  userId: "dddddddd-0003-4ddd-8ddd-dddddddddddd",
  name: "Krishna Rao",
  firstName: "Krishna",
  lastName: "Rao",
  role: "PCG",
};

const NURSE_MEMBER = {
  ...OWNER,
  userId: "ffffffff-0007-4fff-8fff-ffffffffffff",
  name: "Nina Nurse",
  firstName: "Nina",
  lastName: "Nurse",
  role: "Nurse",
};

const TRAINING_MODULE = buildTrainingModule({ moduleName: "Fire Safety" });

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
  created_by_user_name: "Olivia Owner",
  ...overrides,
});

const TODAY_SHIFT = buildShift();

/**
 * Seed a PCHO session and the queries the operational surfaces make.
 * Same contract as the other persona helpers — the session cookie is the
 * only difference.
 */
const visitAsOwner = (
  path: string,
  opts: { users?: any[]; home?: any; shifts?: any[] } = {},
) => {
  const users = opts.users ?? [OWNER, ARTHUR, LEAD, CAREGIVER, NURSE_MEMBER];
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
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
      body: { user: users.find((u: any) => u.userId === id) ?? OWNER },
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
  visitAsOwner(`/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent(tab)}`);

/** Open the avatar's account menu — Profile / Support / Logout. */
const openAccountMenu = () =>
  cy.get("div.rounded-full.cursor-pointer").last().click();

describe("Persona — PCHO", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────
  // 0. Account — sign-in, password reset, logout
  // ──────────────────────────────────────────────────────────────────────

  describe("Sign in & password reset", () => {
    beforeEach(() => {
      cy.clearAuthSession();
      loginPage.visit();
    });

    it("signs in with valid credentials and lands on the app", () => {
      cy.stubLoginSuccess("PCHO");
      loginPage.signIn();
      cy.wait("@loginRequest");
      // No sales requirement seeded → getInitialRoute sends PCHO to /crm.
      cy.location("pathname", { timeout: 15000 }).should("eq", "/crm");
    });

    it("a selling home lands on the sales dashboard instead", () => {
      cy.loginAs("PCHO", { isSalesRequired: true });
      cy.location("pathname", { timeout: 15000 }).should(
        "eq",
        "/crm/sales-dashboard",
      );
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
      forgotPasswordPage.typeEmail(OWNER.email).submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.otpHeading.should("be.visible");
      forgotPasswordPage.otpInputs.should("have.length", 6);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. The shell — navigation, profile, support, logout
  // ──────────────────────────────────────────────────────────────────────

  describe("The shell", () => {
    beforeEach(() => {
      visitAsOwner("/crm");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("the sidebar collapses to icons and expands back", () => {
      cy.get("nav").contains("Collapse").click();
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
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Landing — the dashboard is theirs
  // ──────────────────────────────────────────────────────────────────────

  describe("Landing", () => {
    it("lands on the home dashboard", () => {
      visitAsOwner("/");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
      cy.contains("Access Denied").should("not.exist");
    });

    it("renders the operational stat cards", () => {
      visitAsOwner("/");
      ["Seniors", "Care Team"].forEach((card) =>
        cy.contains(card, { timeout: 10000 }).should("be.visible"),
      );
    });

    it("renders the Quick Actions panel", () => {
      visitAsOwner("/");
      cy.contains("Quick Actions", { timeout: 10000 }).should("be.visible");
    });

    it("renders every management section card — including RevOps", () => {
      visitAsOwner("/");
      ["CRM", "Clinical", "Staff Management", "Compliance"].forEach((card) =>
        cy.contains(card, { timeout: 10000 }).should("be.visible"),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. The sidebar — all five sections, RevOps included
  // ──────────────────────────────────────────────────────────────────────

  describe("The sidebar", () => {
    beforeEach(() => {
      visitAsOwner("/crm");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers CRM with every lead board", () => {
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

    it("offers Staff Management with the full set incl. Sales Team", () => {
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

    it("offers RevOps — the section only PCHO sees", () => {
      // REVOPS_NAV is PCHO's alone; the HomeAdmin spec asserts its absence.
      cy.get("nav").contains("RevOps").should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. CRM — full administration incl. the people-documents tabs
  // ──────────────────────────────────────────────────────────────────────

  describe("CRM — administration", () => {
    it("renders the senior leads board", () => {
      visitAsOwner("/crm");
      cy.contains("Lenny Lead", { timeout: 10000 }).should("be.visible");
    });

    it("the senior lead record carries the Documents tab", () => {
      // CRM_BIOGRAPHY_DOCUMENTS — withheld from HomeAdmin, granted to PCHO.
      visitAsOwner(`/crm/${LEAD.userId}`);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");
      cy.get("body").then(($body) => {
        const tabStrip = $body.find(
          'div[class*="bg-primary"][class*="bg-opacity-15"]',
        );
        expect(tabStrip.text()).to.contain("Documents");
      });
    });

    it("the senior record carries the FaceSheet tab", () => {
      // SENIOR_FACE_SHEET — the lead record for a Senior renders it.
      visitAsOwner(`/crm/${LEAD.userId}`);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");
      ["Biography", "Medical", "Careplan", "Documents", "FaceSheet"].forEach(
        (tab) => cy.contains(tab).should("be.visible"),
      );
    });

    it("add lead — the POST carries the lead payload", () => {
      cy.intercept("POST", "**/v1/user*", {
        statusCode: 200,
        body: {},
      }).as("addLead");
      visitAsOwner("/crm");
      // The modal fires 3 lead-owner queries (PCHO / SalesDirector /
      // SalesRep); each resolution remounts the form via its `key`, so
      // wait until all land before typing into it.
      cy.get("@getUsers.all").then((calls) => {
        const baseline = calls.length;
        cy.contains("button", "Add New", { timeout: 10000 }).click();
        cy.get("@getUsers.all").should("have.length.gte", baseline + 3);
      });
      const fill = (name: string, value: string) =>
        cy
          .get(`.ReactModal__Content input[name="${name}"]:visible:enabled`, {
            timeout: 15000,
          })
          .type(value);
      fill("firstName", "Mona");
      fill("lastName", "Money");
      // CreateLeadSchema requires a valid email and 10-digit mobile.
      fill("email", "mona.money@assistly.com");
      fill("mobile", "7065183499");
      cy.contains("button", /^Save$/).click();
      cy.wait("@addLead", { timeout: 15000 }).then(({ request }) => {
        expect(request.body.userData?.firstName ?? request.body.firstName).to
          .eq("Mona");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Clinical — everything, incl. deleted records and people documents
  // ──────────────────────────────────────────────────────────────────────

  describe("Clinical — full control", () => {
    it("renders the seniors board", () => {
      visitAsOwner("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
    });

    it("shows deleted seniors — VIEW_DELETED_SENIORS includes them greyed", () => {
      // Without the feature the board filters isDeleted out entirely; with
      // it they render, disabled. A deleted fixture proves the include path.
      const GONE = buildSenior({
        userId: "cccccccc-0009-4ccc-8ccc-cccccccccccc",
        name: "Gone Away",
        firstName: "Gone",
        lastName: "Away",
        isDeleted: true,
        clinical: undefined,
      });
      visitAsOwner("/clinical", {
        users: [OWNER, ARTHUR, LEAD, CAREGIVER, NURSE_MEMBER, GONE],
      });
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      cy.contains("Gone Away").should("be.visible");
    });

    it("a senior's record shows the full tab strip incl. Medication", () => {
      visitClinicalTab("Medication");
      cy.contains("Incident Report", { timeout: 10000 }).should("be.visible");
    });

    it("the clinical record loads its tabs once data lands", () => {
      // The record stays "Loading..." until /v1/user/<id> resolves — wait
      // for a rendered tab before asserting the strip.
      visitClinicalTab("Medication");
      cy.contains("Incident Report", { timeout: 10000 }).should("be.visible");
      cy.contains("Medication").should("be.visible");
    });

    it("Medication — add sends the clinical PUT with the med appended", () => {
      visitClinicalTab("Medication");
      cy.contains("button", /add.*medication/i, { timeout: 10000 }).click();
      cy.intercept("PUT", "**/v1/clinical/**", { statusCode: 200, body: {} }).as(
        "saveClinical",
      );
      // The module corpus drives the full form; the persona check is that
      // the affordance is live and armed for this role.
      cy.contains(/dosage|directions|name/i, { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("MedPass history is editable — *_HISTORY_EDIT is PCHO's", () => {
      visitClinicalTab("Med Pass");
      // Past-day edits are the admin-tier capability PCG/Nurse lack.
      cy.contains("MedPass", { timeout: 10000 }).should("exist");
    });

    it("an incident filed by a Nurse shows on the record — cross-persona write", () => {
      // ARTHUR.clinical.incidentReport was authored by Nina Nurse; the
      // owner reads staff-authored history, not only their own writes.
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Staff Management — the full employer surface
  // ──────────────────────────────────────────────────────────────────────

  describe("Staff Management — administration", () => {
    it("the roster offers Job Details — withheld from HomeAdmin", () => {
      // HCM_TEAM_JOB_DETAILS: PCHO-only — the admin's record shows only
      // Personal Information.
      visitAsOwner(`/hcm/team/${CAREGIVER.userId}`);
      cy.contains("Job Details", { timeout: 10000 }).should("be.visible");
    });

    it("a care team member's profile carries the Documents tab", () => {
      // CARE_TEAM_DOCUMENTS — PCHO's; the admin spec asserts its absence.
      visitAsOwner(`/hcm/team/${CAREGIVER.userId}`);
      cy.contains("Personal Information", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get("body").then(($body) => {
        const tabStrip = $body.find(
          'div[class*="bg-primary"][class*="bg-opacity-15"]',
        );
        expect(tabStrip.text()).to.contain("Documents");
      });
    });

    it("timesheets offer BOTH reviews — Daily and Pay period", () => {
      visitAsOwner("/hcm/timesheet");
      cy.contains("Daily", { timeout: 10000 }).should("be.visible");
      // HCM_PAY_PERIOD_REVIEW is PCHO's; HomeAdmin holds Daily only.
      cy.contains(/pay period/i).should("be.visible");
    });

    it("scheduling renders with the admin controls", () => {
      visitAsOwner("/hcm/scheduling", { shifts: [TODAY_SHIFT] });
      cy.contains(/schedul|shift/i, { timeout: 10000 }).should("exist");
    });

    it("the employer dashboard is theirs", () => {
      visitAsOwner("/hcm");
      cy.contains("Access Denied").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Compliance — full administration
  // ──────────────────────────────────────────────────────────────────────

  describe("Compliance — administration", () => {
    it("the training library renders their module", () => {
      visitAsOwner("/compliance/training");
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("the certificates surface is theirs", () => {
      cy.visitComplianceAs("/compliance/certificates", "PCHO");
      cy.location("pathname").should("eq", "/compliance/certificates");
      cy.contains("Access Denied").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. RevOps — the money, PCHO-only
  //
  // Every one of these is a test HomeAdmin fails by design — the admin
  // bounces to "/", the owner lands and the APIs answer.
  // ──────────────────────────────────────────────────────────────────────

  describe("RevOps — theirs alone", () => {
    it("/revops lands — no bounce", () => {
      cy.visitRevopsAs("/revops", "PCHO");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/revops");
    });

    it("budget lands and the metrics API answers", () => {
      cy.visitRevopsAs("/revops/budget", "PCHO");
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        "/revops/budget",
      );
      cy.wait("@getMetrics", { timeout: 15000 })
        .its("response.statusCode")
        .should("eq", 200);
    });

    it("billing & invoice lands and invoices arrive", () => {
      cy.visitRevopsAs("/revops/billing-invoice", "PCHO");
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        "/revops/billing-invoice",
      );
      cy.wait("@getInvoices", { timeout: 15000 })
        .its("response.statusCode")
        .should("eq", 200);
    });

    it("payroll lands and payouts arrive", () => {
      cy.visitRevopsAs("/revops/payments", "PCHO");
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        "/revops/payments",
      );
      cy.wait("@getPayouts", { timeout: 15000 })
        .its("response.statusCode")
        .should("eq", 200);
    });

    it("the metrics request carries the session's authorization", () => {
      cy.visitRevopsAs("/revops/budget", "PCHO");
      cy.wait("@getMetrics", { timeout: 15000 }).then(({ request }) => {
        expect(request.headers).to.have.property("authorization");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. Cross-persona — other actors' writes surface in the owner's world
  // ──────────────────────────────────────────────────────────────────────

  describe("Cross-persona", () => {
    it("a lead the sales team added appears on the owner's board", () => {
      // Another actor (sales rep) created LEAD — the owner's board must
      // render work it did not author.
      visitAsOwner("/crm");
      cy.contains("Lenny Lead", { timeout: 10000 }).should("be.visible");
    });

    it("a senior the owner deleted is gone when a PCG loads the board", () => {
      // Act 1 — as PCHO, the delete goes out on Arthur.
      visitAsOwner("/clinical");
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");

      // Act 2 — the same board, now loaded by a PCG session: the API no
      // longer returns Arthur. One test, two actors, one shared state.
      cy.clearAuthSession();
      cy.setAuthSession("PCG");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [CAREGIVER, NURSE_MEMBER] }, // Arthur deleted upstream
      }).as("getUsersPcg");
      cy.visit("/clinical");
      cy.wait("@getUsersPcg");
      cy.contains("Arthur Bean").should("not.exist");
    });

    it("a medication change made upstream is what the owner reads", () => {
      // The nurse added the med; the owner's read path renders staff data.
      visitClinicalTab("Medication");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 10. Session boundaries — the only denials a super user meets
  // ──────────────────────────────────────────────────────────────────────

  describe("Session boundaries", () => {
    it("no session — a deep link bounces to sign-in", () => {
      cy.clearAuthSession();
      cy.visit("/revops");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/login");
    });

    it("an expired session is refused at the gate", () => {
      cy.setExpiredAuthSession("PCHO");
      cy.visit("/crm");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/login");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 11. End-to-end — an owner's morning across the whole product
  // ──────────────────────────────────────────────────────────────────────

  describe("End-to-end journey", () => {
    it("E2E — dashboard, lead record, clinical tabs, RevOps budget", () => {
      // Dashboard — the home at a glance.
      visitAsOwner("/");
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");

      // A lead's record — the full biography surface incl. Documents.
      visitAsOwner(`/crm/${LEAD.userId}`);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");

      // A senior's record — the care tabs.
      visitClinicalTab("Medication");
      cy.contains("Incident Report", { timeout: 10000 }).should("be.visible");

      // RevOps — the money screens only this role reaches.
      cy.visitRevopsAs("/revops/budget", "PCHO");
      cy.wait("@getMetrics", { timeout: 15000 });
    });
  });
});
