/// <reference types="cypress" />

/**
 * Staff Management — Dashboard
 *
 *   pages/hcm/index.tsx                               the route and its two gates
 *   components/hcm/dashboard/employer-dashboard.tsx   what a PCHO sees
 *   components/hcm/dashboard/ReviewTimeOffCard.tsx    Needs Review
 *   components/hcm/dashboard/employee-dashboard.tsx   what a carer sees
 *   components/hcm/timesheet/edit-time-card.tsx       the clock-in/out modal
 *
 * TWO DASHBOARDS, ONE ROUTE
 *   `/hcm` renders whichever of the two the role is entitled to:
 *   `HCM_EMPLOYER_DASHBOARD` (PCHO, HomeAdmin) or `HCM_EMPLOYEE_DASHBOARD`
 *   (PCG). A role with neither is pushed to its own initial route rather than
 *   being shown Access Denied. This spec is the employer dashboard, as a PCHO,
 *   with the employee one asserted only far enough to show the split works.
 *
 * WHICH SHIFT LANDS IN WHICH TAB
 *   The board fetches a two-day window — yesterday and today — and sorts it:
 *
 *     Completed        clock-in AND clock-out both set, and clocked out TODAY
 *     Now & Upcoming   anything not completed that starts today or ENDS today
 *
 *   That second clause is what keeps a night shift begun yesterday on the
 *   board, labelled "Started yesterday at …". A shift carrying `isOverlap` is
 *   dropped from both tabs before either rule runs.
 *
 * THE ⋮ MENU IS ONE ACTION WEARING TWO LABELS
 *   "Add Clock In" and "Add Clock Out" both dispatch the SAME
 *   `handleOpenEditTimeCardModal(shift)` — there is no separate clock-in-only
 *   flow. Each label flips to "Edit …" once that timestamp exists, so a
 *   half-punched shift shows one of each. Pinned as built.
 *
 * NEEDS REVIEW
 *   Time-off shifts that start today or later and are still undecided
 *   (`is_unavailability_approved === null`). Approve and Reject are the same
 *   `PUT /v1/hcm/shift/{id}` with a different boolean. The card is collapsed on
 *   first paint and the whole panel is absent when there is nothing to review.
 *
 * The clock-in/out modal itself is the same `EditTimeCard` the timesheets use
 * and is covered in depth in timesheet-daily-review.cy.ts, so only the handover
 * is asserted here. It has no notes field on this branch — see the README.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const HCM_PATH = "/hcm";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const TODAY = new Date(2026, 8, 8);
const YESTERDAY = new Date(2026, 8, 7);
const TOMORROW = new Date(2026, 8, 9);

const AVLON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BHUV = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";

/** An ISO instant at a local wall-clock time on a given day. */
const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

/** `h:mm a`, the format `formatTime` uses — derived, never hardcoded. */
const clockTime = (iso: string | null) => {
  const d = new Date(iso as string);
  const suffix = d.getHours() >= 12 ? "PM" : "AM";
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
};

/**
 * Mirror the app's `formatToLocalLongDate` exactly — `Intl.DateTimeFormat` on
 * the browser's own locale. Hardcoding "EEE, MMM d" assumed an en-US browser;
 * the deployed build runs whatever locale the runner ships (en-GB prints
 * "Tue, 8 Sept"), so the expectation has to be derived the same way.
 */
const longDate = (day: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);

const buildMember = (userId: string, name: string, role = "PCG") => ({
  userId,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role,
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  roaster: [{ pay_rate: "20", pay_frequency: "Hourly" }],
  isDeleted: false,
});

const AVLON_MEMBER = buildMember(AVLON, "Avlon Regal");
const BHUV_MEMBER = buildMember(BHUV, "bhuv Grey");

const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 6001,
  user_id: AVLON,
  user_name: "Avlon Regal",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: "20",
  pay_frequency: "Hourly",
  shift_start_time: at(TODAY, 0, 0),
  shift_end_time: at(TODAY, 1, 0),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

/** Scheduled today, nobody has punched — the screenshot's case. */
const UNPUNCHED = buildShift();

/** Clocked in and out today: 9–11, two hours at $20 → $40. */
const COMPLETED = buildShift({
  id: 6002,
  shift_start_time: at(TODAY, 9, 0),
  shift_end_time: at(TODAY, 11, 0),
  clock_in_timestamp: at(TODAY, 9, 0),
  clock_out_timestamp: at(TODAY, 11, 0),
});

/** Began 11pm yesterday, ends 7am today, still running. */
const OVERNIGHT = buildShift({
  id: 6003,
  shift_start_time: at(YESTERDAY, 23, 0),
  shift_end_time: at(TODAY, 7, 0),
  clock_in_timestamp: at(YESTERDAY, 23, 5),
});

const buildTimeOff = (overrides: Record<string, any> = {}) => ({
  id: 7001,
  user_id: BHUV,
  user_name: "bhuv Grey",
  home_id: TEST_HOME_ID,
  shift_status: "timeoff",
  pay_rate: "20",
  unavailability_reason: "Sick Leave",
  is_unavailability_approved: null,
  shift_start_time: at(TOMORROW, 0, 0),
  shift_end_time: at(TOMORROW, 23, 59),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  tab: (label: string) => cy.contains("span", label),
  /** A shift card — the nearest `shadow-md` block around the member's name. */
  card: (name: string) => cy.contains(name).closest('div[class*="shadow-md"]'),
  cardMenu: (name: string) => sel.card(name).find("svg").last(),
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),

  // Needs Review
  reviewPanel: () => cy.contains("Needs Review").parent(),
  timeOffToggle: () => cy.contains(/^Time Off Requests \(\d+\)$/),
  approve: () => cy.contains("button", "Approve"),
  reject: () => cy.contains("button", "Reject"),

  // The clock-in/out modal
  clockIn: () => cy.get('input[name="clock_in_time"]'),
  clockOut: () => cy.get('input[name="clock_out_time"]'),
  saveChanges: () => cy.contains("button", "Save changes"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

/**
 * The board makes two shift queries against one endpoint; only the time-off one
 * asks for `shift_status=timeoff`, which is how they are told apart.
 */
const stubShifts = (working: any[], timeOff: any[]) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
    const status = new URL(req.url).searchParams.get("shift_status");
    req.reply({
      statusCode: 200,
      body: { shifts: status === "timeoff" ? timeOff : working },
    });
  }).as("getShifts");

const visitDashboard = (
  working: any[] = [UNPUNCHED],
  timeOff: any[] = [],
  opts: { role?: any; home?: any; members?: any[]; expectRestricted?: boolean } = {}
) => {
  const members = opts.members ?? [AVLON_MEMBER, BHUV_MEMBER];

  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? members : [] },
    });
  }).as("getStaff");
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("/").pop()?.split("?")[0];
    req.reply({
      statusCode: 200,
      body: { user: members.find((m) => m.userId === id) ?? members[0] },
    });
  }).as("getMember");
  stubShifts(working, timeOff);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(HCM_PATH);
  if (opts.expectRestricted) return;
  cy.contains("Needs Review", { timeout: 10000 }).should("be.visible");
};

const stubTimeOffDecision = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode, body }).as("decide");

describe("Staff Management — Dashboard", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The header
  // ──────────────────────────────────────────────────────────────────────────

  describe("The header", () => {
    beforeEach(() => visitDashboard([COMPLETED]));

    it("dates today", () => {
      cy.contains(longDate(TODAY)).should("be.visible");
    });

    it("labels the day's totals", () => {
      cy.contains("Paid Hours").should("be.visible");
      cy.contains("Wages").should("be.visible");
    });

    it("counts the hours actually worked", () => {
      // 9–11 is two hours.
      cy.contains("Paid Hours").parent().should("contain.text", "2");
    });

    it("values them at the shift's rate", () => {
      // Two hours at $20.
      cy.contains("Wages").parent().should("contain.text", "$40");
    });

    it("counts nothing from a shift still in progress", () => {
      visitDashboard([UNPUNCHED]);
      cy.contains("Paid Hours").parent().should("contain.text", "0");
      cy.contains("Wages").parent().should("contain.text", "$0");
    });

    it("adds up several completed shifts", () => {
      visitDashboard([
        COMPLETED,
        buildShift({
          id: 6004,
          shift_start_time: at(TODAY, 13, 0),
          shift_end_time: at(TODAY, 16, 0),
          clock_in_timestamp: at(TODAY, 13, 0),
          clock_out_timestamp: at(TODAY, 16, 0),
        }),
      ]);
      cy.contains("Paid Hours").parent().should("contain.text", "5");
      cy.contains("Wages").parent().should("contain.text", "$100");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Sorting shifts into the two tabs
  // ──────────────────────────────────────────────────────────────────────────

  describe("The two tabs", () => {
    it("counts each tab in its own label", () => {
      visitDashboard([UNPUNCHED, COMPLETED]);
      sel.tab("Now & Upcoming (1)").should("be.visible");
      sel.tab("Completed (1)").should("be.visible");
    });

    it("opens on Now & Upcoming", () => {
      visitDashboard([UNPUNCHED]);
      cy.contains("Not clocked in").should("be.visible");
    });

    it("puts an unpunched shift in Now & Upcoming", () => {
      visitDashboard([UNPUNCHED]);
      sel.tab("Now & Upcoming (1)").should("be.visible");
      sel.tab("Completed (0)").should("be.visible");
    });

    it("puts a fully punched shift in Completed", () => {
      visitDashboard([COMPLETED]);
      sel.tab("Now & Upcoming (0)").should("be.visible");
      sel.tab("Completed (1)").should("be.visible");
    });

    it("keeps a half-punched shift in Now & Upcoming", () => {
      // Clocked in but not out — not complete, so it is still current.
      visitDashboard([
        buildShift({ clock_in_timestamp: at(TODAY, 9, 0) }),
      ]);
      sel.tab("Now & Upcoming (1)").should("be.visible");
      sel.tab("Completed (0)").should("be.visible");
    });

    it("keeps a night shift begun yesterday on the board", () => {
      visitDashboard([OVERNIGHT]);
      sel.tab("Now & Upcoming (1)").should("be.visible");
    });

    it("says when a shift began yesterday", () => {
      visitDashboard([OVERNIGHT]);
      cy.contains(
        `Started yesterday at ${clockTime(OVERNIGHT.shift_start_time)}`
      ).should("be.visible");
    });

    it("drops a conflicting shift from both tabs", () => {
      // `isOverlap` shifts are hidden entirely rather than flagged.
      visitDashboard([buildShift({ isOverlap: true })]);
      sel.tab("Now & Upcoming (0)").should("be.visible");
      sel.tab("Completed (0)").should("be.visible");
    });

    it("switches to Completed", () => {
      visitDashboard([COMPLETED]);
      sel.tab("Completed (1)").click();
      cy.contains("hrs Worked").should("be.visible");
    });

    it("switches back to Now & Upcoming", () => {
      visitDashboard([UNPUNCHED, COMPLETED]);
      sel.tab("Completed (1)").click();
      sel.tab("Now & Upcoming (1)").click();
      cy.contains("Not clocked in").should("be.visible");
    });

    it("says so when nothing is current", () => {
      visitDashboard([]);
      cy.contains("No ongoing or upcoming shifts").should("be.visible");
    });

    it("says so when nothing is finished", () => {
      visitDashboard([UNPUNCHED]);
      sel.tab("Completed (0)").click();
      cy.contains("No completed shifts").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. A Now & Upcoming card
  // ──────────────────────────────────────────────────────────────────────────

  describe("A current shift", () => {
    beforeEach(() => visitDashboard([UNPUNCHED]));

    it("names the member", () => {
      cy.contains("Avlon Regal").should("be.visible");
    });

    it("says what they are", () => {
      // A PCG is shown as "Care Team".
      sel.card("Avlon Regal").should("contain.text", "Care Team");
    });

    it("flags that nobody has clocked in", () => {
      cy.contains("Not clocked in").should("be.visible");
    });

    it("marks that warning in red", () => {
      cy.contains("Not clocked in").should("have.class", "text-red-700");
    });

    it("shows the hours they were scheduled for", () => {
      sel.card("Avlon Regal").should(
        "contain.text",
        `${clockTime(UNPUNCHED.shift_start_time)} – ${clockTime(
          UNPUNCHED.shift_end_time
        )}`
      );
    });

    it("reports a clock-in once there is one", () => {
      const punched = buildShift({ clock_in_timestamp: at(TODAY, 0, 5) });
      visitDashboard([punched]);
      cy.contains(`${clockTime(punched.clock_in_timestamp)} Clocked In`).should(
        "be.visible"
      );
    });

    it("marks that in green", () => {
      visitDashboard([buildShift({ clock_in_timestamp: at(TODAY, 0, 5) })]);
      cy.contains("Clocked In").should("have.class", "text-green-700");
    });

    it("gives every card a ⋮ menu", () => {
      sel.cardMenu("Avlon Regal").should("exist");
    });
  });

  describe("A completed shift", () => {
    beforeEach(() => {
      visitDashboard([COMPLETED]);
      sel.tab("Completed (1)").click();
    });

    it("reports the hours worked", () => {
      cy.contains("2 hrs Worked").should("be.visible");
    });

    it("shows the punched times", () => {
      cy.contains(
        `${clockTime(COMPLETED.clock_in_timestamp)} – ${clockTime(
          COMPLETED.clock_out_timestamp
        )}`
      ).should("be.visible");
    });

    it("says nothing about a difference when it matched the schedule", () => {
      cy.contains("scheduled time").should("not.exist");
    });

    it("reports time over the schedule", () => {
      visitDashboard([
        buildShift({
          id: 6005,
          shift_start_time: at(TODAY, 9, 0),
          shift_end_time: at(TODAY, 11, 0),
          clock_in_timestamp: at(TODAY, 9, 0),
          clock_out_timestamp: at(TODAY, 11, 30),
        }),
      ]);
      sel.tab("Completed (1)").click();
      cy.contains("30 min over scheduled time").should("be.visible");
    });

    it("reports time under the schedule", () => {
      visitDashboard([
        buildShift({
          id: 6006,
          shift_start_time: at(TODAY, 9, 0),
          shift_end_time: at(TODAY, 11, 0),
          clock_in_timestamp: at(TODAY, 9, 0),
          clock_out_timestamp: at(TODAY, 10, 15),
        }),
      ]);
      sel.tab("Completed (1)").click();
      cy.contains("45 min under scheduled time").should("be.visible");
    });

    it("still offers a ⋮ menu", () => {
      sel.cardMenu("Avlon Regal").should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. The ⋮ menu and the clock-in/out card
  // ──────────────────────────────────────────────────────────────────────────

  describe("The ⋮ menu", () => {
    it("offers to add both punches when there are none", () => {
      visitDashboard([UNPUNCHED]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Add Clock In").should("be.visible");
      sel.item("Add Clock Out").should("be.visible");
    });

    it("offers to edit a punch that already exists", () => {
      visitDashboard([buildShift({ clock_in_timestamp: at(TODAY, 0, 5) })]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Edit Clock In").should("be.visible");
      sel.item("Add Clock Out").should("be.visible");
    });

    it("offers to edit both on a completed shift", () => {
      visitDashboard([COMPLETED]);
      sel.tab("Completed (1)").click();
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Edit Clock In").should("be.visible");
      sel.item("Edit Clock Out").should("be.visible");
    });

    it("opens the time card from Add Clock In", () => {
      visitDashboard([UNPUNCHED]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Add Clock In").click();
      sel.clockIn().should("be.visible");
    });

    it("[as-built] opens the same card from Add Clock Out", () => {
      // Both entries dispatch `handleOpenEditTimeCardModal(shift)`; there is no
      // clock-out-only flow, so the second label is cosmetic.
      visitDashboard([UNPUNCHED]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Add Clock Out").click();
      sel.clockIn().should("be.visible");
      sel.clockOut().should("be.visible");
    });

    it("sends nothing merely by opening the menu", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitDashboard([UNPUNCHED]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      cy.assertNoRequest("@updateShift");
    });
  });

  describe("The clock-in/out card", () => {
    beforeEach(() => {
      visitDashboard([UNPUNCHED]);
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Add Clock In").click();
      sel.clockIn().should("be.visible");
    });

    it("names the member and the day", () => {
      cy.get('div[class*="text-[24px]"]').should("have.text", "Avlon Regal");
      cy.contains(longDate(TODAY)).should("be.visible");
    });

    it("says where they work", () => {
      cy.get('div[class*="text-[24px]"]')
        .parent()
        .should("contain.text", "Care Team")
        .and("contain.text", "at Comfort Cove");
    });

    it("shows the schedule without letting it be edited", () => {
      cy.contains("Scheduled :").should("be.visible");
      cy.get('input[name="shift_start_time"]').should("not.exist");
    });

    it("opens with both fields empty", () => {
      sel.clockIn().should("have.value", "");
      sel.clockOut().should("have.value", "");
    });

    it("locks Clocked Out until Clocked In is filled", () => {
      sel.clockOut().should("be.disabled");
    });

    it("records the punches that were entered", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode: 200, body: {} }).as(
        "updateShift"
      );
      sel.clockIn().type("00:05");
      sel.clockOut().type("00:55");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.url).to.contain("/v1/hcm/shift/6001");
        expect(new Date(request.body.clock_in_timestamp).getHours()).to.eq(0);
        expect(new Date(request.body.clock_in_timestamp).getMinutes()).to.eq(5);
      });
      cy.assertPopover("Timecard updated successfully");
    });

    it("refuses a clock-out at or before the clock-in", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      sel.clockIn().type("00:30");
      sel.clockOut().type("00:30");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Needs Review
  // ──────────────────────────────────────────────────────────────────────────

  describe("Needs Review", () => {
    it("heads the panel", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      cy.contains("Needs Review").should("be.visible");
    });

    it("counts the outstanding requests", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      cy.contains("Time Off Requests (1)").should("be.visible");
    });

    it("counts several", () => {
      visitDashboard(
        [UNPUNCHED],
        [
          buildTimeOff(),
          buildTimeOff({ id: 7002, shift_start_time: at(new Date(2026, 8, 15), 0, 0) }),
        ]
      );
      cy.contains("Time Off Requests (2)").should("be.visible");
    });

    it("shows nothing to review when there is nothing", () => {
      visitDashboard([UNPUNCHED], []);
      cy.contains("Time Off Requests").should("not.exist");
    });

    it("leaves a decided request out", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff({ is_unavailability_approved: true })]);
      cy.contains("Time Off Requests").should("not.exist");
    });

    it("leaves a request from the past out", () => {
      visitDashboard(
        [UNPUNCHED],
        [buildTimeOff({ shift_start_time: at(new Date(2026, 8, 1), 0, 0) })]
      );
      cy.contains("Time Off Requests").should("not.exist");
    });

    it("keeps a request starting today", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff({ shift_start_time: at(TODAY, 0, 0) })]);
      cy.contains("Time Off Requests (1)").should("be.visible");
    });

    it("starts collapsed", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      cy.contains("bhuv Grey").should("not.exist");
    });

    it("expands on click", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      sel.timeOffToggle().click();
      cy.contains("bhuv Grey").should("be.visible");
    });

    it("collapses again", () => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      sel.timeOffToggle().click();
      cy.contains("bhuv Grey").should("be.visible");
      sel.timeOffToggle().click();
      cy.contains("bhuv Grey").should("not.exist");
    });
  });

  describe("A time-off request", () => {
    beforeEach(() => {
      visitDashboard([UNPUNCHED], [buildTimeOff()]);
      sel.timeOffToggle().click();
      cy.contains("bhuv Grey").should("be.visible");
    });

    it("names who asked", () => {
      cy.contains("bhuv Grey").should("be.visible");
    });

    it("gives the reason", () => {
      cy.contains("Sick Leave").should("be.visible");
    });

    it("dates a single day once", () => {
      cy.contains(longDate(TOMORROW)).should("be.visible");
    });

    it("dates a range from end to end", () => {
      visitDashboard(
        [UNPUNCHED],
        [
          buildTimeOff({
            shift_start_time: at(TOMORROW, 0, 0),
            shift_end_time: at(new Date(2026, 8, 11), 23, 59),
          }),
        ]
      );
      sel.timeOffToggle().click();
      cy.contains(
        `${longDate(TOMORROW)} - ${longDate(new Date(2026, 8, 11))}`
      ).should("be.visible");
    });

    it("offers Approve and Reject", () => {
      sel.approve().should("be.visible");
      sel.reject().should("be.visible");
    });

    it("sends nothing until one is pressed", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("decide");
      cy.assertNoRequest("@decide");
    });

    it("approves the request", () => {
      stubTimeOffDecision();
      sel.approve().click();
      cy.wait("@decide").then(({ request }) => {
        expect(request.url).to.contain("/v1/hcm/shift/7001");
        expect(request.body.is_unavailability_approved).to.eq(true);
      });
      cy.assertPopover("Timeoff Approved successfully");
    });

    it("rejects the request", () => {
      stubTimeOffDecision();
      sel.reject().click();
      cy.wait("@decide").then(({ request }) => {
        expect(request.body.is_unavailability_approved).to.eq(false);
      });
      cy.assertPopover("Timeoff Rejected successfully");
    });

    it("keeps the rest of the shift intact", () => {
      stubTimeOffDecision();
      sel.approve().click();
      cy.wait("@decide").then(({ request }) => {
        expect(request.body.shift_status).to.eq("timeoff");
        expect(request.body.unavailability_reason).to.eq("Sick Leave");
        expect(request.body.pay_rate).to.eq(20);
      });
    });

    it("strips the fields the shift endpoint rejects", () => {
      stubTimeOffDecision();
      sel.approve().click();
      cy.wait("@decide").then(({ request }) => {
        ["user_name", "created_at", "updated_at"].forEach((field) =>
          expect(request.body, `${field} omitted`).not.to.have.property(field)
        );
      });
    });

    it("authorises the decision", () => {
      stubTimeOffDecision();
      sel.approve().click();
      cy.wait("@decide");
      cy.assertAuthorized("@decide");
    });

    it("reports a rejected approval", () => {
      stubTimeOffDecision(500, { message: "Shift is locked" });
      sel.approve().click();
      cy.wait("@decide");
      cy.assertPopover("Error approving timeoff : Shift is locked");
    });

    it("reports a rejected rejection", () => {
      stubTimeOffDecision(500, { message: "Shift is locked" });
      sel.reject().click();
      cy.wait("@decide");
      cy.assertPopover("Error rejecting timeoff : Shift is locked");
    });

    it("falls back to a generic message when the API gives no reason", () => {
      stubTimeOffDecision(500, {});
      sel.approve().click();
      cy.wait("@decide");
      cy.assertPopover("Error approving timeoff : Something Went Wrong");
    });

    it("decides one request without touching the other", () => {
      stubTimeOffDecision();
      visitDashboard(
        [UNPUNCHED],
        [
          buildTimeOff(),
          buildTimeOff({ id: 7002, user_name: "Avlon Regal", user_id: AVLON }),
        ]
      );
      sel.timeOffToggle().click();

      cy.contains("button", "Approve").first().click();
      cy.wait("@decide").then(({ request }) => {
        expect(request.url).to.contain("/v1/hcm/shift/7001");
      });
      cy.get("@decide.all").should("have.length", 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. What the dashboard asks the API for
  // ──────────────────────────────────────────────────────────────────────────

  describe("The queries behind the board", () => {
    it("asks for this home's shifts only", () => {
      visitDashboard();
      cy.get("@getShifts.all").should((interceptions: any) => {
        expect(interceptions.length).to.be.greaterThan(0);
        interceptions.forEach((i: any) =>
          expect(new URL(i.request.url).searchParams.get("home_id")).to.eq(
            TEST_HOME_ID
          )
        );
      });
    });

    it("asks for a two-day window of working shifts", () => {
      visitDashboard();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const working = interceptions.find(
          (i: any) =>
            new URL(i.request.url).searchParams.get("shift_status") === "available"
        );
        expect(working, "an available-shift query").to.exist;
        const window = new URL(working.request.url).searchParams.getAll(
          "shift_start_time"
        );
        expect(window).to.have.length(2);
        expect(new Date(window[0]).getDate(), "starts yesterday").to.eq(7);
      });
    });

    it("asks for time off without a date window", () => {
      visitDashboard();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const timeOff = interceptions.find(
          (i: any) =>
            new URL(i.request.url).searchParams.get("shift_status") === "timeoff"
        );
        expect(timeOff, "a timeoff query").to.exist;
        expect(
          new URL(timeOff.request.url).searchParams.getAll("shift_start_time")
        ).to.have.length(0);
      });
    });

    it("scopes both queries to the active team", () => {
      visitDashboard();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const ids = interceptions.flatMap((i: any) =>
          new URL(i.request.url).searchParams.getAll("user_id")
        );
        expect(ids).to.include(AVLON);
      });
    });

    it("leaves a deleted member out", () => {
      visitDashboard([UNPUNCHED], [], {
        members: [AVLON_MEMBER, { ...BHUV_MEMBER, isDeleted: true }],
      });
      cy.get("@getShifts.all").should((interceptions: any) => {
        const ids = interceptions.flatMap((i: any) =>
          new URL(i.request.url).searchParams.getAll("user_id")
        );
        expect(ids).to.include(AVLON);
        expect(ids).to.not.include(BHUV);
      });
    });

    it("sends the session token with every query", () => {
      visitDashboard();
      cy.getCookie("idToken").then((cookie) => {
        cy.get("@getShifts.all").should((interceptions: any) => {
          expect(interceptions.length).to.be.greaterThan(0);
          interceptions.forEach((i: any) =>
            expect(i.request.headers.authorization).to.eq(`Bearer ${cookie?.value}`)
          );
        });
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the board when the home has no staff management module", () => {
      visitDashboard([UNPUNCHED], [], {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
        expectRestricted: true,
      });
      cy.assertRestricted();
    });

    it("gives a carer the employee dashboard instead", { tags: [Tags.PCG] }, () => {
      // A PCG holds HCM_EMPLOYEE_DASHBOARD, not the employer one.
      visitDashboard([UNPUNCHED], [], { role: "PCG", expectRestricted: true });
      cy.contains("Your Week", { timeout: 10000 }).should("be.visible");
      cy.contains("Needs Review").should("not.exist");
    });

    it("keeps the employer's tabs away from a carer", { tags: [Tags.PCG] }, () => {
      visitDashboard([UNPUNCHED], [], { role: "PCG", expectRestricted: true });
      cy.contains("My Schedule", { timeout: 10000 }).should("be.visible");
      cy.contains("Now & Upcoming").should("not.exist");
    });

    it("[as-built] hides the wages figure from a HomeAdmin", { tags: [Tags.HOMEADMIN] }, () => {
      // `role === PCHO` gates the Wages column; a HomeAdmin sees the employer
      // dashboard but only its Paid Hours.
      visitDashboard([COMPLETED], [], { role: "HomeAdmin" });
      cy.contains("Paid Hours").should("be.visible");
      cy.contains("Wages").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a missing punch is spotted and filled in from the dashboard", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode: 200, body: {} }).as(
        "updateShift"
      );
      visitDashboard([UNPUNCHED]);

      cy.contains("Not clocked in").should("be.visible");
      sel.cardMenu("Avlon Regal").click({ force: true });
      sel.item("Add Clock In").click();

      sel.clockOut().should("be.disabled");
      sel.clockIn().type("00:05");
      sel.clockOut().type("00:55");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(new Date(request.body.clock_in_timestamp).getMinutes()).to.eq(5);
        expect(new Date(request.body.clock_out_timestamp).getMinutes()).to.eq(55);
      });
      cy.assertPopover("Timecard updated successfully");
      sel.clockIn().should("not.exist");
    });

    it("E2E — a time-off request is reviewed and approved", () => {
      stubTimeOffDecision();
      visitDashboard([UNPUNCHED], [buildTimeOff()]);

      cy.contains("Time Off Requests (1)").click();
      cy.contains("bhuv Grey").should("be.visible");
      cy.contains("Sick Leave").should("be.visible");

      sel.approve().click();
      cy.wait("@decide").then(({ request }) => {
        expect(request.body.is_unavailability_approved).to.eq(true);
      });
      cy.assertPopover("Timeoff Approved successfully");
    });

    it("E2E — the board separates the finished from the outstanding", () => {
      visitDashboard([UNPUNCHED, COMPLETED], [buildTimeOff()]);

      sel.tab("Now & Upcoming (1)").should("be.visible");
      cy.contains("Not clocked in").should("be.visible");

      sel.tab("Completed (1)").click();
      cy.contains("2 hrs Worked").should("be.visible");

      cy.contains("Paid Hours").parent().should("contain.text", "2");
      cy.contains("Time Off Requests (1)").should("be.visible");
    });
  });
});
