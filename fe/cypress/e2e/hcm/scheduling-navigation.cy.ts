/// <reference types="cypress" />

/**
 * Staff Management — Scheduling: views and date navigation
 *
 *   pages/hcm/scheduling/index.tsx              the route and its gate
 *   components/hcm/schedule/schedule-board.tsx  the header controls
 *   components/hcm/schedule/week-view.tsx       day headers, today's outline
 *   components/hcm/schedule/month-view.tsx      the month grid
 *   components/hcm/schedule/day-view.tsx        the single-day column
 *   redux/slices/schedule-date-slice.ts         where the date actually lives
 *
 * This spec is only the top bar: Today, the date label, the ‹ › arrows, the
 * view select and the Copy week select. Adding, editing, copying and printing
 * shifts are separate flows and are not driven here.
 *
 * ONE DATE, THREE VIEWS
 *   The date is a single ISO string in Redux (`scheduleDate.currentDate`), so
 *   it survives switching views: rewind two weeks and the month view opens on
 *   that month. The VIEW itself is local `useState` in the board and resets to
 *   "week" on reload. Every arrow click and every Today press dispatches to the
 *   same slice; only the step size changes — ±7 days, ±1 month, ±1 day.
 *
 * THE LABEL IS THE ASSERTION
 *   There is no other stable readout of where you are, so each navigation test
 *   reads the `w-[200px]` box. Its three formats are exact, and the week one is
 *   irregular enough to be worth writing down:
 *
 *     week   "MMM d" – "MMM d , yyyy"       → "Sep 7 – Sep 13 , 2026"
 *     month  "MMMM yyyy"                    → "September 2026"
 *     day    "EEEE, MMMM d, yyyy"           → "Tuesday, September 8, 2026"
 *
 *   That is an en dash with spaces around it, and a space BEFORE the comma in
 *   the week form (`"MMM d , yyyy"`) — while the Copy week options, built four
 *   lines further down, use a normal `"MMM d, yyyy"`. The two are inconsistent
 *   in the source; both are pinned as built.
 *
 * WHY THE CLOCK IS FROZEN
 *   "Today" and the blue outline are both `new Date()`. The slice seeds itself
 *   from `new Date()` too, so the whole screen hangs off the wall clock. Every
 *   test freezes at Tue 8 Sep 2026 — a mid-week, mid-month date, which keeps
 *   the week from straddling a year and keeps month arithmetic away from the
 *   29th–31st, where `addMonths` clamping would muddy what is being tested.
 *   `["Date"]` fakes only Date, leaving React Query's timers alive.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SCHEDULING_PATH = "/hcm/scheduling";

/** Tuesday 8 September 2026, 10:00 local — see the header note. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

// The label in each view, for the frozen date and one step either side.
const WEEK_NOW = "Sep 7 – Sep 13 , 2026";
const WEEK_PREV = "Aug 31 – Sep 6 , 2026";
const WEEK_NEXT = "Sep 14 – Sep 20 , 2026";
const MONTH_NOW = "September 2026";
const MONTH_PREV = "August 2026";
const MONTH_NEXT = "October 2026";
const DAY_NOW = "Tuesday, September 8, 2026";
const DAY_PREV = "Monday, September 7, 2026";
const DAY_NEXT = "Wednesday, September 9, 2026";

/** The six weeks Copy week offers, counting back from Mon 7 Sep 2026. */
const COPY_WEEKS = [
  "Aug 31 – Sep 6, 2026",
  "Aug 24 – Aug 30, 2026",
  "Aug 17 – Aug 23, 2026",
  "Aug 10 – Aug 16, 2026",
  "Aug 3 – Aug 9, 2026",
  "Jul 27 – Aug 2, 2026",
];

/**
 * The date the Confirm Copy Week banner prints for the Aug 31 source week.
 *
 * `week-view.tsx:649` renders `format(new Date(addDays(copyFromWeek, 1)), "MMM
 * d, yyyy")` — it takes the option's value ("2026-08-31"), which is already the
 * week start, and adds a day before formatting. The string parses as UTC
 * midnight and formats in local time, so the +1 cancels the westward shift and
 * the banner reads "Aug 31" in the Americas — and "Sep 1", the wrong week
 * start, at UTC+0 and east of it.
 *
 * Derived rather than hardcoded so the test states the same thing wherever it
 * runs; see the README note on this pairing.
 */
const BANNER_WEEK = (() => {
  const d = new Date(Date.parse("2026-08-31") + 24 * 60 * 60 * 1000);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
})();

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
  roaster: [{ pay_rate: 15 }],
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  /** Today, the label and both arrows share one flex row. */
  controls: () => cy.contains("div", /^Today$/).parent(),
  today: () => cy.contains("div", /^Today$/),
  label: () => sel.controls().find('div[class*="w-[200px]"]'),
  /** The only two icons in that row, in DOM order: back then forward. */
  prev: () => sel.controls().find("svg").eq(0).parent(),
  next: () => sel.controls().find("svg").eq(1).parent(),
  viewSelect: () => cy.get('select[name="view"]'),
  copyWeek: () => cy.get('select[name="copyWeek"]'),
  /** A week-view column header, e.g. "Tue 08" (`format(date, "EEE dd")`). */
  dayHeader: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
  /** A month-view date cell; its text is the day number plus the hover "+ Add". */
  monthCell: (dd: string) =>
    cy.contains('div[class*="text-xs"]', new RegExp(`^${dd}`)),
};

/** Read the date label, whitespace-normalised, and retry until it matches. */
const labelIs = (expected: string) =>
  sel.label().should(($el) => {
    expect($el.text().replace(/\s+/g, " ").trim()).to.eq(expected);
  });

const clickPrev = (times = 1) => {
  for (let i = 0; i < times; i += 1) sel.prev().click();
};

const clickNext = (times = 1) => {
  for (let i = 0; i < times; i += 1) sel.next().click();
};

// ── Setup ────────────────────────────────────────────────────────────────────

const visitBoard = (
  opts: { role?: any; home?: any; staff?: any[] } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? opts.staff ?? [buildStaffRow()] : [] },
    });
  }).as("getStaff");
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: [] },
  }).as("getShifts");

  // Freeze before the visit so the slice seeds itself from the frozen instant.
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SCHEDULING_PATH);
  sel.today().should("be.visible");
};

/**
 * Answer the copy-week lookup with one available shift, while leaving the
 * board's own week empty.
 *
 * Both go to GET /v1/hcm/shifts; only the copy lookup carries
 * `shift_start_time`, so that parameter is what tells them apart. The shift has
 * to fall inside the chosen source week (Mon 31 Aug – Sun 6 Sep 2026) and be
 * `available` — `availableShiftsToCopy` drops every other status.
 */
const stubCopyableWeek = () =>
  cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
    const isCopyLookup = new URL(req.url).searchParams.has("shift_start_time");
    req.reply({
      statusCode: 200,
      body: {
        shifts: isCopyLookup
          ? [
              {
                id: 9001,
                user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                user_name: "Priya Patel",
                home_id: TEST_HOME_ID,
                shift_status: "available",
                shift_start_time: new Date(2026, 8, 2, 9, 0, 0).toISOString(),
                shift_end_time: new Date(2026, 8, 2, 17, 0, 0).toISOString(),
                pay_rate: 15,
              },
            ]
          : [],
      },
    });
  }).as("getShifts");

const inMonthView = () => {
  sel.viewSelect().select("month");
  labelIs(MONTH_NOW);
};

const inDayView = () => {
  sel.viewSelect().select("day");
  labelIs(DAY_NOW);
};

describe("Staff Management — Scheduling: views and date navigation", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. What the board opens on
  // ──────────────────────────────────────────────────────────────────────────

  describe("Defaults", () => {
    beforeEach(() => visitBoard());

    it("opens in Week View", () => {
      sel.viewSelect().should("have.value", "week");
    });

    it("opens on the week containing today", () => {
      labelIs(WEEK_NOW);
    });

    it("offers all three controls", () => {
      sel.today().should("be.visible");
      sel.label().should("be.visible");
      sel.controls().find("svg").should("have.length", 2);
    });

    it("runs the week from Monday to Sunday", () => {
      ["Mon 07", "Tue 08", "Wed 09", "Thu 10", "Fri 11", "Sat 12", "Sun 13"].forEach(
        (day) => sel.dayHeader(day).should("be.visible")
      );
    });

    it("outlines today's column", () => {
      sel.dayHeader("Tue 08").should("have.class", "border-blue-500");
    });

    it("outlines only today's column", () => {
      ["Mon 07", "Wed 09", "Sun 13"].forEach((day) =>
        sel.dayHeader(day).should("not.have.class", "border-blue-500")
      );
    });

    it("offers Copy week alongside the view select", () => {
      sel.copyWeek().should("exist");
      sel.viewSelect().should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Week view — the arrows
  // ──────────────────────────────────────────────────────────────────────────

  describe("Week view — navigating", () => {
    beforeEach(() => visitBoard());

    it("steps back one week", () => {
      clickPrev();
      labelIs(WEEK_PREV);
    });

    it("steps forward one week", () => {
      clickNext();
      labelIs(WEEK_NEXT);
    });

    it("steps back several weeks", () => {
      clickPrev(3);
      labelIs("Aug 17 – Aug 23 , 2026");
    });

    it("steps forward several weeks", () => {
      clickNext(3);
      labelIs("Sep 28 – Oct 4 , 2026");
    });

    it("returns to the current week when the steps cancel out", () => {
      clickPrev(2);
      clickNext(2);
      labelIs(WEEK_NOW);
    });

    it("crosses a month boundary going back", () => {
      // Mon 31 Aug – Sun 6 Sep: the week straddles two months.
      clickPrev();
      labelIs(WEEK_PREV);
      sel.dayHeader("Mon 31").should("be.visible");
      sel.dayHeader("Sun 06").should("be.visible");
    });

    it("crosses a month boundary going forward", () => {
      clickNext(3);
      sel.dayHeader("Mon 28").should("be.visible");
      sel.dayHeader("Sun 04").should("be.visible");
    });

    it("redraws the day columns for the week it moved to", () => {
      clickPrev();
      sel.dayHeader("Tue 08").should("not.exist");
      sel.dayHeader("Tue 01").should("be.visible");
    });

    it("drops the outline once the week no longer contains today", () => {
      clickPrev();
      sel.dayHeader("Tue 01").should("not.have.class", "border-blue-500");
    });

    it("drops the outline in a future week too", () => {
      clickNext();
      sel.dayHeader("Tue 15").should("not.have.class", "border-blue-500");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Week view — Today
  // ──────────────────────────────────────────────────────────────────────────

  describe("Week view — Today", () => {
    beforeEach(() => visitBoard());

    it("returns from a past week", () => {
      clickPrev(4);
      labelIs("Aug 10 – Aug 16 , 2026");
      sel.today().click();
      labelIs(WEEK_NOW);
    });

    it("returns from a future week", () => {
      clickNext(4);
      labelIs("Oct 5 – Oct 11 , 2026");
      sel.today().click();
      labelIs(WEEK_NOW);
    });

    it("brings back the outline on today's column", () => {
      clickPrev(2);
      sel.today().click();
      sel.dayHeader("Tue 08").should("have.class", "border-blue-500");
    });

    it("changes nothing when the current week is already shown", () => {
      sel.today().click();
      labelIs(WEEK_NOW);
      sel.dayHeader("Tue 08").should("have.class", "border-blue-500");
    });

    it("can be pressed twice without moving", () => {
      sel.today().click();
      sel.today().click();
      labelIs(WEEK_NOW);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. The view select
  // ──────────────────────────────────────────────────────────────────────────

  describe("The view select", () => {
    beforeEach(() => visitBoard());

    it("offers exactly Month, Week and Day", () => {
      sel.viewSelect()
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels).to.deep.eq(["Month View", "Week View", "Day View"]);
        });
    });

    it("switches to the month view", () => {
      sel.viewSelect().select("month");
      sel.viewSelect().should("have.value", "month");
      labelIs(MONTH_NOW);
    });

    it("switches to the day view", () => {
      sel.viewSelect().select("day");
      sel.viewSelect().should("have.value", "day");
      labelIs(DAY_NOW);
    });

    it("switches back to the week view", () => {
      sel.viewSelect().select("month");
      sel.viewSelect().select("week");
      labelIs(WEEK_NOW);
    });

    it("goes straight from month to day", () => {
      sel.viewSelect().select("month");
      sel.viewSelect().select("day");
      labelIs(DAY_NOW);
    });

    it("reverts to the week view on reload", () => {
      // `view` is component state, not Redux — a reload resets it.
      sel.viewSelect().select("month");
      cy.reload();
      sel.viewSelect().should("have.value", "week");
    });
  });

  describe("Copy week is week-view only", () => {
    beforeEach(() => visitBoard());

    it("is offered in the week view", () => {
      sel.copyWeek().should("exist");
    });

    it("is withdrawn in the month view", () => {
      sel.viewSelect().select("month");
      sel.copyWeek().should("not.exist");
    });

    it("is withdrawn in the day view", () => {
      sel.viewSelect().select("day");
      sel.copyWeek().should("not.exist");
    });

    it("comes back on returning to the week view", () => {
      sel.viewSelect().select("day");
      sel.copyWeek().should("not.exist");
      sel.viewSelect().select("week");
      sel.copyWeek().should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Month view
  // ──────────────────────────────────────────────────────────────────────────

  describe("Month view — navigating", () => {
    beforeEach(() => {
      visitBoard();
      inMonthView();
    });

    it("steps back one month", () => {
      clickPrev();
      labelIs(MONTH_PREV);
    });

    it("steps forward one month", () => {
      clickNext();
      labelIs(MONTH_NEXT);
    });

    it("steps back several months", () => {
      clickPrev(3);
      labelIs("June 2026");
    });

    it("steps forward several months", () => {
      clickNext(3);
      labelIs("December 2026");
    });

    it("crosses into the previous year", () => {
      clickPrev(9);
      labelIs("December 2025");
    });

    it("crosses into the next year", () => {
      clickNext(4);
      labelIs("January 2027");
    });

    it("returns to the current month when the steps cancel out", () => {
      clickNext(2);
      clickPrev(2);
      labelIs(MONTH_NOW);
    });

    it("outlines today's cell in the current month", () => {
      sel.monthCell("08").should("have.class", "border-blue-500");
    });

    it("outlines nothing once the month no longer contains today", () => {
      clickPrev();
      labelIs(MONTH_PREV);
      cy.get('div[class*="text-xs"][class*="border-blue-500"]').should("not.exist");
    });
  });

  describe("Month view — Today", () => {
    beforeEach(() => {
      visitBoard();
      inMonthView();
    });

    it("returns from a past month", () => {
      clickPrev(5);
      labelIs("April 2026");
      sel.today().click();
      labelIs(MONTH_NOW);
    });

    it("returns from a future month", () => {
      clickNext(5);
      labelIs("February 2027");
      sel.today().click();
      labelIs(MONTH_NOW);
    });

    it("brings back the outline on today's cell", () => {
      clickPrev(2);
      sel.today().click();
      sel.monthCell("08").should("have.class", "border-blue-500");
    });

    it("changes nothing when the current month is already shown", () => {
      sel.today().click();
      labelIs(MONTH_NOW);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Day view
  // ──────────────────────────────────────────────────────────────────────────

  describe("Day view — navigating", () => {
    beforeEach(() => {
      visitBoard();
      inDayView();
    });

    it("steps back one day", () => {
      clickPrev();
      labelIs(DAY_PREV);
    });

    it("steps forward one day", () => {
      clickNext();
      labelIs(DAY_NEXT);
    });

    it("steps back several days", () => {
      clickPrev(3);
      labelIs("Saturday, September 5, 2026");
    });

    it("steps forward several days", () => {
      clickNext(3);
      labelIs("Friday, September 11, 2026");
    });

    it("names the weekday it moved to", () => {
      clickNext(6);
      labelIs("Monday, September 14, 2026");
    });

    it("crosses a month boundary going back", () => {
      clickPrev(8);
      labelIs("Monday, August 31, 2026");
    });

    it("crosses a month boundary going forward", () => {
      clickNext(23);
      labelIs("Thursday, October 1, 2026");
    });

    it("returns to today when the steps cancel out", () => {
      clickPrev(3);
      clickNext(3);
      labelIs(DAY_NOW);
    });
  });

  describe("Day view — Today", () => {
    beforeEach(() => {
      visitBoard();
      inDayView();
    });

    it("returns from a past day", () => {
      clickPrev(5);
      labelIs("Thursday, September 3, 2026");
      sel.today().click();
      labelIs(DAY_NOW);
    });

    it("returns from a future day", () => {
      clickNext(5);
      labelIs("Sunday, September 13, 2026");
      sel.today().click();
      labelIs(DAY_NOW);
    });

    it("changes nothing when today is already shown", () => {
      sel.today().click();
      labelIs(DAY_NOW);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. The date survives a change of view
  // ──────────────────────────────────────────────────────────────────────────

  describe("One date across three views", () => {
    beforeEach(() => visitBoard());

    it("carries a rewound week into the month view", () => {
      clickPrev(2);
      labelIs("Aug 24 – Aug 30 , 2026");
      sel.viewSelect().select("month");
      labelIs(MONTH_PREV);
    });

    it("carries a rewound week into the day view", () => {
      clickPrev();
      sel.viewSelect().select("day");
      labelIs("Tuesday, September 1, 2026");
    });

    it("carries a month step into the week view", () => {
      sel.viewSelect().select("month");
      clickNext();
      labelIs(MONTH_NEXT);
      sel.viewSelect().select("week");
      labelIs("Oct 5 – Oct 11 , 2026");
    });

    it("carries a day step into the week view", () => {
      sel.viewSelect().select("day");
      clickNext(7);
      labelIs("Tuesday, September 15, 2026");
      sel.viewSelect().select("week");
      labelIs("Sep 14 – Sep 20 , 2026");
    });

    it("resets every view when Today is pressed in one of them", () => {
      sel.viewSelect().select("month");
      clickPrev(3);
      sel.today().click();
      labelIs(MONTH_NOW);

      sel.viewSelect().select("week");
      labelIs(WEEK_NOW);
      sel.viewSelect().select("day");
      labelIs(DAY_NOW);
    });

    it("keeps the step size to the view it is used in", () => {
      // One click back is a week, a month or a day depending on where you are.
      clickPrev();
      labelIs(WEEK_PREV);
      sel.viewSelect().select("day");
      labelIs("Tuesday, September 1, 2026");
      clickPrev();
      labelIs("Monday, August 31, 2026");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. The Copy week select
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Copy week select", () => {
    beforeEach(() => visitBoard());

    it("starts with no week chosen", () => {
      // The placeholder option is `disabled hidden`, so the browser refuses to
      // make it the selected option and the select reports no value at all —
      // `.val()` is null rather than "". It still DISPLAYS the placeholder.
      sel.copyWeek().invoke("val").should("not.be.ok");
    });

    it("shows its placeholder", () => {
      sel.copyWeek().find("option[value='']").should("have.text", "⧉ Copy week");
    });

    it("labels the list 'Copy from:'", () => {
      sel.copyWeek().contains("option", "Copy from:").should("exist");
    });

    it("offers the six preceding weeks", () => {
      sel.copyWeek()
        .find("option")
        .then(($options) => {
          const labels = [...$options]
            .map((o) => o.textContent)
            .filter((t) => t !== "Copy from:" && t !== "⧉ Copy week");
          expect(labels).to.deep.eq(COPY_WEEKS);
        });
    });

    it("offers no week later than the one on screen", () => {
      // Every option starts before Mon 7 Sep; the current week is not listed.
      sel.copyWeek().should("not.contain.text", "Sep 7 –");
    });

    it("carries the week start as each option's value", () => {
      sel.copyWeek()
        .find("option")
        .eq(2)
        .should("have.value", "2026-08-31");
    });

    it("[as-built] punctuates its weeks differently from the header", () => {
      // The header builds "MMM d , yyyy" and these options "MMM d, yyyy", four
      // lines apart in schedule-board.tsx. Both pinned as built.
      labelIs(WEEK_NOW);
      sel.copyWeek().should("contain.text", "Aug 31 – Sep 6, 2026");
    });

    it("re-bases its options when the week changes", () => {
      clickPrev();
      labelIs(WEEK_PREV);
      sel.copyWeek()
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels).to.include("Aug 24 – Aug 30, 2026");
          expect(labels).not.to.include("Aug 31 – Sep 6, 2026");
        });
    });

    it("re-bases its options for a future week too", () => {
      clickNext();
      labelIs(WEEK_NEXT);
      sel.copyWeek().should("contain.text", "Sep 7 – Sep 13, 2026");
    });

    it("asks for confirmation when a week is chosen", () => {
      // The copy itself is a separate flow; this pins the handover to it.
      sel.copyWeek().select("2026-08-31");
      cy.contains("Confirm Copy Week").should("be.visible");
    });

    it("says so when the chosen week has nothing to copy", () => {
      // The board's own week and the copy source share one endpoint; with the
      // default stub both come back empty.
      sel.copyWeek().select("2026-08-31");
      cy.contains("There are no available shifts to copy!").should("be.visible");
    });

    it("offers no Confirm when the chosen week has nothing to copy", () => {
      sel.copyWeek().select("2026-08-31");
      cy.contains("There are no available shifts to copy!").should("be.visible");
      cy.contains("button", "Confirm").should("not.exist");
    });

    it("names the chosen week when it does have shifts", () => {
      stubCopyableWeek();
      sel.copyWeek().select("2026-08-31");
      cy.contains("Are you sure you want to copy the schedule from the").should(
        "be.visible"
      );
      cy.contains(BANNER_WEEK).should("be.visible");
    });

    it("warns that time off is left behind", () => {
      stubCopyableWeek();
      sel.copyWeek().select("2026-08-31");
      cy.contains("Only available shifts will be copied and time offs are excluded.")
        .should("be.visible");
    });

    it("sends nothing until the copy is confirmed", () => {
      cy.intercept("POST", "**/v1/hcm/shift**").as("createShift");
      stubCopyableWeek();
      sel.copyWeek().select("2026-08-31");
      cy.contains("button", "Confirm").should("be.visible");
      cy.assertNoRequest("@createShift");
    });

    it("sends nothing when the confirmation is cancelled", () => {
      cy.intercept("POST", "**/v1/hcm/shift**").as("createShift");
      stubCopyableWeek();
      sel.copyWeek().select("2026-08-31");
      cy.contains("button", "Cancel").click();

      cy.contains("Confirm Copy Week").should("not.exist");
      cy.assertNoRequest("@createShift");
    });

    it("leaves the displayed week alone when a copy source is chosen", () => {
      sel.copyWeek().select("2026-08-31");
      labelIs(WEEK_NOW);
    });

    it("leaves the displayed week alone after cancelling", () => {
      stubCopyableWeek();
      sel.copyWeek().select("2026-08-31");
      cy.contains("button", "Cancel").click();
      labelIs(WEEK_NOW);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the board to a role without HCM_TIMESHEETS", () => {
      cy.clearAuthSession();
      cy.setAuthSession("Lead");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.visit(SCHEDULING_PATH);
      cy.assertRestricted();
    });

    it("refuses the board when the home has no staff management module", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ authorizedModules: ["CRM", "CLINICAL"] }));
      cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.visit(SCHEDULING_PATH);
      cy.assertRestricted();
    });

    it("withholds Copy week from a role without HCM_SCHEDULING", { tags: [Tags.SENIOR] }, () => {
      // A Senior holds HCM_TIMESHEETS EDIT, so the board renders, but not
      // HCM_SCHEDULING — the ProtectedComponent around Copy week sees nothing.
      visitBoard({ role: "Senior" });
      sel.copyWeek().should("not.exist");
    });

    it("still lets that role navigate the dates", { tags: [Tags.SENIOR] }, () => {
      visitBoard({ role: "Senior" });
      labelIs(WEEK_NOW);
      clickPrev();
      labelIs(WEEK_PREV);
      sel.today().click();
      labelIs(WEEK_NOW);
    });

    it("still lets that role switch views", { tags: [Tags.SENIOR] }, () => {
      visitBoard({ role: "Senior" });
      sel.viewSelect().select("month");
      labelIs(MONTH_NOW);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a fortnight back, into the month, and home again", () => {
      visitBoard();

      clickPrev(2);
      labelIs("Aug 24 – Aug 30 , 2026");

      sel.viewSelect().select("month");
      labelIs(MONTH_PREV);
      cy.get('div[class*="text-xs"][class*="border-blue-500"]').should("not.exist");

      sel.today().click();
      labelIs(MONTH_NOW);
      sel.monthCell("08").should("have.class", "border-blue-500");

      sel.viewSelect().select("week");
      labelIs(WEEK_NOW);
      sel.dayHeader("Tue 08").should("have.class", "border-blue-500");
    });

    it("E2E — every view lands on the same day when Today is pressed", () => {
      visitBoard();

      sel.viewSelect().select("day");
      clickNext(10);
      sel.today().click();
      labelIs(DAY_NOW);

      sel.viewSelect().select("week");
      labelIs(WEEK_NOW);

      sel.viewSelect().select("month");
      labelIs(MONTH_NOW);
    });

    it("E2E — the copy source follows the week being viewed", () => {
      visitBoard();

      sel.copyWeek().should("contain.text", COPY_WEEKS[0]);

      clickPrev(2);
      labelIs("Aug 24 – Aug 30 , 2026");
      sel.copyWeek().should("contain.text", "Aug 17 – Aug 23, 2026");

      sel.today().click();
      labelIs(WEEK_NOW);
      sel.copyWeek().should("contain.text", COPY_WEEKS[0]);
    });
  });
});
