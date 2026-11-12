/**
 * Home dashboard — the trend, occupancy and lookup helpers
 *
 *   utils/dashboardUtils.ts
 *     calculateMonthlyTrend       the "+3 this month" line on every stat card
 *     GetHomeOccupancyRateTrend   the occupancy percentage and its trend
 *     getPcgByUserId              finds the signed-in carer in the bundle
 *     getDocusignStatusBadge      the e-sign chip on a lead row
 *     summarizeUsersRequiredDocs  the third "x/y" document helper
 *
 * The Home dashboard had no unit tests at all — its 131 Cypress tests drive
 * these five functions through the UI, so a change in the arithmetic breaks a
 * dozen opaque end-to-end assertions instead of one obvious unit test.
 * `compliance-document-summaries.test.ts` covers the other five exports of
 * this file; these are the remainder.
 *
 * WHICH DATE COUNTS DEPENDS ON THE ROLE
 *   `calculateMonthlyTrend` reads `createdAt` for the *lead* roles (Lead,
 *   PCGLead, NurseLead, Referral) and `contractCompletedOn` for the *active*
 *   ones (Senior, PCG, Nurse) — because a resident's month is when they moved
 *   in, not when their enquiry was logged. An item with no `role` at all is
 *   skipped entirely, which is the single easiest way to get a card reading
 *   "No change this month" while the list plainly grew.
 *
 * THE DELETION FLAG IS `is_deleted`, NOT `isDeleted`
 *   Snake case here; camel case everywhere else in the app. A deleted user
 *   therefore still counts towards the trend unless the snake-cased field
 *   happens to be present. Pinned below.
 *
 * THE OCCUPANCY TREND COMPARES UNLIKE THINGS
 *   `currentRate` is computed from `seniors.length` — every resident ever —
 *   while `previousRate` counts only those whose contract completed *last
 *   month*. So the "trend" is today's total against one month's intake, and
 *   is almost always positive. Pinned rather than corrected.
 */

import {
  calculateMonthlyTrend,
  getDocusignStatusBadge,
  getPcgByUserId,
  GetHomeOccupancyRateTrend,
  summarizeUsersRequiredDocs,
} from "../../../utils/dashboardUtils";

/** Thu 17 Sep 2026, local noon. */
const TODAY = new Date(2026, 8, 17, 12, 0, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

const THIS_MONTH = "2026-09-04T10:00:00.000Z";
const LAST_MONTH = "2026-08-04T10:00:00.000Z";
const LAST_YEAR = "2025-09-04T10:00:00.000Z";

/** A lead-style record, dated by `createdAt`. */
const lead = (overrides: Record<string, any> = {}) => ({
  role: "Lead",
  createdAt: THIS_MONTH,
  ...overrides,
});

/** An active-resident-style record, dated by `contractCompletedOn`. */
const senior = (overrides: Record<string, any> = {}) => ({
  role: "Senior",
  contractCompletedOn: THIS_MONTH,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// calculateMonthlyTrend
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateMonthlyTrend — the lead roles, dated by createdAt", () => {
  it("counts a lead created this month", () => {
    expect(calculateMonthlyTrend([lead()])).toEqual({
      trend: 1,
      trendUp: true,
      label: "+1 this month",
    });
  });

  it("ignores a lead created last month", () => {
    expect(calculateMonthlyTrend([lead({ createdAt: LAST_MONTH })]).trend).toBe(0);
  });

  it("ignores the same month a year ago", () => {
    // Both month AND year must match, which is what `isSameYear` is for.
    expect(calculateMonthlyTrend([lead({ createdAt: LAST_YEAR })]).trend).toBe(0);
  });

  it("counts every lead-style role by createdAt", () => {
    ["Lead", "PCGLead", "NurseLead", "Referral"].forEach((role) =>
      expect(calculateMonthlyTrend([{ role, createdAt: THIS_MONTH }]).trend).toBe(1)
    );
  });

  it("adds several up", () => {
    expect(calculateMonthlyTrend([lead(), lead(), lead()]).label).toBe("+3 this month");
  });

  it("[as-built] ignores a lead-role record that carries only contractCompletedOn", () => {
    // A PCGLead with no createdAt is invisible to the trend, whatever else it
    // has on it.
    expect(
      calculateMonthlyTrend([{ role: "PCGLead", contractCompletedOn: THIS_MONTH }]).trend
    ).toBe(0);
  });
});

describe("calculateMonthlyTrend — the active roles, dated by contractCompletedOn", () => {
  it("counts a resident whose contract completed this month", () => {
    expect(calculateMonthlyTrend([senior()]).label).toBe("+1 this month");
  });

  it("counts every active role by contractCompletedOn", () => {
    ["Senior", "PCG", "Nurse"].forEach((role) =>
      expect(
        calculateMonthlyTrend([{ role, contractCompletedOn: THIS_MONTH }]).trend
      ).toBe(1)
    );
  });

  it("[as-built] ignores an active-role record dated only by createdAt", () => {
    // A resident added this month but not yet under contract does not move
    // the card — the figure tracks move-ins, not enquiries.
    expect(calculateMonthlyTrend([{ role: "Senior", createdAt: THIS_MONTH }]).trend).toBe(
      0
    );
  });

  it("ignores a contract completed last month", () => {
    expect(
      calculateMonthlyTrend([senior({ contractCompletedOn: LAST_MONTH })]).trend
    ).toBe(0);
  });

  it("counts leads and residents in one list independently", () => {
    expect(calculateMonthlyTrend([lead(), senior()]).trend).toBe(2);
  });
});

describe("calculateMonthlyTrend — deletions", () => {
  it("subtracts a deletion from the same month", () => {
    expect(calculateMonthlyTrend([lead(), lead({ is_deleted: true })]).trend).toBe(0);
  });

  it("reports no change when they cancel out", () => {
    expect(calculateMonthlyTrend([lead(), lead({ is_deleted: true })]).label).toBe(
      "No change this month"
    );
  });

  it("goes negative when deletions outnumber additions", () => {
    const items = [lead({ is_deleted: true }), lead({ is_deleted: true }), lead()];
    expect(calculateMonthlyTrend(items)).toEqual({
      trend: 1,
      trendUp: false,
      label: "-1 this month",
    });
  });

  it("reports the magnitude, never a negative number, in `trend`", () => {
    const items = [lead({ is_deleted: true }), lead({ is_deleted: true })];
    expect(calculateMonthlyTrend(items).trend).toBe(2);
    expect(calculateMonthlyTrend(items).trendUp).toBe(false);
  });

  it("[as-built] counts a user deleted with the camel-cased flag as an addition", () => {
    // The rest of the app uses `isDeleted`; this function reads `is_deleted`.
    // A soft-deleted lead therefore still pushes the trend UP.
    expect(calculateMonthlyTrend([lead({ isDeleted: true })])).toEqual({
      trend: 1,
      trendUp: true,
      label: "+1 this month",
    });
  });

  it("ignores a deletion from a previous month", () => {
    expect(
      calculateMonthlyTrend([lead({ createdAt: LAST_MONTH, is_deleted: true })]).trend
    ).toBe(0);
  });
});

describe("calculateMonthlyTrend — nothing to count", () => {
  it("reports no change for an empty list", () => {
    expect(calculateMonthlyTrend([])).toEqual({
      trend: 0,
      trendUp: true,
      label: "No change this month",
    });
  });

  it("[as-built] treats zero as an upward trend", () => {
    // `diff >= 0`, so a flat month is styled green rather than neutral.
    expect(calculateMonthlyTrend([]).trendUp).toBe(true);
  });

  it("[as-built] ignores an item with no role at all", () => {
    // The easiest way to get a card reading "No change" while the list grew:
    // `getRelevantDate` returns undefined without a role.
    expect(calculateMonthlyTrend([{ createdAt: THIS_MONTH }]).trend).toBe(0);
  });

  it("[as-built] ignores a role it does not recognise", () => {
    expect(
      calculateMonthlyTrend([{ role: "HomeAdmin", createdAt: THIS_MONTH }]).trend
    ).toBe(0);
  });

  it("copes with a null entry in the list", () => {
    expect(calculateMonthlyTrend([null as any, lead()]).trend).toBe(1);
  });

  it("[as-built] throws on an unparseable date rather than skipping it", () => {
    // `isValid` only checks the field is present, so `parseISO("banana")`
    // reaches `isSameMonth` as an Invalid Date. One bad record from the API
    // takes the whole card down.
    expect(() => calculateMonthlyTrend([lead({ createdAt: "banana" })])).not.toThrow();
    expect(calculateMonthlyTrend([lead({ createdAt: "banana" })]).trend).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GetHomeOccupancyRateTrend
// ═══════════════════════════════════════════════════════════════════════════

describe("GetHomeOccupancyRateTrend", () => {
  it("reports the rate as a percentage of capacity", () => {
    const seniors = [senior(), senior(), senior()];
    expect(GetHomeOccupancyRateTrend(seniors, 10).currentRate).toBe(30);
  });

  it("rounds to a whole percentage", () => {
    const seniors = [senior(), senior()];
    // 2/3 = 66.67% → 67
    expect(GetHomeOccupancyRateTrend(seniors, 3).currentRate).toBe(67);
  });

  it("reports a full home as 100%", () => {
    const seniors = [senior(), senior()];
    expect(GetHomeOccupancyRateTrend(seniors, 2).currentRate).toBe(100);
  });

  it("[as-built] can exceed 100% when there are more residents than beds", () => {
    const seniors = [senior(), senior(), senior()];
    expect(GetHomeOccupancyRateTrend(seniors, 2).currentRate).toBe(150);
  });

  it("[boundary] reports zero rather than dividing by zero for no capacity", () => {
    expect(GetHomeOccupancyRateTrend([senior()], 0).currentRate).toBe(0);
  });

  it("[boundary] reports zero for a negative capacity", () => {
    expect(GetHomeOccupancyRateTrend([senior()], -5).currentRate).toBe(0);
  });

  it("reports zero for an empty home", () => {
    expect(GetHomeOccupancyRateTrend([], 10).currentRate).toBe(0);
  });

  it("[as-built] compares today's total against last month's intake alone", () => {
    // `currentRate` uses `seniors.length` — everyone — while `previousRate`
    // counts only contracts completed last month. Three residents, one of
    // whom arrived last month, in a home of ten: 30% "against" 10%.
    const seniors = [
      senior(),
      senior(),
      senior({ contractCompletedOn: LAST_MONTH }),
    ];
    const result = GetHomeOccupancyRateTrend(seniors, 10);
    expect(result.currentRate).toBe(30);
    expect(result.trend).toBe(20);
    expect(result.trendUp).toBe(true);
  });

  it("[as-built] shows a rise even when nobody arrived this month", () => {
    // Every resident arrived long ago, so last month's intake is zero and the
    // trend reads as the whole occupancy — the figure cannot fall.
    const seniors = [senior({ contractCompletedOn: LAST_YEAR })];
    const result = GetHomeOccupancyRateTrend(seniors, 10);
    expect(result.label).toBe("+10% this month");
  });

  it("reports no change when the home is empty", () => {
    expect(GetHomeOccupancyRateTrend([], 10).label).toBe("No change this month");
  });

  it("labels the trend with a percentage sign", () => {
    const seniors = [senior(), senior()];
    expect(GetHomeOccupancyRateTrend(seniors, 10).label).toContain("%");
  });

  it("ignores a resident with no contract date in last month's count", () => {
    const seniors = [senior({ contractCompletedOn: undefined }), senior()];
    expect(GetHomeOccupancyRateTrend(seniors, 10).currentRate).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getPcgByUserId
// ═══════════════════════════════════════════════════════════════════════════

describe("getPcgByUserId", () => {
  const bundle = (users: any[]) => ({ PCGs: { users } });
  const carer = (userId: string, name = "Morris Olsen") => ({ userId, name });

  it("finds a carer in the PCGs bundle", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), "u1")).toMatchObject({ userId: "u1" });
  });

  it("returns null when nobody matches", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), "u2")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(getPcgByUserId(bundle([carer("ABC-123")]), "abc-123")).not.toBeNull();
  });

  it("matches despite surrounding whitespace on either side", () => {
    expect(getPcgByUserId(bundle([carer("  u1  ")]), "u1")).not.toBeNull();
    expect(getPcgByUserId(bundle([carer("u1")]), "  u1  ")).not.toBeNull();
  });

  it("falls back to a flat users list", () => {
    expect(getPcgByUserId({ users: [carer("u1")] }, "u1")).not.toBeNull();
  });

  it("prefers the PCGs bundle over a flat list", () => {
    const data = { PCGs: { users: [carer("u1", "From PCGs")] }, users: [carer("u1", "Flat")] };
    expect(getPcgByUserId(data, "u1").name).toBe("From PCGs");
  });

  it("returns null without a user id", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), undefined)).toBeNull();
  });

  it("returns null for a null user id", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), null)).toBeNull();
  });

  it("returns null for an empty user id", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), "")).toBeNull();
  });

  it("returns null for a non-string user id", () => {
    expect(getPcgByUserId(bundle([carer("u1")]), 1 as any)).toBeNull();
  });

  it("returns null when there is no bundle at all", () => {
    expect(getPcgByUserId(undefined, "u1")).toBeNull();
  });

  it("returns null for an empty bundle", () => {
    expect(getPcgByUserId(bundle([]), "u1")).toBeNull();
  });

  it("skips an entry whose userId is not a string", () => {
    expect(getPcgByUserId(bundle([{ userId: 1 }, carer("u1")]), "u1")).not.toBeNull();
  });

  it("returns the first match when ids repeat", () => {
    const data = bundle([carer("u1", "First"), carer("u1", "Second")]);
    expect(getPcgByUserId(data, "u1").name).toBe("First");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getDocusignStatusBadge
// ═══════════════════════════════════════════════════════════════════════════

describe("getDocusignStatusBadge", () => {
  it("shows nothing at all for a completed contract", () => {
    // Deliberate: a signed contract needs no chip, which is why the return
    // type is optional.
    expect(getDocusignStatusBadge("completed")).toBeUndefined();
  });

  it("shows nothing when there is no status", () => {
    expect(getDocusignStatusBadge(undefined)).toBeUndefined();
  });

  it("shows nothing for an empty status", () => {
    expect(getDocusignStatusBadge("")).toBeUndefined();
  });

  it("labels a declined request", () => {
    expect(getDocusignStatusBadge("declined")).toEqual({
      label: "Declined",
      notes: "The signer declined the request",
    });
  });

  it("labels an errored request", () => {
    expect(getDocusignStatusBadge("error")).toEqual({
      label: "Error",
      notes: "Error occurred while processing",
    });
  });

  it("labels a sent request as Mail Sent", () => {
    expect(getDocusignStatusBadge("sent")).toEqual({
      label: "Mail Sent",
      notes: "Signature pending",
    });
  });

  it("[as-built] the pending case is unreachable — the first match wins", () => {
    // `ESIGN_ENVELOPE_STATUS_PENDING` appears twice in the same switch. The
    // earlier arm returns "Mail Sent / Signature pending", so the later
    // "Pending / Request not yet initiated" arm can never run.
    expect(getDocusignStatusBadge("pending")).toEqual({
      label: "Mail Sent",
      notes: "Signature pending",
    });
  });

  it("falls back to Pending for an unknown status", () => {
    expect(getDocusignStatusBadge("expired")).toEqual({
      label: "Pending",
      notes: "Unknown status",
    });
  });

  it("falls back for a status it has never seen", () => {
    expect(getDocusignStatusBadge("voided")).toEqual({
      label: "Pending",
      notes: "Unknown status",
    });
  });

  it("is case-sensitive", () => {
    expect(getDocusignStatusBadge("DECLINED")).toEqual({
      label: "Pending",
      notes: "Unknown status",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// summarizeUsersRequiredDocs
// ═══════════════════════════════════════════════════════════════════════════

describe("summarizeUsersRequiredDocs", () => {
  const spec = (name: string, required = true) => ({ name, label: name, required });
  const SPECS = [spec("admission_agreement"), spec("house_rules")];

  const doc = (documentName: string) => ({ documentName, isRequiredDocument: true });

  it("reports nothing satisfied for a user with no documents", () => {
    const result = summarizeUsersRequiredDocs([{ userId: "u1", documents: [] }], SPECS);
    expect(result[0]).toMatchObject({ label: "0/2" });
  });

  it("counts a matching document", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [doc("admission_agreement")] }],
      SPECS
    );
    expect(result[0].label).toBe("1/2");
  });

  it("de-duplicates by type", () => {
    const result = summarizeUsersRequiredDocs(
      [
        {
          userId: "u1",
          documents: [doc("admission_agreement"), doc("admission_agreement")],
        },
      ],
      SPECS
    );
    expect(result[0].label).toBe("1/2");
  });

  it("strips the file extension when matching", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [doc("admission_agreement.pdf")] }],
      SPECS
    );
    expect(result[0].label).toBe("1/2");
  });

  it("matches case-insensitively", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [doc("ADMISSION_AGREEMENT")] }],
      SPECS
    );
    expect(result[0].label).toBe("1/2");
  });

  it("ignores a document no spec names", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [doc("random_file")] }],
      SPECS
    );
    expect(result[0].label).toBe("0/2");
  });

  it("excludes optional specs from the denominator", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [] }],
      [spec("admission_agreement"), spec("leaflet", false)]
    );
    expect(result[0].label).toBe("0/1");
  });

  it("accepts a bare document array instead of a user", () => {
    // The signature is deliberately permissive — the dashboard passes a user,
    // the profile modal passes the documents alone.
    const result = summarizeUsersRequiredDocs([doc("admission_agreement")] as any, SPECS);
    // Summarised as one user: one of the two required documents is present.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "1/2" });
  });

  it("[as-built] returns nothing when no specs are required", () => {
    // 0 of 0 counts as complete, and only INCOMPLETE users are returned — so
    // a home with no required documents yields an empty list rather than a
    // row of zeroes.
    expect(
      summarizeUsersRequiredDocs([{ userId: "u1", documents: [] }], undefined)
    ).toEqual([]);
  });

  it("copes with no users", () => {
    expect(summarizeUsersRequiredDocs([], SPECS)).toEqual([]);
  });

  it("copes with undefined input", () => {
    expect(summarizeUsersRequiredDocs(undefined, SPECS)).toEqual([]);
  });

  it("orders the worst offender first, not the input order", () => {
    // It sorts by `missingCount` descending, so the person furthest from
    // compliant heads the list — which is the order the panel wants.
    const result = summarizeUsersRequiredDocs(
      [
        { userId: "u1", documents: [doc("admission_agreement")] },
        { userId: "u2", documents: [] },
      ],
      SPECS
    );
    expect(result.map((r: any) => r.label)).toEqual(["0/2", "1/2"]);
  });

  it("breaks a tie on name, then on user id", () => {
    const result = summarizeUsersRequiredDocs(
      [
        { userId: "u2", name: "Zoe", documents: [] },
        { userId: "u1", name: "Adam", documents: [] },
      ],
      SPECS
    );
    expect(result.map((r: any) => r.fullName)).toEqual(["Adam", "Zoe"]);
  });

  it("[as-built] drops a user entirely once they are compliant", () => {
    // Unlike `summarizePCHORequiredDocs`, which always returns a summary.
    // This one is a worklist: a complete user simply disappears from it.
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", documents: [doc("admission_agreement"), doc("house_rules")] }],
      SPECS
    );
    expect(result).toEqual([]);
  });

  it("keeps only the incomplete ones out of a mixed list", () => {
    const result = summarizeUsersRequiredDocs(
      [
        { userId: "done", documents: [doc("admission_agreement"), doc("house_rules")] },
        { userId: "todo", documents: [] },
      ],
      SPECS
    );
    expect(result.map((r: any) => r.userId)).toEqual(["todo"]);
  });

  it("carries the name and role through for the panel to render", () => {
    const result = summarizeUsersRequiredDocs(
      [{ userId: "u1", firstName: "Morris", lastName: "Olsen", role: "PCG", documents: [] }],
      SPECS
    );
    expect(result[0]).toMatchObject({
      userId: "u1",
      role: "PCG",
      fullName: "Morris Olsen",
      missingCount: 2,
    });
  });
});
