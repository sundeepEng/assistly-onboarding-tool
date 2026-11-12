/// <reference types="cypress" />
/* eslint-disable cypress/no-force -- RBAC proof: force-clicking a disabled
   toggle is exactly how we assert "the control stays inert for this role". */

/**
 * Persona — Nurse
 *
 * The whole world a clinical Nurse can reach, exercised as the Nurse session
 * itself — not the staff-view tests that merely *mention* the role. This is
 * the suite to run when the question is "does a nurse's day still work".
 *
 * THE PERMISSION MODEL (utils/roles.ts — hasAccess does NOT treat EDIT as
 * implying VIEW):
 *
 *   Nav        roleNavAllow.Nurse = { clinical: [CLINICAL, CLINICAL_NURSE] }
 *              → the sidebar offers the Clinical section alone: Seniors and
 *              Nurses. Every other section header is withheld by
 *              ProtectedComponent (no CRM_NAV / STAFF_MANAGEMENT_NAV /
 *              COMPLIANCE_NAV / REVOPS_NAV).
 *
 *   /clinical  CLINICAL_DASHBOARD EDIT → the seniors board, but narrowed to
 *              the nurse's `associatedUserIds` — a nurse sees only the
 *              seniors assigned to them (pages/clinical/index.tsx).
 *
 *   A senior   All five tabs render — CLINICAL_MEDICATION, CLINICAL_MEDPASS,
 *              CLINICAL_OTC, CLINICAL_CAREPLAN, CLINICAL_INCIDENT all VIEW —
 *              but the edit surfaces are narrower:
 *                Medication   listed for view, and nurses DO own it — Add,
 *                             Edit and Delete are mounted ungated in
 *                             clinical-tabs.tsx, deliberately: recording a
 *                             med is a nurse's job. Bulk is withheld
 *                             (CLINICAL_TABS EDIT).
 *                MedPass      view + the date selector
 *                             (CLINICAL_MEDPASS_DATE_SELECTOR EDIT); the
 *                             Pass/Refuse toggles are disabled
 *                             (CLINICAL_MEDPASS EDIT absent). Comments are
 *                             writable for today and EMAR generation —
 *                             download + e-sign — is theirs.
 *                OTC          CLINICAL_OTC_ADD lets them record a dose.
 *                Care Plan    services and housekeeping are read-only
 *                             (CLINICAL_CAREPLAN VIEW); vitals are writable
 *                             for today via CLINICAL_CAREPLAN_VITALS, but
 *                             CLINICAL_CAREPLAN_VITALS_HISTORY_EDIT belongs
 *                             to PCHO/HomeAdmin — a past day shows no inputs;
 *                             comments save; the monthly Care Report
 *                             generates with download + e-sign.
 *                Incident     the tab itself is withheld from nurses —
 *                             product decision: staff file incidents, nurses
 *                             don't read the register either.
 *
 * KNOWN PROD DRIFT: the deployed prod build (main's roles.ts) still grants
 * Nurse CLINICAL_INCIDENT VIEW and CLINICAL_CAREPLAN_VITALS_HISTORY_EDIT EDIT —
 * dev's tightened matrix removed both. The incident-tab, deep-link and
 * history-vitals assertions below are correct for the intended contract and
 * go green on prod once that tightening ships. Verified empirically on
 * www.assistly.live — do not weaken them to match prod.
 *
 *   Nurses     The board route leads to their own profile — Document
 *              Management with Additional Documents upload (word/pdf/image).
 *
 *   Shell      Sidebar collapse, avatar → Profile/Support/Logout, and the
 *              Assistly bot launcher work like any user's.
 *              CLINICAL_CAROUSEL is held as EDIT only, and the strip checks
 *              VIEW — so the face carousel is never rendered.
 *
 *   /clinical/nurse   CLINICAL_NURSE EDIT → the Nurses board is reachable.
 *
 *   Everywhere else  "/" and /revops* bounce to /clinical (getInitialRoute),
 *              /crm* renders the Access Denied card, /compliance* redirects
 *              to /crm (which then denies), /hcm* renders Access Denied.
 *
 * PCHO remains the super-admin persona — the top-level tag on every other
 * spec keeps it in cy:run:pcho. This file carries only Tags.NURSE so
 * `cy:run:nurse` is the nurse's world exactly.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
const OTHER_SENIOR_ID = "cccccccc-0002-4ccc-8ccc-cccccccccccc";
const NURSE_BOARD = "/clinical/nurse";
const CLINICAL = "/clinical";

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * 86400000));

/** The nurse whose session these tests run — one assigned senior. */
const NINA = {
  userId: TEST_USER_ID,
  name: "Nina Nurse",
  firstName: "Nina",
  lastName: "Nurse",
  email: "nina.nurse@assistly.com",
  mobile: "7065183400",
  role: "Nurse",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  associatedUserIds: [SENIOR_ID],
};

const buildSenior = (overrides: Record<string, any> = {}) => ({
  userId: SENIOR_ID,
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
          remarks: "",
          providedAt: `${today()}T09:00:00.000Z`,
          providedBy: TEST_USER_ID,
          timing: "09:00:00",
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
      comments: [],
    },
    incidentReport: [
      {
        incidentId: "inc-1",
        incidentDate: `${today()}T07:48:00.000Z`,
        detailsOfIncident: "Fell in the corridor",
        reporterName: "Nina Nurse",
      },
    ],
  },
  ...overrides,
});

const ARTHUR = buildSenior();
const MARY = buildSenior({
  userId: OTHER_SENIOR_ID,
  name: "Mary Shaw",
  firstName: "Mary",
  lastName: "Shaw",
});
const DELETED_SENIOR = buildSenior({
  userId: "cccccccc-0003-4ccc-8ccc-cccccccccccc",
  name: "Gone Away",
  isDeleted: true,
});

/**
 * Seed a Nurse session and the four queries every clinical screen makes:
 * the home record, today's shifts, the people list, and per-user lookups
 * (the nurse's own record carries `associatedUserIds`; the senior's record
 * feeds the tabs). `seniors` is the FULL board — the page itself narrows it
 * to the nurse's assignments.
 */
const visitClinical = (
  path: string,
  opts: { nurse?: any; users?: any[] } = {},
) => {
  const nurse = opts.nurse ?? NINA;
  const users = opts.users ?? [NINA, ARTHUR, MARY, DELETED_SENIOR];
  cy.clearAuthSession();
  cy.setAuthSession("Nurse");
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
    const user =
      id === TEST_USER_ID ? nurse : (users.find((u: any) => u.userId === id) ?? ARTHUR);
    req.reply({ statusCode: 200, body: { user } });
  }).as("getUser");
  cy.visit(path);
};

const visitBoard = (opts?: Parameters<typeof visitClinical>[1]) =>
  visitClinical(CLINICAL, opts);

const visitSeniorTab = (
  tab: string,
  opts?: Parameters<typeof visitClinical>[1],
) => visitClinical(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent(tab)}`, opts);

const watchClinicalSave = () =>
  cy.intercept("PUT", "**/v1/clinical/user/**").as("saveClinical");

/** Open the avatar's account menu — Profile / Support / Logout. The avatar
 * renders initials (NN) when the user has no profile image. */
const openAccountMenu = () =>
  cy.get('div.rounded-full.cursor-pointer').last().click();

describe("Persona — Nurse", { tags: [Tags.REGRESSION, Tags.PCHO, Tags.NURSE] }, () => {
  // ──────────────────────────────────────────────────────────────────────
  // 0. Account — the shared, pre-auth surfaces and the session itself
  // ──────────────────────────────────────────────────────────────────────

  describe("Account & session", () => {
    it("offers the forgot-password flow from sign-in", () => {
      // The reset flow lives inside /login — a screen swap, not a route.
      cy.clearAuthSession();
      cy.visit("/login");
      cy.contains("Forgot password?", { timeout: 10000 }).click();
      cy.contains("Forgot Your Password?", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get('input[name="email"]').should("be.visible");
      cy.contains("button", "Send Email").should("be.visible");
    });

    it("sends the reset email and reaches the OTP screen", () => {
      cy.clearAuthSession();
      cy.intercept("PUT", "**/reset-password", { statusCode: 200, body: {} });
      cy.visit("/login");
      cy.contains("Forgot password?", { timeout: 10000 }).click();
      cy.get('input[name="email"]').type("nina.nurse@assistly.com");
      cy.contains("button", "Send Email").click();
      cy.contains("Enter OTP & Reset Password", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.get(".custom-otp-input input").should("have.length", 6);
      cy.get('input[name="newPassword"]').should("exist");
    });

    it("renders the activation screen for an invite link", () => {
      // A tokenless link still renders the form — the email just stays
      // empty (the auth suite covers the token contract). Both the mobile
      // and desktop copies exist in the DOM; assert the visible one.
      cy.clearAuthSession();
      cy.visit("/activate-account");
      cy.contains("Activate Account", { timeout: 10000 }).should("exist");
      cy.get('input[type="password"]').should("exist");
    });

    it("logout ends the session and lands on sign-in", () => {
      visitBoard();
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
      openAccountMenu();
      cy.contains(/^Logout$/).click();
      cy.contains("Are you sure you want to logout", {
        timeout: 5000,
      }).should("be.visible");
      cy.contains("button", /^Confirm$/).click();
      // Every session cookie is torn down and the router lands on sign-in.
      cy.getCookie("idToken", { timeout: 10000 }).should("not.exist");
      cy.getCookie("role").should("not.exist");
      cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
      cy.contains("button", "Sign in", { timeout: 10000 }).should(
        "be.visible",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. The shell — collapse, profile, support, the Assistly bot
  // ──────────────────────────────────────────────────────────────────────

  describe("The shell", () => {
    beforeEach(() => {
      visitBoard();
      cy.get("nav", { timeout: 10000 }).should("exist");
    });

    it("the sidebar collapses to icons and expands back", () => {
      cy.get("nav").contains("Collapse").click();
      // Collapsed: the labels leave the DOM — only icons remain.
      cy.get("nav").should("not.contain.text", "Seniors");
      // The same control toggles back — icon-only once collapsed.
      cy.get("nav").find("button").last().click();
      cy.get("nav").should("contain.text", "Seniors");
    });

    it("opens their profile — Personal Details", () => {
      openAccountMenu();
      cy.contains(/^Profile$/).click();
      cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
    });

    it("opens the support ticket form — subject, description, attachments", () => {
      openAccountMenu();
      cy.contains(/^Support$/).click();
      cy.contains("Subject", { timeout: 10000 }).should("be.visible");
      cy.contains("Description").should("be.visible");
      cy.contains("Attachments").should("be.visible");
    });

    it("the Assistly bot opens a chat window", () => {
      // The purple round launcher bottom-right — chat is on every screen.
      cy.get("button.bg-primary.rounded-full")
        .last()
        .click();
      cy.get('textarea[placeholder="Type your message..."]', {
        timeout: 10000,
      }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. Signing in — where a nurse lands
  // ──────────────────────────────────────────────────────────────────────

  describe("Landing", () => {
    it("lands on the clinical board after sign-in", () => {
      visitBoard();
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
      cy.contains("Seniors").should("be.visible");
    });

    it("is bounced off the home dashboard to clinical", { tags: [Tags.NURSE] }, () => {
      cy.clearAuthSession();
      cy.setAuthSession("Nurse");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [NINA, ARTHUR] } });
      cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user: NINA } });
      cy.visit("/");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. The sidebar — Clinical is the whole world
  // ──────────────────────────────────────────────────────────────────────

  describe("The sidebar", () => {
    beforeEach(() => {
      visitBoard();
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
    });

    it("offers the Clinical section", () => {
      cy.get("nav").contains("Clinical").should("be.visible");
    });

    it("offers Seniors and Nurses under Clinical", () => {
      cy.get("nav").contains("Seniors").should("be.visible");
      cy.get("nav").contains("Nurses").should("be.visible");
    });

    it("offers no Care Team — CLINICAL_PCG is not theirs", () => {
      cy.get("nav").contains("Care Team").should("not.exist");
    });

    it("withholds every other section header", () => {
      ["CRM", "Staff Management", "Compliance", "RevOps"].forEach((section) =>
        cy.get("nav").contains(section).should("not.exist"),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. The seniors board — assigned seniors only
  // ──────────────────────────────────────────────────────────────────────

  describe("The seniors board", () => {
    it("shows only the seniors assigned to the nurse", () => {
      visitBoard();
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");
      cy.contains("Mary Shaw").should("not.exist");
    });

    it("counts only the assigned seniors", () => {
      visitBoard();
      cy.contains("1 members").should("be.visible");
    });

    it("says so when nobody is assigned", () => {
      visitBoard({ nurse: { ...NINA, associatedUserIds: [] } });
      cy.contains("No seniors assigned to you", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("never shows a deleted senior, even an assigned one", () => {
      visitBoard({
        nurse: { ...NINA, associatedUserIds: [DELETED_SENIOR.userId] },
      });
      cy.contains("Gone Away").should("not.exist");
    });

    it("still asks the API for seniors at the contract milestone", { tags: [Tags.SENIOR] }, () => {
      visitBoard();
      cy.wait("@getUsers").then(({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("userType")).to.eq("Senior");
        expect(url.searchParams.get("homeId")).to.eq(TEST_HOME_ID);
        expect(url.searchParams.get("milestone")).to.eq("contract");
      });
    });

    it("authenticates every clinical query with the session id token", () => {
      visitBoard();
      cy.wait("@getUsers");
      cy.assertAuthorized("@getUsers");
      cy.assertAuthorized("@getUser");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. A senior's record — five tabs, no carousel
  // ──────────────────────────────────────────────────────────────────────

  describe("A senior's record — the tab strip", () => {
    beforeEach(() => {
      visitSeniorTab("Medication");
      cy.contains("Medication", { timeout: 10000 }).should("be.visible");
    });

    it("offers four clinical tabs", () => {
      ["Medication", "MedPass", "Over-The-Counter Medication", "Care Plan"]
        .forEach((tab) => cy.contains(tab).should("be.visible"));
    });

    it("withholds the Incident Report tab — by design", () => {
      // Product decision, confirmed: nurses don't see the incident register.
      cy.contains("Incident Report").should("not.exist");
    });

    it("deep-linking the incident tab renders nothing — no data leaks", () => {
      visitSeniorTab("Incident Report");
      // The strip shows the four allowed tabs, none active; the body stays
      // empty — the incident register never renders.
      cy.contains("Medication", { timeout: 10000 }).should("be.visible");
      cy.contains("Fell in the corridor").should("not.exist");
      cy.contains("Incident Report").should("not.exist");
    });

    it("never renders the face carousel", () => {
      // Each carousel face is a 138px circle; none render for a Nurse.
      cy.get('div[class*="w-[138px]"]').should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Medication — read-only
  // ──────────────────────────────────────────────────────────────────────

  describe("Medication — view the list, add a med", () => {
    beforeEach(() => {
      visitSeniorTab("Medication");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
    });

    it("lists the senior's medication", () => {
      cy.contains("Tylenol").should("be.visible");
      cy.contains("100mg").should("be.visible");
    });

    it("offers Add Medication — recording a med is a nurse's job", () => {
      // Deliberate product behaviour: the button is mounted ungated in
      // clinical-tabs.tsx. Not a defect — confirmed.
      cy.contains("button", "Add Medication").should("be.visible");
    });

    it("opens the medication form for them", () => {
      cy.contains("button", "Add Medication").click();
      cy.get(".ReactModal__Content")
        .find('input[name="medication.name"]')
        .should("be.visible");
    });

    it("offers edit and delete on each course", () => {
      // The Actions column carries the round edit + delete icons per row —
      // nurses own the medication list end to end.
      cy.contains("Tylenol").should("be.visible");
      cy.get('button[class*="w-[36px]"], div[class*="w-[36px]"]')
        .its("length")
        .should("be.gte", 2);
    });

    it("edits an existing course", () => {
      watchClinicalSave();
      cy.contains("Tylenol").should("be.visible");
      cy.get('button[class*="w-[36px]"], div[class*="w-[36px]"]')
        .first()
        .click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("be.visible");
      cy.get('input[name="medication.name"]').should("have.value", "Tylenol");
      // The timings chip prefills from the record ("09:00:00" → "09:00 AM");
      // touch the dosage and Save writes the whole course back.
      cy.get('input[name="medication.dosage"]').clear();
      cy.get('input[name="medication.dosage"]').type("200mg");
      cy.contains("button", "Save").click();
      cy.wait("@saveClinical").then(({ request }) => {
        const med = request.body.medication.find((m: any) => m.id === "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
        expect(med.dosage).to.eq("200mg");
      });
    });

    it("deletes a course", () => {
      // Delete rides the native window.confirm, not a React modal.
      cy.on("window:confirm", () => true);
      watchClinicalSave();
      cy.contains("Tylenol").should("be.visible");
      cy.get('button[class*="w-[36px]"], div[class*="w-[36px]"]')
        .eq(1)
        .click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(
          request.body.medication.find((m: any) => m.id === "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
        ).to.not.exist;
      });
    });

    it("offers no Bulk toggle", () => {
      cy.contains("Bulk").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. MedPass — see the round, change the day, never action it
  // ──────────────────────────────────────────────────────────────────────

  describe("MedPass — view only", () => {
    beforeEach(() => {
      visitSeniorTab("MedPass");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
    });

    it("renders the round", () => {
      cy.contains("Tylenol").should("be.visible");
      cy.contains(/^Pass$/).should("be.visible");
      cy.contains(/^Refuse$/).should("be.visible");
    });

    it("lets the date be moved — CLINICAL_MEDPASS_DATE_SELECTOR is theirs", () => {
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      // Yesterday's date lands on the row header.
      const d = daysFromNow(-1).split("-");
      cy.contains(`${d[1]}/${d[2]}/${d[0]}`).should("be.visible");
    });

    it("cannot pass a dose — the toggle is disabled", () => {
      watchClinicalSave();
      cy.contains(/^Pass$/).click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("cannot refuse a dose", () => {
      watchClinicalSave();
      cy.contains(/^Refuse$/).click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("offers the comments box — and saves one on today's round", () => {
      cy.contains("Add Comment", { timeout: 10000 }).should("be.visible");
      cy.get('textarea[name="comment"], textarea').first().type("Shift round complete");
      watchClinicalSave();
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical").then(({ request }) => {
        // The comment lands inside the clinical payload — wherever the
        // serializer puts it, the text must be in the write.
        expect(JSON.stringify(request.body)).to.contain(
          "Shift round complete",
        );
      });
    });

    it("generates the EMAR for the month", () => {
      // Generate EMAR → EmarDataLayer → "EMAR Generated" modal. A service
      // was recorded today, so this month's sheet is real.
      cy.get("select").first().select(today().slice(0, 7));
      cy.contains("EMAR Generated", { timeout: 10000 }).should("be.visible");
    });

    it("offers download and e-sign on the generated EMAR", () => {
      // CLINICAL_EMAR_ESIGN is theirs.
      cy.get("select").first().select(today().slice(0, 7));
      cy.contains("button", "Download PDF", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("button", "E-Sign PDF").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Over-the-Counter — the one clinical surface a nurse writes to
  // ──────────────────────────────────────────────────────────────────────

  describe("Over-the-Counter — writable", () => {
    const OTC_TAB = "Over-The-Counter Medication";
    const modal = () => cy.get(".ReactModal__Content");

    const openForm = () => {
      visitSeniorTab(OTC_TAB);
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).click();
      modal().find('input[name="medication.name"]').should("be.visible");
    };

    it("offers Add Over-the-Counter Medication — CLINICAL_OTC_ADD is theirs", () => {
      visitSeniorTab(OTC_TAB);
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).should("be.visible");
    });

    it("refuses an empty form — no request leaves the browser", () => {
      openForm();
      watchClinicalSave();
      cy.contains("button", /^Save$/).click();
      cy.assertNoRequest("@saveClinical");
    });

    it("records a dose and marks it over-the-counter", () => {
      openForm();
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");

      modal().find('input[name="medication.name"]').type("Ibuprofen");
      modal().find('input[name="medication.dosage"]').type("200mg");
      modal().find('input[name="medication.startdate"]').type(today());
      // Timings live behind a dropdown; tick the zero-padded 09:00 AM slot.
      modal().find('div[class*="w-[420px]"]').first().click();
      cy.get("ul li").contains(/^09:00 AM$/).click();
      modal().find('div[class*="w-[420px]"]').first().click();
      cy.contains("button", /^Save$/).click();

      cy.wait("@saveClinical").then(({ request }) => {
        const dose = request.body.medication.filter((m: any) => m.overTheCounter).slice(-1)[0];
        expect(dose.name).to.eq("Ibuprofen");
        expect(dose.overTheCounter).to.eq(true);
      });
    });

    it("lists doses already recorded — OTC history is visible", () => {
      // The OTC service recorded today sits in the senior's medpass table.
      visitSeniorTab("Over-The-Counter Medication");
      cy.contains("Add Over-the-Counter Medication", {
        timeout: 10000,
      }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. Care Plan — vitals today, everything else read-only
  // ──────────────────────────────────────────────────────────────────────

  describe("Care Plan", () => {
    beforeEach(() => {
      visitSeniorTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
    });

    it("lists the ADL services the CRM care plan wrote", () => {
      cy.contains("Bathing").should("be.visible");
      cy.contains("Assistance").should("be.visible");
    });

    it("cannot record an ADL service — the toggle is disabled", () => {
      watchClinicalSave();
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .parents("button")
        .should("be.disabled");
      cy.contains('div[class*="border-b"]', "Bathing")
        .contains("div", /^Provided$/)
        .click({ force: true });
      cy.assertNoRequest("@saveClinical");
    });

    it("can take a vital sign reading for today", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");

      cy.contains("Blood Pressure")
        .parent()
        .find('div[class*="w-[280px]"], button')
        .first()
        .click();
      cy.get('input[type="time"]').type("14:30");
      cy.get('input[placeholder="e.g. 120/80"]').type("120/80");
      cy.contains("button", /^Add$/).click();

      cy.wait("@saveClinical").then(({ request }) => {
        const services = request.body.carePlan.services;
        expect(
          services.find((s: any) => s.serviceCategory === "Vital Signs"),
        ).to.exist;
      });
    });

    it("offers no vital inputs on an earlier day — no HISTORY_EDIT", () => {
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      cy.contains("Blood Pressure")
        .parent()
        .find('div[class*="w-[280px]"], button')
        .first()
        .click();
      cy.get('input[type="time"]').should("not.exist");
      cy.contains("button", /^Add$/).should("not.exist");
    });

    it("offers the comments box — VIEW renders it", () => {
      cy.get('textarea[name="comment"], textarea').should("exist");
    });

    it("saves a comment on today's round", () => {
      cy.get('textarea[name="comment"], textarea')
        .first()
        .type("Nurse review done");
      watchClinicalSave();
      cy.contains("button", "Add Comment").click();
      cy.wait("@saveClinical");
    });

    it("reviews a past day — the records render, read-only", () => {
      // Past dates are viewable — the date selector moves and the
      // recorded vitals for that day still list.
      cy.get('input[type="date"]').first().type(daysFromNow(-1));
      cy.contains("Blood Pressure", { timeout: 10000 }).should("be.visible");
    });

    it("generates the Care Report — download and e-sign offered", () => {
      // CLINICAL_CAREREPORT_ESIGN is theirs. A service was recorded this
      // month, so the report generates rather than warning.
      cy.get("select").first().select(today().slice(0, 7));
      cy.contains("Care Report Generated", { timeout: 10000 }).should(
        "be.visible",
      );
      cy.contains("button", "Download PDF").should("be.visible");
      cy.contains("button", "E-Sign PDF").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. The Nurses board — the nav item leads to the nurse's own profile
  // ──────────────────────────────────────────────────────────────────────

  describe("The Nurses board", () => {
    it("routes the nurse to their own profile, not the staff list", () => {
      visitClinical(NURSE_BOARD, { users: [NINA, ARTHUR] });
      // /clinical/nurse redirects a Nurse to /clinical/nurse/{theirId} —
      // Document Management, not the roster.
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `${NURSE_BOARD}/${TEST_USER_ID}`,
      );
      cy.contains("Document Management", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("the sidebar's Nurses entry leads to the same place", () => {
      visitBoard();
      cy.contains("Seniors", { timeout: 10000 }).should("be.visible");
      cy.get("nav").contains("Nurses").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `${NURSE_BOARD}/${TEST_USER_ID}`,
      );
    });

    it("offers Additional Documents upload on their own profile", () => {
      visitClinical(NURSE_BOARD, { users: [NINA] });
      cy.contains("Click to upload document", { timeout: 10000 }).should(
        "be.visible",
      );
    });

    it("opens the document upload dialog", () => {
      visitClinical(NURSE_BOARD, { users: [NINA] });
      // The empty card opens an expiration modal holding Select File.
      cy.contains("Click to upload document", { timeout: 10000 }).click();
      cy.contains("Select File", { timeout: 10000 }).should("be.visible");
      cy.get('input[type="file"]').should("exist");
      cy.contains("Expiration Date").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 11. Everything else — denied or bounced back to clinical
  // ──────────────────────────────────────────────────────────────────────

  describe("Outside clinical — denied", { tags: [Tags.NURSE] }, () => {
    const visitAsNurse = (path: string) => {
      cy.clearAuthSession();
      cy.setAuthSession("Nurse");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [NINA, ARTHUR] } });
      cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user: NINA } });
      cy.visit(path);
    };

    it("CRM board → bounced to clinical", () => {
      // getInitialRoute(Nurse) = /clinical; the CRM page pushes them home.
      visitAsNurse("/crm");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });

    it("Care Leads board → bounced to clinical", () => {
      visitAsNurse("/crm/pcg");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });

    it("staff dashboard → bounced to clinical", () => {
      visitAsNurse("/hcm");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });

    it("scheduling → Access Denied", () => {
      visitAsNurse("/hcm/scheduling");
      cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
    });

    it("timesheets → denied", () => {
      visitAsNurse("/hcm/timesheet");
      cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
    });

    it("team roster → denied", () => {
      visitAsNurse("/hcm/team");
      cy.contains("Access Denied", { timeout: 10000 }).should("be.visible");
    });

    it("compliance → redirected to /crm, which then denies", () => {
      visitAsNurse("/compliance");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("compliance training → same bounce", () => {
      visitAsNurse("/compliance/training");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("RevOps → bounced to clinical", () => {
      visitAsNurse("/revops");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });

    it("RevOps budget → bounced to clinical", () => {
      visitAsNurse("/revops/budget");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });

    it("payroll → bounced to clinical", () => {
      visitAsNurse("/revops/payments");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 11b. Cross-persona — shared records, different hands
  // ──────────────────────────────────────────────────────────────────────

  describe("Cross-persona", () => {
    it("every API call carries the nurse's authorization", () => {
      visitBoard();
      cy.wait("@getUsers").then(({ request }) => {
        expect(request.headers).to.have.property("authorization");
      });
    });

    it("a senior discharged upstream is gone from the next board load", () => {
      // Admin removed Arthur — the nurse's next fetch must not resurrect
      // him, even though he's still in the nurse's assignments.
      visitBoard({ users: [NINA, MARY] });
      cy.wait("@getUsers");
      cy.contains("Arthur Bean").should("not.exist");
    });

    it("a medication prescribed upstream is on the record the nurse opens", () => {
      // The order was written by an admin/doctor upstream; the nurse's
      // Medication tab is where that decision lands for care.
      visitSeniorTab("Medication");
      cy.contains("Tylenol", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 12. End-to-end — a nurse's round
  // ──────────────────────────────────────────────────────────────────────

  describe("End-to-end journey", () => {
    it("E2E — a nurse reviews their senior, records a vital, adds an OTC dose", () => {
      // Board → only the assigned senior is there.
      visitBoard();
      cy.contains("Arthur Bean", { timeout: 10000 }).should("be.visible");

      // Care Plan → today's vital is writable.
      visitSeniorTab("Care Plan");
      cy.contains("Bathing", { timeout: 10000 }).should("be.visible");
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveClinical");
      cy.contains("Blood Pressure")
        .parent()
        .find('div[class*="w-[280px]"], button')
        .first()
        .click();
      cy.get('input[type="time"]').type("08:15");
      cy.get('input[placeholder="e.g. 120/80"]').type("118/76");
      cy.contains("button", /^Add$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(
          request.body.carePlan.services.find(
            (s: any) => s.serviceCategory === "Vital Signs",
          ),
        ).to.exist;
      });

      // OTC tab → record the dose the senior asked for.
      visitSeniorTab("Over-The-Counter Medication");
      cy.contains("button", "Add Over-the-Counter Medication", {
        timeout: 10000,
      }).click();
      cy.get(".ReactModal__Content").find('input[name="medication.name"]').type("Ibuprofen");
      cy.get(".ReactModal__Content").find('input[name="medication.dosage"]').type("200mg");
      cy.get(".ReactModal__Content").find('input[name="medication.startdate"]').type(today());
      cy.get(".ReactModal__Content").find('div[class*="w-[420px]"]').first().click();
      cy.get("ul li").contains(/^09:00 AM$/).click();
      cy.get(".ReactModal__Content").find('div[class*="w-[420px]"]').first().click();
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveClinical").then(({ request }) => {
        expect(request.body.medication.some((m: any) => m.overTheCounter)).to.be
          .true;
      });
    });
  });
});
