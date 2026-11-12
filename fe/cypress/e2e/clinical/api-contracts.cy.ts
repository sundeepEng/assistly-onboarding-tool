/// <reference types="cypress" />

/**
 * Clinical — API contracts and access control
 *
 * Route under test: /clinical (pages/clinical/index.tsx)
 *
 * The seniors board is the entry point to every clinical action. What matters
 * here is that it asks for the right population (Seniors who reached the
 * contract milestone, in the caller's home), that it is authenticated, that the
 * per-role narrowing works (a care team member only sees the seniors they are
 * rostered to today; a nurse only sees the ones assigned to them), and that the
 * module can be switched off per home.
 *
 * What the board *renders* — the grid and list views, the row ⋮ menu and soft
 * delete — is covered by seniors-board.cy.ts.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildShiftRow, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const CLINICAL_PATH = "/clinical";

/** A senior as GET /v1/users returns them for the clinical board. */
const buildSenior = (overrides: Record<string, any> = {}) => ({
  userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Arthur Bean",
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  clinical: { roomNumber: 12, status: "In Home" },
  isDeleted: false,
  ...overrides,
});

/** Stub the seniors list. */
const stubSeniors = (users: any[] = [buildSenior()]) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as(
    "getSeniors"
  );

/** Stub the today's-shifts query the care-team view depends on. */
const stubShifts = (shifts: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts } }).as(
    "getShifts"
  );

describe("Clinical module", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // -------------------------------------------------------------------------
  // 1. Seniors list - GET /v1/users
  // -------------------------------------------------------------------------

  describe("GET /v1/users - the seniors board", () => {
    beforeEach(() => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);
    });

    it("requests the seniors list on load", () => {
      cy.wait("@getSeniors").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/users");
      });
    });

    it("filters to Seniors who reached the contract milestone, in the caller's home", { tags: [Tags.SENIOR] }, () => {
      // A senior only belongs on the clinical board once their contract is
      // complete; without the milestone filter, prospects would appear as
      // residents.
      cy.wait("@getSeniors");
      cy.assertQuery("@getSeniors", {
        userType: "Senior",
        homeId: TEST_HOME_ID,
        milestone: "contract",
      });
    });

    it("authenticates with the session id token", () => {
      cy.wait("@getSeniors");
      cy.assertAuthorized("@getSeniors");
    });

    it("renders the Seniors heading and the member count", () => {
      cy.wait("@getSeniors");
      cy.contains("Seniors").should("be.visible");
      cy.contains("1 members").should("be.visible");
    });

    it("renders the senior returned by the API", () => {
      cy.wait("@getSeniors");
      cy.contains("Arthur Bean").should("be.visible");
    });
  });

  // -------------------------------------------------------------------------
  // 2. What the board shows
  // -------------------------------------------------------------------------

  describe("Seniors board contents", () => {
    beforeEach(() => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
    });

    it("counts every active senior", () => {
      stubSeniors([
        buildSenior({ name: "Arthur Bean" }),
        buildSenior({ userId: "senior-2", name: "Mary Shaw" }),
        buildSenior({ userId: "senior-3", name: "Ivan Petrov" }),
      ]);
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("3 members").should("be.visible");
      cy.contains("Mary Shaw").should("be.visible");
      cy.contains("Ivan Petrov").should("be.visible");
    });

    it("excludes deleted seniors from the count", () => {
      stubSeniors([
        buildSenior({ name: "Arthur Bean" }),
        buildSenior({ userId: "senior-2", name: "Gone Away", isDeleted: true }),
      ]);
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("1 members").should("be.visible");
    });

    it("renders an empty board without erroring", () => {
      stubSeniors([]);
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("Seniors").should("be.visible");
      cy.contains("0 members").should("be.visible");
    });

  });

  // -------------------------------------------------------------------------
  // 3. Per-role narrowing
  // -------------------------------------------------------------------------

  describe("Per-role narrowing of the board", () => {
    it("shows a care team member every senior at a residential home", { tags: [Tags.PCG] }, () => {
      cy.setAuthSession("PCG");
      cy.stubHome(buildHome({ homeType: "Residential" }));
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("Arthur Bean").should("be.visible");
    });

    it("shows an In-Home Care caregiver only the seniors on today's roster", { tags: [Tags.PCG] }, () => {
      cy.setAuthSession("PCG");
      cy.stubHome(buildHome({ homeType: "In Home Care" }));
      stubShifts([
        buildShiftRow({
          user_id: TEST_USER_ID,
          assigned_to_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
      ]);
      stubSeniors([
        buildSenior({ name: "Arthur Bean" }),
        buildSenior({ userId: "senior-unassigned", name: "Not My Visit" }),
      ]);
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("Arthur Bean").should("be.visible");
      cy.contains("Not My Visit").should("not.exist");
    });

    it("tells an In-Home Care caregiver with no shifts that nothing is assigned", { tags: [Tags.PCG] }, () => {
      cy.setAuthSession("PCG");
      cy.stubHome(buildHome({ homeType: "In Home Care" }));
      stubShifts([]);
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("0 members").should("be.visible");
    });

    it("requests today's shifts scoped to the caregiver and the home", { tags: [Tags.PCG] }, () => {
      cy.setAuthSession("PCG");
      cy.stubHome(buildHome({ homeType: "In Home Care" }));
      stubShifts([]);
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.wait("@getShifts");
      cy.assertQuery("@getShifts", {
        home_id: TEST_HOME_ID,
        user_id: TEST_USER_ID,
        shift_status: "available",
      });
      cy.assertAuthorized("@getShifts");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Access control
  // -------------------------------------------------------------------------

  describe("Access control", () => {
    it("sends a Senior straight to their own clinical record", { tags: [Tags.SENIOR] }, () => {
      cy.setAuthSession("Senior");
      cy.stubHome();
      stubShifts();
      stubSeniors();
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: { user: buildSenior() },
      }).as("getSenior");
      cy.visit(CLINICAL_PATH);

      // One assertion, not two: splitting them lets the second run in the gap
      // before the redirect settles and read `/clinical` again.
      cy.location("pathname", { timeout: 10000 }).should("match", /^\/clinical\/.+/);
    });

    it("sends a ComplianceGuest to compliance training", () => {
      cy.setAuthSession("ComplianceGuest");
      cy.stubHome();
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.location("pathname", { timeout: 10000 }).should("eq", "/compliance/training");
    });

    it("restricts the board when the home has no Clinical module", () => {
      // A home's `authorizedModules` is the per-tenant feature switch; dropping
      // CLINICAL must close the board even for a PCHO.
      cy.setAuthSession("PCHO");
      cy.stubHome(
        buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT", "COMPLIANCE"] })
      );
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("Seniors").should("not.exist");
    });

    it("opens the board when the home does have the Clinical module", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ authorizedModules: ["CRM", "CLINICAL"] }));
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.contains("Seniors").should("be.visible");
    });

    it("bounces an unauthenticated visitor", () => {
      cy.stubHome();
      stubShifts();
      stubSeniors();
      cy.visit(CLINICAL_PATH);

      cy.location("pathname", { timeout: 10000 }).should("not.eq", CLINICAL_PATH);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Error handling
  // -------------------------------------------------------------------------

  describe("Error handling", () => {
    it("keeps the shell up while the seniors query is failing", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 500,
        body: { error: "Clinical service unavailable" },
      }).as("getSeniors");
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      // `!data` renders the loader rather than a blank screen.
      cy.get("body").should("not.be.empty");
    });

    it("does not crash when the seniors query ultimately fails", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 503,
        body: { error: "Service unavailable" },
      }).as("getSeniors");
      cy.visit(CLINICAL_PATH);

      cy.waitForQueryFailure("@getSeniors");
      cy.get("body").should("not.be.empty");
    });
  });

  // -------------------------------------------------------------------------
  // 6. End-to-end journey
  // -------------------------------------------------------------------------

  describe("End-to-end journey", () => {
    it("E2E - a nurse logs in and lands on the clinical board", { tags: [Tags.NURSE] }, () => {
      // utils/roles.ts routes a Nurse straight to /clinical after sign-in.
      cy.stubHome();
      stubShifts();
      stubSeniors();
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: {
          user: {
            userId: TEST_USER_ID,
            name: "Nina Nurse",
            associatedUserIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          },
        },
      }).as("getNurse");

      cy.loginAs("Nurse");
      cy.location("pathname", { timeout: 10000 }).should("eq", CLINICAL_PATH);
      cy.wait("@getSeniors");
      cy.contains("Seniors").should("be.visible");
    });

    it("E2E - a PCHO opens the clinical board from a fresh session", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      stubSeniors([
        buildSenior({ name: "Arthur Bean" }),
        buildSenior({ userId: "senior-2", name: "Mary Shaw" }),
      ]);
      cy.visit(CLINICAL_PATH);

      cy.wait("@getSeniors");
      cy.assertAuthorized("@getSeniors");
      cy.contains("Seniors").should("be.visible");
      cy.contains("2 members").should("be.visible");
      cy.contains("Arthur Bean").should("be.visible");
      cy.contains("Mary Shaw").should("be.visible");
    });
  });
});
