/* eslint-disable cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Staff Management — Scheduling: shifts, time off, copy and print
 *
 *   components/hcm/schedule/schedule-board.tsx  the modal shell and its guards
 *   components/hcm/schedule/week-view.tsx       the grid, Print, Confirm Copy Week
 *   components/hcm/schedule/add-shift.tsx       the Add shift tab
 *   components/hcm/schedule/time-off.tsx        the Time off tab
 *   components/hcm/schedule/week-select.tsx     "Apply to"
 *   components/hcm/schedule/color-select.tsx    "Select a color"
 *   components/hcm/utils/timeUtils.ts           the time dropdown and ISO joins
 *
 * The top bar — Today, the arrows, the view select, choosing a copy source —
 * is in scheduling-navigation.cy.ts. This spec picks up where that one stops.
 *
 * THE CLOCK IS FROZEN AT TUE 8 SEP 2026
 *   Same reason and same instant as the navigation spec: "today" decides
 *   whether the Time off tab exists at all, and the week the board opens on
 *   decides which dates the grid offers. Wed 9 Sep is used as the working cell
 *   throughout — a future day, so Time off is available on it.
 *
 * WHAT A SAVE ACTUALLY SENDS
 *   The endpoints are NOT symmetrical with the one the board reads from, and
 *   the difference is a single letter:
 *
 *     GET    /v1/hcm/shifts        the list
 *     POST   /v1/hcm/shift         create
 *     PUT    /v1/hcm/shift/{id}    update
 *
 *   A stub written against `**\/v1/hcm/shifts*` therefore catches the list and
 *   silently misses every write, which looks exactly like "the button does
 *   nothing". `hcm-create-shift.ts` also insists on a **201** specifically — it
 *   throws on any other 2xx — so a 200 stub fails the create.
 *
 *   Creating is sometimes a single object and sometimes an ARRAY:
 *
 *     Add shift    one weekday selected  → array of one (Apply to always
 *                                          preselects the clicked day, so the
 *                                          single-object branch is unreachable
 *                                          from the grid)
 *                  several selected      → array, one entry per weekday
 *     Time off     Multiple Days off     → single object
 *                  Multiple Days on      → array, one entry per day in range
 *
 *   Times leave the form as local "HH:mm:ss" and are joined to the cell's date
 *   with `getUtcDateTimeString`, so the wire value is a real UTC instant. Tests
 *   therefore assert on the LOCAL rendering of what was sent, never on a
 *   hardcoded Z-string, or they would only pass in one timezone.
 *
 * OVERNIGHT SHIFTS
 *   If the end is at or before the start, add-shift rolls the end forward a
 *   day. 10 PM – 6 AM is a real night shift, not a validation error.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SCHEDULING_PATH = "/hcm/scheduling";

/** Tuesday 8 September 2026, 10:00 local. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const PRIYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALBERT = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";
const NO_WAGE = "bbbbbbbb-bbbb-4bbb-8bbb-dddddddddddd";

/** The working cell: Wednesday of the frozen week — a future day. */
const WED = new Date(2026, 8, 9);
const WED_TITLE = "Add Schedule - September 9, 2026";
const WED_EDIT_TITLE = "Edit Schedule - September 9, 2026";

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
  mobile: "5551112222",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
  ...overrides,
});

const PRIYA_ROW = buildMember(PRIYA, "Priya Patel");
const ALBERT_ROW = buildMember(ALBERT, "Albert Einstein");
/** No usable wage — `hasMemberPayRate` rejects an empty roaster. */
const NO_WAGE_ROW = buildMember(NO_WAGE, "Wageless Wanda", { roaster: [] });

/** Build a local datetime on a given day, as the app would. */
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
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

const buildTimeOff = (overrides: Record<string, any> = {}) =>
  buildShift({
    id: 6001,
    shift_status: "timeoff",
    unavailability_reason: "Sick Leave",
    is_unavailability_approved: null,
    shift_start_time: at(WED, 0, 0),
    shift_end_time: at(WED, 23, 59),
    ...overrides,
  });

/** Every reason the Time off dropdown offers, in source order. */
const TIME_OFF_REASONS = [
  "Vacation(Unpaid)",
  "Vacation(Paid)",
  "Hoilday", // sic — the constant is misspelled; pinned as built
  "Jury Duty",
  "Sick Leave",
  "Personal Medical Emergency",
  "Family Medical Emergency",
  "Other",
];

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  controls: () => cy.contains("div", /^Today$/).parent(),
  prev: () => sel.controls().find("svg").eq(0).parent(),
  print: () => cy.contains("button", "Print"),
  copyWeek: () => cy.get('select[name="copyWeek"]'),

  /** The row for one team member; its name cell carries a title attribute. */
  memberRow: (name: string) => cy.get(`div[title="${name}"]`).closest(".contents"),
  /**
   * A grid cell for a member on a weekday index (0 = Mon).
   *
   * `DroppableCell` passes its id to dnd-kit only — nothing lands in the DOM —
   * so the cells are found by their layout class instead.
   */
  cell: (name: string, dayIndex: number) =>
    sel.memberRow(name).find('div[class*="min-h-[60px]"]').eq(dayIndex),
  /**
   * The visible shift card.
   *
   * `.shift-card` is on TWO elements for an available shift: the draggable
   * wrapper (week-view.tsx:161, class list is just "shift-card") and the card
   * inside it, which carries the border, the colour and the click handler. Time
   * off has no wrapper, so it matches once. Filtering on `border-2` picks the
   * card in both cases.
   */
  shiftCard: () => cy.get('.shift-card[class*="border-2"]'),
  /** The draggable wrapper: it owns the cursor and the already-clocked guard. */
  shiftWrapper: () => cy.get(".shift-card").not('[class*="border-2"]'),
  /** The cards sitting in one member's row. */
  cardsIn: (name: string) =>
    sel.memberRow(name).find('.shift-card[class*="border-2"]'),

  modalTitle: (text: string) => cy.contains(text),
  tab: (label: string) => cy.contains("span", label),
  startTime: () => cy.get('select[name="shift_start_time"]'),
  endTime: () => cy.get('select[name="shift_end_time"]'),
  teamMember: () => cy.get('select[name="user_id"]'),
  reason: () => cy.get('select[name="unavailability_reason"]'),
  notes: () => cy.get('textarea[name="notes"]'),
  applyTo: () => cy.contains("div", /^Apply to$/).parent(),
  weekday: (day: string) => sel.applyTo().contains("button", day),
  colourTrigger: () => cy.contains("div", /^Select a color$/).parent().find("div.w-16 > div"),
  save: () => cy.contains("button", /^(Save|Saving\.\.\.)$/),
  /** ToggleSwitch renders a label span next to the button that actually toggles. */
  multipleDays: () => cy.contains("span", "Multiple Days").parent().find("button"),
  toggle: () => cy.contains("Multiple Days").parent().find("input, [role='switch'], div").last(),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubUsers = (members: any[]) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? members : [] },
    });
  }).as("getStaff");

const stubShifts = (shifts: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");

const visitBoard = (
  opts: { members?: any[]; shifts?: any[]; role?: any } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(buildHome());
  stubUsers(opts.members ?? [PRIYA_ROW, ALBERT_ROW]);
  stubShifts(opts.shifts ?? []);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SCHEDULING_PATH);
  cy.contains("Today").should("be.visible");
  cy.contains("Tue 08").should("be.visible");
};

/** Open the Add Schedule modal on Priya's Wednesday cell. */
const openAddShift = () => {
  sel.cell("Priya Patel", 2).click({ force: true });
  sel.modalTitle(WED_TITLE).should("be.visible");
};

/** Open the Edit Schedule modal on an existing shift. */
const openEditShift = () => {
  sel.shiftCard().first().click({ force: true });
  sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
};

/**
 * Drag the first shift card onto a grid cell.
 *
 * dnd-kit drives everything from pointer events on `document`, behind a
 * `PointerSensor` with a 4px activation distance — so a plain `.trigger("drag")`
 * does nothing at all. Three things are load-bearing here, each established by
 * trying the alternative and watching the drag never start:
 *
 *   1. The MOVES go to `body`, not to the source or target element. dnd-kit
 *      binds its move/up listeners to the document once the drag activates.
 *   2. There is a pause between the steps. The sensor activates asynchronously,
 *      and Cypress fires events back to back — without a gap the drop resolves
 *      against a `null` `over` and nothing is sent.
 *   3. Coordinates come from live bounding rects. `closestCenter` compares real
 *      geometry, so invented numbers drop the shift nowhere.
 *
 * `mousedown`/`mousemove` are not a substitute: the PointerSensor listens for
 * pointer events only.
 */
const dragShiftTo = (member: string, dayIndex: number) => {
  const pointer = {
    eventConstructor: "PointerEvent",
    pointerType: "mouse",
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: 1,
    force: true,
  } as any;

  sel.shiftCard().first().then(($card) => {
    const from = $card[0].getBoundingClientRect();
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height / 2;

    sel.cell(member, dayIndex).then(($cell) => {
      const to = $cell[0].getBoundingClientRect();
      const toX = to.x + to.width / 2;
      const toY = to.y + to.height / 2;

      cy.wrap($card).trigger("pointerdown", { ...pointer, clientX: fromX, clientY: fromY });
      cy.wait(50);
      // Clear the 4px threshold, then travel, then settle over the target.
      cy.get("body").trigger("pointermove", { ...pointer, clientX: fromX + 6, clientY: fromY + 6 });
      cy.wait(50);
      cy.get("body").trigger("pointermove", { ...pointer, clientX: fromX + 30, clientY: fromY + 30 });
      cy.wait(50);
      cy.get("body").trigger("pointermove", { ...pointer, clientX: toX, clientY: toY });
      cy.wait(100);
      cy.get("body").trigger("pointerup", { ...pointer, buttons: 0, clientX: toX, clientY: toY });
    });
  });
};

const stubCreate = (statusCode = 201, body: any = {}) =>
  cy.intercept("POST", "**/v1/hcm/shift", { statusCode, body }).as("createShift");

const stubUpdate = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/hcm/shift/*", { statusCode, body }).as("updateShift");

/** Render an ISO instant as local "h:mm AM" — the only timezone-safe assertion. */
const localTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

/**
 * The same instant as the CARD prints it.
 *
 * The grid uses `format(..., "hh:mm a")` — a zero-padded hour — while the time
 * dropdown and every other readout use a numeric one. "09:30 AM" on a card,
 * "9:30 AM" in the picker, same shift.
 */
const cardTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

/** Render an ISO instant as a local yyyy-MM-dd. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe("Staff Management — Scheduling: shifts, time off, copy and print", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Confirming a week copy
  // ──────────────────────────────────────────────────────────────────────────

  describe("Confirming a week copy", () => {
    /** One available shift in the Aug 31 – Sep 6 source week (Wed 2 Sep). */
    const SOURCE_SHIFT = buildShift({
      id: 7001,
      shift_start_time: at(new Date(2026, 8, 2), 9, 0),
      shift_end_time: at(new Date(2026, 8, 2), 17, 0),
      notes: "Morning round",
      shift_color: "#388E3C",
    });

    const stubCopySource = (shifts: any[] = [SOURCE_SHIFT]) =>
      cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
        const isCopyLookup = new URL(req.url).searchParams.has("shift_start_time");
        req.reply({ statusCode: 200, body: { shifts: isCopyLookup ? shifts : [] } });
      }).as("getShifts");

    const openConfirm = (shifts?: any[]) => {
      visitBoard();
      stubCopySource(shifts);
      sel.copyWeek().select("2026-08-31");
      cy.contains("Confirm Copy Week").should("be.visible");
    };

    it("copies the source week's shifts", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        expect(request.body, "a bulk array is sent").to.be.an("array");
        expect(request.body).to.have.length(1);
      });
    });

    it("moves each shift forward to the displayed week", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        // Wed 2 Sep in the source week becomes Wed 9 Sep in the current one.
        expect(localDay(request.body[0].shift_start_time)).to.eq("2026-09-09");
        expect(localDay(request.body[0].shift_end_time)).to.eq("2026-09-09");
      });
    });

    it("keeps the time of day when it moves them", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        expect(localTime(request.body[0].shift_start_time)).to.eq(
          localTime(SOURCE_SHIFT.shift_start_time)
        );
        expect(localTime(request.body[0].shift_end_time)).to.eq(
          localTime(SOURCE_SHIFT.shift_end_time)
        );
      });
    });

    it("carries the colour and the notes across", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].shift_color).to.eq("#388E3C");
        expect(request.body[0].notes).to.eq("Morning round");
      });
    });

    it("copies them as available shifts", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].shift_status).to.eq("available");
      });
    });

    it("confirms the copy", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift");
      cy.assertPopover("Shifts copied successfully!");
    });

    it("closes the dialog once copied", () => {
      stubCreate();
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift");
      cy.contains("Confirm Copy Week").should("not.exist");
    });

    it("leaves out a shift whose owner is no longer on the team", () => {
      // `copyShiftsToNewWeek` skips any shift whose user_id is not an active
      // member of the current board.
      stubCreate();
      openConfirm([
        SOURCE_SHIFT,
        buildShift({ id: 7002, user_id: "someone-who-left" }),
      ]);
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(1);
        expect(request.body[0].user_id).to.eq(PRIYA);
      });
    });

    it("reports a rejected copy", () => {
      cy.intercept("POST", "**/v1/hcm/shift", {
        statusCode: 500,
        body: { error: "Copy failed" },
      }).as("createShift");
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift");
      cy.assertPopover("Copy failed");
    });

    it("closes the dialog after a rejected copy", () => {
      cy.intercept("POST", "**/v1/hcm/shift", { statusCode: 500, body: {} }).as(
        "createShift"
      );
      openConfirm();
      cy.contains("button", "Confirm").click();

      cy.wait("@createShift");
      cy.contains("Confirm Copy Week").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Print
  // ──────────────────────────────────────────────────────────────────────────

  describe("Print", () => {
    it("offers Print to a scheduler", () => {
      visitBoard();
      sel.print().should("be.visible");
    });

    it("withholds Print from a role without HCM_SCHEDULING", { tags: [Tags.SENIOR] }, () => {
      visitBoard({ role: "Senior" });
      sel.print().should("not.exist");
    });

    it("downloads the week as a PDF", () => {
      visitBoard({ shifts: [buildShift()] });
      sel.print().click();
      // downloadPdf names it "<prefix>_<yyyy_MM_dd of the week's Monday>.pdf".
      cy.readFile("cypress/downloads/weekly_schedule_2026_09_07.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("names the file after the week on screen, not today", () => {
      visitBoard({ shifts: [buildShift()] });
      sel.prev().click();
      cy.contains("Aug 31").should("be.visible");
      sel.print().click();
      cy.readFile("cypress/downloads/weekly_schedule_2026_08_31.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("writes a real PDF", () => {
      visitBoard({ shifts: [buildShift()] });
      sel.print().click();
      cy.readFile("cypress/downloads/weekly_schedule_2026_09_07.pdf", "binary", {
        timeout: 20000,
      }).then((contents: string) => {
        expect(contents.slice(0, 5), "PDF magic number").to.eq("%PDF-");
      });
    });

    it("still produces a sheet for a week with no shifts", () => {
      visitBoard({ shifts: [] });
      sel.print().click();
      cy.readFile("cypress/downloads/weekly_schedule_2026_09_07.pdf", null, {
        timeout: 20000,
      }).should("have.length.greaterThan", 0);
    });

    it("sends nothing to the API", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("createShift");
      visitBoard({ shifts: [buildShift()] });
      sel.print().click();
      cy.assertNoRequest("@createShift");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Add shift — the form
  // ──────────────────────────────────────────────────────────────────────────

  describe("Add shift — the form", () => {
    beforeEach(() => {
      visitBoard();
      openAddShift();
    });

    it("names the day it was opened on", () => {
      sel.modalTitle(WED_TITLE).should("be.visible");
    });

    it("names the team member the cell belongs to", () => {
      cy.contains("Priya Patel").should("be.visible");
    });

    it("opens on the Add shift tab", () => {
      sel.tab("Add shift").should("be.visible");
    });

    it("offers a Time off tab for a future day", () => {
      sel.tab("Time off").should("be.visible");
    });

    it("offers a start and an end time", () => {
      sel.startTime().should("exist");
      sel.endTime().should("exist");
    });

    it("starts with neither time chosen", () => {
      sel.startTime().invoke("val").should("not.be.ok");
      sel.endTime().invoke("val").should("not.be.ok");
    });

    it("offers the whole day in quarter-hour steps", () => {
      sel.startTime().find("option").should("have.length.at.least", 96);
    });

    it("labels midnight and noon unambiguously", () => {
      sel.startTime().find('option[value="00:00:00"]').should("have.text", "12:00 AM");
      sel.startTime().find('option[value="12:00:00"]').should("have.text", "12:00 PM");
    });

    it("distinguishes morning from afternoon", () => {
      // The reason AM/PM matters: 09:00 and 21:00 are twelve hours apart.
      sel.startTime().find('option[value="09:00:00"]').should("have.text", "9:00 AM");
      sel.startTime().find('option[value="21:00:00"]').should("have.text", "9:00 PM");
    });

    it("runs to a quarter to midnight", () => {
      sel.startTime().find('option[value="23:45:00"]').should("have.text", "11:45 PM");
    });

    it("preselects the day the cell belongs to under Apply to", () => {
      sel.weekday("Wed").should("have.class", "border-primary");
    });

    it("leaves the other days unselected", () => {
      ["Mon", "Tue", "Thu", "Fri", "Sat", "Sun"].forEach((day) =>
        sel.weekday(day).should("have.class", "border-gray-300")
      );
    });

    it("lets more days be added", () => {
      sel.weekday("Fri").click();
      sel.weekday("Fri").should("have.class", "border-primary");
      sel.weekday("Wed").should("have.class", "border-primary");
    });

    it("lets a day be taken off again", () => {
      sel.weekday("Wed").click();
      sel.weekday("Wed").should("have.class", "border-gray-300");
    });

    it("offers a colour, defaulting to blue", () => {
      sel.colourTrigger().find("span").should("have.attr", "style").and("contain", "rgb(59, 130, 246)");
    });

    it("opens a palette of twelve colours", () => {
      sel.colourTrigger().click();
      cy.get('div[class*="grid-cols-6"]').find("div[style]").should("have.length", 12);
    });

    it("takes the colour that was picked", () => {
      sel.colourTrigger().click();
      cy.get('div[class*="grid-cols-6"]').find("div[style]").eq(5).click();
      sel.colourTrigger().find("span").should("have.attr", "style").and("contain", "rgb(56, 142, 60)");
    });

    it("offers a notes field", () => {
      sel.notes().should("have.attr", "placeholder", "Leave a note for the shift");
    });

    it("does not offer Select Team member when adding", () => {
      // That field is edit-only; on add, the member is the row that was clicked.
      sel.teamMember().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Add shift — saving
  // ──────────────────────────────────────────────────────────────────────────

  describe("Add shift — saving", () => {
    beforeEach(() => {
      stubCreate();
      visitBoard();
      openAddShift();
    });

    const fill = (start = "09:00:00", end = "17:00:00") => {
      sel.startTime().select(start);
      sel.endTime().select(end);
    };

    it("creates the shift for the member whose cell was clicked", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].user_id).to.eq(PRIYA);
        expect(request.body[0].home_id).to.eq(TEST_HOME_ID);
      });
    });

    it("creates it as an available shift", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].shift_status).to.eq("available");
      });
    });

    it("puts it on the day the cell belongs to", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localDay(request.body[0].shift_start_time)).to.eq("2026-09-09");
      });
    });

    it("sends the times that were chosen", () => {
      fill("09:00:00", "17:00:00");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localTime(request.body[0].shift_start_time)).to.eq("9:00 AM");
        expect(localTime(request.body[0].shift_end_time)).to.eq("5:00 PM");
      });
    });

    it("keeps an afternoon shift in the afternoon", () => {
      // A PM start must not be sent as its AM twin.
      fill("13:30:00", "18:45:00");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localTime(request.body[0].shift_start_time)).to.eq("1:30 PM");
        expect(localTime(request.body[0].shift_end_time)).to.eq("6:45 PM");
      });
    });

    it("rolls an overnight shift's end into the next day", () => {
      fill("22:00:00", "06:00:00");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localDay(request.body[0].shift_start_time)).to.eq("2026-09-09");
        expect(localDay(request.body[0].shift_end_time)).to.eq("2026-09-10");
        expect(localTime(request.body[0].shift_end_time)).to.eq("6:00 AM");
      });
    });

    it("rolls a shift whose end equals its start into the next day", () => {
      fill("09:00:00", "09:00:00");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localDay(request.body[0].shift_end_time)).to.eq("2026-09-10");
      });
    });

    it("sends the chosen colour", () => {
      fill();
      sel.colourTrigger().click();
      cy.get('div[class*="grid-cols-6"]').find("div[style]").eq(0).click();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].shift_color).to.eq("#D93025");
      });
    });

    it("defaults the colour to blue when none is picked", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].shift_color).to.eq("#3b82f6");
      });
    });

    it("sends the note", () => {
      fill();
      sel.notes().type("Cover the morning round");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].notes).to.eq("Cover the morning round");
      });
    });

    it("sends an empty note when none is written", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body[0].notes).to.eq("");
      });
    });

    it("creates one shift per weekday selected", () => {
      fill();
      sel.weekday("Fri").click();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(2);
        const days = request.body.map((s: any) => localDay(s.shift_start_time));
        expect(days).to.have.members(["2026-09-09", "2026-09-11"]);
      });
    });

    it("spreads a whole week when every day is selected", () => {
      fill();
      ["Mon", "Tue", "Thu", "Fri", "Sat", "Sun"].forEach((d) => sel.weekday(d).click());
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(7);
      });
    });

    it("counts a weekday before the clicked day as the following week", () => {
      // `getDateForWeekday` adds 7 when the target is earlier in the week, so
      // Mon selected from a Wednesday cell means the NEXT Monday.
      fill();
      sel.weekday("Wed").click();
      sel.weekday("Mon").click();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(1);
        expect(localDay(request.body[0].shift_start_time)).to.eq("2026-09-14");
      });
    });

    it("confirms the save", () => {
      fill();
      sel.save().click();
      cy.wait("@createShift");
      cy.assertPopover("Shift(s) created successfully!");
    });

    it("refuses to save with no times chosen", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("blocked");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("refuses to save with only a start time", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("blocked");
      sel.startTime().select("09:00:00");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("refuses to save with only an end time", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("blocked");
      sel.endTime().select("17:00:00");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("reports a rejected save", () => {
      cy.intercept("POST", "**/v1/hcm/shift", {
        statusCode: 500,
        body: { error: "Overlapping shift" },
      }).as("createShift");
      fill();
      sel.save().click();
      cy.wait("@createShift");
      cy.assertPopover("Overlapping shift");
    });
  });

  describe("Add shift — the shift on the calendar", () => {
    it("shows the saved shift in the member's cell", () => {
      const saved = buildShift({ shift_color: "#388E3C", notes: "Round" });
      visitBoard({ shifts: [saved] });

      sel.shiftCard().should("have.length", 1);
      sel.shiftCard().should("contain.text", cardTime(saved.shift_start_time));
      sel.shiftCard().should("contain.text", cardTime(saved.shift_end_time));
    });

    it("draws it in the colour it was given", () => {
      visitBoard({ shifts: [buildShift({ shift_color: "#388E3C" })] });
      sel.shiftCard()
        .should("have.attr", "style")
        .and("contain", "rgb(56, 142, 60)");
    });

    it("puts it against the right member", () => {
      visitBoard({ shifts: [buildShift({ user_id: ALBERT, user_name: "Albert Einstein" })] });
      sel.memberRow("Albert Einstein").find('.shift-card[class*="border-2"]').should("have.length", 1);
      sel.memberRow("Priya Patel").find('.shift-card[class*="border-2"]').should("have.length", 0);
    });

    it("labels an ordinary shift Care Team", () => {
      visitBoard({ shifts: [buildShift()] });
      sel.shiftCard().should("contain.text", "Care Team");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Edit shift
  // ──────────────────────────────────────────────────────────────────────────

  describe("Edit shift", () => {
    beforeEach(() => {
      visitBoard({ shifts: [buildShift({ notes: "Morning round" })] });
      openEditShift();
    });

    it("opens as an edit, not an add", () => {
      sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
    });

    it("prefills the scheduled times", () => {
      sel.startTime().should("have.value", "09:30:00");
      sel.endTime().should("have.value", "14:00:00");
    });

    it("prefills the note", () => {
      sel.notes().should("have.value", "Morning round");
    });

    it("offers Select Team member", () => {
      sel.teamMember().should("exist");
    });

    it("lists the members who have a wage", () => {
      sel.teamMember().find("option").should("contain.text", "Priya Patel");
      sel.teamMember().find("option").should("contain.text", "Albert Einstein");
    });

    it("leaves out a member with no wage", () => {
      visitBoard({
        members: [PRIYA_ROW, NO_WAGE_ROW],
        shifts: [buildShift()],
      });
      openEditShift();
      sel.teamMember().should("not.contain.text", "Wageless Wanda");
    });

    it("locks Apply to, so the day cannot be changed", () => {
      sel.applyTo().should("have.class", "pointer-events-none");
    });

    it("says why Apply to is locked", () => {
      sel.applyTo().should(
        "have.attr",
        "title",
        "Apply to is not available when editing a shift"
      );
    });

    it("offers a delete and a copy action", () => {
      // Both icons sit in one absolutely-positioned strip beside the title.
      cy.get('div[class*="absolute"][class*="top-6"]')
        .find("svg")
        .should("have.length.at.least", 2);
    });

    it("updates the shift rather than creating one", () => {
      stubUpdate();
      cy.intercept("POST", "**/v1/hcm/shift").as("createShift");
      sel.startTime().select("10:00:00");
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.id).to.eq(5001);
      });
      cy.assertNoRequest("@createShift");
    });

    it("sends the changed time", () => {
      stubUpdate();
      sel.startTime().select("10:00:00");
      sel.endTime().select("18:30:00");
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(localTime(request.body.shift_start_time)).to.eq("10:00 AM");
        expect(localTime(request.body.shift_end_time)).to.eq("6:30 PM");
      });
    });

    it("keeps the shift on its original day", () => {
      stubUpdate();
      sel.startTime().select("10:00:00");
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-09");
      });
    });

    it("moves the shift to another team member", () => {
      stubUpdate();
      sel.teamMember().select(ALBERT);
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.user_id).to.eq(ALBERT);
      });
    });

    it("sends a changed note", () => {
      stubUpdate();
      sel.notes().clear().type("Evening round");
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.notes).to.eq("Evening round");
      });
    });

    it("sends a changed colour", () => {
      stubUpdate();
      sel.colourTrigger().click();
      cy.get('div[class*="grid-cols-6"]').find("div[style]").eq(1).click();
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.shift_color).to.eq("#F57C00");
      });
    });

    it("rolls an overnight edit's end into the next day", () => {
      stubUpdate();
      sel.startTime().select("22:00:00");
      sel.endTime().select("06:00:00");
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(localDay(request.body.shift_end_time)).to.eq("2026-09-10");
      });
    });

    it("confirms the update", () => {
      stubUpdate();
      sel.startTime().select("10:00:00");
      sel.save().click();
      cy.wait("@updateShift");
      cy.assertPopover("Shift updated successfully!");
    });

    it("reports a rejected update", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", {
        statusCode: 500,
        body: { error: "Overlapping shift" },
      }).as("updateShift");
      sel.startTime().select("10:00:00");
      sel.save().click();

      cy.wait("@updateShift");
      cy.assertPopover("Overlapping shift");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Time off — the form
  // ──────────────────────────────────────────────────────────────────────────

  describe("Time off — the form", () => {
    beforeEach(() => {
      visitBoard();
      openAddShift();
      sel.tab("Time off").click();
    });

    it("offers a reason", () => {
      sel.reason().should("exist");
    });

    it("offers every reason", () => {
      sel.reason()
        .find("option")
        .then(($options) => {
          const labels = [...$options]
            .map((o) => o.textContent)
            .filter((t) => t && t !== "Select");
          expect(labels).to.deep.eq(TIME_OFF_REASONS);
        });
    });

    // Written out one by one rather than looped. A `forEach` with a template
    // literal reads better here, but scripts/build-test-sheets.py parses the
    // source, so a loop lands in the sheet as a single row named
    // "accepts ${reason} as a reason" — one row where there are eight tests.
    // The sheet is a deliverable; it should not disagree with the run.

    it("accepts Vacation(Unpaid) as a reason", () => {
      sel.reason().select("Vacation(Unpaid)");
      sel.reason().should("have.value", "Vacation(Unpaid)");
    });

    it("accepts Vacation(Paid) as a reason", () => {
      sel.reason().select("Vacation(Paid)");
      sel.reason().should("have.value", "Vacation(Paid)");
    });

    it("accepts Hoilday as a reason", () => {
      // Misspelled in constants.ts:447 — see known-defects.cy.ts.
      sel.reason().select("Hoilday");
      sel.reason().should("have.value", "Hoilday");
    });

    it("accepts Jury Duty as a reason", () => {
      sel.reason().select("Jury Duty");
      sel.reason().should("have.value", "Jury Duty");
    });

    it("accepts Sick Leave as a reason", () => {
      sel.reason().select("Sick Leave");
      sel.reason().should("have.value", "Sick Leave");
    });

    it("accepts Personal Medical Emergency as a reason", () => {
      sel.reason().select("Personal Medical Emergency");
      sel.reason().should("have.value", "Personal Medical Emergency");
    });

    it("accepts Family Medical Emergency as a reason", () => {
      sel.reason().select("Family Medical Emergency");
      sel.reason().should("have.value", "Family Medical Emergency");
    });

    it("accepts Other as a reason", () => {
      sel.reason().select("Other");
      sel.reason().should("have.value", "Other");
    });

    it("offers a note", () => {
      sel.notes().should("have.attr", "placeholder", "Leave a note");
    });

    it("offers a Multiple Days toggle, off by default", () => {
      cy.contains("Multiple Days").should("be.visible");
      sel.multipleDays().should("exist");
      cy.get('input[name="shift_date"]').should("exist");
      cy.get('input[name="multi_day_start"]').should("not.exist");
    });

    it("asks for one date and two times while the toggle is off", () => {
      cy.get('input[name="shift_date"]').should("exist");
      cy.get('input[name="shift_start_time"]').should("exist");
      cy.get('input[name="shift_end_time"]').should("exist");
    });

    it("prefills the date from the cell that was clicked", () => {
      cy.get('input[name="shift_date"]').should("have.value", "2026-09-09");
    });

    it("asks for a start and end date once the toggle is on", () => {
      sel.multipleDays().click();
      cy.get('input[name="multi_day_start"]').should("exist");
      cy.get('input[name="multi_day_end"]').should("exist");
    });

    it("withdraws the single-day fields once the toggle is on", () => {
      sel.multipleDays().click();
      cy.get('input[name="shift_date"]').should("not.exist");
      cy.get('input[name="shift_start_time"]').should("not.exist");
    });

    it("brings the single-day fields back when the toggle is turned off", () => {
      sel.multipleDays().click();
      cy.get('input[name="multi_day_start"]').should("exist");
      sel.multipleDays().click();
      cy.get('input[name="shift_date"]').should("exist");
      cy.get('input[name="multi_day_start"]').should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Time off — saving
  // ──────────────────────────────────────────────────────────────────────────

  describe("Time off — saving one day", () => {
    beforeEach(() => {
      stubCreate();
      visitBoard();
      openAddShift();
      sel.tab("Time off").click();
    });

    const fillOneDay = (reason = "Sick Leave") => {
      sel.reason().select(reason);
      cy.get('input[name="shift_start_time"]').type("09:00");
      cy.get('input[name="shift_end_time"]').type("17:00");
    };

    it("saves it as time off, not an available shift", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body.shift_status).to.eq("timeoff");
      });
    });

    it("sends a single object, not a bulk array", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.not.be.an("array");
      });
    });

    it("sends the reason", () => {
      fillOneDay("Jury Duty");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body.unavailability_reason).to.eq("Jury Duty");
      });
    });

    it("sends the note", () => {
      fillOneDay();
      sel.notes().type("Back on Monday");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body.notes).to.eq("Back on Monday");
      });
    });

    it("leaves it awaiting a decision", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body.is_unavailability_approved).to.eq(null);
      });
    });

    it("sends the day and the times chosen", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-09");
        expect(localTime(request.body.shift_start_time)).to.eq("9:00 AM");
        expect(localTime(request.body.shift_end_time)).to.eq("5:00 PM");
      });
    });

    it("books it against the right member", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body.user_id).to.eq(PRIYA);
      });
    });

    it("confirms the save", () => {
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift");
      cy.assertPopover("Time off created successfully!");
    });

    it("refuses to save with no reason", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("blocked");
      cy.get('input[name="shift_start_time"]').type("09:00");
      cy.get('input[name="shift_end_time"]').type("17:00");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("reports a rejected save", () => {
      cy.intercept("POST", "**/v1/hcm/shift", {
        statusCode: 500,
        body: { error: "Time off clashes with a shift" },
      }).as("createShift");
      fillOneDay();
      sel.save().click();
      cy.wait("@createShift");
      cy.assertPopover("Time off clashes with a shift");
    });
  });

  describe("Time off — saving several days", () => {
    beforeEach(() => {
      stubCreate();
      visitBoard();
      openAddShift();
      sel.tab("Time off").click();
      sel.multipleDays().click();
    });

    const fillRange = (start = "2026-09-09", end = "2026-09-11") => {
      sel.reason().select("Vacation(Paid)");
      cy.get('input[name="multi_day_start"]').type(start);
      cy.get('input[name="multi_day_end"]').type(end);
    };

    it("sends one entry per day in the range", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.be.an("array");
        expect(request.body).to.have.length(3);
      });
    });

    it("covers every day from the start to the end inclusive", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        const days = request.body.map((s: any) => localDay(s.shift_start_time));
        expect(days).to.deep.eq(["2026-09-09", "2026-09-10", "2026-09-11"]);
      });
    });

    it("books each day from midnight to a minute to midnight", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(localTime(request.body[0].shift_start_time)).to.eq("12:00 AM");
        expect(localTime(request.body[0].shift_end_time)).to.eq("11:59 PM");
      });
    });

    it("carries the reason onto every day", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        request.body.forEach((s: any) =>
          expect(s.unavailability_reason).to.eq("Vacation(Paid)")
        );
      });
    });

    it("leaves every day awaiting a decision", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        request.body.forEach((s: any) =>
          expect(s.is_unavailability_approved).to.eq(null)
        );
      });
    });

    it("[as-built] will not end the range on the day it starts", () => {
      // End Date carries `min={nextStartDate}`, which is the day after the
      // CELL's date — not after whatever Start Date was picked. So a one-day
      // range is refused, and moving Start Date later does not move the floor.
      cy.intercept("POST", "**/v1/hcm/shift").as("blocked");
      cy.get('input[name="multi_day_end"]').should("have.attr", "min", "2026-09-10");

      fillRange("2026-09-09", "2026-09-09");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("accepts the shortest range it allows", () => {
      fillRange("2026-09-09", "2026-09-10");
      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(2);
      });
    });

    it("confirms the save", () => {
      fillRange();
      sel.save().click();
      cy.wait("@createShift");
      cy.assertPopover("Time off created!");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Time off on the calendar
  // ──────────────────────────────────────────────────────────────────────────

  describe("Time off on the calendar", () => {
    it("labels it as time off", () => {
      visitBoard({ shifts: [buildTimeOff()] });
      sel.shiftCard().should("contain.text", "⊘ TimeOff");
    });

    it("marks an undecided request with a grey dot", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: null })] });
      sel.shiftCard()
        .find("div[style]")
        .should("have.attr", "style")
        .and("contain", "rgb(156, 163, 175)");
    });

    it("marks an approved request with a green dot", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: true })] });
      sel.shiftCard()
        .find("div[style]")
        .should("have.attr", "style")
        .and("contain", "rgb(34, 197, 94)");
    });

    it("marks a rejected request with a red dot", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: false })] });
      sel.shiftCard()
        .find("div[style]")
        .should("have.attr", "style")
        .and("contain", "rgb(239, 68, 68)");
    });

    it("says Pending on hover while undecided", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: null })] });
      sel.shiftCard().should("have.attr", "title", "Pending");
    });

    it("says Approved on hover once approved", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: true })] });
      sel.shiftCard().should("have.attr", "title", "Approved");
    });

    it("says Rejected on hover once rejected", () => {
      visitBoard({ shifts: [buildTimeOff({ is_unavailability_approved: false })] });
      sel.shiftCard().should("have.attr", "title", "Rejected");
    });

    it("shows the hours it covers", () => {
      const off = buildTimeOff();
      visitBoard({ shifts: [off] });
      sel.shiftCard().should("contain.text", cardTime(off.shift_start_time));
      sel.shiftCard().should("contain.text", cardTime(off.shift_end_time));
    });

    it("gives time off a grey border rather than a shift colour", () => {
      visitBoard({ shifts: [buildTimeOff({ shift_color: "#D93025" })] });
      sel.shiftCard().should("have.attr", "style").and("contain", "rgb(128, 128, 128)");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. The two guards
  // ──────────────────────────────────────────────────────────────────────────

  describe("A member with no wage", () => {
    beforeEach(() => visitBoard({ members: [NO_WAGE_ROW, PRIYA_ROW] }));

    it("refuses to open the shift form", () => {
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.contains("Cannot create shift for this team member").should("be.visible");
    });

    it("explains what is missing", () => {
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.contains("There is no wage rate set. So please add a wage on the Team page")
        .should("be.visible");
    });

    it("does not open the Add Schedule modal", () => {
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.contains("Cannot create shift for this team member").should("be.visible");
      cy.contains("Add shift").should("not.exist");
    });

    it("sends nothing", () => {
      cy.intercept("POST", "**/v1/hcm/shift").as("createShift");
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.assertNoRequest("@createShift");
    });

    it("offers a way to the Team page", () => {
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.contains("button", "Navigate to Team").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm/team");
    });

    it("can be dismissed", () => {
      sel.cell("Wageless Wanda", 2).click({ force: true });
      cy.contains("button", "Cancel").click();
      cy.contains("Cannot create shift for this team member").should("not.exist");
    });

    it("leaves a member who does have a wage alone", () => {
      sel.cell("Priya Patel", 2).click({ force: true });
      cy.contains("Cannot create shift for this team member").should("not.exist");
      sel.modalTitle(WED_TITLE).should("be.visible");
    });
  });

  /**
   * A clocked shift used to be frozen for everyone. The stg merge added
   * `&& !isPCHO` to both the cursor and the blocked-attempt handler, so the
   * lock now applies to every role EXCEPT the home owner — a PCHO can correct
   * a timesheet after the fact, and nobody else can.
   *
   * HomeAdmin is the control below: it reaches the board and holds
   * HCM_SCHEDULING EDIT, so the only thing separating it from a PCHO here is
   * the role check itself.
   */
  describe("A shift that has already been clocked — as a PCHO", () => {
    const CLOCKED = buildShift({
      clock_in_timestamp: at(WED, 9, 32),
      clock_out_timestamp: at(WED, 14, 1),
    });

    it("opens the edit form", () => {
      visitBoard({ shifts: [CLOCKED] });
      sel.shiftCard().first().click({ force: true });
      sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
    });

    it("raises no warning", () => {
      visitBoard({ shifts: [CLOCKED] });
      sel.shiftCard().first().trigger("mousedown");
      cy.contains("Care Team has already logged time").should("not.exist");
    });

    it("marks it draggable", () => {
      // The cursor lives on the draggable wrapper, not the card inside it.
      visitBoard({ shifts: [CLOCKED] });
      sel.shiftWrapper().first().should("have.css", "cursor", "grab");
    });

    it("leaves an unclocked shift editable too", () => {
      visitBoard({ shifts: [buildShift()] });
      sel.shiftCard().first().click({ force: true });
      sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
    });
  });

  describe("A shift that has already been clocked — as a HomeAdmin", { tags: [Tags.HOMEADMIN] }, () => {
    const CLOCKED = buildShift({
      clock_in_timestamp: at(WED, 9, 32),
      clock_out_timestamp: at(WED, 14, 1),
    });

    const asHomeAdmin = (shifts: any[]) =>
      visitBoard({ shifts, role: "HomeAdmin" });

    it("refuses to be edited", () => {
      asHomeAdmin([CLOCKED]);
      sel.shiftCard().first().trigger("mousedown");
      cy.assertPopover(
        "Care Team has already logged time for this shift and cannot be edited or moved."
      );
    });

    it("does not open the edit form", () => {
      asHomeAdmin([CLOCKED]);
      sel.shiftCard().first().trigger("mousedown");
      cy.contains("Care Team has already logged time").should("be.visible");
      cy.contains(WED_EDIT_TITLE).should("not.exist");
    });

    it("sends nothing", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      asHomeAdmin([CLOCKED]);
      sel.shiftCard().first().trigger("mousedown");
      cy.assertNoRequest("@updateShift");
    });

    it("marks it as not draggable", () => {
      asHomeAdmin([CLOCKED]);
      sel.shiftWrapper().first().should("have.css", "cursor", "not-allowed");
    });

    it("leaves an unclocked shift editable", () => {
      asHomeAdmin([buildShift()]);
      sel.shiftCard().first().click({ force: true });
      sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
    });

    it("is only the clock that stops it, not the role", () => {
      // The control for the control: a HomeAdmin can drag an unclocked shift,
      // so the lock above is about the timestamps and nothing else.
      asHomeAdmin([buildShift()]);
      sel.shiftWrapper().first().should("have.css", "cursor", "grab");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Dragging a shift to another team member
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * `onDragEnd` (week-view.tsx:349) rebuilds the shift for wherever it landed:
   * the target member becomes `user_id`, the target column becomes the date,
   * the time of day and the duration are preserved, and the pay rate is taken
   * from the NEW member's roaster rather than carried over. The grid is updated
   * optimistically and rolled back if the PUT fails.
   *
   * Only an `available` shift with no clock entry is draggable at all.
   */
  describe("Dragging a shift", () => {
    /** Albert is paid more than Priya, so a move should change the rate. */
    const RICHER = buildMember(ALBERT, "Albert Einstein", {
      roaster: [{ pay_rate: 22, pay_frequency: "Hourly" }],
    });

    it("hands the shift to the member it was dropped on", () => {
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.id).to.eq(5001);
        expect(request.body.user_id).to.eq(ALBERT);
      });
    });

    it("keeps the time of day", () => {
      stubUpdate();
      const shift = buildShift();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [shift] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        expect(localTime(request.body.shift_start_time)).to.eq(
          localTime(shift.shift_start_time)
        );
      });
    });

    it("keeps the length of the shift", () => {
      stubUpdate();
      const shift = buildShift();
      const originalMs =
        new Date(shift.shift_end_time).getTime() -
        new Date(shift.shift_start_time).getTime();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [shift] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        const movedMs =
          new Date(request.body.shift_end_time).getTime() -
          new Date(request.body.shift_start_time).getTime();
        expect(movedMs).to.eq(originalMs);
      });
    });

    it("keeps the shift on the same day when moved straight across", () => {
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-09");
      });
    });

    it("moves it to the day it was dropped under", () => {
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 4); // Friday

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.user_id).to.eq(ALBERT);
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-11");
      });
    });

    it("moves it within the same member to another day", () => {
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Priya Patel", 4);

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.user_id).to.eq(PRIYA);
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-11");
      });
    });

    it("takes on the new member's wage", () => {
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.pay_rate).to.eq(22);
      });
    });

    it("carries the colour, notes and status across", () => {
      stubUpdate();
      visitBoard({
        members: [PRIYA_ROW, RICHER],
        shifts: [buildShift({ shift_color: "#388E3C", notes: "Morning round" })],
      });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.shift_color).to.eq("#388E3C");
        expect(request.body.notes).to.eq("Morning round");
        expect(request.body.shift_status).to.eq("available");
      });
    });

    it("shows the shift against its new member straight away", () => {
      // The grid is updated optimistically, before the PUT comes back.
      stubUpdate();
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift");
      sel.memberRow("Albert Einstein").find('.shift-card[class*="border-2"]').should("have.length", 1);
      sel.memberRow("Priya Patel").find('.shift-card[class*="border-2"]').should("have.length", 0);
    });

    it("sends nothing when dropped back where it started", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Priya Patel", 2);
      cy.assertNoRequest("@updateShift");
    });

    it("refuses to drop onto a member with no wage", () => {
      visitBoard({
        members: [PRIYA_ROW, NO_WAGE_ROW],
        shifts: [buildShift()],
      });
      dragShiftTo("Wageless Wanda", 2);
      cy.contains("Cannot create shift for this team member").should("be.visible");
    });

    it("sends nothing when dropped onto a member with no wage", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitBoard({
        members: [PRIYA_ROW, NO_WAGE_ROW],
        shifts: [buildShift()],
      });
      dragShiftTo("Wageless Wanda", 2);
      cy.assertNoRequest("@updateShift");
    });

    it("warns when the move clashes with an existing shift", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", {
        statusCode: 500,
        body: { error: "clash" },
      }).as("updateShift");
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift");
      cy.assertPopover("Shift overlaps with existing shifts");
    });

    it("puts the shift back when the move is rejected", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*", {
        statusCode: 500,
        body: { error: "clash" },
      }).as("updateShift");
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildShift()] });
      dragShiftTo("Albert Einstein", 2);

      cy.wait("@updateShift");
      cy.dismissPopover();
      sel.memberRow("Priya Patel").find('.shift-card[class*="border-2"]').should("have.length", 1);
      sel.memberRow("Albert Einstein").find('.shift-card[class*="border-2"]').should("have.length", 0);
    });

    it("will not drag time off", () => {
      // `useDraggable` is disabled for anything that is not an available shift.
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitBoard({ members: [PRIYA_ROW, RICHER], shifts: [buildTimeOff()] });
      dragShiftTo("Albert Einstein", 2);
      cy.assertNoRequest("@updateShift");
    });

    it("will not drag a shift that has been clocked", () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitBoard({
        members: [PRIYA_ROW, RICHER],
        shifts: [
          buildShift({
            clock_in_timestamp: at(WED, 9, 32),
            clock_out_timestamp: at(WED, 14, 1),
          }),
        ],
      });
      dragShiftTo("Albert Einstein", 2);
      cy.assertNoRequest("@updateShift");
    });

    it("will not let a role without HCM_SCHEDULING drag anything", { tags: [Tags.SENIOR] }, () => {
      cy.intercept("PUT", "**/v1/hcm/shift/*").as("updateShift");
      visitBoard({
        members: [PRIYA_ROW, RICHER],
        shifts: [buildShift()],
        role: "Senior",
      });
      dragShiftTo("Albert Einstein", 2);
      cy.assertNoRequest("@updateShift");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a three-day shift pattern is created in one save", () => {
      stubCreate();
      visitBoard();
      openAddShift();

      sel.startTime().select("07:00:00");
      sel.endTime().select("15:00:00");
      sel.weekday("Fri").click();
      sel.weekday("Sun").click();
      sel.colourTrigger().click();
      cy.get('div[class*="grid-cols-6"]').find("div[style]").eq(5).click();
      sel.notes().type("Weekend cover");

      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(3);
        expect(request.body.map((s: any) => localDay(s.shift_start_time))).to.have.members([
          "2026-09-09",
          "2026-09-11",
          "2026-09-13",
        ]);
        request.body.forEach((s: any) => {
          expect(localTime(s.shift_start_time)).to.eq("7:00 AM");
          expect(s.shift_color).to.eq("#388E3C");
          expect(s.notes).to.eq("Weekend cover");
        });
      });
      cy.assertPopover("Shift(s) created successfully!");
    });

    it("E2E — a shift is retimed and handed to another member", () => {
      stubUpdate();
      visitBoard({ shifts: [buildShift()] });
      openEditShift();

      sel.startTime().select("12:00:00");
      sel.endTime().select("20:00:00");
      sel.teamMember().select(ALBERT);
      sel.save().click();

      cy.wait("@updateShift").then(({ request }) => {
        expect(request.body.id).to.eq(5001);
        expect(request.body.user_id).to.eq(ALBERT);
        expect(localTime(request.body.shift_start_time)).to.eq("12:00 PM");
        expect(localTime(request.body.shift_end_time)).to.eq("8:00 PM");
        expect(localDay(request.body.shift_start_time)).to.eq("2026-09-09");
      });
      cy.assertPopover("Shift updated successfully!");
    });

    it("E2E — a week of leave is booked and comes back pending", () => {
      stubCreate();
      visitBoard();
      openAddShift();

      sel.tab("Time off").click();
      sel.reason().select("Vacation(Paid)");
      sel.notes().type("Annual leave");
      sel.multipleDays().click();
      cy.get('input[name="multi_day_start"]').type("2026-09-09");
      cy.get('input[name="multi_day_end"]').type("2026-09-13");

      sel.save().click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body).to.have.length(5);
        request.body.forEach((s: any) => {
          expect(s.shift_status).to.eq("timeoff");
          expect(s.is_unavailability_approved).to.eq(null);
        });
      });
      cy.assertPopover("Time off created!");
      cy.dismissPopover();

      // The board refetches; the API returns them awaiting a decision.
      stubShifts([buildTimeOff()]);
      cy.reload();
      sel.shiftCard().should("have.attr", "title", "Pending");
    });
  });
});
