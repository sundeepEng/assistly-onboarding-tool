/// <reference types="cypress" />

/**
 * Staff Management — Timesheets: Pay period review
 *
 *   components/hcm/timesheet/time-sheet-header.tsx     the two tabs
 *   components/hcm/timesheet/pay-period-review.tsx     the range, export, rows
 *   components/hcm/timesheet/date-picker.tsx           the two-month calendar
 *   components/hcm/timesheet/edit-time-card.tsx        the Add Clock In / Out modal
 *   utils/export/xlsx/exportPayPeriodXlsx.ts           the workbook
 *   commonComponents/accordian-component.tsx           MUI Accordion
 *
 * WHAT A ROW IS
 *   One accordion per PERSON — `_.groupBy(shifts, "user_id")` — where the daily
 *   review is one row per shift. The header totals are computed over that
 *   person's shifts in the range; the expanded table is one row per shift.
 *
 * THE ACCORDION IS MUI, SO COLLAPSED CONTENT STAYS MOUNTED
 *   Every expanded row exists in the DOM from first paint. Assert `be.visible`
 *   / `not.be.visible`, never `exist` / `not.exist` — the same rule the clinical
 *   suite follows for its accordions. Only one may be open at a time:
 *   `toggleSection` closes every other section before opening the clicked one.
 *
 * MONTHLY PAY HIDES THE MONEY, NOT THE HOURS
 *   `pay_frequency === "Monthly"` prints **NA** for Est. Wages in the header and
 *   for Estimated wages in each row, while Timecards and Total Hours are still
 *   counted. An hourly member with no punches gets `$0` in the header and `-`
 *   in the row — three different "nothing here" strings, all pinned below.
 *
 * "ACTUAL VS. SCHEDULED" IS NOT A COMPARISON
 *   Despite the column name, it renders
 *   `getHoursDifference(clock_in, clock_out)` — the hours actually worked, with
 *   the schedule nowhere in the expression. It shows `0` when nobody punched.
 *   Pinned as built; see the README.
 *
 * THE RANGE
 *   Defaults to today and the thirteen days before it (a fortnight). The picker
 *   is a custom two-month calendar: clicking a day starts a range, clicking a
 *   second completes it, and **Apply** is what tells the page. Cancel and the
 *   outside click both discard. The ✕ clears the range entirely, which drops
 *   `shift_start_time` from the query.
 *
 * NOT PRESENT: SHIFT NOTES
 *   The Add Clock In / Out dialog is the same `EditTimeCard` the daily review
 *   uses, and it has no notes field on this branch — `edit-time-card.tsx`
 *   renders the date, the member, Clocked In / Clocked Out, the read-only
 *   Scheduled line and Save changes, nothing else. Nothing is asserted about
 *   notes. See the README.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const TIMESHEET_PATH = "/hcm/timesheet";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

/** `getWeekRange()` is today and the 13 days before it. */
const DEFAULT_RANGE_LABEL = "8/26/2026 - 9/8/2026";
const DEFAULT_EXPORT_FILE = "PayPeriodReview_8-26-2026_9-8-2026.xlsx";

const TEJU = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AVLON = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";

const SHIFT_DAY = new Date(2026, 8, 4); // Friday 4 September 2026

/** An ISO instant at a local wall-clock time on a given day. */
const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

/**
 * What `TimeCardShow` prints — Intl on the browser's own locale with the
 * whitespace stripped (en-GB yields "9:00am", en-US "9:00AM"). Deriving it the
 * same way keeps the assertion truthful on any runner.
 */
const cardTime = (iso: string | null) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso as string))
    .replace(/\s/g, "");

/** What `formatToLocalLongDate` prints — Intl on the browser's own locale. */
const longDate = (day: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);

/**
 * `pay_rate` is a STRING here, as everything in this codebase assumes.
 * `calculateTotalWages` does `pay_rate.replace(...)` on the override it is
 * handed — and the export hands it `roaster[0].pay_rate` — so a numeric rate
 * throws inside `handleExport`, which has no catch, and the download simply
 * never appears.
 */
const buildMember = (
  userId: string,
  name: string,
  payRate: string,
  payFrequency = "Hourly"
) => ({
  userId,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "PCG",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  roaster: [{ pay_rate: payRate, pay_frequency: payFrequency }],
  isDeleted: false,
});

/** Hourly, $25/hr. */
const AVLON_MEMBER = buildMember(AVLON, "Avlon Regal", "25");
/** Monthly, $4500/m — the "NA" case. */
const TEJU_MEMBER = buildMember(TEJU, "Teju Carelead", "4500", "Monthly");

const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 9001,
  user_id: AVLON,
  user_name: "Avlon Regal",
  user_profile_image_url: "",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: "25",
  pay_frequency: "Hourly",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  created_by_user_name: "Admin",
  shift_start_time: at(SHIFT_DAY, 9, 0),
  shift_end_time: at(SHIFT_DAY, 11, 0),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

/** Worked 9:00–11:00 at $25/hr → 2 hours, $50. */
const WORKED_SHIFT = buildShift({
  clock_in_timestamp: at(SHIFT_DAY, 9, 0),
  clock_out_timestamp: at(SHIFT_DAY, 11, 0),
});

/** A monthly-paid member's shift — hours counted, wages NA. */
const MONTHLY_SHIFT = buildShift({
  id: 9002,
  user_id: TEJU,
  user_name: "Teju Carelead",
  pay_rate: "4500",
  pay_frequency: "Monthly",
  shift_start_time: at(SHIFT_DAY, 0, 0),
  shift_end_time: at(SHIFT_DAY, 2, 45),
  clock_in_timestamp: at(SHIFT_DAY, 6, 40),
  clock_out_timestamp: at(SHIFT_DAY, 8, 39),
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  tab: (label: string) => cy.contains("span", label),
  rangeInput: () => cy.get('input[aria-label^="Select"], input[aria-label^="Selected"]'),
  rangeButton: () => cy.get('div[aria-label="Open date picker"]'),
  clearRange: () => cy.get('button[aria-label="Clear selection"]'),
  calendar: () => cy.get('div[aria-label="Date range calendar"]'),
  apply: () => cy.contains("button", "Apply"),
  cancelRange: () => cy.contains("button", "Cancel"),
  monthSelect: (which: 0 | 1) => cy.get('select[aria-label="Select month"]').eq(which),
  yearSelect: (which: 0 | 1) => cy.get('select[aria-label="Select year"]').eq(which),
  prevMonth: () => cy.get('button[aria-label="Previous month"]'),
  /** A day cell in the calendar, e.g. 1 September. */
  day: (which: 0 | 1, label: string) =>
    sel.calendar()
      .find("div.p-3")
      .eq(which)
      .contains("button", new RegExp(`^${label}$`)),
  exportExcel: () => cy.contains("button", "Export Excel"),
  /**
   * Export is `disabled` until `usersReady` — every user behind a shift has
   * been fetched one by one in an effect. Clicking early is a no-op that fails
   * later as a missing download, so always wait for it to enable.
   */
  readyExport: () => sel.exportExcel().should("not.be.disabled"),

  /** One person's accordion, found through their name. */
  accordion: (name: string) => cy.contains(name).closest(".MuiAccordion-root"),
  summary: (name: string) => sel.accordion(name).find(".MuiAccordionSummary-root"),
  details: (name: string) => sel.accordion(name).find(".MuiAccordionDetails-root"),
  addClock: (name: string) =>
    sel.details(name).contains("+ Add Clock In / Out"),

  // The Add Clock In / Out modal — the same EditTimeCard the daily review uses.
  clockIn: () => cy.get('input[name="clock_in_time"]'),
  clockOut: () => cy.get('input[name="clock_out_time"]'),
  saveChanges: () => cy.contains("button", "Save changes"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const visitPayPeriod = (
  shifts: any[] = [WORKED_SHIFT],
  opts: { role?: any; home?: any; members?: any[]; expectRestricted?: boolean } = {}
) => {
  const members = opts.members ?? [AVLON_MEMBER, TEJU_MEMBER];

  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: members } });
  // Both the accordion header and the export's user lookup hit this.
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("/").pop()?.split("?")[0];
    req.reply({
      statusCode: 200,
      body: { user: members.find((m) => m.userId === id) ?? members[0] },
    });
  }).as("getMember");
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(TIMESHEET_PATH);
  if (opts.expectRestricted) return;
  cy.contains("Timesheets").should("be.visible");
  sel.tab("Pay period review").click();
  cy.contains("Export Excel").should("be.visible");
};

const stubUpdate = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode, body }).as("updateShift");

describe("Staff Management — Timesheets: Pay period review", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Getting there
  // ──────────────────────────────────────────────────────────────────────────

  describe("Reaching the tab", () => {
    it("opens the Timesheets screen on Daily review, not this one", () => {
      // The tab order in time-sheet-header.tsx decides the landing tab, and
      // Daily review is first for any role that holds it.
      visitPayPeriod([WORKED_SHIFT], { expectRestricted: true });
      cy.contains("Timesheets").should("be.visible");
      cy.contains("Team member").should("be.visible");
      cy.contains("Export Excel").should("not.exist");
    });

    it("switches to Pay period review when asked", () => {
      visitPayPeriod();
      cy.contains("Export Excel").should("be.visible");
    });

    it("goes back to Daily review", () => {
      visitPayPeriod();
      sel.tab("Daily review").click();
      cy.contains("Export Excel").should("not.exist");
      cy.contains("Team member").should("be.visible");
    });

    it("returns to Daily review on reload", () => {
      // The active tab is component state, so a reload resets it.
      visitPayPeriod();
      cy.reload();
      cy.contains("Team member").should("be.visible");
      cy.contains("Export Excel").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The date range
  // ──────────────────────────────────────────────────────────────────────────

  describe("The date range", () => {
    beforeEach(() => visitPayPeriod());

    it("opens on the last fortnight", () => {
      sel.rangeInput().should("have.value", DEFAULT_RANGE_LABEL);
    });

    it("asks the API for that fortnight", () => {
      cy.get("@getShifts.all").should((interceptions: any) => {
        const asked = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          return start.getMonth() === 7 && start.getDate() === 26;
        });
        expect(asked, "a query for 26 Aug – 8 Sep").to.eq(true);
      });
    });

    it("asks only for available shifts in this home", () => {
      cy.get("@getShifts.all").should((interceptions: any) => {
        expect(interceptions.length).to.be.greaterThan(0);
        interceptions.forEach((i: any) => {
          const query = new URL(i.request.url).searchParams;
          expect(query.get("shift_status")).to.eq("available");
          expect(query.get("home_id")).to.eq(TEST_HOME_ID);
        });
      });
    });

    it("keeps the calendar shut until asked", () => {
      sel.calendar().should("not.exist");
    });

    it("opens the calendar", () => {
      sel.rangeButton().click();
      sel.calendar().should("be.visible");
    });

    it("shows two months side by side", () => {
      sel.rangeButton().click();
      cy.get('select[aria-label="Select month"]').should("have.length", 2);
      cy.get('select[aria-label="Select year"]').should("have.length", 2);
    });

    it("offers a month and a year to jump to", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.yearSelect(0).select("2026");
      sel.monthSelect(0).should("have.value", "8");
    });

    it("steps back a month", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.prevMonth().click();
      sel.monthSelect(0).should("have.value", "7");
    });

    it("closes on Cancel", () => {
      sel.rangeButton().click();
      sel.cancelRange().click();
      sel.calendar().should("not.exist");
    });

    it("[as-built] applies a range the moment the second date is clicked", () => {
      // `date-picker.tsx:116` — an effect calls `onChange` as soon as
      // `tempRange` has both ends. The page is therefore re-queried before
      // Apply is pressed at all, which makes Apply a no-op that only closes
      // the popup.
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();

      cy.get("@getShifts.all").should((interceptions: any) => {
        const narrowed = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          return start.getMonth() === 8 && start.getDate() === 1;
        });
        expect(narrowed, "the range was applied without Apply").to.eq(true);
      });
    });

    it("[as-built] cannot be cancelled once both dates are chosen", () => {
      // Cancel only closes the popup. By then the effect above has already
      // told the page, and nothing restores `tempRange` either — so both the
      // box and the data below keep the range the user tried to abandon.
      // The failing test for the intended behaviour is in known-defects.cy.ts.
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.cancelRange().click();

      sel.rangeInput().should("have.value", "9/1/2026 - 9/5/2026");
      cy.get("@getShifts.all").should((interceptions: any) => {
        const narrowed = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          return start.getMonth() === 8 && start.getDate() === 1;
        });
        expect(narrowed, "the cancelled range was queried anyway").to.eq(true);
      });
    });

    it("refuses to apply half a range", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.apply().should("be.disabled");
    });

    it("enables Apply once both ends are chosen", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.apply().should("not.be.disabled");
    });

    it("applies the range that was picked", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.apply().click();

      sel.calendar().should("not.exist");
      sel.rangeInput().should("have.value", "9/1/2026 - 9/5/2026");
    });

    it("re-queries for the range that was applied", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.apply().click();

      cy.get("@getShifts.all").should((interceptions: any) => {
        const asked = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          const end = new Date(window[1]);
          return (
            start.getMonth() === 8 &&
            start.getDate() === 1 &&
            end.getMonth() === 8 &&
            end.getDate() === 5
          );
        });
        expect(asked, "a query for 1–5 Sep").to.eq(true);
      });
    });

    it("orders a backwards selection for the user", () => {
      // Clicking the later day first still yields start ≤ end.
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "5").click();
      sel.day(0, "1").click();
      sel.apply().click();
      sel.rangeInput().should("have.value", "9/1/2026 - 9/5/2026");
    });

    it("accepts a single-day range", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "3").click();
      sel.day(0, "3").click();
      sel.apply().click();
      sel.rangeInput().should("have.value", "9/3/2026 - 9/3/2026");
    });

    it("accepts a range that spans both months on show", () => {
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "28").click();
      sel.day(1, "2").click();
      sel.apply().click();
      sel.rangeInput().should("have.value", "9/28/2026 - 10/2/2026");
    });

    it("clears the range", () => {
      sel.clearRange().click();
      sel.rangeInput().should("have.value", "Select date range");
    });

    it("[as-built] drops the window from the query when the range is cleared", () => {
      // With neither end set, `shift_start_time` is omitted entirely and the
      // API is asked for every available shift in the home.
      sel.clearRange().click();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const unbounded = interceptions.some(
          (i: any) =>
            new URL(i.request.url).searchParams.getAll("shift_start_time").length === 0
        );
        expect(unbounded, "a query with no date window").to.eq(true);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The list of people
  // ──────────────────────────────────────────────────────────────────────────

  describe("The list", () => {
    it("gives each person one row", () => {
      visitPayPeriod([WORKED_SHIFT, MONTHLY_SHIFT]);
      cy.get(".MuiAccordion-root").should("have.length", 2);
    });

    it("groups a person's shifts into a single row", () => {
      visitPayPeriod([
        WORKED_SHIFT,
        buildShift({ id: 9003, shift_start_time: at(SHIFT_DAY, 14, 0) }),
      ]);
      cy.get(".MuiAccordion-root").should("have.length", 1);
    });

    it("names the person", () => {
      visitPayPeriod();
      cy.contains("Avlon Regal").should("be.visible");
    });

    it("labels the four header figures", () => {
      visitPayPeriod();
      ["WageRate", "Timecards", "Total Hours", "Est. Wages"].forEach((label) =>
        cy.contains(label).should("be.visible")
      );
    });

    it("shows an hourly wage rate", () => {
      visitPayPeriod();
      cy.contains("$25/hr").should("be.visible");
    });

    it("shows a monthly wage rate", () => {
      visitPayPeriod([MONTHLY_SHIFT]);
      cy.contains("$4500/m").should("be.visible");
    });

    it("counts only the shifts that were punched", () => {
      // Two shifts, one of them never clocked → one timecard.
      visitPayPeriod([WORKED_SHIFT, buildShift({ id: 9003 })]);
      sel.summary("Avlon Regal").should("contain.text", "Timecards");
      sel.summary("Avlon Regal").should("contain.text", "1");
    });

    it("totals the hours worked", () => {
      visitPayPeriod();
      sel.summary("Avlon Regal").should("contain.text", "2.00");
    });

    it("totals the estimated wages for an hourly member", () => {
      // 2 hours at $25.
      visitPayPeriod();
      sel.summary("Avlon Regal").should("contain.text", "$50");
    });

    it("says NA for a monthly-paid member's wages", () => {
      visitPayPeriod([MONTHLY_SHIFT]);
      sel.summary("Teju Carelead").should("contain.text", "NA");
    });

    it("still counts a monthly-paid member's hours", () => {
      // 6:40 to 8:39 is 1.98 hours — the money is hidden, not the time.
      visitPayPeriod([MONTHLY_SHIFT]);
      sel.summary("Teju Carelead").should("contain.text", "1.98");
    });

    it("totals nothing for a member who never punched", () => {
      visitPayPeriod([buildShift()]);
      sel.summary("Avlon Regal").should("contain.text", "0.00");
      sel.summary("Avlon Regal").should("contain.text", "$0");
    });

    it("says so when the period has no timecards at all", () => {
      visitPayPeriod([]);
      cy.contains("No timecards found for this period.").should("be.visible");
    });

    it("keeps every row shut to begin with", () => {
      visitPayPeriod([WORKED_SHIFT, MONTHLY_SHIFT]);
      sel.details("Avlon Regal").should("not.be.visible");
      sel.details("Teju Carelead").should("not.be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Expanding a row
  // ──────────────────────────────────────────────────────────────────────────

  describe("Expanding a row", () => {
    beforeEach(() => visitPayPeriod([WORKED_SHIFT, MONTHLY_SHIFT]));

    it("opens on click", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("be.visible");
    });

    it("closes again on a second click", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("be.visible");
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("not.be.visible");
    });

    it("closes the other rows when one opens", () => {
      // `toggleSection` shuts everything else first.
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("be.visible");

      sel.summary("Teju Carelead").click();
      sel.details("Teju Carelead").should("be.visible");
      sel.details("Avlon Regal").should("not.be.visible");
    });

    it("names all six columns", () => {
      sel.summary("Avlon Regal").click();
      [
        "Date",
        "Shift rate",
        "Time card",
        "Scheduled hours",
        "Actual vs. scheduled",
        "Estimated wages",
      ].forEach((header) =>
        sel.details("Avlon Regal").should("contain.text", header)
      );
    });

    it("gives each shift its own line", () => {
      visitPayPeriod([
        WORKED_SHIFT,
        buildShift({ id: 9003, shift_start_time: at(SHIFT_DAY, 14, 0) }),
      ]);
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").find('div[title="Edit Time Card"], div:contains("+ Add Clock In / Out")').should("exist");
    });

    it("dates each shift", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("contain.text", longDate(SHIFT_DAY));
    });

    it("shows the shift's own rate", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("contain.text", "$25/hr");
    });

    it("shows the scheduled hours", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("contain.text", "2");
    });

    it("shows the punched times", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should(
        "contain.text",
        `${cardTime(WORKED_SHIFT.clock_in_timestamp)}–${cardTime(
          WORKED_SHIFT.clock_out_timestamp
        )}`
      );
    });

    it("shows the estimated wages for the shift", () => {
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("contain.text", "$50.00");
    });

    it("says NA for a monthly-paid shift", () => {
      sel.summary("Teju Carelead").click();
      sel.details("Teju Carelead").should("contain.text", "NA");
    });
  });

  describe("A shift nobody punched", () => {
    beforeEach(() => {
      visitPayPeriod([buildShift()]);
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("be.visible");
    });

    it("offers to add the missing times", () => {
      sel.addClock("Avlon Regal").should("be.visible");
    });

    it("counts the hours worked as nothing", () => {
      sel.details("Avlon Regal").should("contain.text", "0");
    });

    it("[as-built] dashes the estimated wages rather than showing zero", () => {
      // `estimatedWages` returns "-" without both punches, while the header
      // above it prints "$0" for the same member — two different ways of
      // saying the same nothing.
      sel.details("Avlon Regal").should("contain.text", "-");
      sel.summary("Avlon Regal").should("contain.text", "$0");
    });

    it("[as-built] shows the worked hours under 'Actual vs. scheduled'", () => {
      // The column renders getHoursDifference(clock_in, clock_out) — the hours
      // worked, not a comparison with the schedule. With no punches it is 0
      // even though two hours were scheduled.
      sel.details("Avlon Regal").should("contain.text", "0");
      sel.details("Avlon Regal").should("contain.text", "2");
    });

    it("withholds the add link from a role that cannot edit timecards", { tags: [Tags.PCG] }, () => {
      // A PCG holds the pay period tab but not HCM_EDIT_TIMECARD.
      visitPayPeriod([buildShift()], { role: "PCG" });
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").should("not.contain.text", "+ Add Clock In / Out");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Adding the missing clock in / out
  // ──────────────────────────────────────────────────────────────────────────

  describe("Add Clock In / Out", () => {
    beforeEach(() => {
      visitPayPeriod([buildShift()]);
      sel.summary("Avlon Regal").click();
      sel.addClock("Avlon Regal").click();
      sel.clockIn().should("be.visible");
    });

    it("opens the time card", () => {
      sel.clockIn().should("be.visible");
      sel.clockOut().should("be.visible");
    });

    it("names the day and the member", () => {
      cy.contains(longDate(SHIFT_DAY)).should("be.visible");
      cy.get('div[class*="text-[24px]"]').should("have.text", "Avlon Regal");
    });

    it("says where they work", () => {
      cy.get('div[class*="text-[24px]"]')
        .parent()
        .should("contain.text", "Care Team")
        .and("contain.text", "at Comfort Cove");
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

    it("shows the schedule without letting it be edited", () => {
      cy.contains("Scheduled :").should("be.visible");
      cy.get('input[name="shift_start_time"]').should("not.exist");
    });

    it("sends nothing merely by opening", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      cy.assertNoRequest("@updateShift");
    });

    it("records the times that were entered", () => {
      stubUpdate();
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:30");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.url).to.contain("/v1/hcm/shift/9001");
        const inAt = new Date(request.body.clock_in_timestamp);
        const outAt = new Date(request.body.clock_out_timestamp);
        expect(inAt.getHours()).to.eq(9);
        expect(outAt.getHours()).to.eq(11);
        expect(outAt.getMinutes()).to.eq(30);
      });
    });

    it("keeps an afternoon time in the afternoon", () => {
      stubUpdate();
      sel.clockIn().type("13:15");
      sel.clockOut().type("17:45");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(new Date(request.body.clock_in_timestamp).getHours()).to.eq(13);
        expect(new Date(request.body.clock_out_timestamp).getHours()).to.eq(17);
      });
    });

    it("puts the times on the shift's own date", () => {
      stubUpdate();
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:30");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        const sent = new Date(request.body.clock_in_timestamp);
        expect(sent.getMonth()).to.eq(8);
        expect(sent.getDate()).to.eq(4);
      });
    });

    it("confirms the update", () => {
      stubUpdate();
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:30");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      cy.assertPopover("Timecard updated successfully");
    });

    it("closes the card", () => {
      stubUpdate();
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:30");
      sel.saveChanges().click();
      cy.wait("@updateShift");
      sel.clockIn().should("not.exist");
    });

    it("refuses a clock-out equal to the clock-in", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      sel.clockIn().type("09:00");
      sel.clockOut().type("09:00");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });

    it("refuses a clock-out before the clock-in", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      sel.clockIn().type("09:00");
      sel.clockOut().type("08:00");
      sel.saveChanges().click();

      cy.assertPopover("Clock-out time must be greater than clock-in time.");
      cy.assertNoRequest("@updateShift");
    });

    it("reports a rejected update", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", {
        statusCode: 400,
        body: { message: "Shift is locked" },
      }).as("updateShift");
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:30");
      sel.saveChanges().click();

      cy.wait("@updateShift");
      cy.assertPopover("Error updating timecard: Shift is locked");
    });
  });

  describe("Editing times that are already there", () => {
    it("opens the time card from the punched times", () => {
      visitPayPeriod();
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").find('span[title="Edit Time Card"]').click();
      sel.clockIn().should("have.value", "09:00");
      sel.clockOut().should("have.value", "11:00");
    });

    it("saves a change to an existing card", () => {
      stubUpdate();
      visitPayPeriod();
      sel.summary("Avlon Regal").click();
      sel.details("Avlon Regal").find('span[title="Edit Time Card"]').click();

      sel.clockOut().clear().type("12:30");
      sel.saveChanges().click();
      cy.wait("@updateShift").then(({ request }) => {
        const outAt = new Date(request.body.clock_out_timestamp);
        expect(outAt.getHours()).to.eq(12);
        expect(outAt.getMinutes()).to.eq(30);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Export Excel
  // ──────────────────────────────────────────────────────────────────────────

  describe("Export Excel", () => {
    it("offers the export", () => {
      visitPayPeriod();
      sel.exportExcel().should("be.visible");
    });

    it("waits for the team to load before it can be used", () => {
      // `disabled={isLoading || !usersReady}` — the workbook needs every user
      // behind a shift, and those are fetched one at a time after the shifts.
      visitPayPeriod();
      sel.exportExcel().should("not.be.disabled");
    });

    it("downloads a workbook named for the range", () => {
      visitPayPeriod();
      sel.readyExport().click();
      cy.readFile(`cypress/downloads/${DEFAULT_EXPORT_FILE}`, null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("writes a real xlsx file", () => {
      visitPayPeriod();
      sel.readyExport().click();
      cy.readFile(`cypress/downloads/${DEFAULT_EXPORT_FILE}`, null, {
        timeout: 20000,
      }).then((contents: any) => {
        // Every .xlsx is a zip: "PK\x03\x04".
        expect(contents[0], "zip magic byte 1").to.eq(0x50);
        expect(contents[1], "zip magic byte 2").to.eq(0x4b);
      });
    });

    it("names the file after the range that was applied", () => {
      visitPayPeriod();
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.apply().click();

      sel.readyExport().click();
      cy.readFile("cypress/downloads/PayPeriodReview_9-1-2026_9-5-2026.xlsx", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("exports a period with no timecards rather than failing", () => {
      visitPayPeriod([]);
      sel.readyExport().click();
      cy.readFile(`cypress/downloads/${DEFAULT_EXPORT_FILE}`, null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("sends nothing to the API", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitPayPeriod();
      sel.readyExport().click();
      cy.assertNoRequest("@updateShift");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the screen to a role without HCM_TIMESHEETS", () => {
      visitPayPeriod([WORKED_SHIFT], { role: "Lead", expectRestricted: true });
      cy.assertRestricted();
    });

    it("refuses the screen when the home has no staff management module", () => {
      visitPayPeriod([WORKED_SHIFT], {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
        expectRestricted: true,
      });
      cy.assertRestricted();
    });

    it("gives a PCG this tab and not the other", { tags: [Tags.PCG] }, () => {
      visitPayPeriod([WORKED_SHIFT], { role: "PCG", expectRestricted: true });
      cy.contains("Timesheets").should("be.visible");
      sel.tab("Pay period review").should("be.visible");
      sel.tab("Daily review").should("not.exist");
    });

    it("narrows the query to a PCG's own shifts", { tags: [Tags.PCG] }, () => {
      visitPayPeriod([WORKED_SHIFT], { role: "PCG", expectRestricted: true });
      cy.contains("Export Excel").should("be.visible");
      cy.get("@getShifts.all").should((interceptions: any) => {
        const scoped = interceptions.some((i: any) =>
          new URL(i.request.url).searchParams.has("user_id")
        );
        expect(scoped, "the query is scoped to one user").to.eq(true);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a missing timecard is found, filled in and confirmed", () => {
      stubUpdate();
      visitPayPeriod([buildShift()]);

      sel.summary("Avlon Regal").should("contain.text", "0.00");
      sel.summary("Avlon Regal").click();
      sel.addClock("Avlon Regal").should("be.visible").click();

      sel.clockOut().should("be.disabled");
      sel.clockIn().type("09:00");
      sel.clockOut().type("11:00");
      sel.saveChanges().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(new Date(request.body.clock_in_timestamp).getHours()).to.eq(9);
        expect(new Date(request.body.clock_out_timestamp).getHours()).to.eq(11);
      });
      cy.assertPopover("Timecard updated successfully");
      sel.clockIn().should("not.exist");
    });

    it("E2E — the range is narrowed and the export follows it", () => {
      visitPayPeriod();

      sel.rangeInput().should("have.value", DEFAULT_RANGE_LABEL);
      sel.rangeButton().click();
      sel.monthSelect(0).select("September");
      sel.day(0, "1").click();
      sel.day(0, "5").click();
      sel.apply().click();
      sel.rangeInput().should("have.value", "9/1/2026 - 9/5/2026");

      sel.readyExport().click();
      cy.readFile("cypress/downloads/PayPeriodReview_9-1-2026_9-5-2026.xlsx", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("E2E — an hourly and a monthly member are reported differently", () => {
      visitPayPeriod([WORKED_SHIFT, MONTHLY_SHIFT]);

      sel.summary("Avlon Regal").should("contain.text", "$50");
      sel.summary("Teju Carelead").should("contain.text", "NA");

      sel.summary("Teju Carelead").click();
      sel.details("Teju Carelead").should("contain.text", "NA");
      sel.details("Avlon Regal").should("not.be.visible");
    });
  });
});
