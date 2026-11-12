/**
 * Staff Management — the formatting half of components/hcm/utils/timeUtils.ts
 *
 *   formatTime               every clock reading on the schedule and timesheets
 *   getLocalTimeString       an ISO instant back into a `<input type=time>` value
 *   scheduleTimeOptions      the Start/End Time dropdowns on Add shift
 *   getShiftDateTime         a date + a time string → the instant that is sent
 *   getUtcDateTimeString     the same job, from a Date rather than a string
 *   formatToLocalLongDate    "Fri, Sep 4" — pay period rows, time-off requests
 *   formatToLongDate         "Friday, Sep 4, 2026"
 *   formatToDateWithTime     "Sep 8 2026, 10:00 AM"
 *   isOvernightShift         whether a shift crosses midnight
 *
 * These are small, and every one of them renders on a screen where being an
 * hour or a day out is a payroll error rather than a cosmetic one. Several have
 * sharp edges worth writing down: `formatTime` swallows an invalid date into
 * "--:--", `scheduleTimeOptions` covers a full day despite a comment saying it
 * stops at noon, and `formatToDateWithTime` strips only the FIRST comma it
 * finds, which is not the one a reader would expect.
 *
 * WHY THE EXPECTATIONS ARE DERIVED
 *   Every one of these converts between an ISO instant and a local wall clock,
 *   so a hardcoded string only passes in the timezone it was written in. The
 *   fixtures build instants from local components and the expectations are
 *   computed the same way the code does, so these pass wherever they run — the
 *   same rule the clinical date tests follow.
 */

import {
  formatTime,
  formatToDateWithTime,
  formatToLocalLongDate,
  formatToLongDate,
  getLocalTimeString,
  getShiftDateTime,
  getUtcDateTimeString,
  isOvernightShift,
  scheduleTimeOptions,
} from "../../../components/hcm/utils/timeUtils";

/** An ISO instant at a local wall-clock time on a given day. */
const at = (year: number, month: number, day: number, hours: number, minutes = 0) =>
  new Date(year, month, day, hours, minutes, 0, 0).toISOString();

/** `h:mm a`, computed the way `formatTime` does. */
const expectedClock = (iso: string) => {
  const d = new Date(iso);
  const suffix = d.getHours() >= 12 ? "PM" : "AM";
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
};

// ─── formatTime ──────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("renders a morning time in twelve-hour form", () => {
    const iso = at(2026, 8, 4, 9, 30);
    expect(formatTime(iso)).toBe(expectedClock(iso));
  });

  it("renders an afternoon time as PM", () => {
    const iso = at(2026, 8, 4, 14, 5);
    expect(formatTime(iso)).toBe(expectedClock(iso));
    expect(formatTime(iso)).toContain("PM");
  });

  it("calls midnight 12 AM, not 0 AM", () => {
    expect(formatTime(at(2026, 8, 4, 0, 0))).toBe("12:00 AM");
  });

  it("calls noon 12 PM, not 0 PM", () => {
    expect(formatTime(at(2026, 8, 4, 12, 0))).toBe("12:00 PM");
  });

  it("calls one minute before midnight 11:59 PM", () => {
    expect(formatTime(at(2026, 8, 4, 23, 59))).toBe("11:59 PM");
  });

  it("pads the minutes", () => {
    expect(formatTime(at(2026, 8, 4, 9, 5))).toBe("9:05 AM");
  });

  it("does not pad the hour", () => {
    // The grid uses `hh:mm a` and prints "09:30 AM"; this one prints "9:30 AM".
    // A test that asserts the wrong one of the two never matches.
    expect(formatTime(at(2026, 8, 4, 9, 30))).toBe("9:30 AM");
  });

  it("dashes a null timestamp", () => {
    expect(formatTime(null)).toBe("--:--");
  });

  it("dashes an empty string", () => {
    expect(formatTime("")).toBe("--:--");
  });

  it("dashes a string that is not a date", () => {
    expect(formatTime("not-a-timestamp")).toBe("--:--");
  });
});

// ─── getLocalTimeString ──────────────────────────────────────────────────────

describe("getLocalTimeString", () => {
  it("returns the local wall clock with seconds by default", () => {
    const iso = at(2026, 8, 4, 14, 5);
    expect(getLocalTimeString(iso)).toBe("14:05:00");
  });

  it("drops the seconds when asked", () => {
    expect(getLocalTimeString(at(2026, 8, 4, 14, 5), false)).toBe("14:05");
  });

  it("pads a single-digit hour", () => {
    expect(getLocalTimeString(at(2026, 8, 4, 9, 5), false)).toBe("09:05");
  });

  it("renders midnight as 00:00", () => {
    expect(getLocalTimeString(at(2026, 8, 4, 0, 0), false)).toBe("00:00");
  });

  it("keeps the afternoon in twenty-four-hour form", () => {
    // This feeds `<input type=time>`, whose DOM value is always 24-hour.
    expect(getLocalTimeString(at(2026, 8, 4, 23, 45), false)).toBe("23:45");
  });

  it("returns an empty string for an empty input", () => {
    expect(getLocalTimeString("")).toBe("");
  });

  it("returns an empty string for a string that is not a date", () => {
    expect(getLocalTimeString("nonsense")).toBe("");
  });

  it("round-trips through getShiftDateTime", () => {
    // The pair the Add shift form relies on: a time string becomes an instant,
    // and the instant reads back as the same time string.
    const iso = getShiftDateTime("2026-09-04", "14:05:00");
    expect(getLocalTimeString(iso)).toBe("14:05:00");
  });
});

// ─── scheduleTimeOptions ─────────────────────────────────────────────────────

describe("scheduleTimeOptions", () => {
  it("offers a quarter-hour slot for a whole day", () => {
    expect(scheduleTimeOptions).toHaveLength(96);
  });

  it("[as-built] covers all twenty-four hours, not the twelve its comment claims", () => {
    // The comment above it says "12:00 AM to 12:00 PM"; 96 fifteen-minute steps
    // is 1440 minutes, so the list actually runs to 11:45 PM. The comment is
    // wrong, not the code — an evening shift can be scheduled.
    expect(scheduleTimeOptions[95]).toEqual({
      option: "11:45 PM",
      value: "23:45:00",
    });
  });

  it("starts at midnight", () => {
    expect(scheduleTimeOptions[0]).toEqual({
      option: "12:00 AM",
      value: "00:00:00",
    });
  });

  it("steps a quarter of an hour at a time", () => {
    expect(scheduleTimeOptions[1].value).toBe("00:15:00");
    expect(scheduleTimeOptions[2].value).toBe("00:30:00");
    expect(scheduleTimeOptions[3].value).toBe("00:45:00");
    expect(scheduleTimeOptions[4].value).toBe("01:00:00");
  });

  it("labels noon as 12:00 PM", () => {
    expect(scheduleTimeOptions[48]).toEqual({
      option: "12:00 PM",
      value: "12:00:00",
    });
  });

  it("zero-pads every value", () => {
    scheduleTimeOptions.forEach(({ value }) =>
      expect(value).toMatch(/^\d{2}:\d{2}:00$/)
    );
  });

  it("never repeats a value", () => {
    const values = scheduleTimeOptions.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("labels every slot in twelve-hour form", () => {
    scheduleTimeOptions.forEach(({ option }) =>
      expect(option).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    );
  });
});

// ─── getShiftDateTime ────────────────────────────────────────────────────────

describe("getShiftDateTime", () => {
  it("joins a date and a time into one instant", () => {
    const iso = getShiftDateTime("2026-09-04", "09:30:00");
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it("reads the date as a LOCAL calendar date", () => {
    // Built from parts rather than parsed, so "2026-09-04" is the 4th wherever
    // the reader is — this is the fix the copy-week banner is missing.
    expect(new Date(getShiftDateTime("2026-09-04", "00:00:00")).getDate()).toBe(4);
  });

  it("defaults the seconds to zero when they are left off", () => {
    expect(new Date(getShiftDateTime("2026-09-04", "09:30")).getSeconds()).toBe(0);
  });

  it("keeps the seconds it is given", () => {
    expect(new Date(getShiftDateTime("2026-09-04", "09:30:45")).getSeconds()).toBe(45);
  });

  it("returns an empty string with no date", () => {
    expect(getShiftDateTime("", "09:30:00")).toBe("");
  });

  it("returns an empty string with no time", () => {
    expect(getShiftDateTime("2026-09-04", "")).toBe("");
  });
});

// ─── getUtcDateTimeString ────────────────────────────────────────────────────

describe("getUtcDateTimeString", () => {
  it("puts the time on the date it is given", () => {
    const iso = getUtcDateTimeString(new Date(2026, 8, 4), "14:05:00");
    const d = new Date(iso);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(5);
  });

  it("defaults the seconds to zero", () => {
    const iso = getUtcDateTimeString(new Date(2026, 8, 4), "14:05");
    expect(new Date(iso).getSeconds()).toBe(0);
  });

  it("clears the milliseconds", () => {
    const noisy = new Date(2026, 8, 4, 1, 2, 3, 456);
    const iso = getUtcDateTimeString(noisy, "14:05:00");
    expect(new Date(iso).getMilliseconds()).toBe(0);
  });

  it("does not disturb the Date it was handed", () => {
    // It copies before calling setHours; a mutation here would silently move
    // whatever the caller still holds.
    const original = new Date(2026, 8, 4, 1, 0, 0);
    const before = original.getTime();
    getUtcDateTimeString(original, "14:05:00");
    expect(original.getTime()).toBe(before);
  });
});

// ─── formatToLocalLongDate ───────────────────────────────────────────────────

describe("formatToLocalLongDate", () => {
  it("names the weekday, the month and the day", () => {
    expect(formatToLocalLongDate(at(2026, 8, 4, 12, 0))).toBe("Fri, Sep 4");
  });

  it("leaves the year out", () => {
    expect(formatToLocalLongDate(at(2026, 8, 4, 12, 0))).not.toContain("2026");
  });

  it("abbreviates the weekday and month", () => {
    expect(formatToLocalLongDate(at(2026, 0, 1, 12, 0))).toBe("Thu, Jan 1");
  });

  it("em-dashes a null date", () => {
    expect(formatToLocalLongDate(null)).toBe("—");
  });

  it("em-dashes an undefined date", () => {
    expect(formatToLocalLongDate(undefined)).toBe("—");
  });

  it("em-dashes an empty string", () => {
    expect(formatToLocalLongDate("")).toBe("—");
  });

  it("em-dashes a string that is not a date", () => {
    expect(formatToLocalLongDate("not-a-date")).toBe("—");
  });
});

// ─── formatToLongDate ────────────────────────────────────────────────────────

describe("formatToLongDate", () => {
  it("spells the weekday out and keeps the year", () => {
    expect(formatToLongDate(at(2026, 8, 4, 12, 0))).toBe("Friday, Sep 4, 2026");
  });

  it("em-dashes a missing date", () => {
    expect(formatToLongDate(null)).toBe("—");
    expect(formatToLongDate(undefined)).toBe("—");
  });

  it("em-dashes a string that is not a date", () => {
    expect(formatToLongDate("nonsense")).toBe("—");
  });
});

// ─── formatToDateWithTime ────────────────────────────────────────────────────

describe("formatToDateWithTime", () => {
  it("[as-built] drops the comma after the day, not the one before the time", () => {
    // Intl produces "Sep 8, 2026, 10:00 AM" and the code calls
    // `.replace(',', '')`, which replaces only the FIRST match — so the comma
    // that survives is the one separating the year from the time.
    expect(formatToDateWithTime(at(2026, 8, 8, 10, 0))).toBe("Sep 8 2026, 10:00 AM");
  });

  it("keeps the time in twelve-hour form", () => {
    expect(formatToDateWithTime(at(2026, 8, 8, 14, 30))).toContain("2:30 PM");
  });

  it("pads the minutes", () => {
    expect(formatToDateWithTime(at(2026, 8, 8, 14, 5))).toContain("2:05 PM");
  });

  it("em-dashes a missing date", () => {
    expect(formatToDateWithTime(null)).toBe("—");
    expect(formatToDateWithTime(undefined)).toBe("—");
    expect(formatToDateWithTime("")).toBe("—");
  });

  it("em-dashes a string that is not a date", () => {
    expect(formatToDateWithTime("nope")).toBe("—");
  });
});

// ─── isOvernightShift ────────────────────────────────────────────────────────

describe("isOvernightShift", () => {
  it("says no to a shift inside one day", () => {
    expect(
      isOvernightShift({
        shift_start_time: at(2026, 8, 4, 9, 0),
        shift_end_time: at(2026, 8, 4, 17, 0),
      })
    ).toBe(false);
  });

  it("says yes to a shift that ends the next morning", () => {
    expect(
      isOvernightShift({
        shift_start_time: at(2026, 8, 4, 22, 0),
        shift_end_time: at(2026, 8, 5, 6, 0),
      })
    ).toBe(true);
  });

  it("says yes when the end reads earlier than the start on the same date", () => {
    // 10 PM to 6 AM stored against one date: the end is rolled forward a day
    // before the comparison, which is how a night shift is recognised at all.
    expect(
      isOvernightShift({
        shift_start_time: at(2026, 8, 4, 22, 0),
        shift_end_time: at(2026, 8, 4, 6, 0),
      })
    ).toBe(true);
  });

  it("[as-built] says yes to a zero-length shift", () => {
    // `end <= start` rolls the end forward a day, so identical timestamps come
    // out as an overnight shift rather than an empty one.
    const same = at(2026, 8, 4, 9, 0);
    expect(isOvernightShift({ shift_start_time: same, shift_end_time: same })).toBe(
      true
    );
  });

  it("says no to a shift running to midnight of the same day", () => {
    expect(
      isOvernightShift({
        shift_start_time: at(2026, 8, 4, 9, 0),
        shift_end_time: at(2026, 8, 4, 23, 59),
      })
    ).toBe(false);
  });

  it("says no when there is no start", () => {
    expect(
      isOvernightShift({ shift_start_time: null, shift_end_time: at(2026, 8, 4, 6, 0) })
    ).toBe(false);
  });

  it("says no when there is no end", () => {
    expect(
      isOvernightShift({ shift_start_time: at(2026, 8, 4, 22, 0), shift_end_time: null })
    ).toBe(false);
  });

  it("says no for an empty shift", () => {
    expect(isOvernightShift({})).toBe(false);
  });

  it("says no for no shift at all", () => {
    expect(isOvernightShift(undefined)).toBe(false);
  });
});
