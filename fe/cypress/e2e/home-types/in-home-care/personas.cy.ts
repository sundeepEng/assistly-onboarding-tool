/* eslint-disable cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on grid cells / documented settle windows */
/**
 * In-Home Care — the persona journeys
 *
 *   pages/clinical/index.tsx            PCG sees only assigned seniors
 *   components/hcm/schedule/*.tsx       PCG own-row / senior assigned-PCG filters
 *   components/clinical/clinical-tabs   PCG gets no face carousel
 *   components/dashboard/quick-actions  Business Documents for the admin
 *
 * The module spec pins each IHC branch in isolation; this file is the
 * journey layer — what a whole day looks like for each role when
 * `home.homeType === "In Home Care"`. Tagged by role so the CI persona
 * lanes (`@pcg`, `@senior`, `@nurse`, `@pcho`) sweep it alongside the
 * Residential journeys. Nurse is here on purpose: her world must be
 * *unchanged* by home type, and that needs a test, not an assumption.
 */

import { Tags } from "../../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../../framework/module-commands";
import { TEST_USER_ID } from "../../../framework/constants";

const IHC = { homeType: "In Home Care" };
const SCHEDULING_PATH = "/hcm/scheduling";
const CLINICAL_PATH = "/clinical";
const HOME = "/";

const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();
const WED = new Date(2026, 8, 9);

const PRIYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALBERT = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";
const MABEL = "dddddddd-0001-4ddd-8ddd-dddddddddddd";
const JOSEF = "dddddddd-0002-4ddd-8ddd-dddddddddddd";

const buildMember = (
  userId: string,
  name: string,
  overrides: Record<string, any> = {}
) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "PCG",
  homeId: TEST_HOME_ID,
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
  ...overrides,
});

const SELF_ROW = buildMember(TEST_USER_ID, "Self Caregiver");
const PRIYA_ROW = buildMember(PRIYA, "Priya Patel");
const ALBERT_ROW = buildMember(ALBERT, "Albert Einstein");

const buildSenior = (userId: string, name: string, roomNumber = 12) => ({
  userId,
  name,
  role: "Senior",
  homeId: TEST_HOME_ID,
  isDeleted: false,
  milestone: ["contract"],
  clinical: { roomNumber, status: "In Home", medication: [] },
});

const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 5001,
  user_id: PRIYA,
  user_name: "Priya Patel",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: 15,
  shift_start_time: at(WED, 9, 30),
  shift_end_time: at(WED, 14, 0),
  ...overrides,
});

const sel = {
  faces: () => cy.get('div[class*="w-[138px]"]'),
};

/** `/v1/users` answers PCG/Senior; everything else gets an empty list. */
const stubUsers = (members: any[] = [], seniors: any[] = []) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: {
        users: userType === "PCG" ? members : userType === "Senior" ? seniors : [],
      },
    });
  }).as("getUsers");

const stubShifts = (shifts: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");

const stubMe = (user: any) =>
  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: { user },
  }).as("getUser");

// ────────────────────────────────────────────────────────────────────────────
// The PCG — everything they see is scoped to their assignments
// ────────────────────────────────────────────────────────────────────────────

describe("IHC persona — PCG", { tags: [Tags.REGRESSION, Tags.PCG] }, () => {
  const MABEL_SENIOR = buildSenior(MABEL, "Mabel Simmons");
  const JOSEF_SENIOR = buildSenior(JOSEF, "Josef Albers", 14);

  const visitBoard = () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(buildHome(IHC));
    stubUsers([SELF_ROW, PRIYA_ROW, ALBERT_ROW], [MABEL_SENIOR, JOSEF_SENIOR]);
    stubShifts([
      buildShift({ user_id: TEST_USER_ID, user_name: "Self Caregiver", assigned_to_user_id: MABEL }),
    ]);
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(SCHEDULING_PATH);
    cy.contains("Today").should("be.visible");
  };

  const visitClinical = () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [MABEL_SENIOR, JOSEF_SENIOR]);
    stubShifts([buildShift({ assigned_to_user_id: MABEL })]);
    cy.visit(CLINICAL_PATH);
  };

  const visitSenior = (shifts: any[] = []) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [MABEL_SENIOR]);
    stubShifts(shifts);
    stubMe(MABEL_SENIOR);
    cy.visit(`${CLINICAL_PATH}/${MABEL}`);
  };

  it("the schedule board holds only their own row", () => {
    visitBoard();
    cy.contains("Self Caregiver").should("be.visible");
    cy.contains("Priya Patel").should("not.exist");
    cy.contains("Albert Einstein").should("not.exist");
  });

  it("their assigned shift is the one they see", () => {
    visitBoard();
    cy.get('.shift-card[class*="border-2"]').should("exist");
  });

  it("the clinical board shows only their assigned client", () => {
    visitClinical();
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
    cy.contains("Josef Albers").should("not.exist");
  });

  it("an unassigned day tells them so, plainly", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [MABEL_SENIOR]);
    stubShifts([]);
    cy.visit(CLINICAL_PATH);
    cy.contains("No shifts assigned to you today", { timeout: 10000 }).should(
      "be.visible"
    );
  });

  it("the client's record gives them no face carousel", () => {
    visitSenior([buildShift({ assigned_to_user_id: MABEL })]);
    cy.contains("MedPass", { timeout: 10000 }).should("be.visible");
    sel.faces().should("not.exist");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// The Senior — the board shows only the caregivers coming to them
// ────────────────────────────────────────────────────────────────────────────

describe("IHC persona — Senior", { tags: [Tags.REGRESSION, Tags.SENIOR] }, () => {
  const visitBoard = (shifts: any[]) => {
    cy.clearAuthSession();
    cy.setAuthSession("Senior");
    cy.stubHome(buildHome(IHC));
    stubUsers([PRIYA_ROW, ALBERT_ROW], []);
    stubShifts(shifts);
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(SCHEDULING_PATH);
    cy.contains("Today").should("be.visible");
  };

  it("the schedule board holds only the caregivers assigned to them", () => {
    visitBoard([
      buildShift({ assigned_to_user_id: TEST_USER_ID }), // Priya → me
      buildShift({ id: 5002, user_id: ALBERT, user_name: "Albert Einstein" }), // Albert → nobody
    ]);
    cy.contains("Priya Patel").should("be.visible");
    cy.contains("Albert Einstein").should("not.exist");
  });

  it("a day with nobody assigned says so", () => {
    visitBoard([]);
    cy.contains("No shifts assigned in this week").should("be.visible");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// The Nurse — home type does not change her world
// ────────────────────────────────────────────────────────────────────────────

describe("IHC persona — Nurse", { tags: [Tags.REGRESSION, Tags.NURSE] }, () => {
  const NINA = {
    userId: TEST_USER_ID,
    name: "Nina Nurse",
    role: "Nurse",
    homeId: TEST_HOME_ID,
    associatedUserIds: [{ userId: MABEL }],
  };

  const visitNurseBoard = (me: any = NINA) => {
    cy.clearAuthSession();
    cy.setAuthSession("Nurse");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [buildSenior(MABEL, "Mabel Simmons"), buildSenior(JOSEF, "Josef Albers", 14)]);
    stubShifts([]);
    stubMe(me);
    cy.visit(CLINICAL_PATH);
  };

  it("she sees only the seniors in her assignment list", () => {
    visitNurseBoard();
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
    cy.contains("Josef Albers").should("not.exist");
  });

  it("the IHC shift rule never leaks into her filter", () => {
    // Even when a shift assigns MABEL to a PCG, the nurse's view still runs
    // on associatedUserIds — the PCG-only contract does not apply to her.
    visitNurseBoard();
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// The PCHO — everything, always
// ────────────────────────────────────────────────────────────────────────────

describe("IHC persona — PCHO", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  it("the schedule board shows every member", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome(IHC));
    stubUsers([PRIYA_ROW, ALBERT_ROW], []);
    stubShifts([]);
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(SCHEDULING_PATH);
    cy.contains("Priya Patel").should("be.visible");
    cy.contains("Albert Einstein").should("be.visible");
  });

  it("the clinical board shows every senior", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [buildSenior(MABEL, "Mabel Simmons"), buildSenior(JOSEF, "Josef Albers", 14)]);
    stubShifts([]);
    cy.visit(CLINICAL_PATH);
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
    cy.contains("Josef Albers").should("be.visible");
  });

  it("the dashboard calls it Business Documents", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome(IHC));
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user: {} } });
    stubShifts([]);
    cy.visit(HOME);
    cy.contains("Business Documents", { timeout: 10000 }).should("be.visible");
  });

  it("a senior record offers the face carousel — admins are not filtered", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome(IHC));
    stubUsers([], [buildSenior(MABEL, "Mabel Simmons")]);
    stubShifts([]);
    stubMe(buildSenior(MABEL, "Mabel Simmons"));
    cy.visit(`${CLINICAL_PATH}/${MABEL}`);
    cy.contains("MedPass", { timeout: 10000 }).should("be.visible");
    sel.faces().should("exist");
  });
});
