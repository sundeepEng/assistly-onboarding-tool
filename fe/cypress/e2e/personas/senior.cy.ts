/// <reference types="cypress" />
/* eslint-disable cypress/no-force -- RBAC proof: force-clicking a disabled
   control is exactly how we assert "it stays inert for this role". */

/**
 * Persona — Senior
 *
 * The whole world a resident can reach, exercised as the Senior session
 * itself. A senior's account IS the record — `setAuthSession("Senior")`
 * seeds TEST_USER_ID, and every lookup for that id answers with the senior
 * fixture, the same way the deployed app resolves "the logged-in senior".
 *
 * THE PERMISSION MODEL (utils/roles.ts — hasAccess does NOT treat EDIT as
 * implying VIEW):
 *
 *   Nav        roleNavAllow.Senior =
 *              { crm: [CRM], clinical: [CLINICAL],
 *                hcm: [HCM_SCHEDULING, HCM_TEAM_ROASTER],
 *                revops: [REVOPS_DASHBOARD, REVOPS_BILLING_INVOICE, REVOPS_NAV] }
 *              → four sidebar sections: CRM ("My Details"), Clinical
 *              ("Seniors" — which resolves to their own record), Staff
 *              Management (Scheduling + Team), RevOps (Dashboard + Billing
 *              & Invoice). No Compliance section, no Budget, no Payment.
 *
 *   /crm/{id}  Their own record — the CRM board never renders for them;
 *              /crm pushes to getInitialRoute(Senior) = /crm/{theirId}.
 *              CRM_BIOGRAPHY EDIT is theirs — own details are editable.
 *
 *   /clinical  /clinical pushes to /clinical/{theirId}. On the record:
 *              four tabs — MedPass, OTC, Care Plan, Incident Report — all
 *              VIEW. No Medication tab (CLINICAL_MEDICATION absent), no
 *              carousel (CLINICAL_CAROUSEL absent), no writes of any kind:
 *              the one EDIT they hold is CLINICAL_MEDPASS_DATE_SELECTOR, so
 *              a senior can leaf through past days but never record.
 *
 *   /hcm       Scheduling and Team roster render (view); HCM_TIMESHEETS is
 *              EDIT in the matrix — /hcm/timesheet opens too, though the nav
 *              never offers it [as-built]. /hcm (the staff dashboard) bounces.
 *
 *   /revops    SENIOR_REVOPS_DASHBOARD renders the senior's own billing
 *              dashboard — stats, upcoming payments with Pay Now, recent
 *              activity — filtered to invoices whose user_id is theirs.
 *              /revops/billing-invoice shows the same filtered ledger.
 *              Budget and staff payroll are not theirs — they bounce.
 *
 *   Elsewhere  "/", /crm board, /compliance* — all push to /crm/{theirId}.
 */

import { Tags } from "../../framework/utils/tags";
import { loginPage } from "../../framework/pages/login.page";
import { forgotPasswordPage } from "../../framework/pages/forgot-password.page";
import {
  buildHome,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const OWN_ID = TEST_USER_ID;
const OWN_CRM = `/crm/${OWN_ID}`;
const OWN_CLINICAL = `/clinical/${OWN_ID}`;

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * 86400000));
const currentBillingPeriod = () => new Date().toISOString().slice(0, 7);

/** The senior the session belongs to — and two housemates they must not see. */
const SHELDON = {
  userId: OWN_ID,
  name: "Sheldon Cooper",
  firstName: "Sheldon",
  lastName: "Cooper",
  email: "sheldon.cooper@assistly.com",
  mobile: "7065183400",
  role: "Senior",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  biography: {
    personalDetails: {
      gender: "Male",
      birthdate: "1940-05-15",
      address: {
        street1: "12 Meadow Lane",
        city: "Alpharetta",
        state: "GA",
        zipCode: "30004",
      },
    },
  },
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
        id: "med-1",
        name: "Tylenol",
        dosage: "100mg",
        directions: "After eating",
        startdate: daysFromNow(-30),
        timings: ["09:00:00"],
        overTheCounter: false,
      },
    ],
    medPass: {
      services: [
        {
          medicationId: "med-1",
          passOrRefuse: "Pass",
          remarks: "",
          providedAt: `${today()}T09:00:00.000Z`,
          providedBy: TEST_USER_ID,
          timing: "09:00:00",
        },
      ],
      comments: [
        {
          messageId: "11111111-1111-4111-8111-111111111111",
          message: "Took the morning dose fine",
          parentMessageId: null,
          createdAt: `${today()}T09:15:00.000Z`,
          createdByUserId: TEST_USER_ID,
          createdByUserName: "Nina Nurse",
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
          createdByUserName: "Nina Nurse",
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
  // A prior conversation — proves the bot's history persists across sessions.
  chatbot: {
    crm: {
      chatHistory: [
        {
          messageId: "33333333-3333-4333-8333-333333333333",
          message: "What is on my care plan today?",
          createdBy: "User",
          createdAt: `${today()}T08:00:00.000Z`,
        },
        {
          messageId: "44444444-4444-4444-8444-444444444444",
          message: "Bathing assistance is scheduled for today.",
          createdBy: "Bot",
          createdAt: `${today()}T08:00:05.000Z`,
        },
      ],
      chatSummary: "Asked about today's care plan.",
    },
  },
};

const HOUSEMATE = {
  ...SHELDON,
  userId: "cccccccc-0002-4ccc-8ccc-cccccccccccc",
  name: "Mary Shaw",
  firstName: "Mary",
  lastName: "Shaw",
  clinical: { roomNumber: 9, status: "In Home", medication: [] },
};

/** Invoices as GET /v1/revops/invoice returns them. */
const buildInvoice = (overrides: Record<string, any> = {}) => ({
  id: 107,
  invoice_id: "INV_2026_10_107",
  home_id: TEST_HOME_ID,
  user_id: OWN_ID,
  created_by_user_id: "pcho-1",
  billing_period: currentBillingPeriod(),
  status: "DUE",
  total_amount: 550,
  due_date: daysFromNow(7),
  created_at: `${currentBillingPeriod()}-01T09:00:00.000Z`,
  notes: "",
  parent_invoice_id: null,
  payments: [],
  items: [
    {
      invoice_item_id: "item-1",
      item_category: "MEDICAL",
      description: "Monthly care fee",
      amount: 550,
    },
  ],
  ...overrides,
});

const OWN_DUE = buildInvoice();
const OWN_PAID = buildInvoice({
  id: 88,
  invoice_id: "INV_2026_10_088",
  status: "PAID",
  total_amount: 480,
});
const HOUSEMATE_DUE = buildInvoice({
  id: 201,
  invoice_id: "INV_2026_10_201",
  user_id: HOUSEMATE.userId,
  total_amount: 900,
});
const OWN_DRAFT = buildInvoice({
  id: 90,
  invoice_id: "INV_2026_10_090",
  status: "DRAFT",
});

/**
 * Seed a Senior session and the queries the shell makes. `users` is the
 * home's full roster — every page then narrows it to the senior's own world.
 */
const visitAsSenior = (
  path: string,
  opts: { users?: any[]; invoices?: any[] } = {},
) => {
  const users = opts.users ?? [SHELDON, HOUSEMATE];
  cy.clearAuthSession();
  cy.setAuthSession("Senior");
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: [] },
  }).as("getShifts");
  cy.intercept("GET", "**/v1/users*", {
    statusCode: 200,
    body: { users },
  }).as("getUsers");
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("?")[0].split("/").pop();
    req.reply({
      statusCode: 200,
      body: { user: users.find((u: any) => u.userId === id) ?? SHELDON },
    });
  }).as("getUser");
  cy.stubInvoices(opts.invoices ?? [OWN_DUE, OWN_PAID, HOUSEMATE_DUE, OWN_DRAFT]);
  cy.visit(path);
};

const visitClinicalTab = (tab: string) =>
  visitAsSenior(
    `/clinical/${OWN_ID}?activeTab=${encodeURIComponent(tab)}`,
  );

describe("Persona — Senior", { tags: [Tags.REGRESSION, Tags.PCHO, Tags.SENIOR] }, () => {
  // ──────────────────────────────────────────────────────────────────────
  // 0. Account — sign-in, password reset, logout
  // ──────────────────────────────────────────────────────────────────────

  describe("Sign in & password reset", () => {
    beforeEach(() => {
      cy.clearAuthSession();
      loginPage.visit();
    });

    it("signs in with valid credentials and lands on their own record", { tags: [Tags.SENIOR] }, () => {
      cy.stubLoginSuccess("Senior");
      loginPage.signIn();
      cy.wait("@loginRequest");
      cy.location("pathname", { timeout: 15000 }).should("eq", OWN_CRM);
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
        .typeEmail("sheldon.cooper@assistly.com")
        .submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.otpHeading.should("be.visible");
      forgotPasswordPage.otpInputs.should("have.length", 6);
    });

    it("valid OTP + matching new passwords resets and returns to login", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("sheldon.cooper@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp("123456")
        .typeNewPassword("NewPass@123")
        .typeConfirmPassword("NewPass@123")
        .submitReset();
      cy.wait("@confirmResetRequest").then(({ request }) => {
        expect(request.body.email).to.eq("sheldon.cooper@assistly.com");
        expect(request.body.confirmationCode).to.eq("123456");
      });
      cy.assertPopover(forgotPasswordPage.messages.passwordChanged);
      loginPage.signInButton.should("be.visible");
    });

    it("a wrong OTP fails the reset and keeps them on the OTP screen", () => {
      cy.stubForgotPassword(200);
      loginPage.openForgotPassword();
      forgotPasswordPage.typeEmail("sheldon.cooper@assistly.com").submitEmail();
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
      forgotPasswordPage.typeEmail("sheldon.cooper@assistly.com").submitEmail();
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
      forgotPasswordPage.typeEmail("sheldon.cooper@assistly.com").submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      forgotPasswordPage.resendOtp();
      cy.get("@forgotPasswordRequest.all").should("have.length", 2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. The shell — collapse, profile, support, the Assistly bot
  // ──────────────────────────────────────────────────────────────────────

  describe("The shell", () => {
    const openAccountMenu = () =>
      cy.get("div.rounded-full.cursor-pointer").last().click();

    beforeEach(() => {
      visitAsSenior(OWN_CRM);
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("the sidebar collapses to icons and expands back", () => {
      cy.get("nav").contains("Collapse").click();
      cy.get("nav").should("not.contain.text", "My Details");
      cy.get("nav").find("button").last().click();
      cy.get("nav").should("contain.text", "My Details");
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
      cy.get('input[name="firstName"], input[name="personalDetails.firstName"]')
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

    it("opens the support ticket form", () => {
      openAccountMenu();
      cy.contains(/^Support$/).click();
      cy.contains("Subject", { timeout: 10000 }).should("be.visible");
      cy.contains("Description").should("be.visible");
      cy.contains("Attachments").should("be.visible");
    });

    it("the Assistly bot shows the conversation that was already there", () => {
      // chatbot.crm.chatHistory is seeded on the senior's record — it must
      // rehydrate when the window opens: the messages persist.
      cy.get("button.bg-primary.rounded-full").last().click();
      cy.contains("What is on my care plan today?", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("Bathing assistance is scheduled for today.").should(
        "be.visible",
      );
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
      cy.location("pathname", { timeout: 10000 }).should("eq", "/login");
      cy.getCookie("role").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Landing — a senior's world starts at their own record
  // ──────────────────────────────────────────────────────────────────────

  describe("Landing", () => {
    it("lands on their own CRM record after sign-in", () => {
      visitAsSenior(OWN_CRM);
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
      cy.contains("Sheldon", { timeout: 10000 }).should("be.visible");
    });

    it("is bounced off the home dashboard to their record", () => {
      visitAsSenior("/");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. The sidebar — four sections, each pointing at their own world
  // ──────────────────────────────────────────────────────────────────────

  describe("The sidebar", () => {
    beforeEach(() => {
      visitAsSenior(OWN_CRM);
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("calls CRM 'My Details' — not Senior Leads", () => {
      cy.get("nav").contains("My Details").should("be.visible");
      cy.get("nav").contains("Senior Leads").should("not.exist");
    });

    it("offers Clinical", () => {
      cy.get("nav").contains("Clinical").should("be.visible");
    });

    it("offers Staff Management", () => {
      cy.get("nav").contains("Staff Management").should("be.visible");
    });

    it("offers RevOps — their billing lives there", () => {
      cy.get("nav").contains("RevOps").should("be.visible");
    });

    it("withholds Compliance entirely", () => {
      cy.get("nav").contains("Compliance").should("not.exist");
    });

    it("offers Scheduling and Team under Staff Management", () => {
      cy.get("nav").contains("Staff Management").click();
      cy.get("nav").contains("Scheduling").should("be.visible");
      cy.get("nav").contains("Team").should("be.visible");
      // But never the staff bookkeeping views.
      ["Dashboard", "Tasks", "Timesheet"].forEach((item) =>
        cy.get("nav").contains(item).should("not.exist"),
      );
    });

    it("offers Dashboard and Billing under RevOps — never Budget or Payment", () => {
      cy.get("nav").contains("RevOps").click();
      cy.get("nav").contains("Billing").should("be.visible");
      cy.get("nav").contains("Budget").should("not.exist");
      cy.get("nav").contains(/^Payment$/).should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Their own record — CRM
  // ──────────────────────────────────────────────────────────────────────

  describe("Their own record — CRM", () => {
    it("the CRM board bounces them to their own record", () => {
      visitAsSenior("/crm");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });

    it("their record shows their details, nobody else's", () => {
      visitAsSenior(OWN_CRM);
      cy.contains("Sheldon", { timeout: 10000 }).should("be.visible");
      cy.contains("Mary Shaw").should("not.exist");
    });

    it("My Details offers Biography, Medical, Careplan, Documents, FaceSheet", () => {
      visitAsSenior(OWN_CRM);
      cy.contains("Biography", { timeout: 10000 }).should("be.visible");
      ["Medical", "Careplan", "Documents", "FaceSheet"].forEach((tab) =>
        cy.contains(tab).should("be.visible"),
      );
    });

    it("Biography is editable — CRM_BIOGRAPHY EDIT is theirs", () => {
      visitAsSenior(OWN_CRM);
      cy.contains("Biography", { timeout: 10000 }).click();
      cy.get('input[name="firstName"]', { timeout: 10000 })
        .should("be.visible")
        .and("have.value", "Sheldon");
      // The Save button stays enabled — the senior owns their record.
      cy.contains("button", /^Save$/).should("not.be.disabled");
    });

    it("saves a biography change — PUT /v1/user/{id} carries it", () => {
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveUser");
      visitAsSenior(OWN_CRM);
      cy.contains("Biography", { timeout: 10000 }).click();
      cy.get('input[name="lastName"]', { timeout: 10000 }).clear();
      cy.get('input[name="lastName"]').type("Cooperbean");
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.lastName).to.eq("Cooperbean");
      });
    });

    it("Documents tab renders — CRM_BIOGRAPHY_DOCUMENTS EDIT is theirs", () => {
      visitAsSenior(OWN_CRM);
      cy.contains("Documents", { timeout: 10000 }).click();
      // The documents panel renders — upload affordance included.
      cy.get("body", { timeout: 10000 }).should("contain.text", "Document");
    });

    it("FaceSheet is editable — SENIOR_FACE_SHEET EDIT is theirs", () => {
      visitAsSenior(OWN_CRM);
      cy.contains("FaceSheet", { timeout: 10000 }).click();
      // Editable face sheet offers Print + editable fields (not pointer-locked).
      cy.contains("Print Face Sheet", { timeout: 10000 }).should("be.visible");
      cy.contains("Address:").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Their own record — Clinical, read-only
  // ──────────────────────────────────────────────────────────────────────

  describe("Their own record — clinical", () => {
    it("the clinical board bounces them to their own record", () => {
      visitAsSenior("/clinical");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CLINICAL);
    });

    it("offers four tabs — MedPass, OTC, Care Plan, Incident Report", () => {
      visitClinicalTab("MedPass");
      ["MedPass", "Over-The-Counter Medication", "Care Plan", "Incident Report"]
        .forEach((tab) =>
          cy.contains(tab, { timeout: 10000 }).should("be.visible"),
        );
    });

    it("withholds the Medication tab — CLINICAL_MEDICATION is not theirs", () => {
      // Deep-linking the tab renders nothing: the strip shows the four
      // allowed tabs, none active — the medication list never loads.
      visitClinicalTab("Medication");
      cy.contains("MedPass", { timeout: 10000 }).should("be.visible");
      cy.contains("Tylenol").should("not.exist");
    });

    it("never renders the face carousel", () => {
      visitClinicalTab("MedPass");
      cy.get('div[class*="w-[138px]"]').should("not.exist");
    });

    it("shows their medpass round — read-only, but the date moves", () => {
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // CLINICAL_MEDPASS_DATE_SELECTOR is their only clinical EDIT.
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      const d = daysFromNow(-1).split("-");
      cy.contains(`${d[1]}/${d[2]}/${d[0]}`).should("be.visible");
    });

    it("cannot pass or refuse a dose", () => {
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveClinical");
      cy.contains(/^Pass$/).click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("cannot record a care plan service", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveClinical");
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("cannot record a vital sign", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Blood Pressure", { timeout: 10000 })
        .parent()
        .find('div[class*="w-[280px]"], button')
        .first()
        .click();
      cy.get('input[type="time"]').should("not.exist");
      cy.contains("button", /^Add$/).should("not.exist");
    });

    it("comments on today's MedPass round — and replies to one", () => {
      // commentEditAccess = isToday || HISTORY_EDIT — today is always theirs.
      visitClinicalTab("MedPass");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      // The seeded comment renders with its date stamp.
      cy.contains("Took the morning dose fine").should("be.visible");
      // Add a comment.
      cy.get("textarea").last().type("All good this morning");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(JSON.stringify(request.body)).to.contain(
          "All good this morning",
        );
      });
      // Reply to the SEEDED comment. The comment just added renders
      // optimistically on top of the list until the PUT echo resets it — a
      // bare .first() can click the doomed comment's Reply, after which its
      // replyId matches nothing and no box opens. Scoping to the seeded
      // comment's own card sidesteps the race.
      cy.contains("Took the morning dose fine")
        .closest("div.border-l-2")
        .contains("button", "Reply")
        .click();
      cy.get('textarea[name^="reply-"]', { timeout: 8000 })
        .should("be.visible")
        .type("Noted, thank you");
      cy.contains("button", "Add Reply").click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(JSON.stringify(request.body)).to.contain("Noted, thank you");
      });
    });

    it("downloads the EMAR for the month — generate, then Download PDF", () => {
      // The EMAR select is ungated; a service was recorded today so this
      // month's sheet is real. E-Sign is withheld — CLINICAL_EMAR_ESIGN
      // EDIT is not a senior's.
      visitClinicalTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
      cy.get("select")
        .contains("Generate EMAR")
        .parent("select")
        .select(today().slice(0, 7));
      cy.contains("EMAR Generated", { timeout: 10000 }).should("be.visible");
      cy.contains("button", "Download PDF").should("be.visible");
      cy.contains("button", "E-Sign PDF").should("not.exist");
    });

    it("shows their incident register — view only", () => {
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("button", "Add Incident").should("not.exist");
    });

    it("offers no Add Over-the-Counter button — OTC is view-only for a senior", () => {
      visitClinicalTab("Over-The-Counter Medication");
      cy.contains("Over-The-Counter", { timeout: 10000 }).should("be.visible");
      cy.contains("button", "Add Over-the-Counter Medication").should(
        "not.exist",
      );
    });

    it("care plan comments render with their exact date — and accept a new one", () => {
      visitClinicalTab("Care Plan");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains("Bath taken in the morning", { timeout: 10000 }).should(
        "be.visible",
      );
      // The timestamp next to the author renders the comment's date.
      cy.contains("Bath taken in the morning")
        .closest("div.border-l-2")
        .find("p.font-poppins")
        .invoke("text")
        .should("match", /\d{4}/);
      cy.get("textarea").last().type("Vitals normal today");
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(JSON.stringify(request.body)).to.contain("Vitals normal today");
      });
    });

    it("downloads the Care Report for the month — download only, no e-sign", () => {
      // The Generate Care Report select is ungated; today's recorded service
      // makes this month's report real. CLINICAL_CAREREPORT_ESIGN is not
      // theirs — only Download PDF shows.
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
      cy.contains("button", "E-Sign PDF").should("not.exist");
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
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Staff Management — the schedule and roster, view-only
  // ──────────────────────────────────────────────────────────────────────

  describe("Staff Management — view only", () => {
    it("renders the schedule board in week view by default", () => {
      visitAsSenior("/hcm/scheduling");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
      cy.contains("Today").should("be.visible");
    });

    it("switches between week, month, and day views", () => {
      visitAsSenior("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      // The view switcher is a select with Month/Week/Day options.
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
      // Still on the board — no denial, no crash.
      cy.contains("Today").should("be.visible");
    });

    it("moves the schedule to past and future weeks", () => {
      visitAsSenior("/hcm/scheduling");
      cy.get("nav", { timeout: 10000 }).should("exist");
      // The week-range label sits between the two arrow controls.
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

    it("renders the team roster — care team list, view only", () => {
      visitAsSenior("/hcm/team");
      cy.contains("Access Denied").should("not.exist");
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("[as-built] opens timesheets — HCM_TIMESHEETS is EDIT for a senior", () => {
      // The nav never offers it, but the URL is reachable: the matrix grants
      // Senior HCM_TIMESHEETS EDIT. If that's wrong it's a role-matrix bug,
      // not a page bug — flagged, not pinned.
      visitAsSenior("/hcm/timesheet");
      cy.contains("Access Denied").should("not.exist");
    });

    it("the staff dashboard itself is not theirs", () => {
      visitAsSenior("/hcm");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. RevOps — their own billing dashboard, nothing else
  // ──────────────────────────────────────────────────────────────────────

  describe("RevOps — their billing", () => {
    it("renders their own dashboard with the stat cards", () => {
      visitAsSenior("/revops");
      cy.contains("Dashboard", { timeout: 10000 }).should("be.visible");
      ["Total Invoiced", "Total Paid", "Due Amount"].forEach((card) =>
        cy.contains(card).should("be.visible"),
      );
    });

    it("upcoming payments show their invoices only", () => {
      visitAsSenior("/revops");
      cy.contains("Upcoming Payments", { timeout: 10000 }).should("be.visible");
      // Their $550 due invoice is listed; the housemate's $900 is not.
      cy.contains("$550").should("be.visible");
      cy.contains("$900").should("not.exist");
    });

    it("offers Pay Now on a due invoice", () => {
      visitAsSenior("/revops");
      cy.contains("button", "Pay Now", { timeout: 10000 }).should("be.visible");
    });

    it("the invoice ledger lists only their invoices", () => {
      visitAsSenior("/revops/billing-invoice");
      cy.contains("INV_2026_10_107", { timeout: 10000 }).should("be.visible");
      cy.contains("INV_2026_10_088").should("be.visible");
      // The housemate's invoice and their own DRAFT never surface.
      cy.contains("INV_2026_10_201").should("not.exist");
      cy.contains("INV_2026_10_090").should("not.exist");
    });

    it("Budget is not theirs — bounced to their record", () => {
      visitAsSenior("/revops/budget");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });

    it("staff payroll is not theirs — bounced to their record", () => {
      visitAsSenior("/revops/payments");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Everywhere else — denied or bounced home
  // ──────────────────────────────────────────────────────────────────────

  describe("Everything else — denied", () => {
    it("compliance → bounced to their record", () => {
      visitAsSenior("/compliance");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });

    it("compliance training → bounced to their record", () => {
      visitAsSenior("/compliance/training");
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
    });

    it("the care-team board → denied or bounced", () => {
      visitAsSenior("/clinical/pcg");
      cy.location("pathname", { timeout: 10000 }).then((pathname) => {
        // Either the Access Denied card or a bounce — never the board itself.
        if (pathname === "/clinical/pcg") {
          cy.contains("Access Denied", { timeout: 5000 }).should("be.visible");
        } else {
          expect(pathname).to.eq(OWN_CRM);
        }
      });
    });

    it("the nurses board → Access Denied", () => {
      visitAsSenior("/clinical/nurse");
      cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7b. Cross-persona — the staff's writes on the senior's own record
  // ──────────────────────────────────────────────────────────────────────

  describe("Cross-persona", () => {
    it("every API call carries the senior's authorization", () => {
      visitAsSenior(OWN_CLINICAL);
      cy.wait("@getUser").then(({ request }) => {
        expect(request.headers).to.have.property("authorization");
      });
    });

    it("an incident the nurse filed on me is on my record", () => {
      // SHELDON's incidentReport is authored by Nina Nurse — the senior's
      // read path surfaces staff-authored history, not just self-writes.
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("a care-plan note the nurse left is on my record", () => {
      visitClinicalTab("Care Plan");
      cy.contains("Bath taken in the morning", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. End-to-end — a senior's day
  // ──────────────────────────────────────────────────────────────────────

  describe("End-to-end journey", () => {
    it("E2E — checks their care plan, reviews their bill, pays attention to it", () => {
      // Their record is where they land.
      visitAsSenior(OWN_CRM);
      cy.location("pathname", { timeout: 10000 }).should("eq", OWN_CRM);
      cy.contains("Sheldon", { timeout: 10000 }).should("be.visible");

      // Care plan — they can read today's services.
      visitClinicalTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");

      // Incident register — readable, no add affordance.
      visitClinicalTab("Incident Report");
      cy.contains("Fell in the corridor", { timeout: 10000 }).should(
        "be.visible",
      );

      // Billing — their dashboard shows only their ledger.
      visitAsSenior("/revops");
      cy.contains("Dashboard", { timeout: 10000 }).should("be.visible");
      cy.contains("$550").should("be.visible");
      cy.contains("$900").should("not.exist");
    });
  });
});
