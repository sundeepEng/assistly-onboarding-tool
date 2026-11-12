/**
 * Leads-table cell formatting — utils/dateUtils.ts
 *
 * `formatDate` renders the "Added" column and `getDaysAgo` renders "Contacted"
 * (components/leads-table.tsx). Both take API strings straight from the record,
 * so they have to cope with missing and malformed values without blanking the row.
 */

import { dateFormat, formatDate, getDaysAgo } from "../../../utils/dateUtils";

describe("formatDate — the 'Added' column", () => {
  it("renders an ISO timestamp as MM/DD/YYYY", () => {
    expect(formatDate("2026-01-15T10:00:00.000Z")).toBe("01/15/2026");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatDate("2026-03-05T00:00:00.000Z")).toBe("03/05/2026");
  });

  it("reads the date in UTC, not the runner's local zone", () => {
    // A late-evening UTC timestamp must not roll back a day for a viewer in a
    // negative offset — the whole table would look a day early.
    expect(formatDate("2026-01-15T23:59:59.000Z")).toBe("01/15/2026");
    expect(formatDate("2026-01-15T00:00:01.000Z")).toBe("01/15/2026");
  });

  it("handles a date-only string", () => {
    expect(formatDate("2026-12-31")).toBe("12/31/2026");
  });

  it("returns NaN placeholders for an unparseable value rather than throwing", () => {
    // Documents the current behaviour: the cell renders "NaN/NaN/NaN" instead of
    // crashing the table. Worth improving, but the row still renders.
    expect(formatDate("not-a-date")).toBe("NaN/NaN/NaN");
  });
});

describe("getDaysAgo — the 'Contacted' column", () => {
  const FIXED_NOW = new Date("2026-02-20T12:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts whole days since the last modification", () => {
    expect(getDaysAgo("2026-02-15T12:00:00.000Z")).toBe("5 days ago");
  });

  it("uses the singular for exactly one day", () => {
    expect(getDaysAgo("2026-02-19T12:00:00.000Z")).toBe("1 day ago");
  });

  it("uses the plural for zero days", () => {
    expect(getDaysAgo("2026-02-20T09:00:00.000Z")).toBe("0 days ago");
  });

  it("prefers modifiedAt over createdAt", () => {
    // A lead created long ago but contacted yesterday must read "1 day ago".
    expect(getDaysAgo("2026-02-19T12:00:00.000Z", "2025-01-01T00:00:00.000Z")).toBe(
      "1 day ago"
    );
  });

  it("falls back to createdAt when the record was never modified", () => {
    expect(getDaysAgo(undefined, "2026-02-10T12:00:00.000Z")).toBe("10 days ago");
  });

  it("reports 0 days when neither date is present", () => {
    // A brand-new row with no timestamps reads as contacted today.
    expect(getDaysAgo(undefined, undefined)).toBe("0 days ago");
  });

  it("returns 'Invalid date' for an unparseable timestamp", () => {
    expect(getDaysAgo("yesterday")).toBe("Invalid date");
  });

  it("returns a positive count for a future date (the difference is absolute)", () => {
    // Clock skew between the API and the browser must not produce "-2 days ago".
    expect(getDaysAgo("2026-02-22T12:00:00.000Z")).toBe("2 days ago");
  });
});

describe("dateFormat — YYYY-MM-DD to MM/DD/YYYY", () => {
  it("reorders a hyphenated date", () => {
    expect(dateFormat("2026-01-15")).toBe("01/15/2026");
  });

  it("passes a non-hyphenated string through untouched", () => {
    expect(dateFormat("01/15/2026")).toBe("01/15/2026");
  });

  it("passes null and undefined through untouched", () => {
    expect(dateFormat(null)).toBeNull();
    expect(dateFormat(undefined)).toBeUndefined();
  });

  it("passes a non-string through untouched", () => {
    expect(dateFormat(20260115)).toBe(20260115);
  });
});
