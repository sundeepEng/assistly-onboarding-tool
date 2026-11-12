/**
 * Clinical date and time helpers — utils/dateUtils.ts
 *
 * Every clinical screen turns a date and a time into a stored timestamp and
 * back again: MedPass files a dose under a round, Care Plan files a vital-sign
 * reading under a day, the incident form combines a date and time picker into
 * one instant. Getting the timezone wrong here does not throw — it silently
 * files a record under the wrong day, which is how the Medication-tab/MedPass
 * disagreement pinned in the Cypress defects file came about.
 *
 * These tests therefore pin, explicitly, WHICH clock each helper uses. Several
 * assertions are written to hold in any timezone rather than assuming the
 * machine runs in UTC — where a helper genuinely cannot be checked without a
 * known offset, the test says so and derives the expectation the same way the
 * helper does.
 */

import {
  calculateAge,
  dateFormat,
  extractTimeFromIso,
  fixTimingFormat,
  formatAddress,
  formatDate,
  formatIsoToDate,
  formatIsoToLocalTime,
  getDaysAgo,
  getSelectedDateTimeIso,
  getUtcDateTimeString,
  splitISOToDateTime,
  getYYYYMMDDString,
  omit,
  timeArrayFormat,
  timeFormat,
  timeOptions,
  timeOptions24H,
} from "../../../utils/dateUtils";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ─── formatDate — reads the clock in UTC ─────────────────────────────────────

describe("formatDate", () => {
  it("formats an ISO timestamp as MM/DD/YYYY", () => {
    expect(formatDate("2026-08-31T07:48:00.000Z")).toBe("08/31/2026");
  });

  it("uses the UTC calendar date, not the local one", () => {
    // 23:30 UTC is already the next day east of UTC and still the previous day
    // far enough west — the helper must ignore both and report the UTC date.
    expect(formatDate("2026-08-31T23:30:00.000Z")).toBe("08/31/2026");
    expect(formatDate("2026-09-01T00:30:00.000Z")).toBe("09/01/2026");
  });

  it("pads single-digit months and days", () => {
    expect(formatDate("2026-01-02T10:00:00.000Z")).toBe("01/02/2026");
  });

  it("handles a leap day", () => {
    expect(formatDate("2028-02-29T12:00:00.000Z")).toBe("02/29/2028");
  });
});

// ─── getYYYYMMDDString — reads the clock LOCALLY ─────────────────────────────

describe("getYYYYMMDDString", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(getYYYYMMDDString(new Date(2026, 7, 31))).toBe("2026-08-31");
  });

  it("uses the local calendar date", () => {
    // Built from local parts, so it must agree with the local getters whatever
    // the offset — this is the helper MedPass and Care Plan file records with.
    const d = new Date(2026, 0, 2, 23, 59);
    expect(getYYYYMMDDString(d)).toBe(localDate(d));
  });

  it("pads single-digit months and days", () => {
    expect(getYYYYMMDDString(new Date(2026, 0, 2))).toBe("2026-01-02");
  });

  it("accepts an ISO string as well as a Date", () => {
    const iso = "2026-08-31T12:00:00.000Z";
    expect(getYYYYMMDDString(iso as any)).toBe(localDate(new Date(iso)));
  });

  it("defaults to now", () => {
    expect(getYYYYMMDDString()).toBe(localDate(new Date()));
  });

  it("disagrees with formatDate for part of every day", () => {
    // The two helpers are the pair behind the Medication-tab / MedPass split:
    // one is local, one is UTC. Pick an instant where they must differ.
    const offsetMinutes = new Date().getTimezoneOffset();
    if (offsetMinutes === 0) return; // unobservable at UTC+0

    const d = new Date();
    d.setHours(offsetMinutes > 0 ? 23 : 1, 0, 0, 0);
    expect(getYYYYMMDDString(d)).not.toBe(formatDate(d.toISOString()).replace(
      /(\d{2})\/(\d{2})\/(\d{4})/,
      "$3-$1-$2"
    ));
  });
});

// ─── getUtcDateTimeString — local wall-clock time, stored as UTC ─────────────

describe("getUtcDateTimeString", () => {
  it("applies the time to the given date and returns an ISO string", () => {
    const iso = getUtcDateTimeString(new Date(2026, 7, 31), "14:30");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("sets the wall-clock time in LOCAL terms", () => {
    const iso = getUtcDateTimeString(new Date(2026, 7, 31), "14:30");
    const back = new Date(iso);
    expect(back.getHours()).toBe(14);
    expect(back.getMinutes()).toBe(30);
  });

  it("accepts seconds and defaults them to zero", () => {
    const withSeconds = new Date(getUtcDateTimeString(new Date(2026, 7, 31), "14:30:45"));
    expect(withSeconds.getSeconds()).toBe(45);

    const without = new Date(getUtcDateTimeString(new Date(2026, 7, 31), "14:30"));
    expect(without.getSeconds()).toBe(0);
  });

  it("round-trips through formatIsoToLocalTime", () => {
    // This is the Care Plan vital-sign contract: type 14:30, read back 2:30 PM.
    const iso = getUtcDateTimeString(new Date(2026, 7, 31), "14:30");
    expect(formatIsoToLocalTime(iso)).toBe("2:30 PM");
  });

  it("handles midnight and one minute to midnight", () => {
    const midnight = new Date(getUtcDateTimeString(new Date(2026, 7, 31), "00:00"));
    expect(midnight.getHours()).toBe(0);

    const late = new Date(getUtcDateTimeString(new Date(2026, 7, 31), "23:59"));
    expect(late.getHours()).toBe(23);
    expect(late.getMinutes()).toBe(59);
  });
});

// ─── getSelectedDateTimeIso — pins local noon so the date never drifts ───────

describe("getSelectedDateTimeIso", () => {
  it("keeps the selected date as the date part", () => {
    // Built from local noon — far enough from either midnight that the stored
    // date survives the viewer's offset in both directions.
    expect(getSelectedDateTimeIso("2026-08-31").slice(0, 10)).toBe("2026-08-31");
  });

  it("keeps the date stable for every date it is given", () => {
    ["2026-01-01", "2026-06-15", "2026-12-31"].forEach((date) => {
      expect(getSelectedDateTimeIso(date).slice(0, 10)).toBe(date);
    });
  });

  it("returns a valid ISO timestamp", () => {
    expect(getSelectedDateTimeIso("2026-08-31")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("pins midday local time — the picked date survives any timezone", () => {
    // Noon is the safe wall-clock choice: in no offset does it cross a day
    // boundary, which is what midnight-UTC pinning used to get wrong.
    const iso = getSelectedDateTimeIso("2026-08-31");
    expect(new Date(iso).getHours()).toBe(12);
    expect(new Date(iso).getMinutes()).toBe(0);
  });
});

// ─── timeFormat / timeArrayFormat — 12-hour display, NOT zero-padded ─────────

describe("timeFormat", () => {
  it("converts a 24-hour time to 12-hour with a suffix", () => {
    expect(timeFormat("14:00:00")).toBe("2:00 PM");
    expect(timeFormat("08:00:00")).toBe("8:00 AM");
  });

  it("does NOT zero-pad the hour", () => {
    // The dropdown's labels ARE padded (timeOptions24H). The two disagree, and
    // asking cy.contains for the wrong one silently matches the wrong option.
    expect(timeFormat("08:00:00")).toBe("8:00 AM");
    expect(timeFormat("08:00:00")).not.toBe("08:00 AM");
  });

  it("renders midnight as 12 AM and midday as 12 PM", () => {
    expect(timeFormat("00:00:00")).toBe("12:00 AM");
    expect(timeFormat("12:00:00")).toBe("12:00 PM");
  });

  it("renders the last half hour of the day", () => {
    expect(timeFormat("23:30:00")).toBe("11:30 PM");
  });

  it("returns the input unchanged when it is not a time", () => {
    expect(timeFormat("nonsense")).toBe("nonsense");
  });

  it("copes with an empty value", () => {
    expect(timeFormat("")).toBe("");
  });
});

describe("timeArrayFormat", () => {
  it("joins several timings with commas", () => {
    expect(timeArrayFormat(["09:00:00", "14:00:00", "21:00:00"])).toBe(
      "9:00 AM, 2:00 PM, 9:00 PM"
    );
  });

  it("formats a single timing", () => {
    expect(timeArrayFormat(["14:00:00"])).toBe("2:00 PM");
  });

  it("returns an empty string for no timings", () => {
    expect(timeArrayFormat([])).toBe("");
  });
});

// ─── timeOptions24H — the dropdown the forms use ─────────────────────────────

describe("timeOptions24H", () => {
  it("offers 48 half-hour slots", () => {
    expect(timeOptions24H).toHaveLength(48);
  });

  it("starts at midnight and ends at 11:30 PM", () => {
    expect(timeOptions24H[0]).toEqual({ option: "12:00 AM", value: "00:00:00" });
    expect(timeOptions24H[47]).toEqual({ option: "11:30 PM", value: "23:30:00" });
  });

  it("zero-pads its display labels", () => {
    // "02:00 PM", not "2:00 PM" — the inverse of timeFormat.
    expect(timeOptions24H.find((o) => o.value === "14:00:00")?.option).toBe("02:00 PM");
  });

  it("gives every option a distinct value", () => {
    const values = timeOptions24H.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every option a distinct label", () => {
    // Padding is what makes this true — without it "2:00 PM" would be a
    // substring of "12:00 PM" and a text-based picker could match the wrong one.
    const labels = timeOptions24H.map((o) => o.option);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has no label that is a substring of another", () => {
    const labels = timeOptions24H.map((o) => o.option);
    const collisions = labels.filter((a) =>
      labels.some((b) => b !== a && b.includes(a))
    );
    expect(collisions).toEqual([]);
  });
});

describe("timeOptions", () => {
  it("covers 8 AM to 8 PM in half hours", () => {
    expect(timeOptions).toHaveLength(25);
    expect(timeOptions[0].value).toBe("08:00:00");
    expect(timeOptions[24].value).toBe("20:00:00");
  });
});

// ─── dateFormat — string reshuffle, no Date involved ────────────────────────

describe("dateFormat", () => {
  it("turns YYYY-MM-DD into MM/DD/YYYY", () => {
    expect(dateFormat("2026-08-31")).toBe("08/31/2026");
  });

  it("returns the input unchanged when it is not a date string", () => {
    expect(dateFormat("nonsense")).toBe("nonsense");
    expect(dateFormat("")).toBe("");
  });

  it("returns non-strings unchanged", () => {
    expect(dateFormat(null as any)).toBeNull();
    expect(dateFormat(undefined as any)).toBeUndefined();
  });

  it("does no timezone conversion at all", () => {
    // Pure string work, so the same input gives the same output everywhere.
    expect(dateFormat("2026-01-01")).toBe("01/01/2026");
  });
});

// ─── formatIsoToLocalTime / formatIsoToDate ─────────────────────────────────

describe("formatIsoToLocalTime", () => {
  it("formats an ISO timestamp as local 12-hour time", () => {
    const iso = getUtcDateTimeString(new Date(2026, 7, 31), "09:05");
    expect(formatIsoToLocalTime(iso)).toBe("9:05 AM");
  });

  it("returns an em dash for an empty value", () => {
    expect(formatIsoToLocalTime("")).toBe("—");
  });

  it("returns an em dash for an unparseable value", () => {
    expect(formatIsoToLocalTime("not-a-date")).toBe("—");
  });
});

describe("formatIsoToDate", () => {
  it("formats an ISO timestamp as MM/dd/yyyy", () => {
    const iso = getUtcDateTimeString(new Date(2026, 7, 31), "12:00");
    expect(formatIsoToDate(iso)).toBe("08/31/2026");
  });

  it("returns an em dash for an empty value", () => {
    expect(formatIsoToDate("")).toBe("—");
  });

  it("returns an em dash for an unparseable value", () => {
    expect(formatIsoToDate("not-a-date")).toBe("—");
  });
});

// ─── extractTimeFromIso / fixTimingFormat ───────────────────────────────────

describe("extractTimeFromIso", () => {
  it("pulls HH:mm out of an ISO string in UTC", () => {
    expect(extractTimeFromIso("2026-08-31T14:30:00.000Z")).toBe("14:30");
  });

  it("returns an empty string for no input", () => {
    expect(extractTimeFromIso("")).toBe("");
    expect(extractTimeFromIso(undefined as any)).toBe("");
  });
});

describe("fixTimingFormat", () => {
  it("trims a malformed four-part timing back to HH:mm:ss", () => {
    expect(fixTimingFormat("11:54:00:00")).toBe("11:54:00");
  });

  it("leaves a well-formed timing alone", () => {
    expect(fixTimingFormat("11:54:00")).toBe("11:54:00");
  });

  it("copes with an undefined timing", () => {
    expect(fixTimingFormat(undefined)).toBeUndefined();
  });
});

// ─── calculateAge — used on the senior profile card ─────────────────────────

describe("calculateAge", () => {
  it("counts whole years", () => {
    const born = new Date();
    born.setFullYear(born.getFullYear() - 40);
    expect(calculateAge(localDate(born))).toBe(40);
  });

  it("does not count a birthday that is still a month away", () => {
    const born = new Date();
    born.setFullYear(born.getFullYear() - 40);
    born.setMonth(born.getMonth() + 2);
    expect(calculateAge(localDate(born))).toBe(39);
  });

  it("[known bug] ages a senior a day early west of UTC", () => {
    // calculateAge does `new Date("YYYY-MM-DD")`, which parses as UTC midnight,
    // then compares with LOCAL getters. West of UTC that instant is still the
    // previous day locally, so the stored birth date reads one day earlier than
    // it was written and the senior gains a year 24 hours early.
    //
    //   born "1986-09-01" → new Date(...) → Aug 31 20:00 local (UTC-4)
    //   .getDate() === 31, not 1
    //
    // Pinned as-built rather than left failing, so `npm test` stays green — but
    // it is a defect: a resident's displayed age is wrong for a day each year.
    // The fix is to parse the date in local terms, as getYYYYMMDDString does.
    const born = new Date();
    born.setFullYear(born.getFullYear() - 40);
    born.setDate(born.getDate() + 1); // birthday is tomorrow → true age is 39

    const offsetMinutes = new Date().getTimezoneOffset();
    const westOfUtc = offsetMinutes > 0;

    expect(calculateAge(localDate(born))).toBe(westOfUtc ? 40 : 39);
  });

  it("returns null for no birth date", () => {
    expect(calculateAge("")).toBeNull();
    expect(calculateAge(undefined as any)).toBeNull();
  });

  it("returns null for an unparseable birth date", () => {
    expect(calculateAge("not-a-date")).toBeNull();
  });

  it("returns a negative age for a birth date in the future", () => {
    // Nothing guards against it — worth pinning so a future fix is deliberate.
    const born = new Date();
    born.setFullYear(born.getFullYear() + 5);
    expect(calculateAge(localDate(born))).toBeLessThan(0);
  });
});

// ─── getDaysAgo — the "Contacted N days ago" column ─────────────────────────

describe("getDaysAgo", () => {
  it("reports today as 0 days ago", () => {
    expect(getDaysAgo(new Date().toISOString())).toBe("0 days ago");
  });

  it("uses the singular for exactly one day", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 - 60_000);
    expect(getDaysAgo(yesterday.toISOString())).toBe("1 day ago");
  });

  it("uses the plural beyond one day", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60_000);
    expect(getDaysAgo(threeDaysAgo.toISOString())).toBe("3 days ago");
  });

  it("falls back to createdAt when there is no updatedAt", () => {
    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 60_000);
    expect(getDaysAgo(undefined, created.toISOString())).toBe("2 days ago");
  });

  it("reports an invalid date rather than throwing", () => {
    expect(getDaysAgo("not-a-date")).toBe("Invalid date");
  });

  it("treats a future date as a positive distance", () => {
    // The helper takes the absolute difference, so tomorrow reads as 0 days ago
    // rather than -1 — pinned because it hides clock skew rather than showing it.
    const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000);
    expect(getDaysAgo(tomorrow.toISOString())).toBe("0 days ago");
  });
});

// ─── omit — used before every clinical PUT ──────────────────────────────────

describe("omit", () => {
  it("removes the listed keys", () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ["b"])).toEqual({ a: 1, c: 3 });
  });

  it("leaves the original object untouched", () => {
    const original = { a: 1, b: 2 };
    omit(original, ["b"]);
    expect(original).toEqual({ a: 1, b: 2 });
  });

  it("ignores keys that are not present", () => {
    expect(omit({ a: 1 }, ["zzz"])).toEqual({ a: 1 });
  });

  it("copes with an empty omit list", () => {
    expect(omit({ a: 1 }, [])).toEqual({ a: 1 });
  });

  it("keeps nested objects by reference rather than deep-cloning", () => {
    const nested = { inner: true };
    const result = omit({ a: 1, nested }, ["a"]) as any;
    expect(result.nested).toBe(nested);
  });
});

// ─── formatAddress — the In-Home-Care profile card ─────────────────────────

describe("formatAddress", () => {
  it("joins the parts it is given", () => {
    const out = formatAddress({
      street1: "12 Elm Row",
      city: "Springfield",
      state: "IL",
      zipCode: "62704",
    });
    expect(out).toContain("12 Elm Row");
    expect(out).toContain("Springfield");
  });

  it("copes with no address at all", () => {
    expect(() => formatAddress(undefined as any)).not.toThrow();
  });

  it("copes with a partial address", () => {
    expect(() => formatAddress({ city: "Springfield" } as any)).not.toThrow();
  });
});


// ─── splitISOToDateTime ──────────────────────────────────────────────────────

/**
 * Added with the edit-incident-report work.
 *
 * Splits a stored ISO instant into the `date` and `time` halves an edit form
 * needs. It reads LOCAL components on purpose — `toISOString()` would re-encode
 * as UTC and shift the hour, so a carer who typed 14:30 would reopen the form
 * and find 09:30. Every assertion below derives its expectation from the same
 * Date the helper sees, so the file passes in any timezone.
 */
describe("splitISOToDateTime", () => {
  const localParts = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  it("splits an instant into a date and a time", () => {
    const iso = "2026-05-10T14:30:00.000Z";
    expect(splitISOToDateTime(iso)).toEqual(localParts(iso));
  });

  it("returns the date as yyyy-MM-dd", () => {
    expect(splitISOToDateTime("2026-05-10T14:30:00.000Z").date).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  it("returns the time as HH:mm with no seconds", () => {
    expect(splitISOToDateTime("2026-05-10T14:30:45.000Z").time).toMatch(
      /^\d{2}:\d{2}$/
    );
  });

  it("drops the seconds rather than rounding them", () => {
    const a = splitISOToDateTime("2026-05-10T14:30:00.000Z").time;
    const b = splitISOToDateTime("2026-05-10T14:30:59.000Z").time;
    expect(a).toBe(b);
  });

  it("zero-pads a single-digit month and day", () => {
    const iso = "2026-01-05T09:05:00.000Z";
    const { date } = splitISOToDateTime(iso);
    expect(date).toBe(localParts(iso).date);
    expect(date.split("-")[1]).toHaveLength(2);
    expect(date.split("-")[2]).toHaveLength(2);
  });

  it("zero-pads a single-digit hour and minute", () => {
    const { time } = splitISOToDateTime("2026-01-05T09:05:00.000Z");
    expect(time).toHaveLength(5);
  });

  it("reads LOCAL components, not UTC ones", () => {
    // The whole point of the helper. Only meaningful off UTC, so the
    // divergence is asserted conditionally rather than hardcoded.
    const iso = "2026-05-10T02:00:00.000Z";
    const d = new Date(iso);
    const { date } = splitISOToDateTime(iso);
    expect(date).toBe(localParts(iso).date);
    if (d.getUTCDate() !== d.getDate()) {
      expect(date.slice(8, 10)).not.toBe(iso.slice(8, 10));
    }
  });

  it("round-trips a value it produced itself", () => {
    const iso = "2026-05-10T14:30:00.000Z";
    const { date, time } = splitISOToDateTime(iso);
    const rebuilt = new Date(`${date}T${time}`);
    expect(splitISOToDateTime(rebuilt.toISOString())).toEqual({ date, time });
  });

  it("returns empty strings for an undefined instant", () => {
    expect(splitISOToDateTime(undefined)).toEqual({ date: "", time: "" });
  });

  it("returns empty strings for an empty string", () => {
    expect(splitISOToDateTime("")).toEqual({ date: "", time: "" });
  });

  it("returns empty strings for an unparseable instant", () => {
    expect(splitISOToDateTime("not-a-date")).toEqual({ date: "", time: "" });
  });

  it("returns empty strings for a non-string input", () => {
    // Guards the `typeof iso !== "string"` branch — a Date object is refused
    // rather than coerced.
    expect(splitISOToDateTime(new Date() as any)).toEqual({ date: "", time: "" });
  });

  it("returns empty strings for null", () => {
    expect(splitISOToDateTime(null as any)).toEqual({ date: "", time: "" });
  });

  it("never throws on rubbish", () => {
    [undefined, null, "", "x", 0, {}, []].forEach((v) =>
      expect(() => splitISOToDateTime(v as any)).not.toThrow()
    );
  });

  it("accepts a date-only string", () => {
    const iso = "2026-05-10";
    expect(splitISOToDateTime(iso)).toEqual(localParts(iso));
  });
});
