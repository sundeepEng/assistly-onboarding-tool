/**
 * Shared utilities used across every module
 *
 *   utils/dateUtils.ts
 *     getCopyWeekRange                 the scheduling Copy Week window
 *     formatDateRange                  the budget/ledger query window
 *     formatToShortDateRangeForPayStub the pay stub's "Sep 1 - Sep 30, 2026"
 *     formatAddress
 *   utils/facesheetUtil.ts
 *     removeEmptyValuesDeep, deepMerge, safeStr, toDateInputValue, splitName
 *   utils/contractStatus.ts
 *     ContractStatus                   the e-sign banner on a lead
 *
 * These are the last uncovered helpers with real logic in them. Three of them
 * carry the same 04:00 UTC convention and it is the most load-bearing detail
 * in the file, so it leads.
 *
 * THE 04:00 UTC CONVENTION
 *   `getCopyWeekRange` and `formatDateRange` both build a window that starts
 *   at **04:00 UTC** on the first day and ends at **03:59:59.999 UTC** on the
 *   day after the last. That is midnight-to-midnight US Eastern, which is what
 *   the backend stores days in. A test that expects a plain `T00:00:00Z`
 *   boundary is asserting the wrong thing.
 *
 *   The two differ in one important way: `getCopyWeekRange` reads the input
 *   with `getUTC*`, so it is timezone-stable. `formatDateRange` uses
 *   `setHours` on a local Date, so its output SHIFTS with the machine's
 *   timezone. Both are pinned.
 *
 * `removeEmptyValuesDeep` COLLAPSES, IT DOES NOT JUST PRUNE
 *   An object whose every field is empty becomes `undefined`, not `{}` — and
 *   that propagates upward, so a deeply nested tree of blanks disappears
 *   entirely. It is what stops the face sheet PUTting a skeleton of empty
 *   strings over real data.
 *
 * `deepMerge` TREATS `undefined` AS DELETE
 *   Not "leave alone" — `delete output[key]`. So a patch carrying an explicit
 *   undefined removes the field, which is how the face sheet clears values.
 */

import { ContractStatus } from "../../../utils/contractStatus";
import {
  formatAddress,
  formatDateRange,
  formatToShortDateRangeForPayStub,
  getCopyWeekRange,
} from "../../../utils/dateUtils";
import {
  deepMerge,
  removeEmptyValuesDeep,
  safeStr,
  splitName,
  toDateInputValue,
} from "../../../utils/facesheetUtil";

// ═══════════════════════════════════════════════════════════════════════════
// getCopyWeekRange — the scheduling Copy Week window
// ═══════════════════════════════════════════════════════════════════════════

describe("getCopyWeekRange", () => {
  it("starts at 04:00 UTC on the Monday given", () => {
    const [start] = getCopyWeekRange("2026-09-14T00:00:00.000Z");
    expect(start).toBe("2026-09-14T04:00:00.000Z");
  });

  it("ends a millisecond before 04:00 UTC on the following Monday", () => {
    // Seven days on, one millisecond short — so the window is exactly one
    // week of Eastern days and cannot overlap the next copy.
    const [, end] = getCopyWeekRange("2026-09-14T00:00:00.000Z");
    expect(end).toBe("2026-09-21T03:59:59.999Z");
  });

  it("spans exactly seven days", () => {
    const [start, end] = getCopyWeekRange("2026-09-14T00:00:00.000Z");
    const ms = new Date(end).getTime() - new Date(start).getTime();
    expect(ms).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });

  it("accepts a plain date string", () => {
    expect(getCopyWeekRange("2026-09-14")[0]).toBe("2026-09-14T04:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    const [start, end] = getCopyWeekRange("2026-09-28");
    expect(start).toBe("2026-09-28T04:00:00.000Z");
    expect(end).toBe("2026-10-05T03:59:59.999Z");
  });

  it("crosses a year boundary", () => {
    const [start, end] = getCopyWeekRange("2026-12-28");
    expect(start).toBe("2026-12-28T04:00:00.000Z");
    expect(end).toBe("2027-01-04T03:59:59.999Z");
  });

  it("[boundary] handles a leap-year February", () => {
    const [, end] = getCopyWeekRange("2028-02-28");
    // 2028 is a leap year, so 28 Feb + 7 days is 6 March.
    expect(end).toBe("2028-03-06T03:59:59.999Z");
  });

  it("[boundary] handles a common-year February", () => {
    const [, end] = getCopyWeekRange("2026-02-28");
    expect(end).toBe("2026-03-07T03:59:59.999Z");
  });

  it("reads the input in UTC, so a late-evening instant stays on its own day", () => {
    // `getUTCDate` rather than `getDate`, so this is timezone-stable —
    // unlike `formatDateRange` below.
    expect(getCopyWeekRange("2026-09-14T23:30:00.000Z")[0]).toBe(
      "2026-09-14T04:00:00.000Z"
    );
  });

  it("ignores the time of day entirely", () => {
    expect(getCopyWeekRange("2026-09-14T09:15:00.000Z")).toEqual(
      getCopyWeekRange("2026-09-14T00:00:00.000Z")
    );
  });

  it("[as-built] throws on an unparseable date rather than returning a range", () => {
    // `new Date("banana")` is Invalid, and `toISOString()` on it throws a
    // RangeError — so a malformed week silently takes the Copy Week action
    // down rather than no-opping.
    expect(() => getCopyWeekRange("banana")).toThrow(RangeError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDateRange — the budget and ledger query window
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDateRange", () => {
  it("returns two ISO strings for a month", () => {
    expect(formatDateRange("2026-09-01", "2026-09-30")).toHaveLength(2);
  });

  it("returns an empty array without a start date", () => {
    expect(formatDateRange(undefined, "2026-09-30")).toEqual([]);
  });

  it("returns an empty array without an end date", () => {
    expect(formatDateRange("2026-09-01", undefined)).toEqual([]);
  });

  it("returns an empty array with neither", () => {
    // Which is what the budget screen sends on first paint, before
    // `selectedPeriod` is set — so the query goes out with no window.
    expect(formatDateRange()).toEqual([]);
  });

  it("returns an empty array for an unparseable date", () => {
    expect(formatDateRange("banana", "2026-09-30")).toEqual([]);
  });

  it("returns an empty array for an unparseable end date", () => {
    expect(formatDateRange("2026-09-01", "banana")).toEqual([]);
  });

  it("puts the start before the end", () => {
    const [start, end] = formatDateRange("2026-09-01", "2026-09-30");
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });

  it("sets the start to 04:00 and the end to 03:59:59.999 in LOCAL time", () => {
    // `setHours` is local, so these assertions are timezone-relative — read
    // back with the matching local getters rather than off the ISO string.
    const [start, end] = formatDateRange("2026-09-01", "2026-09-30");
    expect(new Date(start).getHours()).toBe(4);
    expect(new Date(end).getHours()).toBe(3);
    expect(new Date(end).getMinutes()).toBe(59);
    expect(new Date(end).getSeconds()).toBe(59);
    expect(new Date(end).getMilliseconds()).toBe(999);
  });

  it("[as-built] shifts with the machine's timezone, unlike getCopyWeekRange", () => {
    // The pair is built with local `setHours`, so the emitted UTC instants
    // depend on where the browser is. The backend is asked for a different
    // window from Chicago than from London for the same month.
    const [start] = formatDateRange("2026-09-01", "2026-09-30");
    const offsetMinutes = new Date("2026-09-01T00:00:00Z").getTimezoneOffset();
    // Compare whole UTC minutes — half-hour offsets (e.g. IST) make an
    // hour-only expectation fractional.
    const expectedUtcMinutes = (4 * 60 + offsetMinutes + 1440) % 1440;
    const startUtcMinutes =
      new Date(start).getUTCHours() * 60 + new Date(start).getUTCMinutes();
    expect(startUtcMinutes).toBe(expectedUtcMinutes);
  });

  it("[defect] inverts a single-day window", () => {
    // Start is 04:00 and end is 03:59:59.999 on the SAME day, so the end
    // precedes the start by just under 24 hours. Asking the budget for one
    // day's transactions asks for a negative window — and the API is given a
    // range it can only answer as empty.
    const [start, end] = formatDateRange("2026-09-01", "2026-09-01");
    expect(new Date(end).getTime()).toBeLessThan(new Date(start).getTime());
  });

  it("[defect] a single-day window is a whole day the wrong way round", () => {
    const [start, end] = formatDateRange("2026-09-01", "2026-09-01");
    const ms = new Date(start).getTime() - new Date(end).getTime();
    expect(ms).toBe(1);
  });

  it("[defect] shifts the date back a day west of UTC, so a quarter loses its first month", () => {
    // `new Date("2026-07-01")` is parsed as UTC midnight, then read with
    // LOCAL getters — so in any negative-offset timezone the instant lands on
    // 30 June. A Q3 window is sent to the API starting in Q2.
    const [start] = formatDateRange("2026-07-01", "2026-09-30");
    const offsetMinutes = new Date("2026-07-01T00:00:00Z").getTimezoneOffset();
    const expectedMonth = offsetMinutes > 0 ? 5 : 6;
    expect(new Date(start).getMonth()).toBe(expectedMonth);
  });

  it("[defect] spans three months only west of UTC — elsewhere the quarter loses its first month", () => {
    // Same day-shift as the test above, seen from the other end: west of UTC
    // the start lands on June 30 so the window counts 3 local months; at or
    // east of UTC it stays July 1 and counts 2.
    const [start, end] = formatDateRange("2026-07-01", "2026-09-30");
    const offsetMinutes = new Date("2026-07-01T00:00:00Z").getTimezoneOffset();
    const months =
      (new Date(end).getFullYear() - new Date(start).getFullYear()) * 12 +
      (new Date(end).getMonth() - new Date(start).getMonth());
    expect(months).toBe(offsetMinutes > 0 ? 3 : 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatToShortDateRangeForPayStub
// ═══════════════════════════════════════════════════════════════════════════

describe("formatToShortDateRangeForPayStub", () => {
  it("drops the year from the start and keeps it on the end", () => {
    // "Sep 1 - Sep 30, 2026" — the format on every pay stub row.
    expect(formatToShortDateRangeForPayStub("2026-09-01", "2026-09-30")).toBe(
      "Sep 1 - Sep 30, 2026"
    );
  });

  it("names both months when the period crosses one", () => {
    expect(formatToShortDateRangeForPayStub("2026-09-16", "2026-10-15")).toBe(
      "Sep 16 - Oct 15, 2026"
    );
  });

  it("handles a bi-weekly first half", () => {
    expect(formatToShortDateRangeForPayStub("2026-09-01", "2026-09-15")).toBe(
      "Sep 1 - Sep 15, 2026"
    );
  });

  it("parses a date-only string without shifting the day", () => {
    // The regex branch builds a LOCAL date from the parts, which is what
    // stops "2026-09-01" becoming 31 August in a western timezone.
    expect(formatToShortDateRangeForPayStub("2026-09-01", "2026-09-01")).toContain(
      "Sep 1"
    );
  });

  it("accepts a full ISO timestamp", () => {
    expect(
      formatToShortDateRangeForPayStub(
        "2026-09-01T00:00:00.000Z",
        "2026-09-30T00:00:00.000Z"
      )
    ).toContain("Sep");
  });

  it("returns a dash without a start date", () => {
    expect(formatToShortDateRangeForPayStub(null, "2026-09-30")).toBe("—");
  });

  it("returns a dash without an end date", () => {
    expect(formatToShortDateRangeForPayStub("2026-09-01", undefined)).toBe("—");
  });

  it("returns a dash for an unparseable date", () => {
    expect(formatToShortDateRangeForPayStub("banana", "2026-09-30")).toBe("—");
  });

  it("returns a dash for an empty string", () => {
    expect(formatToShortDateRangeForPayStub("", "")).toBe("—");
  });

  it("[boundary] gets February right", () => {
    expect(formatToShortDateRangeForPayStub("2026-02-01", "2026-02-28")).toBe(
      "Feb 1 - Feb 28, 2026"
    );
  });

  it("[boundary] gets a leap day right", () => {
    expect(formatToShortDateRangeForPayStub("2028-02-01", "2028-02-29")).toBe(
      "Feb 1 - Feb 29, 2028"
    );
  });

  it("[as-built] accepts an end date before the start without complaint", () => {
    expect(formatToShortDateRangeForPayStub("2026-09-30", "2026-09-01")).toBe(
      "Sep 30 - Sep 1, 2026"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatAddress
// ═══════════════════════════════════════════════════════════════════════════

describe("formatAddress", () => {
  it("joins every part with commas", () => {
    expect(
      formatAddress({
        street1: "12 Oak Lane",
        street2: "Apt 3",
        city: "Springfield",
        state: "IL",
        zipCode: "62704",
      })
    ).toBe("12 Oak Lane, Apt 3, Springfield, IL, 62704");
  });

  it("skips the parts that are missing", () => {
    expect(formatAddress({ city: "Springfield", state: "IL" })).toBe("Springfield, IL");
  });

  it("skips empty strings", () => {
    expect(formatAddress({ street1: "", city: "Springfield" })).toBe("Springfield");
  });

  it("returns a dash for no address at all", () => {
    expect(formatAddress(undefined)).toBe("—");
  });

  it("returns a dash for an empty address", () => {
    expect(formatAddress({})).toBe("—");
  });

  it("returns a dash when every part is empty", () => {
    expect(formatAddress({ street1: "", city: "", state: "" })).toBe("—");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// removeEmptyValuesDeep
// ═══════════════════════════════════════════════════════════════════════════

describe("removeEmptyValuesDeep", () => {
  it("keeps a non-empty string", () => {
    expect(removeEmptyValuesDeep("Mary")).toBe("Mary");
  });

  it("drops an empty string", () => {
    expect(removeEmptyValuesDeep("")).toBeUndefined();
  });

  it("drops a string of only whitespace", () => {
    expect(removeEmptyValuesDeep("   ")).toBeUndefined();
  });

  it("[as-built] keeps the untrimmed original when it has content", () => {
    // It tests the trimmed value but returns the raw one, so padding survives.
    expect(removeEmptyValuesDeep("  Mary  ")).toBe("  Mary  ");
  });

  it("keeps a populated object", () => {
    expect(removeEmptyValuesDeep({ name: "Mary" })).toEqual({ name: "Mary" });
  });

  it("prunes the empty keys from a partly filled object", () => {
    expect(removeEmptyValuesDeep({ name: "Mary", nickname: "" })).toEqual({
      name: "Mary",
    });
  });

  it("collapses a wholly empty object to undefined", () => {
    expect(removeEmptyValuesDeep({ nickname: "", note: "  " })).toBeUndefined();
  });

  it("collapses an empty object", () => {
    expect(removeEmptyValuesDeep({})).toBeUndefined();
  });

  it("collapses nested emptiness all the way up", () => {
    // The whole point: a skeleton of blank inputs disappears rather than
    // being PUT over real data.
    expect(
      removeEmptyValuesDeep({ biography: { personalDetails: { nickName: "" } } })
    ).toBeUndefined();
  });

  it("keeps a nested value that has content, and the branch above it", () => {
    expect(
      removeEmptyValuesDeep({
        biography: { personalDetails: { nickName: "", gender: "Female" } },
      })
    ).toEqual({ biography: { personalDetails: { gender: "Female" } } });
  });

  it("prunes empty entries from an array", () => {
    expect(removeEmptyValuesDeep(["Mary", "", "  ", "Sam"])).toEqual(["Mary", "Sam"]);
  });

  it("collapses an all-empty array to undefined", () => {
    expect(removeEmptyValuesDeep(["", "  "])).toBeUndefined();
  });

  it("collapses an empty array", () => {
    expect(removeEmptyValuesDeep([])).toBeUndefined();
  });

  it("[as-built] keeps false and zero — only strings count as empty", () => {
    // Important for the face sheet's checkboxes: `false` is a real answer.
    expect(removeEmptyValuesDeep({ smoker: false, children: 0 })).toEqual({
      smoker: false,
      children: 0,
    });
  });

  it("[as-built] keeps null", () => {
    expect(removeEmptyValuesDeep({ note: null })).toEqual({ note: null });
  });

  it("passes a Date through untouched", () => {
    const d = new Date("2026-09-17T00:00:00.000Z");
    expect(removeEmptyValuesDeep(d)).toBe(d);
  });

  it("drops an empty object from inside an array", () => {
    expect(removeEmptyValuesDeep([{ a: "" }, { b: "keep" }])).toEqual([{ b: "keep" }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deepMerge
// ═══════════════════════════════════════════════════════════════════════════

describe("deepMerge", () => {
  it("adds a new key", () => {
    expect(deepMerge({ a: 1 }, { b: 2 } as any)).toEqual({ a: 1, b: 2 });
  });

  it("overwrites an existing key", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges nested objects rather than replacing them", () => {
    expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3 } } as any)).toEqual({
      a: { x: 1, y: 3 },
    });
  });

  it("merges three levels down", () => {
    expect(
      deepMerge({ a: { b: { c: 1, d: 2 } } }, { a: { b: { d: 9 } } } as any)
    ).toEqual({ a: { b: { c: 1, d: 9 } } });
  });

  it("[as-built] treats an explicit undefined as DELETE, not as leave-alone", () => {
    // How the face sheet clears a field: send undefined and the key goes.
    expect(deepMerge({ a: 1, b: 2 }, { b: undefined } as any)).toEqual({ a: 1 });
  });

  it("replaces an array wholesale rather than merging it", () => {
    expect(deepMerge({ a: [1, 2, 3] }, { a: [9] } as any)).toEqual({ a: [9] });
  });

  it("replaces an array with an empty one", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [] } as any)).toEqual({ a: [] });
  });

  it("does not mutate the target", () => {
    const target = { a: { x: 1 } };
    deepMerge(target, { a: { y: 2 } } as any);
    expect(target).toEqual({ a: { x: 1 } });
  });

  it("returns the source when the target is not an object", () => {
    expect(deepMerge(null as any, { a: 1 } as any)).toEqual({ a: 1 });
  });

  it("returns the source when the source is not an object", () => {
    expect(deepMerge({ a: 1 } as any, "replaced" as any)).toBe("replaced");
  });

  it("overwrites an object with a scalar", () => {
    expect(deepMerge({ a: { x: 1 } }, { a: 5 } as any)).toEqual({ a: 5 });
  });

  it("overwrites a scalar with an object", () => {
    expect(deepMerge({ a: 5 }, { a: { x: 1 } } as any)).toEqual({ a: { x: 1 } });
  });

  it("keeps null as a value rather than deleting", () => {
    // Only `undefined` deletes; null is stored.
    expect(deepMerge({ a: 1 }, { a: null } as any)).toEqual({ a: null });
  });

  it("copes with an empty patch", () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeStr / toDateInputValue / splitName
// ═══════════════════════════════════════════════════════════════════════════

describe("safeStr", () => {
  it("passes a string through", () => {
    expect(safeStr("Mary")).toBe("Mary");
  });

  it("turns null into an empty string", () => {
    expect(safeStr(null)).toBe("");
  });

  it("turns undefined into an empty string", () => {
    expect(safeStr(undefined)).toBe("");
  });

  it("stringifies a number", () => {
    expect(safeStr(42)).toBe("42");
  });

  it("[as-built] stringifies zero rather than treating it as absent", () => {
    expect(safeStr(0)).toBe("0");
  });

  it("stringifies false", () => {
    expect(safeStr(false)).toBe("false");
  });

  it("keeps an empty string empty", () => {
    expect(safeStr("")).toBe("");
  });
});

describe("toDateInputValue", () => {
  it("trims an ISO timestamp to the date an <input type=date> wants", () => {
    expect(toDateInputValue("2026-09-17T10:30:00.000Z")).toBe("2026-09-17");
  });

  it("leaves a date-only string alone", () => {
    expect(toDateInputValue("2026-09-17")).toBe("2026-09-17");
  });

  it("returns an empty string for undefined", () => {
    expect(toDateInputValue(undefined)).toBe("");
  });

  it("returns an empty string for an empty input", () => {
    expect(toDateInputValue("")).toBe("");
  });

  it("[as-built] slices blindly rather than parsing", () => {
    // No validation at all — the first ten characters of anything come back.
    expect(toDateInputValue("not-a-date-at-all")).toBe("not-a-date");
  });
});

describe("splitName", () => {
  it("splits a first and last name", () => {
    expect(splitName("Mary Shaw")).toEqual({ firstName: "Mary", lastName: "Shaw" });
  });

  it("puts every remaining word into the last name", () => {
    expect(splitName("Mary Anne Shaw")).toEqual({
      firstName: "Mary",
      lastName: "Anne Shaw",
    });
  });

  it("leaves the last name empty for a single word", () => {
    expect(splitName("Mary")).toEqual({ firstName: "Mary", lastName: "" });
  });

  it("collapses repeated spaces", () => {
    expect(splitName("Mary    Shaw")).toEqual({ firstName: "Mary", lastName: "Shaw" });
  });

  it("ignores leading and trailing whitespace", () => {
    expect(splitName("  Mary Shaw  ")).toEqual({ firstName: "Mary", lastName: "Shaw" });
  });

  it("returns two empty strings for an empty name", () => {
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });

  it("returns two empty strings for whitespace only", () => {
    expect(splitName("   ")).toEqual({ firstName: "", lastName: "" });
  });

  it("copes with a non-string", () => {
    expect(splitName(null as any)).toEqual({ firstName: "", lastName: "" });
  });

  it("splits on a tab or newline too", () => {
    expect(splitName("Mary\tShaw")).toEqual({ firstName: "Mary", lastName: "Shaw" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ContractStatus — the e-sign banner
// ═══════════════════════════════════════════════════════════════════════════

describe("ContractStatus", () => {
  it("congratulates a completed contract in the brand colour", () => {
    expect(ContractStatus("completed")).toEqual({
      docusignStatus: "The contract has been successfully signed",
      colorStatus: "#514CEB",
    });
  });

  it("reports a declined request in red", () => {
    expect(ContractStatus("declined")).toEqual({
      docusignStatus: "The e-sign request has been declined",
      colorStatus: "#DC3545",
    });
  });

  it("reports a pending request in amber", () => {
    expect(ContractStatus("pending")).toEqual({
      docusignStatus: "The contract was sent and is awaiting signature",
      colorStatus: "#ffa503",
    });
  });

  it("reports an expired request in red", () => {
    expect(ContractStatus("expired")).toEqual({
      docusignStatus: "The e-sign request has expired",
      colorStatus: "#DC3545",
    });
  });

  it("reports an error in red", () => {
    expect(ContractStatus("error")).toEqual({
      docusignStatus: "An error occurred while processing the document",
      colorStatus: "#DC3545",
    });
  });

  it("falls back to not-yet-initiated in grey", () => {
    expect(ContractStatus(undefined)).toEqual({
      docusignStatus: "The e-sign request is pending and not yet initiated",
      colorStatus: "gray",
    });
  });

  it("falls back for a status it has never seen", () => {
    expect(ContractStatus("voided").colorStatus).toBe("gray");
  });

  it("is case-sensitive", () => {
    expect(ContractStatus("COMPLETED").colorStatus).toBe("gray");
  });

  it("uses the same red for every failure state", () => {
    ["declined", "expired", "error"].forEach((s) =>
      expect(ContractStatus(s).colorStatus).toBe("#DC3545")
    );
  });

  it("never returns undefined, unlike getDocusignStatusBadge", () => {
    // The banner always says something; the row chip hides itself when the
    // contract is signed.
    ["completed", "declined", "pending", "expired", "error", "", undefined].forEach((s) =>
      expect(ContractStatus(s as any)).toBeTruthy()
    );
  });
});
