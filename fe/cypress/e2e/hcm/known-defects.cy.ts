/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Staff Management (HCM) — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE, like its CRM and clinical
 * counterparts at cypress/e2e/crm/known-defects.cy.ts and
 * cypress/e2e/clinical/known-defects.cy.ts. Each asserts the behaviour the UI
 * promises against code that does something else.
 *
 * A test here turning green means the bug is fixed: move it into the spec that
 * owns the area rather than deleting it. Never weaken an assertion to match the
 * code — if the behaviour turns out to be intended, delete the test and record
 * the decision in the owning spec.
 *
 * Run it on its own; exclude it from any "all HCM specs must pass" job:
 *
 *   npx cypress run --spec cypress/e2e/hcm/known-defects.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SCHEDULING_PATH = "/hcm/scheduling";

/** Tuesday 8 September 2026, 10:00 local — the same instant the HCM specs use. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const PRIYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WED = new Date(2026, 8, 9);

const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

const PRIYA_ROW = {
  userId: PRIYA,
  name: "Priya Patel",
  firstName: "Priya",
  lastName: "Patel",
  email: "priya.patel@assistly.com",
  mobile: "5551112222",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
};

const stubBoard = (shifts: any[] = []) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? [PRIYA_ROW] : [] },
    });
  }).as("getStaff");
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SCHEDULING_PATH);
  cy.contains("Tue 08").should("be.visible");
};

/** Open the Add Schedule modal on Priya's Wednesday cell. */
const openAddShift = () => {
  cy.get(`div[title="Priya Patel"]`)
    .closest(".contents")
    .find('div[class*="min-h-[60px]"]')
    .eq(2)
    .click({ force: true });
  cy.contains("Add Schedule - September 9, 2026").should("be.visible");
};

describe("Staff Management (HCM) — known defects", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  // ═════════════════════════════════════════════════════════════════════════
  // 1. The Confirm Copy Week banner names the wrong week east of Greenwich
  //
  //   week-view.tsx:649
  //   format(new Date(addDays(copyFromWeek, 1)), "MMM d, yyyy")
  //
  // `copyFromWeek` is the option's own value — a `yyyy-MM-dd` string that is
  // ALREADY the Monday the user picked. The banner adds a day to it before
  // formatting, and the string parses as UTC midnight while `format` renders in
  // local time. Two errors that cancel out west of Greenwich and compound east
  // of it:
  //
  //   UTC-5   2026-08-31T00:00Z +1d → 2026-09-01T00:00Z → local Aug 31  ✓
  //   UTC+0   2026-08-31T00:00Z +1d → 2026-09-01T00:00Z → local Sep 1   ✗
  //   UTC+5:30                                          → local Sep 1   ✗
  //
  // So a scheduler in London or Bengaluru is asked to confirm copying "the
  // Sep 1, 2026 week" when they picked the week of Aug 31 — and Sep 1 is a
  // Tuesday, which is not a week start at all under `weekStartsOn: 1`.
  //
  // The fix is to format the string as a local date instead of adding a day to
  // paper over the UTC parse: split it on "-" and build the Date from parts, the
  // way `getShiftDateTime` and `AddShift.onSubmit` already do elsewhere.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Confirm Copy Week banner", () => {
    const SOURCE_SHIFT = {
      id: 7001,
      user_id: PRIYA,
      home_id: TEST_HOME_ID,
      shift_status: "available",
      shift_color: "#3b82f6",
      notes: "",
      pay_rate: 15,
      shift_start_time: at(new Date(2026, 8, 2), 9, 0),
      shift_end_time: at(new Date(2026, 8, 2), 17, 0),
      clock_in_timestamp: null,
      clock_out_timestamp: null,
    };

    const openConfirm = () => {
      stubBoard();
      cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
        const isCopyLookup = new URL(req.url).searchParams.has("shift_start_time");
        req.reply({
          statusCode: 200,
          body: { shifts: isCopyLookup ? [SOURCE_SHIFT] : [] },
        });
      }).as("getShifts");
      cy.get('select[name="copyWeek"]').select("2026-08-31");
      cy.contains("Confirm Copy Week").should("be.visible");
    };

    it("[defect] names the week that was picked, in every timezone", () => {
      openConfirm();

      // The invariant: the banner must name the Monday carried by the option
      // that was chosen — "Aug 31 – Sep 6, 2026" → "Aug 31, 2026".
      cy.contains("Aug 31, 2026").should("be.visible");

      // …and it must do so for a reason other than the viewer's UTC offset.
      // West of Greenwich the +1 cancels the UTC parse and the banner reads
      // correctly by accident, so the assertion above cannot catch the bug
      // here. Fail loudly rather than pass silently — the same treatment the
      // clinical UTC defects get.
      cy.then(() => {
        const westOfGreenwich = new Date(2026, 8, 1).getTimezoneOffset() > 0;
        expect(
          westOfGreenwich,
          "this suite is running west of Greenwich, where the banner's stray " +
            "+1 day cancels its UTC parse and the wrong date is masked. Re-run " +
            "with TZ=Europe/London (or any zone at or east of UTC) to watch " +
            "the assertion above fail with 'Sep 1, 2026'."
        ).to.eq(false);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. A backwards time-off range is accepted and sends an empty request
  //
  //   time-off.tsx:302  min={nextStartDate}
  //   time-off.tsx:72   while (current <= endDate) { ... }
  //   user-shifts.model.ts:85  superRefine — presence only, never ordering
  //
  // End Date's `min` is computed from the CELL's date plus one, not from
  // whichever Start Date the user picks, and it is never recomputed. So with a
  // cell on 9 Sep the floor is 10 Sep forever: choosing Start 20 Sep and End
  // 15 Sep clears `min`, clears the schema — which only checks that both dates
  // are present — and reaches `handleSubmit`.
  //
  // There the `while (current <= endDate)` loop never runs, `bulkpayload` stays
  // empty, and the code POSTs `[]`. The user is told "Time off created!" and
  // nothing was booked.
  //
  // Two things to fix, and the second is the one that matters: recompute the
  // End Date floor from the chosen Start Date, and reject `end < start` in
  // `TimeOffSchema` so a bad range can never reach the network.
  // ═════════════════════════════════════════════════════════════════════════

  describe("A backwards time-off range", () => {
    const openBackwardsRange = () => {
      cy.intercept("POST", "**/v1/hcm/shift", { statusCode: 201, body: {} }).as(
        "createShift"
      );
      stubBoard();
      openAddShift();
      cy.contains("span", "Time off").click();
      cy.contains("span", "Multiple Days").parent().find("button").click();

      cy.get('select[name="unavailability_reason"]').select("Sick Leave");
      cy.get('input[name="multi_day_start"]').type("2026-09-20");
      cy.get('input[name="multi_day_end"]').type("2026-09-15");
    };

    it("[defect] floors the End Date at the Start Date that was chosen", () => {
      stubBoard();
      openAddShift();
      cy.contains("span", "Time off").click();
      cy.contains("span", "Multiple Days").parent().find("button").click();
      cy.get('input[name="multi_day_start"]').type("2026-09-20");

      // Picking a later start should move the earliest allowed end with it.
      cy.get('input[name="multi_day_end"]').should("have.attr", "min", "2026-09-21");
    });

    it("[defect] refuses a range that ends before it starts", () => {
      // Currently red because a POST IS sent — with an empty array as its body,
      // since `while (current <= endDate)` never runs.
      openBackwardsRange();
      cy.contains("button", /^(Save|Saving\.\.\.)$/).click();
      cy.assertNoRequest("@createShift");
    });

    it("[defect] sends at least one day when it does send something", () => {
      // The shape of the bug, stated so it survives a partial fix: if the range
      // is going to reach the network at all, it must not be empty.
      openBackwardsRange();
      cy.contains("button", /^(Save|Saving\.\.\.)$/).click();
      cy.wait("@createShift").then(({ request }) => {
        expect(request.body, "days booked").to.have.length.greaterThan(0);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. "Hoilday" is misspelled in the time-off reasons
  //
  //   constants.ts:447  { option: "Hoilday", value: "Hoilday" }
  //
  // Both halves are wrong, which is why this is worth a test rather than a
  // one-character commit: the LABEL is what every scheduler reads in the
  // dropdown, and the VALUE is what has been written to `unavailability_reason`
  // on every holiday booked so far. Correcting the label alone leaves the
  // stored data spelled "Hoilday"; correcting both needs a migration, or a
  // schema that accepts the old value while writing the new one.
  //
  // Any report that groups time off by reason splits holidays across two
  // spellings the moment this is fixed carelessly.
  // ═════════════════════════════════════════════════════════════════════════

  describe("The time-off reasons", () => {
    const openReasons = () => {
      stubBoard();
      openAddShift();
      cy.contains("span", "Time off").click();
      cy.get('select[name="unavailability_reason"]').should("exist");
    };

    it("[defect] spells Holiday correctly in the dropdown", () => {
      openReasons();
      cy.get('select[name="unavailability_reason"]')
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels, "the reason a scheduler reads").to.include("Holiday");
        });
    });

    it("[defect] stores Holiday correctly against the booking", () => {
      openReasons();
      cy.get('select[name="unavailability_reason"]')
        .find('option[value="Holiday"]')
        .should("exist");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 4. The pay-period date picker cannot be cancelled
  //
  //   date-picker.tsx:115  useEffect(... onChange(tempRange) ..., [tempRange])
  //   date-picker.tsx:846  Cancel is `onClick={() => setIsOpen(false)}`
  //   date-picker.tsx:332  applySelection — what Apply is supposed to do
  //
  // The picker is built as though Apply commits and Cancel discards, and the
  // footer says so. Neither is true. An effect fires `onChange` the instant
  // `tempRange` has both ends, so the page is re-queried on the SECOND DATE
  // CLICK, before any button is pressed:
  //
  //   click 1 Sep, click 5 Sep  → onChange fires, the table reloads
  //   press Cancel              → the popup closes, nothing is undone
  //
  // That leaves Apply as dead weight — `applySelection` calls `onChange` with a
  // range that has already been applied — and leaves Cancel actively
  // misleading: a scheduler who opens the picker, misclicks a second date and
  // presses Cancel has silently changed the pay period they are reviewing, and
  // the Export Excel filename with it.
  //
  // Cancel also never restores `tempRange` from `value`, so even the box keeps
  // the abandoned range. Both halves need fixing: drop the effect and let
  // `applySelection` be the only caller of `onChange`, and have Cancel do
  // `setTempRange(value)` before `setIsOpen(false)`.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Pay period review — cancelling the date picker", { tags: [Tags.PCG] }, () => {
    const AVLON = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";
    const SHIFT_DAY = new Date(2026, 8, 4);

    const at = (day: Date, hours: number, minutes = 0) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

    const AVLON_MEMBER = {
      userId: AVLON,
      name: "Avlon Regal",
      email: "avlon@assistly.com",
      role: "PCG",
      home: "Comfort Cove",
      homeId: TEST_HOME_ID,
      roaster: [{ pay_rate: 25, pay_frequency: "Hourly" }],
      isDeleted: false,
    };

    const SHIFT = {
      id: 9001,
      user_id: AVLON,
      user_name: "Avlon Regal",
      home_id: TEST_HOME_ID,
      shift_status: "available",
      pay_rate: "25",
      pay_frequency: "Hourly",
      shift_start_time: at(SHIFT_DAY, 9, 0),
      shift_end_time: at(SHIFT_DAY, 11, 0),
      clock_in_timestamp: at(SHIFT_DAY, 9, 0),
      clock_out_timestamp: at(SHIFT_DAY, 11, 0),
    };

    /** Open the picker and choose 1–5 September, pressing nothing after. */
    const pickWithoutApplying = () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [AVLON_MEMBER] },
      });
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: { user: AVLON_MEMBER },
      });
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [SHIFT] },
      }).as("getShifts");
      cy.clock(new Date(2026, 8, 8, 10, 0, 0).getTime(), ["Date"]);

      cy.visit("/hcm/timesheet");
      cy.contains("span", "Pay period review").click();
      cy.contains("Export Excel").should("be.visible");

      cy.get('div[aria-label="Open date picker"]').click();
      cy.get('select[aria-label="Select month"]').eq(0).select("September");
      cy.get('div[aria-label="Date range calendar"]')
        .find("div.p-3")
        .eq(0)
        .contains("button", /^1$/)
        .click();
      cy.get('div[aria-label="Date range calendar"]')
        .find("div.p-3")
        .eq(0)
        .contains("button", /^5$/)
        .click();
    };

    /** The same, then Cancel. */
    const cancelAfterPicking = () => {
      pickWithoutApplying();
      cy.contains("button", "Cancel").click();
    };

    it("[defect] puts the applied range back in the box", () => {
      cancelAfterPicking();
      cy.get('input[aria-label^="Select"], input[aria-label^="Selected"]').should(
        "have.value",
        "8/26/2026 - 9/8/2026"
      );
    });

    it("[defect] does not re-query for a range that was cancelled", () => {
      // The table must still be reporting the pay period the user was on.
      cancelAfterPicking();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const narrowed = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          return start.getMonth() === 8 && start.getDate() === 1;
        });
        expect(narrowed, "the cancelled range was queried anyway").to.eq(false);
      });
    });

    it("[defect] waits for Apply before changing the pay period", () => {
      // Stated without Cancel at all: choosing two dates must not be enough.
      // This is the effect at date-picker.tsx:115 on its own.
      pickWithoutApplying();
      cy.get("@getShifts.all").should((interceptions: any) => {
        const narrowed = interceptions.some((i: any) => {
          const window = new URL(i.request.url).searchParams.getAll("shift_start_time");
          if (window.length !== 2) return false;
          const start = new Date(window[0]);
          return start.getMonth() === 8 && start.getDate() === 1;
        });
        expect(narrowed, "the range was applied without Apply").to.eq(false);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 5. Cancel saves the Care Team member you were trying not to change
  //
  //   contact-information.tsx:175  <Button name="Cancel" buttonClick={...} />
  //   button.tsx:23                type = "submit"   ← the default
  //
  // `Button` defaults to `type="submit"`, and the Cancel on the Personal
  // Information card does not override it. It sits inside the `<Form>`, so a
  // click runs its own handler — `setEditAccess(false)`, closing the editor —
  // AND submits the form, writing every edit the user had just decided to
  // abandon. The card then shows the saved values, so nothing on screen
  // suggests anything went wrong.
  //
  // The Job Details card two directories away gets this right
  // (`access-roles-wages.tsx:233` passes `type="button"`), which is what makes
  // this an oversight rather than a decision.
  //
  // One prop fixes it: `type="button"` on the Cancel.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care Team — Cancel on Personal Information", { tags: [Tags.PCG] }, () => {
    const MORRIS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const MEMBER = {
      userId: MORRIS,
      name: "Morris Olsen",
      firstName: "Morris",
      lastName: "Olsen",
      email: "morris@yopmail.com",
      mobile: "8585854545",
      role: "PCG",
      home: "Comfort Cove",
      homeId: TEST_HOME_ID,
      contractCompletedOn: "2026-08-17",
      roaster: [{ pay_rate: "10", pay_frequency: "Hourly" }],
      biography: { personalDetails: {} },
      documents: [],
      isDeleted: false,
    };

    /** Open the member's Personal Information card and edit the mobile. */
    const editThenCancel = () => {
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 200, body: {} }).as(
        "saveUser"
      );
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/users*", (req) => {
        const userType = req.query.userType as string | undefined;
        req.reply({
          statusCode: 200,
          body: { users: userType === "PCG" ? [MEMBER] : [] },
        });
      });
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: { user: MEMBER },
      });
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      });
      cy.clock(FROZEN_NOW, ["Date"]);

      cy.visit("/hcm/team");
      cy.contains("Care Team").should("be.visible");
      cy.openRowMenu("Morris Olsen");
      cy.contains("div", /^View personal information$/).click();
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");

      cy.contains("button", "Edit").click();
      cy.get('input[name="mobile"]').clear();
      cy.get('input[name="mobile"]').type("9998887777");
      cy.contains("button", /^Cancel$/).click();
    };

    it("[defect] sends nothing when the edit is cancelled", () => {
      editThenCancel();
      cy.assertNoRequest("@saveUser");
    });

    // There is deliberately no second test asserting the card still shows the
    // old mobile. It passes today for the wrong reason: the save DOES go
    // through, but the stubbed refetch answers with the original record, so the
    // screen reverts and the bug is invisible from the DOM. The request is the
    // only honest evidence, and a green test in this file is worse than none.
  });
});
