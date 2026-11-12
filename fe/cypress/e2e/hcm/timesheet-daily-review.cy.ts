/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Staff Management — Timesheets: Daily review
 *
 *   pages/hcm/timesheet/index.tsx                    the route and its gate
 *   components/hcm/timesheet/time-sheet-header.tsx   the two tabs
 *   components/hcm/timesheet/daily_review.tsx        the date button and table
 *   components/hcm/timesheet/time-sheet-cell.tsx     the member column
 *   components/hcm/timesheet/edit-time-card.tsx      the edit modal
 *   components/hcm/utils/timeUtils.ts                processShiftTimes
 *
 * The Pay period review tab is the next section and is only touched here to the
 * extent of proving it exists and can be switched to.
 *
 * WHAT A ROW IS
 *   One row per SHIFT, not per member — the same person appears twice if they
 *   are scheduled twice that day, which is what the board shows. Rows come from
 *   `GET /v1/hcm/shifts` narrowed to the selected day, `shift_status=available`,
 *   the home, and the ids of every non-deleted PCG and HomeAdmin.
 *
 * THE THREE LINES IN "WORKED"
 *   `processShiftTimes` builds all of them, and each has an edge worth pinning:
 *
 *     worked      `h:mm a – h:mm a`, or `--:--` per side when not clocked
 *     scheduled   the same format, always rendered
 *     difference  only when ALL FOUR timestamps exist, and only when the
 *                 difference is non-zero — an exactly-to-schedule shift shows
 *                 no third line at all
 *
 *   The difference reads "N min under/over scheduled time", with hours folded in
 *   ("1 hr 30 min") and the "hrs" plural only past one hour.
 *
 * THE DATE BUTTON
 *   A visible div with a transparent `input[type=date]` laid over it. The input
 *   carries `max={today}`, so no future date can be picked. Cypress types into
 *   the input directly; the `showPicker()` on the wrapper is native UI.
 *
 * AM/PM
 *   The modal's fields are `input[type=time]`, whose DOM value is 24-hour
 *   (`14:00`) whatever the browser displays. What goes on the wire is the
 *   SHIFT'S date joined to that time and converted to UTC, so the tests assert
 *   the local rendering of what was sent rather than a hardcoded `Z` string —
 *   the same rule as the scheduling specs.
 *
 * NOT PRESENT: SHIFT NOTES
 *   This modal has no notes field. `edit-time-card.tsx` renders the date, the
 *   member, Clocked In / Clocked Out, the read-only Scheduled line and Save
 *   changes — nothing else; "Shift Notes" exists only in the scheduling board's
 *   Add shift form. Nothing is asserted about notes here. See the README.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const TIMESHEET_PATH = "/hcm/timesheet";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

/** The day the tests work on: a past date, as the flow describes. */
const REVIEW_DAY = new Date(2026, 8, 4); // Friday 4 September 2026
const REVIEW_DAY_INPUT = "2026-09-04";

const TEJU = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOHN = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";

/** An ISO instant at a local wall-clock time on a given day. */
const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

/** `h:mm a`, the format `formatTime` uses — derived, never hardcoded. */
const workedTime = (iso: string | null) => {
  const d = new Date(iso as string);
  const suffix = d.getHours() >= 12 ? "PM" : "AM";
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
};

/** The `dddd, MMM D, YYYY` label on the date button. */
const dayLabel = (day: Date) =>
  `${day.toLocaleString("en-US", { weekday: "long" })}, ${day.toLocaleString("en-US", {
    month: "short",
  })} ${day.getDate()}, ${day.getFullYear()}`;

const buildMember = (userId: string, name: string) => ({
  userId,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "PCG",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
});

const TEJU_MEMBER = buildMember(TEJU, "Teju Carelead");
const JOHN_MEMBER = buildMember(JOHN, "John Sarah Doe");

/** A shift row as GET /v1/hcm/shifts returns it for the daily review. */
const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 8001,
  user_id: TEJU,
  user_name: "Teju Carelead",
  user_profile_image_url: "",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: "15",
  pay_frequency: "Hourly",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  created_by_user_name: "Admin",
  shift_start_time: at(REVIEW_DAY, 0, 0),
  shift_end_time: at(REVIEW_DAY, 2, 45),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

/** Worked 6:40–8:39 (119 min) against a 165-min schedule → 46 min under. */
const UNDER_SHIFT = buildShift({
  clock_in_timestamp: at(REVIEW_DAY, 6, 40),
  clock_out_timestamp: at(REVIEW_DAY, 8, 39),
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  tab: (label: string) => cy.contains("span", label),
  dateInput: () => cy.get('input[type="date"]'),
  dateLabel: () => cy.contains("div", /^\w+day, \w{3} \d{1,2}, \d{4}$/),
  rows: () => cy.get('div[class*="border-b"]'),
  /** The Worked cell for a member — the whole clickable block. */
  worked: (name: string) =>
    cy.contains(name).closest('div[class*="border-b"]').find('div[title="Edit Time Card"]'),

  // Edit Time Card modal
  clockIn: () => cy.get('input[name="clock_in_time"]'),
  clockOut: () => cy.get('input[name="clock_out_time"]'),
  saveChanges: () => cy.contains("button", "Save changes"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubShifts = (shifts: any[]) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");

const visitDailyReview = (
  shifts: any[] = [UNDER_SHIFT],
  opts: {
    role?: any;
    home?: any;
    members?: any[];
    /** Skip the "page rendered" wait — a refused role never renders it. */
    expectRestricted?: boolean;
  } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: {
        users:
          userType === "PCG" ? opts.members ?? [TEJU_MEMBER, JOHN_MEMBER] : [],
      },
    });
  }).as("getStaff");
  // The edit modal loads the member it is editing.
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("/").pop()?.split("?")[0];
    req.reply({
      statusCode: 200,
      body: { user: id === JOHN ? JOHN_MEMBER : TEJU_MEMBER },
    });
  }).as("getMember");
  stubShifts(shifts);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(TIMESHEET_PATH);
  if (opts.expectRestricted) return;
  cy.contains("Timesheets").should("be.visible");
};

/** Move the board to the past day the fixtures are built around. */
const goToReviewDay = () => {
  sel.dateInput().type(REVIEW_DAY_INPUT, { force: true });
  cy.contains(dayLabel(REVIEW_DAY)).should("be.visible");
};

const openTimeCard = (name = "Teju Carelead") => {
  sel.worked(name).click();
  sel.clockIn().should("be.visible");
};

const stubUpdate = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode, body }).as("updateShift");

describe("Staff Management — Timesheets: Daily review", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The page and its tabs
  // ──────────────────────────────────────────────────────────────────────────

  describe("The page", () => {
    beforeEach(() => visitDailyReview());

    it("names the screen", () => {
      cy.contains("Timesheets").should("be.visible");
    });

    it("offers both reviews", () => {
      sel.tab("Daily review").should("be.visible");
      sel.tab("Pay period review").should("be.visible");
    });

    it("opens on Daily review", () => {
      sel.dateInput().should("exist");
      cy.contains("Team member").should("be.visible");
    });

    it("switches to Pay period review", () => {
      sel.tab("Pay period review").click();
      cy.contains("Team member").should("not.exist");
    });

    it("switches back to Daily review", () => {
      sel.tab("Pay period review").click();
      sel.tab("Daily review").click();
      cy.contains("Team member").should("be.visible");
    });
  });

  describe("Access", () => {
    it("refuses the screen to a role without HCM_TIMESHEETS", () => {
      visitDailyReview([UNDER_SHIFT], { role: "Lead", expectRestricted: true });
      cy.assertRestricted();
    });

    it("refuses the screen when the home has no staff management module", () => {
      visitDailyReview([UNDER_SHIFT], {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
        expectRestricted: true,
      });
      cy.assertRestricted();
    });

    it("withholds Daily review from a role that only holds the pay period", { tags: [Tags.PCG] }, () => {
      // A PCG has HCM_PAY_PERIOD_REVIEW but not HCM_DAILY_REVIEW.
      visitDailyReview([UNDER_SHIFT], { role: "PCG" });
      sel.tab("Daily review").should("not.exist");
      sel.tab("Pay period review").should("be.visible");
    });

    it("withholds the pay period from a role that only holds Daily review", { tags: [Tags.HOMEADMIN] }, () => {
      // A HomeAdmin is the mirror image.
      visitDailyReview([UNDER_SHIFT], { role: "HomeAdmin" });
      sel.tab("Daily review").should("be.visible");
      sel.tab("Pay period review").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The date button
  // ──────────────────────────────────────────────────────────────────────────

  describe("The date button", () => {
    beforeEach(() => visitDailyReview());

    it("opens on today", () => {
      cy.contains(dayLabel(new Date(FROZEN_NOW))).should("be.visible");
    });

    it("holds today as its value", () => {
      sel.dateInput().should("have.value", "2026-09-08");
    });

    it("refuses any date after today", () => {
      // `max={today}` is the whole of the no-future-dates rule.
      sel.dateInput().should("have.attr", "max", "2026-09-08");
    });

    it("moves to a past date", () => {
      goToReviewDay();
      sel.dateInput().should("have.value", REVIEW_DAY_INPUT);
    });

    it("names the day of the week it moved to", () => {
      goToReviewDay();
      cy.contains("Friday, Sep 4, 2026").should("be.visible");
    });

    it("moves back to today", () => {
      goToReviewDay();
      sel.dateInput().type("2026-09-08", { force: true });
      cy.contains(dayLabel(new Date(FROZEN_NOW))).should("be.visible");
    });

    it("crosses a month boundary", () => {
      sel.dateInput().type("2026-08-31", { force: true });
      cy.contains("Monday, Aug 31, 2026").should("be.visible");
    });

    it("crosses a year boundary", () => {
      sel.dateInput().type("2025-12-31", { force: true });
      cy.contains("Wednesday, Dec 31, 2025").should("be.visible");
    });

    it("re-queries for the day it moved to", () => {
      goToReviewDay();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const asked = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          return (
            window.length === 2 &&
            new Date(window[0]).getTime() ===
              new Date(
                REVIEW_DAY.getFullYear(),
                REVIEW_DAY.getMonth(),
                REVIEW_DAY.getDate()
              ).getTime()
          );
        });
        expect(asked, "a query for the selected day window").to.eq(true);
      });
    });
  });

  /**
   * One visit per test, and every assertion inside a retrying `should`.
   *
   * The board fires its shifts query twice: once on first paint with no team
   * ids at all, and again once the PCG and HomeAdmin lists resolve. A `then`
   * reads whichever requests happen to have landed, so these passed or failed
   * on timing; and a second `visitDailyReview` inside a test that already had
   * one in `beforeEach` leaves both visits under the same alias.
   */
  describe("What the board asks the API for", () => {
    it("asks only for available shifts in this home", () => {
      visitDailyReview();
      cy.get("@getShifts.all").should((interceptions: any) => {
        expect(interceptions.length, "at least one query").to.be.greaterThan(0);
        interceptions.forEach((i: any) => {
          const query = new URL(i.request.url).searchParams;
          expect(query.get("shift_status")).to.eq("available");
          expect(query.get("home_id")).to.eq(TEST_HOME_ID);
        });
      });
    });

    it("asks for the home active team members", () => {
      visitDailyReview();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const ids = interceptions.flatMap((i: any) =>
          new URL(i.request.url).searchParams.getAll("user_id")
        );
        expect(ids).to.include(TEJU);
        expect(ids).to.include(JOHN);
      });
    });

    it("leaves a deleted member out of the query", () => {
      visitDailyReview([UNDER_SHIFT], {
        members: [TEJU_MEMBER, { ...JOHN_MEMBER, isDeleted: true }],
      });
      cy.contains("Teju Carelead").should("be.visible");
      cy.get("@getShifts.all").should((interceptions: any) => {
        const ids = interceptions.flatMap((i: any) =>
          new URL(i.request.url).searchParams.getAll("user_id")
        );
        expect(ids).to.include(TEJU);
        expect(ids).to.not.include(JOHN);
      });
    });

    it("sends the session token with every query", () => {
      // Not `cy.assertAuthorized`: that reads one interception off the alias,
      // and this board fires twice — the single `cy.get` yields null depending
      // on which have landed. Assert the header on all of them instead.
      visitDailyReview();
      cy.getCookie("idToken").then((cookie) => {
        cy.get("@getShifts.all").should((interceptions: any) => {
          expect(interceptions.length, "at least one query").to.be.greaterThan(0);
          interceptions.forEach((i: any) =>
            expect(i.request.headers.authorization).to.eq(`Bearer ${cookie?.value}`)
          );
        });
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The table
  // ──────────────────────────────────────────────────────────────────────────

  describe("The table", () => {
    it("names both columns", () => {
      visitDailyReview();
      cy.contains("Team member").should("be.visible");
      cy.contains("Worked").should("be.visible");
    });

    it("lists the member against their shift", () => {
      visitDailyReview();
      cy.contains("Teju Carelead").should("be.visible");
    });

    it("gives a member one row per shift", () => {
      // Two shifts for the same person on the same day is two rows.
      visitDailyReview([
        UNDER_SHIFT,
        buildShift({
          id: 8002,
          shift_start_time: at(REVIEW_DAY, 20, 0),
          shift_end_time: at(REVIEW_DAY, 23, 30),
        }),
      ]);
      cy.contains("Teju Carelead").should("exist");
      cy.get('div[title="Edit Time Card"]').should("have.length", 2);
    });

    it("says so on a day with nothing on it", () => {
      visitDailyReview([]);
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("truncates a long member name", () => {
      visitDailyReview([
        buildShift({ user_name: "Tejanew Carelead Number Two" }),
      ]);
      cy.contains("Tejanew Carelea...").should("be.visible");
    });

    it("keeps the full name in the title attribute", () => {
      visitDailyReview([
        buildShift({ user_name: "Tejanew Carelead Number Two" }),
      ]);
      cy.get('p[title="Tejanew Carelead Number Two"]').should("exist");
    });

    it("survives a member with no name", () => {
      visitDailyReview([buildShift({ user_name: "" })]);
      cy.contains("Worked").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Worked, scheduled, and the difference between them
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Worked column", () => {
    it("shows the hours actually worked", () => {
      visitDailyReview();
      sel.worked("Teju Carelead").should(
        "contain.text",
        `${workedTime(UNDER_SHIFT.clock_in_timestamp)} – ${workedTime(
          UNDER_SHIFT.clock_out_timestamp
        )}`
      );
    });

    it("shows the hours scheduled", () => {
      visitDailyReview();
      sel.worked("Teju Carelead").should(
        "contain.text",
        `Scheduled: ${workedTime(UNDER_SHIFT.shift_start_time)} – ${workedTime(
          UNDER_SHIFT.shift_end_time
        )}`
      );
    });

    it("dashes both sides when nobody clocked in", () => {
      visitDailyReview([buildShift()]);
      sel.worked("Teju Carelead").should("contain.text", "--:-- – --:--");
    });

    it("dashes only the missing side when someone is still clocked in", () => {
      visitDailyReview([
        buildShift({ clock_in_timestamp: at(REVIEW_DAY, 9, 0) }),
      ]);
      sel.worked("Teju Carelead").should("contain.text", "9:00 AM – --:--");
    });

    it("still shows the schedule when nobody clocked in", () => {
      visitDailyReview([buildShift()]);
      sel.worked("Teju Carelead").should("contain.text", "Scheduled:");
    });

    it("reports time under the schedule", () => {
      // Worked 119 min against a 165-min schedule.
      visitDailyReview();
      sel.worked("Teju Carelead").should("contain.text", "46 min under scheduled time");
    });

    it("reports time over the schedule", () => {
      visitDailyReview([
        buildShift({
          clock_in_timestamp: at(REVIEW_DAY, 0, 0),
          clock_out_timestamp: at(REVIEW_DAY, 3, 15),
        }),
      ]);
      sel.worked("Teju Carelead").should("contain.text", "30 min over scheduled time");
    });

    it("folds whole hours into the difference", () => {
      // 4h15m worked against 2h45m scheduled → 1 hr 30 min over.
      visitDailyReview([
        buildShift({
          clock_in_timestamp: at(REVIEW_DAY, 0, 0),
          clock_out_timestamp: at(REVIEW_DAY, 4, 15),
        }),
      ]);
      sel.worked("Teju Carelead").should("contain.text", "1 hr 30 min over scheduled time");
    });

    it("pluralises past one hour", () => {
      // 5h5m worked against 2h45m scheduled → 2 hrs 20 min over.
      visitDailyReview([
        buildShift({
          clock_in_timestamp: at(REVIEW_DAY, 0, 0),
          clock_out_timestamp: at(REVIEW_DAY, 5, 5),
        }),
      ]);
      sel.worked("Teju Carelead").should("contain.text", "2 hrs 20 min over scheduled time");
    });

    it("says nothing when the shift was worked exactly to schedule", () => {
      visitDailyReview([
        buildShift({
          clock_in_timestamp: at(REVIEW_DAY, 0, 0),
          clock_out_timestamp: at(REVIEW_DAY, 2, 45),
        }),
      ]);
      sel.worked("Teju Carelead").should("not.contain.text", "scheduled time");
    });

    it("says nothing while the shift is still open", () => {
      visitDailyReview([
        buildShift({ clock_in_timestamp: at(REVIEW_DAY, 9, 0) }),
      ]);
      sel.worked("Teju Carelead").should("not.contain.text", "scheduled time");
    });

    it("says nothing when there is no schedule to compare against", () => {
      visitDailyReview([
        buildShift({
          shift_start_time: null,
          shift_end_time: null,
          clock_in_timestamp: at(REVIEW_DAY, 9, 0),
          clock_out_timestamp: at(REVIEW_DAY, 17, 0),
        }),
      ]);
      sel.worked("Teju Carelead").should("not.contain.text", "scheduled time");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. The Edit Time Card modal
  // ──────────────────────────────────────────────────────────────────────────

  describe("The time card", () => {
    beforeEach(() => {
      visitDailyReview();
      openTimeCard();
    });

    it("opens from the Worked cell", () => {
      sel.clockIn().should("be.visible");
      sel.clockOut().should("be.visible");
    });

    it("names the day the shift belongs to", () => {
      cy.contains("Fri, Sep 4").should("be.visible");
    });

    it("names the member", () => {
      // Scoped: the name is also in the table row behind the modal.
      cy.get('div[class*="text-[24px]"]').should("have.text", "Teju Carelead");
    });

    it("says where they work", () => {
      // Scoped through the name, which is unique: "Care Team" is also a
      // sidebar link, and an unscoped `contains` finds that one first.
      cy.get('div[class*="text-[24px]"]')
        .parent()
        .should("contain.text", "Care Team")
        .and("contain.text", "at Comfort Cove");
    });

    it("labels the two fields", () => {
      cy.contains("Clocked In").should("be.visible");
      cy.contains("Clocked Out").should("be.visible");
    });

    it("pre-fills the times already recorded", () => {
      sel.clockIn().should("have.value", "06:40");
      sel.clockOut().should("have.value", "08:39");
    });

    it("shows the schedule without letting it be edited", () => {
      cy.contains(
        `Scheduled : ${workedTime(UNDER_SHIFT.shift_start_time)} – ${workedTime(
          UNDER_SHIFT.shift_end_time
        )}`
      ).should("be.visible");
      cy.get('input[name="shift_start_time"]').should("not.exist");
    });

    it("offers a save", () => {
      sel.saveChanges().should("be.visible");
    });

    it("sends nothing merely by opening", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      cy.assertNoRequest("@updateShift");
    });

    it("can be abandoned", () => {
      cy.get("body").find("svg").last().click({ force: true });
      sel.clockIn().should("not.exist");
    });
  });

  describe("The time card — an unworked shift", () => {
    beforeEach(() => {
      visitDailyReview([buildShift()]);
      openTimeCard();
    });

    it("opens with both fields empty", () => {
      sel.clockIn().should("have.value", "");
      sel.clockOut().should("have.value", "");
    });

    it("locks Clocked Out until Clocked In is filled", () => {
      sel.clockOut().should("be.disabled");
    });

    it("unlocks Clocked Out once Clocked In is filled", () => {
      sel.clockIn().type("09:00");
      sel.clockOut().should("not.be.disabled");
    });

    it("locks Clocked Out again if Clocked In is cleared", () => {
      sel.clockIn().type("09:00");
      sel.clockOut().should("not.be.disabled");
      sel.clockIn().clear();
      sel.clockOut().should("be.disabled");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Saving a time card
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving a time card", () => {
    beforeEach(() => {
      stubUpdate();
      visitDailyReview();
      openTimeCard();
    });

    it("updates the shift it was opened from", () => {
      sel.clockIn().clear().type("07:00");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(request.url).to.contain("/v1/hcm/shift/8001");
        expect(request.body.id).to.eq(8001);
      });
    });

    it("sends the clock-in that was entered", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_in_timestamp)).to.eq("7:15 AM");
      });
    });

    it("sends the clock-out that was entered", () => {
      sel.clockOut().clear().type("09:45");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_out_timestamp)).to.eq("9:45 AM");
      });
    });

    it("keeps an afternoon time in the afternoon", () => {
      // 14:00 in the DOM must not come back as 2 AM.
      sel.clockIn().clear().type("13:30");
      sel.clockOut().clear().type("17:45");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_in_timestamp)).to.eq("1:30 PM");
        expect(workedTime(request.body.clock_out_timestamp)).to.eq("5:45 PM");
      });
    });

    it("keeps midnight as midnight", () => {
      sel.clockIn().clear().type("00:00");
      sel.clockOut().clear().type("06:00");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_in_timestamp)).to.eq("12:00 AM");
      });
    });

    it("keeps noon as noon", () => {
      sel.clockIn().clear().type("12:00");
      sel.clockOut().clear().type("13:00");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_in_timestamp)).to.eq("12:00 PM");
      });
    });

    it("puts the times on the shift's own date", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        const sent = new Date(request.body.clock_in_timestamp);
        expect(sent.getFullYear()).to.eq(2026);
        expect(sent.getMonth()).to.eq(8);
        expect(sent.getDate()).to.eq(4);
      });
    });

    it("leaves the schedule alone", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.shift_start_time).to.eq(UNDER_SHIFT.shift_start_time);
        expect(request.body.shift_end_time).to.eq(UNDER_SHIFT.shift_end_time);
      });
    });

    it("sends the pay rate as a number", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.pay_rate).to.eq(15);
      });
    });

    it("strips the fields the shift endpoint rejects", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        ["created_at", "updated_at", "user_name", "created_by_user_name", "user_profile_image_url"].forEach(
          (field) => expect(request.body, `${field} omitted`).not.to.have.property(field)
        );
      });
    });

    it("confirms the update", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      cy.assertPopover("Timecard updated successfully");
    });

    it("closes the card", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      sel.clockIn().should("not.exist");
    });

    it("authorises the update with the session token", () => {
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      cy.assertAuthorized("@updateShift");
    });

    it("reports a rejected update", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", {
        statusCode: 400,
        body: { message: "Shift is locked" },
      }).as("updateShift");
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();

      cy.wait("@updateShift");
      cy.assertPopover("Error updating timecard: Shift is locked");
    });

    it("falls back to a generic message when the API gives no reason", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode: 500, body: {} }).as(
        "updateShift"
      );
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();

      cy.wait("@updateShift");
      cy.assertPopover("Error updating timecard: Something Went Wrong");
    });

    it("keeps the card open after a rejected update", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode: 500, body: {} }).as(
        "updateShift"
      );
      sel.clockIn().clear().type("07:15");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      cy.dismissPopover();

      sel.clockIn().should("have.value", "07:15");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. What the time card refuses
  // ──────────────────────────────────────────────────────────────────────────

  describe("Time card validation", () => {
    beforeEach(() => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitDailyReview();
      openTimeCard();
    });

    it("refuses a clock-out equal to the clock-in", () => {
      sel.clockIn().clear().type("09:00");
      sel.clockOut().clear().type("09:00");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });

    it("refuses a clock-out before the clock-in on a same-day shift", () => {
      sel.clockIn().clear().type("09:00");
      sel.clockOut().clear().type("08:00");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });

    it("accepts a minute's difference", () => {
      stubUpdate();
      sel.clockIn().clear().type("09:00");
      sel.clockOut().clear().type("09:01");
      sel.saveChanges().click();
      cy.wait("@updateShift");
    });
  });

  describe("Time card validation — an overnight schedule", () => {
    /** Scheduled 10 PM Friday to 6 AM Saturday. */
    const OVERNIGHT = buildShift({
      id: 8003,
      shift_start_time: at(REVIEW_DAY, 22, 0),
      shift_end_time: at(new Date(2026, 8, 5), 6, 0),
      clock_in_timestamp: null,
      clock_out_timestamp: null,
    });

    it("lets a PCHO record a clock-out after midnight", () => {
      // The earlier clock-out is read as the next day, but only for a
      // non-caregiver editor and only when the SCHEDULE is itself overnight.
      stubUpdate();
      visitDailyReview([OVERNIGHT]);
      openTimeCard();

      sel.clockIn().clear().type("22:15");
      sel.clockOut().clear().type("06:05");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        const out = new Date(request.body.clock_out_timestamp);
        expect(out.getDate(), "rolled to the next day").to.eq(5);
        expect(workedTime(request.body.clock_out_timestamp)).to.eq("6:05 AM");
      });
    });

    it("refuses the same times against a same-day schedule", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitDailyReview();
      openTimeCard();

      sel.clockIn().clear().type("22:15");
      sel.clockOut().clear().type("06:05");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });
  });

  describe("Time card validation — empty fields", () => {
    it("[as-built] clears both timestamps when both fields are emptied", () => {
      // `EditTimeCardSchema` marks both fields optional and nothing guards the
      // empty case, so saving an emptied card wipes the recorded times rather
      // than refusing. Pinned as built.
      stubUpdate();
      visitDailyReview();
      openTimeCard();

      // Clear the later field first: emptying Clocked In disables Clocked Out.
      sel.clockOut().clear();
      sel.clockIn().clear();
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.clock_in_timestamp).to.eq(null);
        expect(request.body.clock_out_timestamp).to.eq(null);
      });
    });

    it("cannot be given a clock-out with no clock-in", () => {
      // `handleSubmit` has an "enter clock-in first" guard, but it only runs for
      // a caregiver editing their own card. What actually stops a PCHO reaching
      // that state is the field itself: Clocked Out disables the moment Clocked
      // In is empty, so the half-filled card cannot be built at all.
      visitDailyReview();
      openTimeCard();

      sel.clockOut().clear();
      sel.clockIn().clear();
      sel.clockOut().should("be.disabled");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a past day is opened and a missing time card is filled in", () => {
      stubUpdate();
      visitDailyReview([buildShift()]);

      goToReviewDay();
      sel.worked("Teju Carelead").should("contain.text", "--:-- – --:--");

      sel.worked("Teju Carelead").click();
      sel.clockOut().should("be.disabled");
      sel.clockIn().type("00:05");
      sel.clockOut().type("02:50");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_in_timestamp)).to.eq("12:05 AM");
        expect(workedTime(request.body.clock_out_timestamp)).to.eq("2:50 AM");
      });
      cy.assertPopover("Timecard updated successfully");
      sel.clockIn().should("not.exist");
    });

    it("E2E — an impossible time is corrected and then saved", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitDailyReview();
      openTimeCard();

      sel.clockIn().clear().type("09:00");
      sel.clockOut().clear().type("08:00");
      sel.saveChanges().click();
      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
      cy.dismissPopover();

      stubUpdate();
      sel.clockOut().clear().type("17:30");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        expect(workedTime(request.body.clock_out_timestamp)).to.eq("5:30 PM");
      });
      cy.assertPopover("Timecard updated successfully");
    });

    it("E2E — the difference is what the two rows of times say it is", () => {
      visitDailyReview([
        UNDER_SHIFT,
        buildShift({
          id: 8004,
          user_id: JOHN,
          user_name: "John Sarah Doe",
          shift_start_time: at(REVIEW_DAY, 2, 30),
          shift_end_time: at(REVIEW_DAY, 16, 0),
        }),
      ]);

      sel.worked("Teju Carelead").should("contain.text", "46 min under scheduled time");
      sel.worked("John Sarah Doe").should("contain.text", "--:-- – --:--");
      sel.worked("John Sarah Doe").should("not.contain.text", "scheduled time");
    });
  });
});
