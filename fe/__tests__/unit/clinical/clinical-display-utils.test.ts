/**
 * Display helpers used across the clinical screens.
 *
 *   getInitials()            the avatar monogram — MedPass By, the carousel,
 *                            EMAR signature columns, every senior card
 *   toTitleCase()            name normalisation
 *   formatUtcToLocalDisplay  the "MedPass By" timestamp under a signer
 *   timeAgo()                relative ages in list views
 *
 * These are small, but they render on every clinical screen and several have
 * sharp edges: `getInitials` indexes into a split array without checking it is
 * non-empty, and `formatUtcToLocalDisplay` converts to the machine's timezone
 * while the value it is given is UTC.
 *
 * Timezone-dependent expectations are derived from the same instant rather than
 * hardcoded, so these pass wherever they run.
 */

import { getInitials, toTitleCase } from "../../../utils/getSignatureUtil";
import {
  dateFormat,
  formatUtcToLocalDisplay,
  timeAgo,
  timeFormat,
} from "../../../utils/dateUtils";

// ─── getInitials ─────────────────────────────────────────────────────────────

describe("getInitials", () => {
  it("takes the first letter of a single name", () => {
    expect(getInitials("Arthur")).toBe("A");
  });

  it("takes both initials of a two-part name", () => {
    expect(getInitials("Arthur Bean")).toBe("AB");
  });

  it("takes the first and last of a three-part name", () => {
    // The middle name is skipped, so "Danny James Ross" is DR, not DJ.
    expect(getInitials("Danny James Ross")).toBe("DR");
  });

  it("takes the first and last of a four-part name", () => {
    expect(getInitials("Ana Maria de Souza")).toBe("AS");
  });

  it("upper-cases a lower-case name", () => {
    expect(getInitials("arthur bean")).toBe("AB");
  });

  it("splits a camelCase name into words", () => {
    expect(getInitials("arthurBean")).toBe("AB");
  });

  it("treats underscores as separators", () => {
    expect(getInitials("arthur_bean")).toBe("AB");
  });

  it("ignores repeated spaces", () => {
    expect(getInitials("Arthur    Bean")).toBe("AB");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("")).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(getInitials(undefined)).toBe("");
  });

  it("returns an empty string for null", () => {
    expect(getInitials(null)).toBe("");
  });

  it("[defect] throws on a name that is only whitespace", () => {
    // `" ".split(" ").filter(Boolean)` is empty, and the function indexes
    // `words[0][0]` without checking length — so a whitespace-only name is a
    // TypeError rather than an empty monogram.
    //
    // Reachable from any record whose `name` was saved as spaces; the clinical
    // schemas do not trim. Pinned as-built; a `if (!words?.length) return ""`
    // guard would close it.
    expect(() => getInitials("   ")).toThrow(TypeError);
  });

  it("handles a name with a trailing space", () => {
    expect(getInitials("Arthur Bean ")).toBe("AB");
  });

  it("handles a hyphenated surname as one word", () => {
    expect(getInitials("Mary Shaw-Bean")).toBe("MS");
  });
});

// ─── toTitleCase ─────────────────────────────────────────────────────────────

describe("toTitleCase", () => {
  it("capitalises each word", () => {
    expect(toTitleCase("arthur bean")).toBe("Arthur Bean");
  });

  it("lower-cases the rest of a shouted name", () => {
    expect(toTitleCase("ARTHUR BEAN")).toBe("Arthur Bean");
  });

  it("collapses repeated spaces", () => {
    expect(toTitleCase("arthur    bean")).toBe("Arthur Bean");
  });

  it("trims the ends", () => {
    expect(toTitleCase("  arthur bean  ")).toBe("Arthur Bean");
  });

  it("returns an empty string for no argument", () => {
    expect(toTitleCase()).toBe("");
  });

  it("returns an empty string for an empty string", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("leaves a single word alone but capitalised", () => {
    expect(toTitleCase("bean")).toBe("Bean");
  });
});

// ─── formatUtcToLocalDisplay ─────────────────────────────────────────────────

describe("formatUtcToLocalDisplay", () => {
  /** The same conversion the helper performs, derived not hardcoded. */
  const expected = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const hours24 = d.getHours();
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${hours12}:${pad(
      d.getMinutes()
    )} ${suffix}`;
  };

  it("renders a UTC timestamp in the viewer's timezone", () => {
    const iso = "2026-08-31T14:30:00.000Z";
    expect(formatUtcToLocalDisplay(iso)).toBe(expected(iso));
  });

  it("renders midnight UTC correctly", () => {
    const iso = "2026-08-31T00:00:00.000Z";
    expect(formatUtcToLocalDisplay(iso)).toBe(expected(iso));
  });

  it("renders noon UTC correctly", () => {
    const iso = "2026-08-31T12:00:00.000Z";
    expect(formatUtcToLocalDisplay(iso)).toBe(expected(iso));
  });

  it("can shift the calendar date west of UTC", () => {
    // 01:00Z on the 31st is still the 30th in the Americas. The MedPass By
    // column therefore shows a different day than the stored timestamp — the
    // same UTC/local split pinned as a defect for the Medication tab.
    const iso = "2026-08-31T01:00:00.000Z";
    const localDay = new Date(iso).getDate();
    const result = formatUtcToLocalDisplay(iso);
    expect(result).toContain(String(localDay).padStart(2, "0"));
  });

  it("returns the em dash for an empty string", () => {
    expect(formatUtcToLocalDisplay("")).toBe("—");
  });

  it("returns the em dash for undefined", () => {
    expect(formatUtcToLocalDisplay(undefined as any)).toBe("—");
  });
});

// ─── timeAgo ─────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  const isoMinutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000).toISOString();

  it("says 'just now' under a minute", () => {
    expect(timeAgo(isoMinutesAgo(0))).toBe("just now");
  });

  it("still says 'just now' at 59 seconds", () => {
    expect(timeAgo(new Date(Date.now() - 59_000).toISOString())).toBe("just now");
  });

  it("switches to minutes at exactly one minute", () => {
    expect(timeAgo(isoMinutesAgo(1))).toBe("1m ago");
  });

  it("abbreviates minutes", () => {
    expect(timeAgo(isoMinutesAgo(5))).toBe("5m ago");
  });

  it("switches to hours at sixty minutes", () => {
    expect(timeAgo(isoMinutesAgo(60))).toBe("1h ago");
  });

  it("abbreviates hours", () => {
    expect(timeAgo(isoMinutesAgo(60 * 3))).toBe("3h ago");
  });

  it("switches to days at twenty-four hours", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24))).toBe("1d ago");
  });

  it("abbreviates days", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24 * 2))).toBe("2d ago");
  });

  it("switches to months at thirty days", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24 * 30))).toBe("1mo ago");
  });

  it("abbreviates months", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24 * 90))).toBe("3mo ago");
  });

  it("switches to years at 365 days", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24 * 365))).toBe("1y ago");
  });

  it("abbreviates years", () => {
    expect(timeAgo(isoMinutesAgo(60 * 24 * 365 * 2))).toBe("2y ago");
  });

  it("counts a month as thirty days, so day 31 reads as a month", () => {
    // 2592000s is exactly 30 days — the boundary is arithmetic, not calendar.
    expect(timeAgo(isoMinutesAgo(60 * 24 * 31))).toBe("1mo ago");
  });

  it("returns a string for a future timestamp rather than throwing", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(typeof timeAgo(future)).toBe("string");
  });

  it("does not throw on an unparseable string", () => {
    expect(() => timeAgo("not-a-date")).not.toThrow();
  });
});

// ─── Malformed input the clinical tables can receive ─────────────────────────
//
// Both formatters are handed values straight from the API. Each has a guard for
// a string that does not split as expected; these pin what comes back so a bad
// record degrades to something printable rather than crashing a table row.

describe("dateFormat — malformed input", () => {
  it("returns the input unchanged when a part is missing", () => {
    // "2026--31" splits to ["2026", "", "31"], so `month` is falsy.
    expect(dateFormat("2026--31")).toBe("2026--31");
  });

  it("returns the input unchanged when there is no day", () => {
    expect(dateFormat("2026-08-")).toBe("2026-08-");
  });

  it("rearranges any hyphenated string into a fake date", () => {
    // The guard only checks that the string CONTAINS a hyphen, then splits on
    // it and reassembles as month/day/year. So "not-a-date" renders as
    // "a/date/not" in a Date column rather than being rejected or passed
    // through. Anything hyphenated and non-date-shaped becomes nonsense that
    // still looks like a date.
    expect(dateFormat("not-a-date")).toBe("a/date/not");
  });

  it("mangles a UK-style date rather than refusing it", () => {
    // Same mechanism, more plausible input: "31-08-2026" becomes "08/2026/31".
    expect(dateFormat("31-08-2026")).toBe("08/2026/31");
  });

  it("returns a string with no hyphens unchanged", () => {
    expect(dateFormat("20260831")).toBe("20260831");
  });

  it("returns undefined unchanged", () => {
    expect(dateFormat(undefined)).toBeUndefined();
  });
});

describe("timeFormat — malformed input", () => {
  it("returns the input unchanged when there is no colon", () => {
    expect(timeFormat("0730")).toBe("0730");
  });

  it("returns the input unchanged when the minutes are missing", () => {
    expect(timeFormat("07:")).toBe("07:");
  });

  it("returns an empty string unchanged", () => {
    expect(timeFormat("")).toBe("");
  });
});
