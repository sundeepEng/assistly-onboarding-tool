/**
 * RevOps — NewPayStubSchema
 *
 *   components/revops/payroll/modals/new-pay-stub-modal.tsx
 *
 * The validation behind New Pay Stub and Edit Pay Stub. Worth pinning at unit
 * level because two of its rules are conditional and one of them is the reason
 * the Cypress form tests are ordered the way they are.
 *
 * THE DATE RANGE IS ONLY REQUIRED FOR A BI-WEEKLY PERIOD
 *   `dateRange` is `z.string().optional()`, and a `superRefine` then demands it
 *   **only** when `periodType === "Bi-Weekly"`. A monthly stub with a stray
 *   date range is accepted, which is how the modal can leave the value behind
 *   when the user switches type.
 *
 * HOURS AND RATE ARE COERCED, NOT PARSED
 *   Both are `z.coerce.number()`, so the strings the read-only inputs hold
 *   ("13.82") pass, but so does anything `Number()` accepts — including "" and
 *   whitespace, which both coerce to 0 rather than failing. Pinned below,
 *   because it means an empty rate produces a $0 pay stub instead of an error.
 */

import { NewPayStubSchema } from "../../../components/revops/payroll/modals/new-pay-stub-modal";

/** A minimal valid monthly pay stub. */
const monthly = (overrides: Record<string, any> = {}): Record<string, any> => ({
  periodType: "Monthly",
  month: "2026-09",
  caregiverId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  hoursWorked: 13.82,
  hourlyRate: 10,
  expenses: [],
  ...overrides,
});

/** A minimal valid bi-weekly pay stub. */
const biWeekly = (overrides: Record<string, any> = {}) =>
  monthly({ periodType: "Bi-Weekly", dateRange: "1-15", ...overrides });

const parse = (input: Record<string, any>) => NewPayStubSchema.safeParse(input);

/** The message zod reported for a field, if any. */
const errorFor = (result: ReturnType<typeof parse>, path: string) => {
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path.join(".") === path)?.message;
};

// ─── The happy paths ─────────────────────────────────────────────────────────

describe("NewPayStubSchema — what it accepts", () => {
  it("accepts a monthly stub", () => {
    expect(parse(monthly()).success).toBe(true);
  });

  it("accepts a bi-weekly stub with its half chosen", () => {
    expect(parse(biWeekly()).success).toBe(true);
  });

  it("accepts the second half of the month", () => {
    expect(parse(biWeekly({ dateRange: "16-30" })).success).toBe(true);
  });

  it("accepts a monthly stub with no dateRange key at all", () => {
    const { dateRange, ...rest } = biWeekly();
    expect(parse({ ...rest, periodType: "Monthly" }).success).toBe(true);
  });

  it("accepts zero hours — a fixed-rate caregiver still gets paid", () => {
    // The John Sparrow case: no shifts logged, full bi-weekly rate owed.
    expect(parse(monthly({ hoursWorked: 0 })).success).toBe(true);
  });

  it("accepts a zero rate", () => {
    expect(parse(monthly({ hourlyRate: 0 })).success).toBe(true);
  });

  it("accepts fractional hours", () => {
    expect(parse(monthly({ hoursWorked: 7.25 })).success).toBe(true);
  });

  it("defaults expenses to an empty array when omitted", () => {
    const { expenses, ...rest } = monthly();
    const result = parse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expenses).toEqual([]);
  });
});

// ─── Period type ─────────────────────────────────────────────────────────────

describe("NewPayStubSchema — the period type", () => {
  it("refuses an empty period type", () => {
    expect(parse(monthly({ periodType: "" })).success).toBe(false);
  });

  it("says a period type is needed", () => {
    expect(errorFor(parse(monthly({ periodType: "" })), "periodType")).toBe(
      "Select pay period type"
    );
  });

  it("refuses a missing period type", () => {
    const { periodType, ...rest } = monthly();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] accepts a period type that is not one of the two", () => {
    // It is a `z.string().min(1)`, not an enum, so "Weekly" passes validation
    // and is then treated as Monthly by the payload builder.
    expect(parse(monthly({ periodType: "Weekly" })).success).toBe(true);
  });
});

// ─── Month ───────────────────────────────────────────────────────────────────

describe("NewPayStubSchema — the month", () => {
  it("refuses an empty month", () => {
    expect(parse(monthly({ month: "" })).success).toBe(false);
  });

  it("says a month is needed", () => {
    expect(errorFor(parse(monthly({ month: "" })), "month")).toBe("Select month");
  });

  it("refuses a missing month", () => {
    const { month, ...rest } = monthly();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] does not check the month's shape", () => {
    // No regex, so "banana" is a valid month as far as the schema is
    // concerned; the payload builder then produces NaN dates from it.
    expect(parse(monthly({ month: "banana" })).success).toBe(true);
  });
});

// ─── The conditional date range ──────────────────────────────────────────────

describe("NewPayStubSchema — the bi-weekly date range", () => {
  it("refuses a bi-weekly stub with no half chosen", () => {
    const { dateRange, ...rest } = biWeekly();
    expect(parse(rest).success).toBe(false);
  });

  it("refuses a bi-weekly stub with an empty half", () => {
    expect(parse(biWeekly({ dateRange: "" })).success).toBe(false);
  });

  it("attributes the complaint to the dateRange field", () => {
    expect(errorFor(parse(biWeekly({ dateRange: "" })), "dateRange")).toBe(
      "Select date range"
    );
  });

  it("does NOT require a date range for a monthly stub", () => {
    expect(parse(monthly({ dateRange: "" })).success).toBe(true);
  });

  it("[as-built] lets a monthly stub carry a leftover date range", () => {
    // Only the Bi-Weekly branch is refined, so a stale "1-15" survives a
    // switch to Monthly. Harmless today because the payload builder ignores it
    // for monthly periods, but it is why the modal clears it by hand.
    expect(parse(monthly({ dateRange: "1-15" })).success).toBe(true);
  });

  it("[as-built] accepts any string as the range", () => {
    expect(parse(biWeekly({ dateRange: "99-100" })).success).toBe(true);
  });

  it("is triggered by the exact UI label, not a code", () => {
    // The refinement compares against "Bi-Weekly"; the backend's "BIWEEKLY"
    // would slip past it.
    const { dateRange, ...rest } = biWeekly();
    expect(parse({ ...rest, periodType: "BIWEEKLY" }).success).toBe(true);
  });
});

// ─── Caregiver ───────────────────────────────────────────────────────────────

describe("NewPayStubSchema — the caregiver", () => {
  it("refuses an empty caregiver", () => {
    expect(parse(monthly({ caregiverId: "" })).success).toBe(false);
  });

  it("says a caregiver is needed", () => {
    expect(errorFor(parse(monthly({ caregiverId: "" })), "caregiverId")).toBe(
      "Select caregiver"
    );
  });

  it("refuses a missing caregiver", () => {
    const { caregiverId, ...rest } = monthly();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] does not require a uuid", () => {
    // Unlike the budget schemas, which use `.uuid()`. A stale or hand-typed id
    // would pass here and fail server-side instead.
    expect(parse(monthly({ caregiverId: "not-a-uuid" })).success).toBe(true);
  });
});

// ─── Hours and rate ──────────────────────────────────────────────────────────

describe("NewPayStubSchema — hours and rate", () => {
  it("coerces a numeric string for hours", () => {
    const result = parse(monthly({ hoursWorked: "13.82" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hoursWorked).toBe(13.82);
  });

  it("coerces a numeric string for the rate", () => {
    const result = parse(monthly({ hourlyRate: "10.50" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hourlyRate).toBe(10.5);
  });

  it("refuses negative hours", () => {
    expect(parse(monthly({ hoursWorked: -1 })).success).toBe(false);
  });

  it("explains that hours cannot be negative", () => {
    expect(errorFor(parse(monthly({ hoursWorked: -1 })), "hoursWorked")).toBe(
      "Hours must be 0 or greater"
    );
  });

  it("refuses a negative rate", () => {
    expect(parse(monthly({ hourlyRate: -5 })).success).toBe(false);
  });

  it("explains that the rate cannot be negative", () => {
    expect(errorFor(parse(monthly({ hourlyRate: -5 })), "hourlyRate")).toBe(
      "Hourly rate must be 0 or greater"
    );
  });

  it("[boundary] accepts exactly zero hours", () => {
    expect(parse(monthly({ hoursWorked: 0 })).success).toBe(true);
  });

  it("[as-built] coerces an empty string to zero rather than refusing it", () => {
    // `Number("")` is 0, so a cleared rate field yields a $0 pay stub with no
    // complaint at all — the most consequential coercion in this schema.
    const result = parse(monthly({ hourlyRate: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hourlyRate).toBe(0);
  });

  it("[as-built] coerces null to zero", () => {
    const result = parse(monthly({ hoursWorked: null }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hoursWorked).toBe(0);
  });

  it("refuses a non-numeric string", () => {
    expect(parse(monthly({ hourlyRate: "ten" })).success).toBe(false);
  });

  it("refuses a missing rate outright", () => {
    // `Number(undefined)` is NaN, which fails the min check.
    const { hourlyRate, ...rest } = monthly();
    expect(parse(rest).success).toBe(false);
  });

  it("accepts a very large rate", () => {
    expect(parse(monthly({ hourlyRate: 1_000_000 })).success).toBe(true);
  });
});

// ─── Expenses ────────────────────────────────────────────────────────────────

describe("NewPayStubSchema — additional expenses", () => {
  const withExpenses = (expenses: any[]) => parse(monthly({ expenses }));

  it("accepts a single expense", () => {
    expect(withExpenses([{ description: "Tips", amount: 50 }]).success).toBe(true);
  });

  it("accepts several expenses", () => {
    expect(
      withExpenses([
        { description: "Tips", amount: 50 },
        { description: "Mileage", amount: 12.4 },
      ]).success
    ).toBe(true);
  });

  it("refuses an expense with no description", () => {
    expect(withExpenses([{ description: "", amount: 50 }]).success).toBe(false);
  });

  it("says the description is required", () => {
    expect(
      errorFor(withExpenses([{ description: "", amount: 50 }]), "expenses.0.description")
    ).toBe("Description is required");
  });

  it("[boundary] refuses a zero amount", () => {
    // The minimum is 0.01, so a free line item cannot be added.
    expect(withExpenses([{ description: "Tips", amount: 0 }]).success).toBe(false);
  });

  it("[boundary] accepts one cent", () => {
    expect(withExpenses([{ description: "Tips", amount: 0.01 }]).success).toBe(true);
  });

  it("says the amount is required when it is zero", () => {
    expect(
      errorFor(withExpenses([{ description: "Tips", amount: 0 }]), "expenses.0.amount")
    ).toBe("Amount is required");
  });

  it("refuses a negative amount — expenses cannot be deductions here", () => {
    expect(withExpenses([{ description: "Advance", amount: -50 }]).success).toBe(false);
  });

  it("coerces a numeric string amount", () => {
    const result = withExpenses([{ description: "Tips", amount: "50" }]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expenses[0].amount).toBe(50);
  });

  it("keeps an existing payout_item_id so an edit does not orphan the row", () => {
    const result = withExpenses([
      { description: "Tips", amount: 50, payout_item_id: "abc-123" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expenses[0].payout_item_id).toBe("abc-123");
  });

  it("does not require a payout_item_id on a new expense", () => {
    expect(withExpenses([{ description: "Tips", amount: 50 }]).success).toBe(true);
  });

  it("reports the index of the offending expense", () => {
    const result = withExpenses([
      { description: "Tips", amount: 50 },
      { description: "", amount: 10 },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["expenses", 1, "description"]);
    }
  });

  it("refuses an expense that is not an object", () => {
    expect(withExpenses(["Tips"]).success).toBe(false);
  });

  it("[as-built] does not cap the number of expenses", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      description: `Item ${i}`,
      amount: 1,
    }));
    expect(withExpenses(many).success).toBe(true);
  });

  it("[as-built] allows two expenses with the same description", () => {
    expect(
      withExpenses([
        { description: "Tips", amount: 10 },
        { description: "Tips", amount: 20 },
      ]).success
    ).toBe(true);
  });
});

// ─── Everything at once ──────────────────────────────────────────────────────

describe("NewPayStubSchema — reporting several problems", () => {
  it("refuses a wholly empty form", () => {
    expect(parse({}).success).toBe(false);
  });

  it("complains about every missing question at once", () => {
    const result = parse({ expenses: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining(["periodType", "month", "caregiverId"])
      );
    }
  });

  it("[as-built] withholds the date range complaint until the rest is valid", () => {
    // `superRefine` runs only after the base object parses, so a bi-weekly
    // form that is missing other answers never mentions the date range. The
    // user fixes everything else, presses Save again, and only then learns
    // there is one more required field.
    const result = parse({ periodType: "Bi-Weekly", expenses: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).not.toContain("dateRange");
      expect(fields).toEqual(
        expect.arrayContaining(["month", "caregiverId", "hoursWorked", "hourlyRate"])
      );
    }
  });

  it("reports the date range once everything else is answered", () => {
    const { dateRange, ...rest } = biWeekly();
    const result = parse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join("."))).toEqual(["dateRange"]);
    }
  });

  it("strips unknown keys rather than refusing them", () => {
    // Not `.strict()`, so the modal can pass extra state through harmlessly.
    const result = parse(monthly({ somethingElse: "ignored" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("somethingElse");
  });
});
