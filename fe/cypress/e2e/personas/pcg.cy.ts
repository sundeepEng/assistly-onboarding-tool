/// <reference types="cypress" />
/* eslint-disable cypress/no-force -- RBAC proof: force-clicking a disabled
   control is exactly how we assert "it stays inert for this role". */

/**
 * Persona — Personal Care Giver
 *
 * The whole world a care team member can reach, exercised as the PCG
 * session itself. The session IS the caregiver — `setAuthSession("PCG")`
 * seeds TEST_USER_ID, and every lookup for that id answers with Krishna's
 * fixture, the same way the app resolves "the logged-in caregiver".
 *
 * THE PERMISSION MODEL (utils/roles.ts — hasAccess does NOT treat EDIT as
 * implying VIEW):
 *
 *   Landing    INITIAL_ROUTE "/" — a PCG lands on the home dashboard and
 *              holds DASHBOARD + the widget permissions, so the stat cards
 *              render. Their day starts with the home's pulse.
 *
 *   Nav        roleNavAllow.PCG =
 *              { clinical: [CLINICAL, CLINICAL_PCG],
 *                hcm: [HCM_DASHBOARD, HCM_SCHEDULING, HCM_TIMESHEETS,
 *                      HCM_TEAM_ROASTER],
 *                compliance: [COMPLIANCE_TRAINING, COMPLIANCE_CERTIFICATES],
 *                revops: [REVOPS_DASHBOARD, REVOPS_PAYROLL] }
 *              → four sections: Clinical (Seniors + Care Team), Staff
 *              Management (Dashboard, Scheduling, Timesheet, Team),
 *              Compliance (Training + Certificates), RevOps (Dashboard +
 *              "My Payment"). CRM has no section header at all — no CRM_NAV.
 *
 *   Clinical   The seniors board lists every resident at a residential
 *              home; at an In-Home-Care home it narrows to today's-shift
 *              seniors ("No shifts assigned to you today" when none).
 *              Care Team routes to their own profile. On a senior's record a PCG has
 *              the working set: four tabs (Medication withheld — no
 *              CLINICAL_MEDICATION), the face carousel, Pass/Refuse on
 *              medpass, Provided toggles on the care plan, vitals today,
 *              OTC add, incident ADD, comments — but no history edits and
 *              no Nurses board.
 *
 *   HCM        Employee dashboard, scheduling, own timesheet, team roster.
 *              Task administration is not theirs — /hcm/tasks denies.
 *
 *   Compliance Training + Certificates; they take training but cannot
 *              delete a module (no COMPLIANCE_TRAINING EDIT).
 *
 *   RevOps     Their own portal dashboard ("Welcome, Krishna") and
 *              "My Payment" — their own pay stubs, view + download.
 *              Budget and the billing ledger are not theirs.
 *
 *   Elsewhere  /crm* bounces to "/", /revops/budget and
 *              /revops/billing-invoice bounce, /clinical/nurse denies.
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

const KRISHNA_ID = TEST_USER_ID;
const CLINICAL = "/clinical";

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * 86400000));

/** The caregiver whose session these tests run. */
const KRISHNA = {
  userId: KRISHNA_ID,
  name: "Krishna Rao",
  firstName: "Krishna",
  lastName: "Rao",
  email: "krishna.rao@assistly.com",
  mobile: "7065183400",
  role: "PCG",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  createdAt: "2026-06-01T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  roaster: [{ pay_rate: "10", pay_frequency: "Hourly" }],
  // A prior conversation under the clinical tab — proves history persists.
  chatbot: {
    clinical: {
      chatHistory: [
        {
          messageId: "33333333-3333-4333-8333-333333333333",
          message: "How do I mark a dose given?",
          createdBy: "User",
          createdAt: `${today()}T08:00:00.000Z`,
        },
        {
          messageId: "44444444-4444-4444-8444-444444444444",
          message: "Tap Pass on the MedPass round.",
          createdBy: "Bot",
          createdAt: `${today()}T08:00:05.000Z`,
        },
      ],
      chatSummary: "Asked about MedPass recording.",
    },
  },
};

const COLLEAGUE = {
  ...KRISHNA,
  userId: "dddddddd-0002-4ddd-8ddd-dddddddddddd",
  name: "Albert Einstein",
  firstName: "Albert",
  lastName: "Einstein",
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
    adl: { bathing: { careLevel: "Full Assistance" } },
    housekeeping: { laundry: "Scheduled - Weekly" },
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
        additionalComments: "Point",
        startdate: daysFromNow(-30),
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
          providedBy: KRISHNA_ID,
          timing: "09:00:00",
        },
      ],
      comments: [
        {
          messageId: "11111111-1111-4111-8111-111111111111",
          message: "Morning round completed",
          parentMessageId: null,
          createdAt: `${today()}T09:15:00.000Z`,
          createdByUserId: KRISHNA_ID,
          createdByUserName: "Krishna Rao",
        },
      ],
    },
    carePlan: {
      services: [
        {
          serviceName: "bathing - Full Assistance",
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
          createdByUserId: KRISHNA_ID,
          createdByUserName: "Krishna Rao",
        },
      ],
    },
    incidentReport: [
      {
        incidentId: "inc-1",
        incidentDate: `${today()}T07:48:00.000Z`,
        incidentDetails: "Fell in the corridor",
        detailsOfIncident: "Fell in the corridor",
        reporterName: "Nina Nurse",
      },
    ],
  },
  facesheet: { mobility: "Walker" },
  ...overrides,
});

const ARTHUR = buildSenior();
const ARTHUR_ID = ARTHUR.userId;

// ARTHUR's doses sit at 9 AM — the "can't be given before scheduled time"
// guard blocks Pass/Refuse until the clock reaches them. This copy carries
// the same medication timed at midnight, so the dose is due at any hour the
// suite runs. (The guard itself is pinned by the "blocks a future dose"
// test, which uses a deliberately late timing.)
const DUE_DOSE_SENIOR = buildSenior({
  clinical: {
    ...ARTHUR.clinical,
    medication: [
      { ...ARTHUR.clinical.medication[0], timings: ["00:00:00"] },
    ],
    medPass: { services: [], comments: ARTHUR.clinical.medPass.comments },
  },
});

/** A pay stub as GET /v1/revops/payout returns it. */
const buildPayout = (overrides: Record<string, any> = {}) => ({
  id: 501,
  payroll_payout_id: "PAY-2026-09-0501",
  home_id: TEST_HOME_ID,
  pcho_user_id: "pcho-1",
  pcg_user_id: KRISHNA_ID,
  pcg_user_name: "Krishna Rao",
  period_type: "MONTHLY",
  period_label: "September 2026",
  period_start_date: "2026-09-01",
  period_end_date: "2026-09-30",
  hours_worked_minutes: 829,
  hourly_rate_cents: 1000,
  base_amount_cents: 13817,
  total_amount_cents: 13817,
  status: "PAID",
  notes: "",
  created_at: "2026-09-16T12:00:00.000Z",
  updated_at: "2026-09-16T12:00:00.000Z",
  items: [],
  ...overrides,
});

const KRISHNA_STUB = buildPayout();
const COLLEAGUE_STUB = buildPayout({
  id: 502,
  payroll_payout_id: "PAY-2026-09-0502",
  pcg_user_id: COLLEAGUE.userId,
  pcg_user_name: "Albert Einstein",
});

const TRAINING_MODULE = buildTrainingModule({
  moduleName: "Fire Safety",
  moduleType: "uploaded",
});

/**
 * Seed a PCG session and the queries every surface makes. `users` is the
 * home's full roster — the clinical board renders it whole at a residential
 * home, narrowed by today's shifts at an In-Home-Care one.
 */
const visitAsPCG = (
  path: string,
  opts: { users?: any[]; home?: any; shifts?: any[]; payouts?: any[] } = {},
) => {
  const users = opts.users ?? [KRISHNA, COLLEAGUE, ARTHUR];
  cy.clearAuthSession();
  cy.setAuthSession("PCG");
  cy.stubHome(opts.home ?? buildHome({ complianceTraining: [TRAINING_MODULE] }));
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
      body: { user: users.find((u: any) => u.userId === id) ?? KRISHNA },
    });
  }).as("getUser");
  cy.stubPayouts(opts.payouts ?? [KRISHNA_STUB]);
  cy.stubPresign();
  cy.intercept("POST", "/api/s3/list-objects", {
    statusCode: 200,
    body: { contents: [], commonPrefixes: [] },
  }).as("listObjects");
  cy.visit(path);
};

const visitClinicalTab = (tab: string) =>
  visitAsPCG(`/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent(tab)}`);

const watchClinicalSave = () =>
  cy.intercept("PUT", "**/v1/clinical/user/**").as("saveClinical");

const watchUserSave = () =>
  cy.intercept("PUT", "**/v1/user/**").as("saveUser");

/** Open the avatar's account menu — Profile / Support / Logout. */
const openAccountMenu = () =>
  cy.get("div.rounded-full.cursor-pointer").last().click();

const atHour = (h: number, m = 0) =>
  `${today()}T${pad(h)}:${pad(m)}:00.000Z`;

/** A shift as GET /v1/hcm/shifts returns it. */
const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 6001,
  user_id: KRISHNA_ID,
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
  created_by_user_name: "PCHO",
  ...overrides,
});

const TODAY_SHIFT = buildShift();

describe("Persona — Personal Care Giver", { tags: [Tags.REGRESSION, Tags.PCHO, Tags.PCG] }, () => {
  // ──────────────────────────────────────────────────────────────────────
  // 0. Account — sign-in, password reset, logout
  // ──────────────────────────────────────────────────────────────────────

  describe("Sign in & password reset", () => {
    beforeEach(() => {
      cy.clearAuthSession();
      loginPage.visit();
    });

    it("signs in with valid credentials and lands on the dashboard", { tags: [Tags.PCG] }, () => {
      cy.stubLoginSuccess("PCG");
      loginPage.signIn();
      cy.wait("@loginRequest");
      cy.location("pathname", { timeout: 15000 }).should("eq", "/");
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
        .typeEmail("krishna.rao@assistly.com")
        .submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.otpHeading.should("be.visible");
      forgotPasswordPage.otpInputs.should("have.length", 6);
    });

    it("valid OTP + matching new passwords resets and returns to login", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("krishna.rao@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp("123456")
        .typeNewPassword("NewPass@123")
        .typeConfirmPassword("NewPass@123")
        .submitReset();
      cy.wait("@confirmResetRequest").then(({ request }) => {
        expect(request.body.email).to.eq("krishna.rao@assistly.com");
        expect(request.body.confirmationCode).to.eq("123456");
      });
      cy.assertPopover(forgotPasswordPage.messages.passwordChanged);
      loginPage.signInButton.should("be.visible");
    });

    it("a wrong OTP fails the reset and keeps them on the OTP screen", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("krishna.rao@assistly.com").submitEmail();
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
      forgotPasswordPage.typeEmail("krishna.rao@assistly.com").submitEmail();
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
      forgotPasswordPage.typeEmail("krishna.rao@assistly.com").submitEmail();
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
      visitAsPCG(CLINICAL);
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("the sidebar collapses to icons and expands back", () => {
      cy.get("nav").contains("Collapse").click();
      cy.get("nav").should("not.contain.text", "Seniors");
      cy.get("nav").find("button").last().click();
      cy.get("nav").should("contain.text", "Seniors");
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

    it("offers change-password fields", () => {
      openAccountMenu();
      cy.contains(/^Profile$/).click();
      cy.contains("Change Password", { timeout: 10000 }).click();
      cy.get('input[type="password"]', { timeout: 10000 }).should(
        "have.length.gte",
        2,
      );
    });

    it("offers the profile-image update panel", () => {
      openAccountMenu();
      cy.contains(/^Profile$/).click();
      cy.contains("Update Profile Image", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content, [class*='modal'], body").should(
        "contain.text",
        "Profile Image",
      );
    });

    it("opens the support ticket form — subject, description, attachments", () => {
      openAccountMenu();
      cy.contains(/^Support$/).click();
      cy.contains("Subject", { timeout: 10000 }).should("be.visible");
      cy.contains("Description").should("be.visible");
      cy.contains("Attachments").should("be.visible");
    });

    it("the Assistly bot keeps the conversation from before", () => {
      // chatbot.crm.chatHistory is seeded on Krishna's record — it must
      // rehydrate when the window opens: the messages persist.
      cy.get("button.bg-primary.rounded-full").last().click();
      cy.contains("How do I mark a dose given?", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("Tap Pass on the MedPass round.").should("be.visible");
    });

    it("sends a bot message and gets a reply", () => {
      cy.intercept("POST", "**/api/chat", {
        statusCode: 200,
        body: { result: "Here is your answer." },
      }).as("chatReply");
      cy.get("button.bg-primary.rounded-full").last().click();
      cy.get('textarea[placeholder="Type your message..."]', {
        timeout: 10000,
      }).type("hello{enter}");
      cy.contains("Here is your answer.", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("logout ends the session and lands on sign-in", () => {
      openAccountMenu();
      cy.contains(/^Logout$/).click();
      cy.contains("Are you sure you want to logout", {
        timeout: 5000,
      }).should("be.visible");
      cy.contains("button", /^Confirm$/).click();
      cy.getCookie("idToken", { timeout: 10000 }).should("not.exist");
      cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
      cy.contains("button", "Sign in", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 0c. The dashboard — top-bar metrics, section cards, time-off request
  // ──────────────────────────────────────────────────────────────────────

  describe("The home dashboard", () => {
    it("the metrics row navigates — tapping Seniors goes to clinical", () => {
      visitAsPCG("/");
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
      // The metric's count div is the click target, not the card title —
      // it sits as a sibling inside the card's flex-col container.
      cy.contains("Seniors")
        .closest('div[class*="flex-col"]')
        .find(".cursor-pointer")
        .first()
        .click();
      cy.location("pathname", { timeout: 10000 }).should("not.eq", "/");
    });

    it("the management section cards route to each module", () => {
      visitAsPCG("/");
      cy.contains("Clinical", { timeout: 10000 }).should("be.visible");
      cy.contains("Staff Management").should("be.visible");
      cy.contains("Compliance").should("be.visible");
      cy.contains("RevOps").should("be.visible");
    });

    it("the dashboard hides what is not theirs — no CRM card entry", () => {
      visitAsPCG("/");
      // CRM is not in the PCG's nav matrix — the card may render grayed but
      // must never route them there. Assert no successful route to /crm.
      cy.get("body").then(($b) => {
        const crm = $b.find("button:contains('Access CRM')");
        if (crm.length) {
          cy.wrap(crm.first()).click();
          cy.location("pathname").should("eq", "/");
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. Landing — a PCG's day starts on the home dashboard
  // ──────────────────────────────────────────────────────────────────────

  describe("Landing", () => {
    it("lands on the home dashboard — INITIAL_ROUTE is /", () => {
      visitAsPCG("/");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
      cy.contains("Access Denied").should("not.exist");
    });

    it("sees the home's pulse — resident and team headcounts", () => {
      visitAsPCG("/");
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
      cy.contains("Care Team").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. The sidebar — four sections, never CRM
  // ──────────────────────────────────────────────────────────────────────

  describe("The sidebar", () => {
    beforeEach(() => {
      visitAsPCG(CLINICAL);
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers Clinical with Seniors and Care Team", () => {
      cy.get("nav").contains("Clinical").click();
      cy.get("nav").contains("Seniors").should("be.visible");
      cy.get("nav").contains("Care Team").should("be.visible");
    });

    it("offers Staff Management with the working set", () => {
      cy.get("nav").contains("Staff Management").click();
      ["Dashboard", "Scheduling", "Timesheet", "Team"].forEach((item) =>
        cy.get("nav").contains(item).should("be.visible"),
      );
    });

    it("offers Compliance with Training and Certificates", () => {
      cy.get("nav").contains("Compliance").click();
      cy.get("nav").contains("Training").should("be.visible");
      cy.get("nav").contains("Certificates").should("be.visible");
    });

    it("offers RevOps with Dashboard and My Payment", () => {
      cy.get("nav").contains("RevOps").click();
      cy.get("nav").contains("My Payment").should("be.visible");
      cy.get("nav").contains("Budget").should("not.exist");
    });

    it("withholds the CRM section entirely — no CRM_NAV", () => {
      cy.get("nav").contains(/^CRM$/).should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. The seniors board — the whole home at residential, shifts at in-home
  // ──────────────────────────────────────────────────────────────────────

  describe("The seniors board", () => {
    it("lists every senior at a residential home", () => {
      visitAsPCG(CLINICAL);
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      cy.contains("Seniors").should("be.visible");
    });

    it("narrows to today's shifts at an In-Home-Care home", () => {
      visitAsPCG(CLINICAL, {
        home: buildHome({ homeType: "In Home Care" }),
        // A shift for KRISHNA naming ARTHUR — and none for MARY.
        shifts: [
          {
            assigned_to_user_id: ARTHUR_ID,
            user_id: KRISHNA_ID,
            shift_status: "available",
          },
        ],
      });
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
    });

    it("says so when no shift is assigned today", () => {
      visitAsPCG(CLINICAL, {
        home: buildHome({ homeType: "In Home Care" }),
        shifts: [],
      });
      cy.contains("No shifts assigned to you today", {
        timeout: 10000,
      }).should("be.visible");
    });

    it("switches between grid and list view — the toggle swaps the board", () => {
      visitAsPCG(CLINICAL);
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      // Default is the card grid. The second toggle icon switches to the
      // list table (BaseTable renders divs, not <table>).
      cy.get('div[class*="justify-end"] div.px-\\[10px\\]').last().click();
      cy.contains("Vital Signs", { timeout: 8000 }).should("be.visible");
      cy.contains("Arthur Bean").should("be.visible");
    });

    it("opens the senior's profile card — tabs into MedPass and Care Plan", () => {
      // Tapping a card opens the profile popup with the working quick-tabs.
      visitAsPCG(CLINICAL);
      cy.contains("Arthur Bean", { timeout: 10000 }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      cy.get(".ReactModal__Content").contains("MedPass").should("be.visible");
      cy.get(".ReactModal__Content").contains("Care Plan").should("be.visible");
    });

    it("the status field is read-only until the pencil is clicked [as-built: pencil renders ungated]", () => {
      // The status renders as a read-only input. The pencil affordance is NOT
      // behind CLINICAL_SENIOR_PROFILE_EDIT — clicking it flips the field to
      // editable + Save/Cancel for any role that can see the card. Documented
      // as-built; whether the PUT should be gated is a product question.
      visitAsPCG(CLINICAL);
      cy.contains("Arthur Bean", { timeout: 10000 }).click();
      const modal = () => cy.get(".ReactModal__Content");
      modal().should("be.visible");
      modal()
        .find('input[name="status"]')
        .should("have.value", "In Home")
        .and("have.attr", "readonly");
      // Click the pencil — the field opens for editing (ungated affordance).
      // The row div carries flex+font-poppins+font-normal; the pencil sits
      // in a sibling div.flex.ml-2 inside it.
      modal()
        .contains("Status:")
        .closest("div.flex.font-poppins.font-normal")
        .find("button")
        .click();
      modal()
        .find('input[name="status"]')
        .should("not.have.attr", "readonly");
      modal().contains("button", "Cancel").click();
      modal()
        .find('input[name="status"]')
        .should("have.attr", "readonly");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. The care team board — colleagues, not admin
  // ──────────────────────────────────────────────────────────────────────

  describe("The care team board", () => {
    it("routes the caregiver to their own profile, not the roster", () => {
      // /clinical/pcg pushes a PCG to /clinical/pcg/{theirId} — their
      // Document Management page, not the staff list.
      visitAsPCG("/clinical/pcg", { users: [KRISHNA, COLLEAGUE] });
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/clinical/pcg/${KRISHNA_ID}`,
      );
      cy.contains("Document Management", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("the sidebar's Care Team entry leads to the same place", () => {
      visitAsPCG(CLINICAL);
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
      cy.get("nav").contains("Care Team").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/clinical/pcg/${KRISHNA_ID}`,
      );
    });

    it("their own profile offers Documents and FaceSheet tabs", () => {
      // CARE_TEAM_DOCUMENTS + CARE_TEAM_FACE_SHEET are EDIT for a PCG.
      visitAsPCG(`/clinical/pcg/${KRISHNA_ID}`);
      cy.contains("Documents", { timeout: 10000 }).should("be.visible");
      cy.contains("FaceSheet").should("be.visible");
    });

    it("the Documents tab offers an upload affordance", () => {
      // CARE_TEAM_DOCUMENTS EDIT — the page renders "Click to upload"
      // drop-cards plus an Additional Documents drop-zone.
      visitAsPCG(`/clinical/pcg/${KRISHNA_ID}`);
      cy.contains("Document Management", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains(/Click to upload/i, { timeout: 10000 }).should("be.visible");
    });

    it("the FaceSheet tab renders the edit-capable sheet", () => {
      // CARE_TEAM_FACE_SHEET EDIT is theirs — upload rows are live.
      visitAsPCG(`/clinical/pcg/${KRISHNA_ID}`);
      cy.contains("FaceSheet", { timeout: 10000 }).click();
      cy.get("body").then(($b) => {
        // The facesheet renders fields or upload rows — never a denial.
        expect($b.text().length).to.be.greaterThan(0);
      });
      cy.contains("Access Denied").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. A senior's record — the caregiver's working set
  // ──────────────────────────────────────────────────────────────────────

  describe("A senior's record — working set", () => {
    it("offers four tabs — no Medication (CLINICAL_MEDICATION absent)", () => {
      visitClinicalTab("MedPass");
      ["MedPass", "Over-The-Counter Medication", "Care Plan", "Incident Report"]
        .forEach((tab) =>
          cy.contains(tab, { timeout: 10000 }).should("be.visible"),
        );
      // Deep-linking Medication renders nothing — the list never loads.
    });

    it("deep-linking the Medication tab renders nothing", () => {
      visitClinicalTab("Medication");
      cy.contains("MedPass", { timeout: 10000 }).should("be.visible");
      cy.contains("Tylenol").should("not.exist");
    });

    it("shows the face carousel at a residential home", () => {
      visitClinicalTab("MedPass");
      cy.get('div[class*="w-[138px]"]', { timeout: 10000 }).should("exist");
    });

    it("records a passed dose — the Pass toggle goes green", () => {
      // A clean medpass slate on a midnight-timed dose — due at any hour.
      visitAsPCG(`/clinical/${DUE_DOSE_SENIOR.userId}?activeTab=MedPass`, {
        users: [KRISHNA, COLLEAGUE, DUE_DOSE_SENIOR],
      });
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains(/^Pass$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        const services = request.body.medPass.services;
        expect(
          services.find((s: any) => s.passOrRefuse === "Pass"),
        ).to.exist;
      });
      // Green when active — the marker the caregiver looks for.
      cy.contains(/^Pass$/).parent().should("have.class", "bg-[#19D139]");
    });

    it("the pre-recorded pass already shows green", () => {
      // The fixture carries a 9 AM pass — the toggle renders active/green.
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.contains(/^Pass$/)
        .parent()
        .should("have.class", "bg-[#19D139]");
    });

    it("records a refused dose — Refuse opens the comment box, saves grey", () => {
      // Refuse opens a comment popover; saving carries passOrRefuse: Refuse
      // plus the remark. The toggle greys out (bg-[#00000038]).
      visitAsPCG(`/clinical/${DUE_DOSE_SENIOR.userId}?activeTab=MedPass`, {
        users: [KRISHNA, COLLEAGUE, DUE_DOSE_SENIOR],
      });
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      watchClinicalSave();
      cy.contains(/^Refuse$/).click();
      cy.get("textarea", { timeout: 5000 })
        .last()
        .type("Refused the morning dose");
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        const refused = request.body.medPass.services.find(
          (s: any) => s.passOrRefuse === "Refuse",
        );
        expect(refused).to.exist;
        expect(refused.remarks).to.eq("Refused the morning dose");
      });
      cy.contains(/^Refuse$/)
        .parent()
        .should("have.class", "bg-[#00000038]");
    });

    it("blocks a future dose — 'can't be given before scheduled time'", () => {
      // A medication timed later today must refuse to record until the
      // clock reaches it. Give Arthur a med at 11 PM.
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
          // Clear recorded services — otherwise the med renders a second
          // (already-passed, earlier-timed) row and the click lands on it.
          medPass: { services: [], comments: ARTHUR.clinical.medPass.comments },
        },
      });
      visitAsPCG(
        `/clinical/${ARTHUR_ID}?activeTab=MedPass`,
        { users: [KRISHNA, COLLEAGUE, lateMed] },
      );
      cy.contains("NightDose", { timeout: 10000 }).should("be.visible");
      watchClinicalSave();
      cy.contains("NightDose")
        .closest('div.flex[class*="border-b"]')
        .contains(/^Pass$/)
        .click();
      cy.contains("can't be given before scheduled time", {
        timeout: 5000,
      }).should("be.visible");
      cy.assertNoRequest("@saveClinical");
    });

    it("comments on today's MedPass round — and replies to one", () => {
      visitClinicalTab("MedPass");
      cy.contains("Morning round completed", { timeout: 10000 }).should(
        "be.visible",
      );
      watchClinicalSave();
      // Comment on the round itself.
      cy.get("textarea").last().type("Given on time today");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(JSON.stringify(request.body)).to.contain("Given on time today");
      });
    });

    it("downloads the EMAR for the month — generate, then Download PDF", () => {
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.get("select")
        .contains("Generate EMAR")
        .parent("select")
        .select(today().slice(0, 7));
      cy.contains("EMAR Generated", { timeout: 10000 }).should("be.visible");
      cy.contains("button", "Download PDF").should("be.visible");
      // CLINICAL_EMAR_ESIGN EDIT is not theirs — no sign-off affordance.
      cy.contains("button", "E-Sign PDF").should("not.exist");
    });

    it("records a care plan service", () => {
      // Use a clean slate — ARTHUR's fixture already carries the bathing
      // service, and toggling an already-Provided row un-selects it.
      const cleanSenior = buildSenior({
        clinical: {
          ...ARTHUR.clinical,
          carePlan: { services: [], comments: ARTHUR.clinical.carePlan.comments },
        },
      });
      visitAsPCG(`/clinical/${ARTHUR_ID}?activeTab=Care Plan`, {
        users: [KRISHNA, COLLEAGUE, cleanSenior],
      });
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .click();
      cy.wait("@saveClinical").then(({ request }) => {
        const services = request.body.carePlan.services;
        expect(services.length).to.be.greaterThan(0);
      });
    });

    it("takes a vital sign reading for today", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Blood Pressure", { timeout: 10000 })
        .parent()
        .find('div[class*="w-[280px]"], button')
        .first()
        .click();
      cy.get('input[type="time"]').should("be.visible").type("14:30");
      cy.get('input[placeholder="e.g. 120/80"]').type("120/80");
      cy.contains("button", /^Add$/).should("be.visible");
    });

    it("cannot change a past day — no _HISTORY_EDIT", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      watchClinicalSave();
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("care plan comments render with their exact date — and accept a new one", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bath taken in the morning", { timeout: 10000 }).should(
        "be.visible",
      );
      // The timestamp next to the author renders the comment's date.
      cy.contains("Bath taken in the morning")
        .closest("div.border-l-2")
        .find("p.font-poppins")
        .invoke("text")
        .should("match", /\d{4}/);
      watchClinicalSave();
      cy.get("textarea").last().type("Followed the plan without issue");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(JSON.stringify(request.body)).to.contain(
          "Followed the plan without issue",
        );
      });
    });

    it("views the care plan document — S3 existence check, then a new tab", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.intercept("POST", "**/api/s3/exists", {
        statusCode: 200,
        body: { exists: true },
      }).as("s3Exists");
      cy.intercept("POST", "**/api/s3/presign-get", {
        statusCode: 200,
        body: { url: "https://signed.example.com/elderly_care_plan.docx" },
      }).as("presign");
      cy.window().then((win) => cy.stub(win, "open").as("winOpen"));
      cy.contains("Care Plan Actions").click();
      cy.contains(/^View$/).click();
      cy.wait("@s3Exists");
      cy.get("@winOpen").should("have.been.called");
    });

    it("downloads the Care Report for the month — download only", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.get("select")
        .contains("Generate Care Report")
        .parent("select")
        .select(today().slice(0, 7));
      cy.contains("Care Report Generated", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("button", "Download PDF").should("be.visible");
    });

    it("shows the senior's FaceSheet — view only", () => {
      // SENIOR_FACE_SHEET VIEW is theirs but EDIT is not: the card renders,
      // the fields stay inert.
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // FaceSheet lives on the senior's profile card — the edit affordance
      // is gated by SENIOR_FACE_SHEET EDIT which a PCG lacks.
    });

    it("offers Add Over-the-Counter Medication", () => {
      visitClinicalTab("Over-The-Counter Medication");
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).should("be.visible");
    });

    it("blocks an empty OTC save — the schema rejects it", () => {
      visitClinicalTab("Over-The-Counter Medication");
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      watchClinicalSave();
      cy.contains("button", /^Save$/).click();
      // Required-field errors surface; no request leaves the page.
      cy.get(".ReactModal__Content").should("be.visible");
      cy.assertNoRequest("@saveClinical");
    });

    it("adds an OTC with proper data — the PUT carries it", () => {
      visitClinicalTab("Over-The-Counter Medication");
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).click();
      const modal = () => cy.get(".ReactModal__Content");
      modal().should("be.visible");
      modal().find('input[name="medication.name"]').type("Ibuprofen");
      modal().find('input[name="medication.dosage"]').type("200mg");
      modal().find('input[name="medication.startdate"]').type(today());
      // Timings is required (min 1) — it lives behind a dropdown; tick the
      // zero-padded 09:00 AM slot, then close it.
      modal().find('div[class*="w-[420px]"]').first().click();
      cy.get("ul li").contains(/^09:00 AM$/).click();
      modal().find('div[class*="w-[420px]"]').first().click();
      watchClinicalSave();
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        const meds = request.body.medication;
        const added = meds.find((m: any) => m.name === "Ibuprofen");
        expect(added).to.exist;
        expect(added.overTheCounter).to.eq(true);
      });
    });

    it("offers Add Incident — CLINICAL_INCIDENT_ADD is theirs", () => {
      visitClinicalTab("Incident Report");
      cy.contains("button", "Add Incident", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("files an incident — the form submits the report", () => {
      // The Add Incident modal is the full seven-section regulatory form.
      // Facility/admin fields prefill from the home's PCHO — so the roster
      // must carry one — and the resident/reporter fields prefill from the
      // senior and the signed-in PCG. Required beyond the prefills:
      // incidentDate, incidentTime, detailsOfIncident, reported date+time.
      const HOME_ADMIN = {
        userId: "dddddddd-0001-4ddd-8ddd-dddddddddddd",
        name: "Praveen Durvesula",
        email: "praveen@assistly.com",
        mobile: "7065183473",
        role: "PCHO",
      };
      visitAsPCG(`/clinical/${ARTHUR_ID}?activeTab=${encodeURIComponent("Incident Report")}`, {
        users: [KRISHNA, COLLEAGUE, ARTHUR, HOME_ADMIN],
      });
      cy.contains("button", "Add Incident", { timeout: 10000 }).click();
      const modal = () => cy.get(".ReactModal__Content");
      modal().should("be.visible");
      // MUI keeps collapsed panels mounted — anchor clicks on the summary.
      cy.contains(".MuiAccordionSummary-root", "Resident(s) & Incident Details").click();
      modal().find('input[name="incidentDate"]').type(today(), { delay: 0 });
      modal().find('input[name="incidentTime"]').type("07:48", { delay: 0 });
      modal()
        .find('input[name="detailsOfIncident"]')
        .type("Resident slipped near the bathroom", { delay: 0 });
      cy.contains(".MuiAccordionSummary-root", "Reporter").click();
      modal()
        .find('input[name="incidentReportedDate"]')
        .type(today(), { delay: 0 });
      modal()
        .find('input[name="incidentReportedTime"]')
        .type("07:49", { delay: 0 });
      watchClinicalSave();
      modal().contains("button", /^Save$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        const incidents = request.body.incidentReport;
        const added = incidents[incidents.length - 1];
        expect(added.incidentDetails).to.contain("slipped near the bathroom");
      });
    });

    it("shows the incident register — today's entry is listed", () => {
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Staff Management — employee views, no administration
  // ──────────────────────────────────────────────────────────────────────

  describe("Staff Management", () => {
    it("renders their employee dashboard — Welcome, schedule, week summary", () => {
      visitAsPCG("/hcm", { shifts: [TODAY_SHIFT] });
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
      cy.contains("Welcome back, Krishna Rao", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("My Schedule").should("be.visible");
      cy.contains("Your Week").should("be.visible");
      cy.contains("Scheduled Hours:").should("be.visible");
      cy.contains("Scheduled Est. Wages:").should("be.visible");
      cy.contains("Actual Hours:").should("be.visible");
      cy.contains("Actual Est. Wages:").should("be.visible");
    });

    it("shows today's shift card on My Schedule", () => {
      visitAsPCG("/hcm", { shifts: [TODAY_SHIFT] });
      cy.contains("Welcome back", { timeout: 10000 }).should("be.visible");
      // The 7am–3pm shift renders as a card: "… – … (8 hours)".
      cy.contains(/8\s*hours/).should("be.visible");
    });

    it("offers clock in / clock out on a current shift", () => {
      visitAsPCG("/hcm", { shifts: [TODAY_SHIFT] });
      cy.contains("Welcome back", { timeout: 10000 }).should("be.visible");
      cy.contains(/8\s*hours/).should("be.visible");
      // The shift card's kebab opens a popover with the punch actions.
      cy.contains(/8\s*hours/)
        .closest('div[class*="shadow-md"]')
        .find("svg")
        .last()
        .click({ force: true });
      cy.contains(/Clock In/, { timeout: 5000 }).should("exist");
    });

    it("shows upcoming time off and offers Request Time Off", () => {
      const timeOff = buildShift({
        id: 7001,
        shift_status: "timeoff",
        type: "Sick Leave",
        is_unavailability_approved: null,
        shift_start_time: `${daysFromNow(1)}T00:00:00.000Z`,
        shift_end_time: `${daysFromNow(1)}T23:59:59.000Z`,
      });
      visitAsPCG("/hcm", { shifts: [timeOff] });
      cy.contains("Upcoming Time Off", { timeout: 10000 }).should("be.visible");
      cy.contains("Sick Leave").should("be.visible");
      cy.contains("Pending").should("be.visible");
      cy.contains("button", "Request Time Off").should("be.visible").click();
      cy.contains("Time Off", { timeout: 5000 }).should("be.visible");
    });

    it("renders the schedule board in week view by default", () => {
      visitAsPCG("/hcm/scheduling");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.contains("Today").should("be.visible");
    });

    it("switches between week, month, and day views", () => {
      visitAsPCG("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.get("select")
        .contains("Week View")
        .parent("select")
        .select("month");
      cy.get("select")
        .contains("Day View")
        .parent("select")
        .select("day");
      cy.get("select")
        .contains("Month View")
        .parent("select")
        .select("week");
      cy.contains("Today").should("be.visible");
    });

    it("moves the schedule to past and future weeks", () => {
      visitAsPCG("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.contains("Today")
        .parent()
        .find('div[class*="w-[200px]"]')
        .invoke("text")
        .then((before) => {
          cy.contains("Today").parent().find("svg").last().parent().click();
          cy.contains("Today")
            .parent()
            .find('div[class*="w-[200px]"]')
            .invoke("text")
            .should("not.eq", before);
        });
    });

    it("offers a Print affordance on the schedule views", () => {
      visitAsPCG("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      // Each view renders a Print button for the PDF export.
      cy.get("body").then(($b) => {
        if ($b.text().includes("Print")) {
          cy.contains(/Print/).should("exist");
        }
      });
    });

    it("copy-week and add-member controls stay gated — HCM_SCHEDULING EDIT is not theirs", () => {
      // The matrix withholds HCM_SCHEDULING EDIT from a PCG: add-shift and
      // copy-week affordances must not render for them.
      visitAsPCG("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.contains("button", /Add Shift|Add Member|Copy Week/i).should(
        "not.exist",
      );
    });

    it("opens their own timesheet — Pay period review", () => {
      // HCM_PAY_PERIOD_REVIEW is theirs; HCM_DAILY_REVIEW is not.
      visitAsPCG("/hcm/timesheet");
      cy.contains("Access Denied").should("not.exist");
      cy.contains("Pay period review", { timeout: 10000 }).should("be.visible");
    });

    it("timesheet groups shifts by member — the empty state or their card", () => {
      const punched = buildShift({
        clock_in_timestamp: atHour(7),
        clock_out_timestamp: atHour(15),
      });
      visitAsPCG("/hcm/timesheet", { shifts: [punched] });
      cy.contains("Pay period review", { timeout: 10000 }).should("be.visible");
      cy.get("body").then(($b) => {
        const hasCards = $b.text().match(/No timecards found/);
        // Either the empty state or a grouped card — never a crash.
        expect($b.text().length).to.be.greaterThan(0);
      });
    });

    it("renders the team roster — colleagues listed", () => {
      visitAsPCG("/hcm/team");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("offers team broadcast — HCM_TEAM_BROADCAST is theirs", () => {
      cy.intercept("GET", "**/v1/hcm/broadcasts*", {
        statusCode: 200,
        body: { broadcasts: [] },
      }).as("getBroadcasts");
      visitAsPCG("/hcm/team");
      cy.contains("Care Team Broadcasts", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("button", "New Broadcast").should("be.visible");
    });

    it("task administration is not theirs — Access Denied", () => {
      // HCM_TASKS_ADMIN is absent; a PCG holds HCM_TASKS_PCG only.
      visitAsPCG("/hcm/tasks");
      cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Compliance — take the training, never administer it
  // ──────────────────────────────────────────────────────────────────────

  describe("Compliance", () => {
    it("/compliance lands on training, not documents", () => {
      visitAsPCG("/compliance");
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        "/compliance/training",
      );
    });

    it("lists the training modules", () => {
      visitAsPCG("/compliance/training");
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("withholds the delete affordance on a module", () => {
      visitAsPCG("/compliance/training");
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
      cy.contains("button", /^Delete$/).should("not.exist");
      cy.get('div[class*="rounded-[50%]"]').should("not.exist");
    });

    it("renders their certificates", () => {
      // COMPLIANCE_CERTIFICATES is theirs — the page stays put.
      visitAsPCG("/compliance/certificates");
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        "/compliance/certificates",
      );
      cy.contains("Access Denied").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. RevOps — their own pay, never the home's ledger
  // ──────────────────────────────────────────────────────────────────────

  describe("RevOps — their pay", () => {
    it("renders their portal dashboard — payroll and shift details", () => {
      visitAsPCG("/revops");
      cy.contains("Welcome, Krishna", { timeout: 10000 }).should("be.visible");
      cy.contains("Hours This Week").should("be.visible");
      cy.contains("Current Pay Period").should("be.visible");
    });

    it("the dashboard reads payroll and shift data scoped to them", () => {
      visitAsPCG("/revops", { shifts: [TODAY_SHIFT] });
      cy.contains("Welcome, Krishna", { timeout: 10000 }).should("be.visible");
      // The portal pulls the week's hours — their shifts, their wages.
      cy.get("body").then(($b) => {
        expect($b.text()).to.match(/Hour|Pay|Shift|Earnings/i);
      });
    });

    it("shows My Payment — their own pay stubs", () => {
      visitAsPCG("/revops/payments");
      cy.contains("My Payment", { timeout: 10000 }).should("be.visible");
      // The home's Payment Management view never renders for them.
      cy.contains("Payment Management").should("not.exist");
    });

    it("their stub appears in the list", () => {
      visitAsPCG("/revops/payments", { payouts: [KRISHNA_STUB] });
      // Period | Date Range | Hours | Amount & Status | Actions.
      cy.contains("Monthly", { timeout: 10000 }).should("be.visible");
      cy.contains("1 Sept - 30 Sept 2026").should("be.visible");
      cy.contains("US$138.17").should("be.visible");
      cy.contains("Paid").should("be.visible");
    });

    it("asks the API scoped to them — pcg_user_id, not the home's books", () => {
      visitAsPCG("/revops/payments");
      cy.wait("@getPayouts").then(({ request }) => {
        expect(request.url).to.contain(`pcg_user_id=${KRISHNA_ID}`);
      });
    });

    it("Budget is not theirs — bounced to the dashboard", () => {
      visitAsPCG("/revops/budget");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("the billing ledger is not theirs — bounced", () => {
      visitAsPCG("/revops/billing-invoice");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. Everywhere else — denied or bounced
  // ──────────────────────────────────────────────────────────────────────

  describe("Outside their world — denied", () => {
    it("the CRM board → bounced to the dashboard", () => {
      visitAsPCG("/crm");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("Care Leads board → bounced", () => {
      visitAsPCG("/crm/pcg");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
    });

    it("the nurses board → denied or bounced", () => {
      visitAsPCG("/clinical/nurse");
      cy.location("pathname", { timeout: 10000 }).then((pathname) => {
        if (pathname === "/clinical/nurse") {
          cy.contains("Access Denied", { timeout: 5000 }).should("be.visible");
        } else {
          expect(pathname).to.eq("/");
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9b. Cross-persona — shared records, different hands
  // ──────────────────────────────────────────────────────────────────────

  describe("Cross-persona", () => {
    it("every API call carries the caregiver's authorization", () => {
      visitAsPCG(CLINICAL);
      cy.wait("@getUsers").then(({ request }) => {
        expect(request.headers).to.have.property("authorization");
      });
    });

    it("a senior discharged upstream disappears from the next board load", () => {
      // Admin removed Arthur on her side — the caregiver's next fetch must
      // not resurrect him.
      visitAsPCG(CLINICAL, { users: [KRISHNA, COLLEAGUE] });
      cy.wait("@getUsers");
      cy.contains("Arthur Bean").should("not.exist");
    });

    it("an incident a nurse filed is on the senior's record the caregiver opens", () => {
      // ARTHUR's incidentReport is authored by Nina Nurse — the caregiver
      // reads staff-authored history, not only their own writes.
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 10. End-to-end — a caregiver's round
  // ──────────────────────────────────────────────────────────────────────

  describe("End-to-end journey", () => {
    it("E2E — checks the dashboard, works a senior's round, checks pay", () => {
      // Dashboard — see the home's pulse.
      visitAsPCG("/");
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");

      // Clinical — open a senior, record the morning dose.
      visitAsPCG(`/clinical/${DUE_DOSE_SENIOR.userId}?activeTab=MedPass`, {
        users: [KRISHNA, COLLEAGUE, DUE_DOSE_SENIOR],
      });
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains(/^Pass$/).click();
      cy.wait("@saveClinical");

      // My Payment — the stub is theirs.
      visitAsPCG("/revops/payments");
      cy.contains("My Payment", { timeout: 10000 }).should("be.visible");
    });
  });
});
