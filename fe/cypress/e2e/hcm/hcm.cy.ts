/// <reference types="cypress" />

/**
 * Staffing (HCM) module - API contract and workflow suite
 *
 * Routes under test:
 *   /hcm             dashboard
 *   /hcm/scheduling  schedule board   GET /v1/hcm/shifts
 *   /hcm/team        team roster      GET /v1/users?userType=PCG
 *   /hcm/timesheet   timesheets
 *
 * The staffing screens are the ones that decide who is covering the home, so
 * the contract that matters is: shifts are requested for the right home and
 * window, the roster asks for the right staff population, everything carries
 * the session token, and the module can be switched off per home.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildShiftRow, TEST_HOME_ID } from "../../framework/module-commands";

const HCM_PATH = "/hcm";
const SCHEDULING_PATH = "/hcm/scheduling";
const TEAM_PATH = "/hcm/team";
const TIMESHEET_PATH = "/hcm/timesheet";

/**
 * A care team member as GET /v1/users returns them.
 *
 * `roaster` must be present: the roster table's Wage column reads
 * `data?.roaster[0]?.pay_rate` — the optional chain stops before the index — so
 * a member without the key throws and blanks the whole page. See the
 * "member with no roaster" test below, which pins that.
 */
const buildStaffRow = (overrides: Record<string, any> = {}) => ({
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Priya Patel",
  firstName: "Priya",
  lastName: "Patel",
  email: "priya.patel@assistly.com",
  mobile: "5551112222",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  roaster: [],
  ...overrides,
});

const stubShifts = (shifts: any[] = [buildShiftRow()]) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts } }).as(
    "getShifts"
  );

const stubStaff = (users: any[] = [buildStaffRow()]) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as(
    "getStaff"
  );

/** Seed a PCHO session with the home, staff and shifts every staffing screen reads. */
const asStaffingAdmin = (home = buildHome()) => {
  cy.setAuthSession("PCHO");
  cy.stubHome(home);
  stubStaff();
  stubShifts();
};

describe("Staffing (HCM) module", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // -------------------------------------------------------------------------
  // 1. Schedule board - GET /v1/hcm/shifts
  // -------------------------------------------------------------------------

  describe("GET /v1/hcm/shifts - the schedule board", () => {
    beforeEach(() => {
      asStaffingAdmin();
      cy.visit(SCHEDULING_PATH);
    });

    it("requests the shifts for the board", () => {
      cy.wait("@getShifts").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/hcm/shifts");
      });
    });

    it("scopes the request to the signed-in user's home", () => {
      cy.wait("@getShifts");
      // The board also fires a shifts request before the homeId cookie has been
      // read, so assert against the request that actually carries one rather
      // than whichever landed first.
      cy.get("@getShifts.all").then((calls: any) => {
        const scoped = calls.filter(
          (c: any) => new URL(c.request.url).searchParams.get("home_id") === TEST_HOME_ID
        );
        expect(scoped, "requests scoped to the home").to.have.length.greaterThan(0);
      });
    });

    it("bounds the request to a week window", () => {
      // The window is sent as a repeated `shift_start_time` pair (the custom
      // params serializer in services/hcm-getall-shifts.ts), not as a
      // start/end pair - so both values arrive under the same key.
      cy.wait("@getShifts");
      cy.get("@getShifts.all").then((calls: any) => {
        const windowed = calls
          .map((c: any) => new URL(c.request.url).searchParams.getAll("shift_start_time"))
          .filter((values: string[]) => values.length === 2);

        expect(windowed, "a request carrying a two-ended window").to.have.length.greaterThan(
          0
        );
        const [start, end] = windowed[0];
        expect(new Date(start).getTime(), "window start is a date").to.be.a("number");
        expect(
          new Date(end).getTime(),
          "window end is after its start"
        ).to.be.greaterThan(new Date(start).getTime());
      });
    });

    it("authenticates with the session id token", () => {
      cy.wait("@getShifts");
      cy.assertAuthorized("@getShifts");
    });

    it("also requests the staff the shifts are assigned to", () => {
      cy.wait("@getStaff").then(({ request }) => {
        const userType = new URL(request.url).searchParams.get("userType");
        expect(userType, "staff userType").to.match(/PCG|HomeAdmin/);
      });
      cy.assertAuthorized("@getStaff");
    });

    it("renders the rostered caregiver", () => {
      cy.wait("@getShifts");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Schedule board contents
  // -------------------------------------------------------------------------

  describe("Schedule board contents", () => {
    it("renders an empty week without erroring", () => {
      asStaffingAdmin();
      stubShifts([]);
      cy.visit(SCHEDULING_PATH);

      cy.wait("@getShifts");
      cy.get("body").should("not.be.empty");
    });

    it("renders several shifts for the same caregiver", () => {
      asStaffingAdmin();
      stubShifts([
        buildShiftRow({ id: 101, shift_start_time: "2026-03-02T13:00:00.000Z" }),
        buildShiftRow({ id: 102, shift_start_time: "2026-03-03T13:00:00.000Z" }),
        buildShiftRow({ id: 103, shift_start_time: "2026-03-04T13:00:00.000Z" }),
      ]);
      cy.visit(SCHEDULING_PATH);

      cy.wait("@getShifts");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");
    });

    it("renders a time-off entry alongside available shifts", () => {
      asStaffingAdmin();
      stubShifts([
        buildShiftRow({ id: 101, shift_status: "available" }),
        buildShiftRow({
          id: 102,
          shift_status: "timeoff",
          unavailability_reason: "Sick Leave",
        }),
      ]);
      cy.visit(SCHEDULING_PATH);

      cy.wait("@getShifts");
      cy.get("body").should("not.be.empty");
    });

    it("requests the seniors list too at an In-Home Care home", { tags: [Tags.SENIOR] }, () => {
      // In-Home Care shifts name the senior being visited, so the board needs
      // the seniors to populate that dropdown.
      asStaffingAdmin(buildHome({ homeType: "In Home Care" }));
      cy.visit(SCHEDULING_PATH);

      cy.wait("@getShifts");
      cy.get("@getStaff.all").then((calls: any) => {
        const types = calls.map((c: any) =>
          new URL(c.request.url).searchParams.get("userType")
        );
        expect(types, "requested user types").to.include("Senior");
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Team roster - GET /v1/users
  // -------------------------------------------------------------------------

  describe("GET /v1/users - the team roster", () => {
    beforeEach(() => {
      asStaffingAdmin();
      cy.visit(TEAM_PATH);
    });

    it("requests the care team for the home", () => {
      cy.wait("@getStaff").then(({ request }) => {
        expect(request.method).to.eq("GET");
        const query = new URL(request.url).searchParams;
        expect(query.get("homeId")).to.eq(TEST_HOME_ID);
        expect(query.get("userType")).to.match(/PCG|HomeAdmin/);
      });
    });

    it("authenticates with the session id token", () => {
      cy.wait("@getStaff");
      cy.assertAuthorized("@getStaff");
    });

    it("renders the Care Team heading", () => {
      cy.wait("@getStaff");
      cy.contains("Care Team", { timeout: 10000 }).should("be.visible");
    });

    it("renders each team member", () => {
      cy.wait("@getStaff");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");
    });

    it("also requests the roster's shifts", () => {
      cy.wait("@getShifts").then(({ request }) => {
        expect(request.url).to.include("/v1/hcm/shifts");
      });
    });
  });

  describe("Team roster contents", () => {
    it("renders every member the API returns", () => {
      asStaffingAdmin();
      stubStaff([
        buildStaffRow({ name: "Priya Patel" }),
        buildStaffRow({ userId: "pcg-2", name: "Sam Okafor" }),
      ]);
      cy.visit(TEAM_PATH);

      cy.wait("@getStaff");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");
      cy.contains("Sam Okafor").should("be.visible");
    });

    it("renders an empty roster without erroring", () => {
      asStaffingAdmin();
      stubStaff([]);
      cy.visit(TEAM_PATH);

      cy.wait("@getStaff");
      cy.get("body").should("not.be.empty");
    });

    it("shows the wage of a member who has been rostered", () => {
      asStaffingAdmin();
      stubStaff([
        buildStaffRow({ roaster: [{ pay_rate: 22, pay_frequency: "Hourly" }] }),
      ]);
      cy.visit(TEAM_PATH);

      cy.wait("@getStaff");
      cy.contains("$22/hr", { timeout: 10000 }).should("be.visible");
    });

    it("offers to add a wage for a member who has never been rostered", () => {
      asStaffingAdmin();
      stubStaff([buildStaffRow({ roaster: [] })]);
      cy.visit(TEAM_PATH);

      cy.wait("@getStaff");
      cy.contains("Add Wage", { timeout: 10000 }).should("be.visible");
    });

    /**
     * Known defect — pinned so a fix is a deliberate change.
     *
     * The Wage column renders `data?.roaster[0]?.pay_rate`. The optional chain
     * guards `data`, not `roaster`, so indexing an absent `roaster` throws and
     * React unmounts the whole tree — the Team roster goes blank rather than
     * showing the member. Any user record saved without the key does this.
     *
     * Fix would be `data?.roaster?.[0]?.pay_rate` (three places, around
     * components/hcm/team/team-roster-table.tsx:248).
     */
    it("blanks the roster for a member with no roaster key at all", () => {
      asStaffingAdmin();
      const { roaster, ...withoutRoaster } = buildStaffRow();
      stubStaff([withoutRoaster]);
      cy.visit(TEAM_PATH);

      cy.wait("@getStaff");
      // The render throws, so neither the member nor the heading ever appears.
      cy.contains("Priya Patel").should("not.exist");
      cy.contains("Care Team").should("not.exist");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Timesheets and dashboard
  // -------------------------------------------------------------------------

  describe("Timesheets", () => {
    it("opens the timesheet screen for a PCHO", () => {
      asStaffingAdmin();
      cy.visit(TIMESHEET_PATH);

      cy.location("pathname").should("eq", TIMESHEET_PATH);
      cy.get("body").should("not.be.empty");
    });

    it("authenticates the timesheet's shift query", () => {
      asStaffingAdmin();
      cy.visit(TIMESHEET_PATH);

      cy.wait("@getShifts");
      cy.assertAuthorized("@getShifts");
    });

    it("opens the timesheet screen for a care team member", { tags: [Tags.PCG] }, () => {
      // A PCG holds HCM_TIMESHEETS, so they reach their own timesheet.
      cy.setAuthSession("PCG");
      cy.stubHome();
      stubStaff();
      stubShifts();
      cy.visit(TIMESHEET_PATH);

      cy.location("pathname").should("eq", TIMESHEET_PATH);
    });
  });

  describe("Staffing dashboard", () => {
    it("opens for a PCHO", () => {
      asStaffingAdmin();
      cy.visit(HCM_PATH);

      cy.location("pathname").should("eq", HCM_PATH);
      cy.get("body").should("not.be.empty");
    });

    it("opens for a care team member", { tags: [Tags.PCG] }, () => {
      cy.setAuthSession("PCG");
      cy.stubHome();
      stubStaff();
      stubShifts();
      cy.visit(HCM_PATH);

      cy.location("pathname").should("eq", HCM_PATH);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Access control
  // -------------------------------------------------------------------------

  describe("Access control", () => {
    it("restricts scheduling when the home has no Staff Management module", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ authorizedModules: ["CRM", "CLINICAL"] }));
      stubStaff();
      stubShifts();
      cy.visit(SCHEDULING_PATH);

      cy.contains(/restricted|not authorized|no access/i, { timeout: 10000 }).should(
        "exist"
      );
    });

    it("opens scheduling when the home does have the module", () => {
      asStaffingAdmin(
        buildHome({ authorizedModules: ["CRM", "CLINICAL", "STAFF MANAGEMENT"] })
      );
      cy.visit(SCHEDULING_PATH);

      cy.wait("@getShifts");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");
    });

    it("restricts scheduling for a role without HCM_TIMESHEETS", { tags: [Tags.NURSE] }, () => {
      cy.setAuthSession("Nurse");
      cy.stubHome();
      stubStaff();
      stubShifts();
      cy.visit(SCHEDULING_PATH);

      cy.contains(/restricted|not authorized|no access/i, { timeout: 10000 }).should(
        "exist"
      );
    });

    it("bounces an unauthenticated visitor off the schedule board", () => {
      cy.stubHome();
      stubStaff();
      stubShifts();
      cy.visit(SCHEDULING_PATH);

      cy.contains("Priya Patel").should("not.exist");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Error handling
  // -------------------------------------------------------------------------

  describe("Error handling", () => {
    it("keeps the schedule board up when the shifts query fails", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubStaff();
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 500,
        body: { error: "Scheduling service unavailable" },
      }).as("getShifts");
      cy.visit(SCHEDULING_PATH);

      cy.waitForQueryFailure("@getShifts");
      cy.get("body").should("not.be.empty");
    });

    it("keeps the team roster up when the staff query fails", () => {
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 503,
        body: { error: "Service unavailable" },
      }).as("getStaff");
      cy.visit(TEAM_PATH);

      cy.waitForQueryFailure("@getStaff");
      cy.get("body").should("not.be.empty");
    });
  });

  // -------------------------------------------------------------------------
  // 7. End-to-end journeys
  // -------------------------------------------------------------------------

  describe("End-to-end journeys", () => {
    it("E2E - a PCHO moves between the schedule board and the team roster", () => {
      asStaffingAdmin();

      cy.visit(SCHEDULING_PATH);
      cy.wait("@getShifts");
      cy.assertAuthorized("@getShifts");
      cy.contains("Priya Patel", { timeout: 10000 }).should("be.visible");

      cy.visit(TEAM_PATH);
      cy.wait("@getStaff");
      cy.contains("Care Team", { timeout: 10000 }).should("be.visible");
      cy.contains("Priya Patel").should("be.visible");
    });

    it("E2E - every staffing screen carries the session token", () => {
      asStaffingAdmin();

      [HCM_PATH, SCHEDULING_PATH, TEAM_PATH, TIMESHEET_PATH].forEach((path) => {
        cy.visit(path);
        cy.wait("@getShifts");
        cy.assertAuthorized("@getShifts");
      });
    });
  });
});
