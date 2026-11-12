/**
 * Staff Management — the arithmetic half of components/hcm/utils/timeUtils.ts
 *
 *   getHoursDifference           two instants → hours, to two decimals
 *   processShiftTimes            the three lines in every "Worked" cell
 *   calculateTotalWorkedHours    Paid Hours, Total Hours
 *   calculateTotalScheduledHours the same over the schedule
 *   getNumberOfTimeCards         the Timecards column
 *   calculateShiftWage           one shift's money
 *   calculateTotalWages          Wages, Est. Wages
 *   calculateScheduledTotalWages what the schedule was going to cost
 *   processMissingSchedulesByDay uncovered minutes in a week
 *
 * This is the payroll layer. Every figure a home reads off the dashboard, the
 * timesheets and the exported workbook comes from these nine functions, so the
 * edges matter more than usual:
 *
 *   - a shift still running contributes nothing, and neither does one whose
 *     clock-out precedes its clock-in;
 *   - "Monthly" pay is skipped in the totals rather than counted as zero, which
 *     is why the UI prints "NA" instead of "$0";
 *   - `pay_rate` is treated as a STRING throughout — `calculateTotalWages`
 *     calls `.replace()` on the override it is handed, so a numeric rate throws
 *     rather than being coerced. That one is pinned below because it is
 *     reachable: the pay-period export passes `roaster[0].pay_rate` straight in.
 *
 * `processShiftTimes` is the only one that formats, and its third line — the
 * over/under difference — is deliberately absent when the difference is zero.
 */

import {
  calculateScheduledTotalWages,
  calculateShiftWage,
  calculateTotalScheduledHours,
  calculateTotalWages,
  calculateTotalWorkedHours,
  getHoursDifference,
  getNumberOfTimeCards,
  processMissingSchedulesByDay,
  processShiftTimes,
} from "../../../components/hcm/utils/timeUtils";

/** An ISO instant at a local wall-clock time on a given day. */
const at = (year: number, month: number, day: number, hours: number, minutes = 0) =>
  new Date(year, month, day, hours, minutes, 0, 0).toISOString();

const SEP4 = (hours: number, minutes = 0) => at(2026, 8, 4, hours, minutes);

/** A shift as the HCM endpoints return one. */
const shift = (overrides: Record<string, any> = {}) => ({
  shift_start_time: SEP4(9, 0),
  shift_end_time: SEP4(17, 0),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  pay_rate: "20",
  pay_frequency: "Hourly",
  ...overrides,
});

/** Worked exactly its eight scheduled hours at $20 → $160. */
const worked = (overrides: Record<string, any> = {}) =>
  shift({
    clock_in_timestamp: SEP4(9, 0),
    clock_out_timestamp: SEP4(17, 0),
    ...overrides,
  });

// ─── getHoursDifference ──────────────────────────────────────────────────────

describe("getHoursDifference", () => {
  it("counts whole hours", () => {
    expect(getHoursDifference(SEP4(9, 0), SEP4(17, 0))).toBe(8);
  });

  it("counts a half hour", () => {
    expect(getHoursDifference(SEP4(9, 0), SEP4(9, 30))).toBe(0.5);
  });

  it("rounds to two decimals", () => {
    // 6:40 to 8:39 is 119 minutes → 1.9833… hours.
    expect(getHoursDifference(SEP4(6, 40), SEP4(8, 39))).toBe(1.98);
  });

  it("counts across midnight", () => {
    expect(getHoursDifference(at(2026, 8, 4, 22, 0), at(2026, 8, 5, 6, 0))).toBe(8);
  });

  it("returns a negative number when the end precedes the start", () => {
    // It does NOT clamp — the callers are what decide to ignore it.
    expect(getHoursDifference(SEP4(17, 0), SEP4(9, 0))).toBe(-8);
  });

  it("returns zero for identical instants", () => {
    expect(getHoursDifference(SEP4(9, 0), SEP4(9, 0))).toBe(0);
  });

  it("returns zero when either side is not a date", () => {
    expect(getHoursDifference("nonsense", SEP4(17, 0))).toBe(0);
    expect(getHoursDifference(SEP4(9, 0), "nonsense")).toBe(0);
  });

  it("returns zero when either side is missing", () => {
    expect(getHoursDifference(null as any, SEP4(17, 0))).toBe(0);
    expect(getHoursDifference(SEP4(9, 0), undefined as any)).toBe(0);
  });

  it("[as-built] returns zero for the Unix epoch itself", () => {
    // The guard is `if (!start.getTime() || !end.getTime())`, and the epoch's
    // getTime() is 0 — falsy. A shift timestamped 1970-01-01T00:00:00Z reads as
    // no time at all rather than as a real instant.
    expect(getHoursDifference("1970-01-01T00:00:00.000Z", SEP4(17, 0))).toBe(0);
  });
});

// ─── processShiftTimes ───────────────────────────────────────────────────────

describe("processShiftTimes", () => {
  it("renders the hours worked", () => {
    const { workedTimeDisplay } = processShiftTimes(worked());
    expect(workedTimeDisplay).toBe("9:00 AM – 5:00 PM");
  });

  it("renders the hours scheduled", () => {
    const { scheduledTimeDisplay } = processShiftTimes(shift());
    expect(scheduledTimeDisplay).toBe("9:00 AM – 5:00 PM");
  });

  it("separates the two times with an en dash", () => {
    // A test that types a hyphen never matches.
    expect(processShiftTimes(worked()).workedTimeDisplay).toContain("–");
  });

  it("dashes both sides when nobody clocked in", () => {
    expect(processShiftTimes(shift()).workedTimeDisplay).toBe("--:-- – --:--");
  });

  it("dashes only the missing side when the shift is still running", () => {
    const { workedTimeDisplay } = processShiftTimes(
      shift({ clock_in_timestamp: SEP4(9, 0) })
    );
    expect(workedTimeDisplay).toBe("9:00 AM – --:--");
  });

  it("still renders the schedule when nobody clocked in", () => {
    expect(processShiftTimes(shift()).scheduledTimeDisplay).toBe("9:00 AM – 5:00 PM");
  });

  it("says nothing when the shift was worked exactly to schedule", () => {
    expect(processShiftTimes(worked()).timeDifference).toBeNull();
  });

  it("reports minutes under the schedule", () => {
    const { timeDifference } = processShiftTimes(
      worked({ clock_out_timestamp: SEP4(16, 14) })
    );
    expect(timeDifference).toBe("46 min under scheduled time");
  });

  it("reports minutes over the schedule", () => {
    const { timeDifference } = processShiftTimes(
      worked({ clock_out_timestamp: SEP4(17, 30) })
    );
    expect(timeDifference).toBe("30 min over scheduled time");
  });

  it("folds whole hours into the difference", () => {
    const { timeDifference } = processShiftTimes(
      worked({ clock_out_timestamp: SEP4(18, 30) })
    );
    expect(timeDifference).toBe("1 hr 30 min over scheduled time");
  });

  it("pluralises past one hour", () => {
    const { timeDifference } = processShiftTimes(
      worked({ clock_out_timestamp: SEP4(19, 20) })
    );
    expect(timeDifference).toBe("2 hrs 20 min over scheduled time");
  });

  it("reports a whole number of hours with a trailing zero minutes", () => {
    const { timeDifference } = processShiftTimes(
      worked({ clock_out_timestamp: SEP4(18, 0) })
    );
    expect(timeDifference).toBe("1 hr 0 min over scheduled time");
  });

  it("says nothing while the shift is still open", () => {
    const { timeDifference } = processShiftTimes(
      shift({ clock_in_timestamp: SEP4(9, 0) })
    );
    expect(timeDifference).toBeNull();
  });

  it("says nothing when there is no schedule to compare against", () => {
    const { timeDifference } = processShiftTimes({
      shift_start_time: null,
      shift_end_time: null,
      clock_in_timestamp: SEP4(9, 0),
      clock_out_timestamp: SEP4(17, 0),
    });
    expect(timeDifference).toBeNull();
  });

  it("survives being handed nothing at all", () => {
    const result = processShiftTimes(undefined as any);
    expect(result.workedTimeDisplay).toBe("--:-- – --:--");
    expect(result.timeDifference).toBeNull();
  });
});

// ─── calculateTotalWorkedHours ───────────────────────────────────────────────

describe("calculateTotalWorkedHours", () => {
  it("adds up the shifts that were punched", () => {
    expect(calculateTotalWorkedHours([worked(), worked()])).toBe(16);
  });

  it("counts a single shift", () => {
    expect(calculateTotalWorkedHours([worked()])).toBe(8);
  });

  it("rounds the total to two decimals", () => {
    expect(
      calculateTotalWorkedHours([worked({ clock_out_timestamp: SEP4(10, 39) })])
    ).toBe(1.65);
  });

  it("ignores a shift that was never punched", () => {
    expect(calculateTotalWorkedHours([worked(), shift()])).toBe(8);
  });

  it("ignores a shift that is still running", () => {
    expect(
      calculateTotalWorkedHours([worked(), shift({ clock_in_timestamp: SEP4(9, 0) })])
    ).toBe(8);
  });

  it("ignores a clock-out that precedes its clock-in", () => {
    // The guard is `if (diff > 0)`, so a backwards pair adds nothing rather
    // than subtracting from the total.
    expect(
      calculateTotalWorkedHours([
        worked(),
        worked({ clock_in_timestamp: SEP4(17, 0), clock_out_timestamp: SEP4(9, 0) }),
      ])
    ).toBe(8);
  });

  it("counts hours across midnight", () => {
    expect(
      calculateTotalWorkedHours([
        worked({
          clock_in_timestamp: at(2026, 8, 4, 22, 0),
          clock_out_timestamp: at(2026, 8, 5, 6, 0),
        }),
      ])
    ).toBe(8);
  });

  it("returns zero for an empty list", () => {
    expect(calculateTotalWorkedHours([])).toBe(0);
  });

  it("returns zero for something that is not a list", () => {
    expect(calculateTotalWorkedHours(null as any)).toBe(0);
    expect(calculateTotalWorkedHours(undefined as any)).toBe(0);
  });
});

// ─── calculateTotalScheduledHours ────────────────────────────────────────────

describe("calculateTotalScheduledHours", () => {
  it("adds up what was scheduled, punched or not", () => {
    expect(calculateTotalScheduledHours([shift(), shift()])).toBe(16);
  });

  it("counts a shift nobody turned up for", () => {
    expect(calculateTotalScheduledHours([shift()])).toBe(8);
  });

  it("ignores a schedule that ends before it starts", () => {
    expect(
      calculateTotalScheduledHours([
        shift(),
        shift({ shift_start_time: SEP4(17, 0), shift_end_time: SEP4(9, 0) }),
      ])
    ).toBe(8);
  });

  it("returns zero for an empty list", () => {
    expect(calculateTotalScheduledHours([])).toBe(0);
  });

  it("returns zero for something that is not a list", () => {
    expect(calculateTotalScheduledHours(null)).toBe(0);
  });
});

// ─── getNumberOfTimeCards ────────────────────────────────────────────────────

describe("getNumberOfTimeCards", () => {
  it("counts a shift with both punches", () => {
    expect(getNumberOfTimeCards([worked()])).toBe(1);
  });

  it("counts several", () => {
    expect(getNumberOfTimeCards([worked(), worked(), worked()])).toBe(3);
  });

  it("does not count a shift that was never punched", () => {
    expect(getNumberOfTimeCards([shift()])).toBe(0);
  });

  it("does not count a shift that is still running", () => {
    expect(getNumberOfTimeCards([shift({ clock_in_timestamp: SEP4(9, 0) })])).toBe(0);
  });

  it("does not count a clock-out with no clock-in", () => {
    expect(getNumberOfTimeCards([shift({ clock_out_timestamp: SEP4(17, 0) })])).toBe(0);
  });

  it("counts only the punched ones in a mixed list", () => {
    expect(getNumberOfTimeCards([worked(), shift(), worked(), shift()])).toBe(2);
  });

  it("returns zero for an empty list", () => {
    expect(getNumberOfTimeCards([])).toBe(0);
  });
});

// ─── calculateShiftWage ──────────────────────────────────────────────────────

describe("calculateShiftWage", () => {
  it("multiplies the hours by the rate", () => {
    expect(calculateShiftWage(worked())).toBe(160);
  });

  it("rounds to the cent", () => {
    // 1.98 hours at $20.
    expect(
      calculateShiftWage(
        worked({ clock_in_timestamp: SEP4(6, 40), clock_out_timestamp: SEP4(8, 39) })
      )
    ).toBe(39.6);
  });

  it("strips a currency symbol from the rate", () => {
    expect(calculateShiftWage(worked({ pay_rate: "$20" }))).toBe(160);
  });

  it("takes an override rate over the shift's own", () => {
    expect(calculateShiftWage(worked(), "30")).toBe(240);
  });

  it("accepts a numeric override", () => {
    // Unlike calculateTotalWages, this one stringifies first.
    expect(calculateShiftWage(worked(), 30)).toBe(240);
  });

  it("returns nothing for monthly pay", () => {
    expect(calculateShiftWage(worked({ pay_frequency: "Monthly" }))).toBeNull();
  });

  it("ignores the case of the pay frequency", () => {
    expect(calculateShiftWage(worked({ pay_frequency: "monthly" }))).toBeNull();
  });

  it("returns nothing when the shift was never punched", () => {
    expect(calculateShiftWage(shift())).toBeNull();
  });

  it("returns nothing when the shift is still running", () => {
    expect(calculateShiftWage(shift({ clock_in_timestamp: SEP4(9, 0) }))).toBeNull();
  });

  it("returns nothing when there is no rate", () => {
    expect(calculateShiftWage(worked({ pay_rate: null }))).toBeNull();
  });
});

// ─── calculateTotalWages ─────────────────────────────────────────────────────

describe("calculateTotalWages", () => {
  it("adds up the money earned", () => {
    expect(calculateTotalWages([worked(), worked()])).toBe(320);
  });

  it("rounds the total to the cent", () => {
    expect(
      calculateTotalWages([
        worked({ clock_in_timestamp: SEP4(6, 40), clock_out_timestamp: SEP4(8, 39) }),
      ])
    ).toBe(39.6);
  });

  it("skips a monthly-paid shift rather than counting it as zero", () => {
    // This is why the UI prints "NA" and not "$0" for a monthly member.
    expect(
      calculateTotalWages([worked(), worked({ pay_frequency: "Monthly" })])
    ).toBe(160);
  });

  it("skips a shift that was never punched", () => {
    expect(calculateTotalWages([worked(), shift()])).toBe(160);
  });

  it("applies an override rate to every shift", () => {
    expect(calculateTotalWages([worked(), worked()], "30")).toBe(480);
  });

  it("returns zero for an empty list", () => {
    expect(calculateTotalWages([])).toBe(0);
  });

  it("returns zero for something that is not a list", () => {
    expect(calculateTotalWages(null)).toBe(0);
  });

  it("[as-built] throws when the override rate is a number", () => {
    // `pay_rate = parseFloat(pay_rate.replace(...))` runs before any type
    // check, so a numeric override is a TypeError rather than a coercion.
    //
    // This is reachable, not theoretical: the pay-period export calls
    // `calculateTotalWages(shifts, roaster?.pay_rate)`, and `handleExport` has
    // no catch — a home whose roster stores the rate as a number gets no
    // workbook and no error message. `calculateShiftWage` two functions away
    // does `String(pay_rate)` first and is fine.
    expect(() => calculateTotalWages([worked()], 30)).toThrow(TypeError);
  });

  it("[as-built] throws when a shift's own rate is a number", () => {
    expect(() => calculateTotalWages([worked({ pay_rate: 20 })])).toThrow(TypeError);
  });
});

// ─── calculateScheduledTotalWages ────────────────────────────────────────────

describe("calculateScheduledTotalWages", () => {
  it("costs the schedule rather than the punches", () => {
    // Nobody clocked in, but the shift was still going to cost $160.
    expect(calculateScheduledTotalWages([shift()])).toBe(160);
  });

  it("adds up several shifts", () => {
    expect(calculateScheduledTotalWages([shift(), shift()])).toBe(320);
  });

  it("strips a currency symbol from the rate", () => {
    expect(calculateScheduledTotalWages([shift({ pay_rate: "$20" })])).toBe(160);
  });

  it("[as-built] counts a monthly-paid shift at its monthly rate", () => {
    // Unlike calculateTotalWages, this one has no pay_frequency guard, so a
    // $4500/month member contributes 8 × 4500 to a "scheduled wages" figure.
    expect(
      calculateScheduledTotalWages([
        shift({ pay_rate: "4500", pay_frequency: "Monthly" }),
      ])
    ).toBe(36000);
  });

  it("returns zero for an empty list", () => {
    expect(calculateScheduledTotalWages([])).toBe(0);
  });

  it("returns zero for something that is not a list", () => {
    expect(calculateScheduledTotalWages(null)).toBe(0);
  });
});

// ─── processMissingSchedulesByDay ────────────────────────────────────────────

describe("processMissingSchedulesByDay", () => {
  /** Monday 31 August 2026 — the week the tests below work on. */
  const WEEK = at(2026, 7, 31, 12, 0);
  const FULL_DAY_MINUTES = 1440;

  it("reports on all seven days of the week", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, []);
    expect(missingByDate).toHaveLength(7);
  });

  it("snaps to the Monday of whatever day it is given", () => {
    const { missingByDate } = processMissingSchedulesByDay(at(2026, 8, 3, 12, 0), []);
    expect(missingByDate[0].date).toBe("2026-08-31");
  });

  it("counts a whole week as uncovered when there are no shifts", () => {
    const { weeklyMissingMinutes } = processMissingSchedulesByDay(WEEK, []);
    expect(weeklyMissingMinutes).toBe(FULL_DAY_MINUTES * 7);
  });

  it("counts a whole week as uncovered when shifts are null", () => {
    expect(processMissingSchedulesByDay(WEEK, null).weeklyMissingMinutes).toBe(
      FULL_DAY_MINUTES * 7
    );
  });

  it("subtracts the hours a shift covers", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 9, 0), shift_end_time: at(2026, 7, 31, 17, 0) },
    ]);
    expect(missingByDate[0].minutes).toBe(FULL_DAY_MINUTES - 8 * 60);
  });

  it("leaves the other days untouched", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 9, 0), shift_end_time: at(2026, 7, 31, 17, 0) },
    ]);
    expect(missingByDate[1].minutes).toBe(FULL_DAY_MINUTES);
  });

  it("merges two shifts that overlap rather than double-counting them", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 9, 0), shift_end_time: at(2026, 7, 31, 17, 0) },
      { shift_start_time: at(2026, 7, 31, 13, 0), shift_end_time: at(2026, 7, 31, 21, 0) },
    ]);
    // 09:00–21:00 covered once: twelve hours, not sixteen.
    expect(missingByDate[0].minutes).toBe(FULL_DAY_MINUTES - 12 * 60);
  });

  it("counts the gap between two shifts", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 0, 0), shift_end_time: at(2026, 7, 31, 9, 0) },
      { shift_start_time: at(2026, 7, 31, 11, 0), shift_end_time: at(2026, 7, 31, 23, 59) },
    ]);
    // Just the two-hour hole between them. The trailing minute the day window
    // holds back (it ends at 23:59, counted as 24:00 for arithmetic) is only
    // charged when cover stops BEFORE 23:59 — here the second shift reaches it.
    expect(missingByDate[0].minutes).toBe(2 * 60);
  });

  it("lists only the days that have a gap", () => {
    const { missingDates } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 0, 0), shift_end_time: at(2026, 7, 31, 23, 59) },
    ]);
    expect(missingDates).not.toContain("2026-08-31");
    expect(missingDates).toHaveLength(6);
  });

  it("phrases a gap in hours and minutes", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 0, 0), shift_end_time: at(2026, 7, 31, 22, 30) },
    ]);
    expect(missingByDate[0].display).toBe("1 hr 30 min");
  });

  it("phrases a gap under an hour in minutes alone", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 0, 0), shift_end_time: at(2026, 7, 31, 23, 30) },
    ]);
    expect(missingByDate[0].display).toBe("30 min");
  });

  it("pluralises hours", () => {
    const { weeklyMissingDisplay } = processMissingSchedulesByDay(WEEK, []);
    expect(weeklyMissingDisplay).toContain("hrs");
  });

  it("ignores a shift whose end precedes its start", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 17, 0), shift_end_time: at(2026, 7, 31, 9, 0) },
    ]);
    expect(missingByDate[0].minutes).toBe(FULL_DAY_MINUTES);
  });

  it("ignores a shift with a missing timestamp", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 9, 0), shift_end_time: null },
    ]);
    expect(missingByDate[0].minutes).toBe(FULL_DAY_MINUTES);
  });

  it("clamps a shift that spills past midnight to the day it started", () => {
    const { missingByDate } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 22, 0), shift_end_time: at(2026, 8, 1, 6, 0) },
    ]);
    // Monday loses its last two hours; Tuesday its first six.
    expect(missingByDate[0].minutes).toBe(FULL_DAY_MINUTES - 2 * 60);
    expect(missingByDate[1].minutes).toBe(FULL_DAY_MINUTES - 6 * 60);
  });

  it("adds the days up into a weekly total", () => {
    const { missingByDate, weeklyMissingMinutes } = processMissingSchedulesByDay(WEEK, [
      { shift_start_time: at(2026, 7, 31, 9, 0), shift_end_time: at(2026, 7, 31, 17, 0) },
    ]);
    const summed = missingByDate.reduce((total, day) => total + day.minutes, 0);
    expect(weeklyMissingMinutes).toBe(summed);
  });
});
