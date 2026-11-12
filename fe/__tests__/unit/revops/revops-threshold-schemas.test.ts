/**
 * RevOps — the budget threshold schemas
 *
 *   model/home/home-model.ts   AddThresholdFormSchema, ExpenseThresholdItemSchema,
 *                              BudgetThresholdsSchema
 *
 * A threshold is a spending cap. It is stored on the HOME rather than in its
 * own table, keyed `thresholds[year][monthAbbr][category]`, which is why these
 * schemas live in the home model and why saving one is a `PUT /v1/home`
 * carrying the whole record.
 *
 * TWO SCHEMAS FOR THE SAME THING, AND THEY DISAGREE
 *   `AddThresholdFormSchema` validates what the FORM collects — it has
 *   `category` and `month` fields because the form asks for them. The stored
 *   shape has neither: `ExpenseThresholdItemSchema` is just name, amount and
 *   the enabled flag, because category and month are the keys it is filed
 *   under. A test that expects the two to match will be confused; they are
 *   deliberately different, and both are pinned here.
 *
 * `fixedAmount` IS A STRICT NUMBER, NOT COERCED
 *   Unlike `BudgetSchema`, which coerces `amount_cents`, both threshold
 *   schemas require a real number. The form's number input yields a string, so
 *   the component converts with `parseFloat` before submitting — and a form
 *   left at its default passes only because `defaultValues` seeds a numeric 0.
 */

import {
  AddThresholdFormSchema,
  BudgetThresholdsSchema,
  ExpenseThresholdItemSchema,
} from "../../../model/home/home-model";

const formInput = (overrides: Record<string, any> = {}) => ({
  thresholdName: "Groceries Cap",
  category: "groceries",
  month: "2026-09",
  fixedAmount: 1000,
  isEnabled: true,
  ...overrides,
});

const storedItem = (overrides: Record<string, any> = {}) => ({
  thresholdName: "Groceries Cap",
  fixedAmount: 1000,
  isEnabled: true,
  ...overrides,
});

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// ═══════════════════════════════════════════════════════════════════════════
// The Add Threshold form
// ═══════════════════════════════════════════════════════════════════════════

describe("AddThresholdFormSchema — what it accepts", () => {
  it("accepts a complete threshold", () => {
    expect(AddThresholdFormSchema.safeParse(formInput()).success).toBe(true);
  });

  it("accepts a disabled threshold", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ isEnabled: false })).success
    ).toBe(true);
  });

  it("defaults isEnabled to true when omitted", () => {
    const { isEnabled, ...rest } = formInput();
    const result = AddThresholdFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });

  it("[boundary] accepts a cap of exactly zero", () => {
    // A zero cap is meaningful: it means "spend nothing here". The alerts
    // helper then skips it, because `if (thresholdAmount <= 0) return`.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: 0 })).success
    ).toBe(true);
  });

  it("accepts a fractional cap", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: 1500.5 })).success
    ).toBe(true);
  });

  it("accepts a very large cap", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: 1_000_000 })).success
    ).toBe(true);
  });

  it("strips unknown keys rather than refusing them", () => {
    const result = AddThresholdFormSchema.safeParse(formInput({ stray: "ignored" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("stray");
  });
});

describe("AddThresholdFormSchema — the name", () => {
  it("refuses an empty name", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ thresholdName: "" })).success
    ).toBe(false);
  });

  it("says the name is required", () => {
    expect(
      messageFor(
        AddThresholdFormSchema.safeParse(formInput({ thresholdName: "" })),
        "thresholdName"
      )
    ).toBe("Threshold Name is required");
  });

  it("refuses a missing name", () => {
    const { thresholdName, ...rest } = formInput();
    expect(AddThresholdFormSchema.safeParse(rest).success).toBe(false);
  });

  it("[as-built] accepts a name of only spaces", () => {
    // `nonempty` checks length, not content, so "   " is a valid name and the
    // threshold appears in the table with a blank-looking label.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ thresholdName: "   " })).success
    ).toBe(true);
  });

  it("[as-built] does not cap the name's length", () => {
    expect(
      AddThresholdFormSchema.safeParse(
        formInput({ thresholdName: "x".repeat(500) })
      ).success
    ).toBe(true);
  });
});

describe("AddThresholdFormSchema — the category", () => {
  it("refuses an empty category", () => {
    expect(AddThresholdFormSchema.safeParse(formInput({ category: "" })).success).toBe(
      false
    );
  });

  it("says the category is required", () => {
    expect(
      messageFor(AddThresholdFormSchema.safeParse(formInput({ category: "" })), "category")
    ).toBe("Category is required");
  });

  it("refuses a missing category", () => {
    const { category, ...rest } = formInput();
    expect(AddThresholdFormSchema.safeParse(rest).success).toBe(false);
  });

  it("[as-built] is a plain string, not an enum of the six expense categories", () => {
    // So "rent" validates even though the dropdown never offers it, and the
    // budget screen would then file a cap nothing can ever match.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ category: "rent" })).success
    ).toBe(true);
  });

  it("[as-built] accepts either case, though the component lower-cases on save", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ category: "GROCERIES" })).success
    ).toBe(true);
  });
});

describe("AddThresholdFormSchema — the month", () => {
  it("refuses an empty month", () => {
    expect(AddThresholdFormSchema.safeParse(formInput({ month: "" })).success).toBe(
      false
    );
  });

  it("says the month is required", () => {
    expect(
      messageFor(AddThresholdFormSchema.safeParse(formInput({ month: "" })), "month")
    ).toBe("Month is required");
  });

  it("refuses a missing month", () => {
    const { month, ...rest } = formInput();
    expect(AddThresholdFormSchema.safeParse(rest).success).toBe(false);
  });

  it("[as-built] does not check the month's shape", () => {
    // The component splits on "-" and indexes MONTH_ABBR, so a malformed
    // month yields `thresholds[undefined]` rather than a rejection.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ month: "September" })).success
    ).toBe(true);
  });
});

describe("AddThresholdFormSchema — the amount", () => {
  it("refuses a negative cap", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: -1 })).success
    ).toBe(false);
  });

  it("explains that the cap cannot be negative", () => {
    expect(
      messageFor(
        AddThresholdFormSchema.safeParse(formInput({ fixedAmount: -1 })),
        "fixedAmount"
      )
    ).toBe("Fixed Amount must be 0 or greater");
  });

  it("refuses a string — this schema does not coerce", () => {
    // The contrast with `BudgetSchema`, which uses `z.coerce.number()`. The
    // component has to `parseFloat` before it submits.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: "1000" })).success
    ).toBe(false);
  });

  it("says the cap must be a number", () => {
    expect(
      messageFor(
        AddThresholdFormSchema.safeParse(formInput({ fixedAmount: "1000" })),
        "fixedAmount"
      )
    ).toBe("Fixed Amount must be a number");
  });

  it("refuses a missing amount", () => {
    const { fixedAmount, ...rest } = formInput();
    expect(AddThresholdFormSchema.safeParse(rest).success).toBe(false);
  });

  it("refuses NaN", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: NaN })).success
    ).toBe(false);
  });

  it("[as-built] accepts Infinity", () => {
    // `.min(0)` is satisfied by Infinity, so an uncapped cap is storable.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ fixedAmount: Infinity })).success
    ).toBe(true);
  });
});

describe("AddThresholdFormSchema — the enabled flag", () => {
  it("refuses a non-boolean", () => {
    expect(
      AddThresholdFormSchema.safeParse(formInput({ isEnabled: "yes" })).success
    ).toBe(false);
  });

  it("[as-built] refuses null rather than defaulting it", () => {
    // `.default()` only fills in for `undefined`; an explicit null fails.
    expect(
      AddThresholdFormSchema.safeParse(formInput({ isEnabled: null })).success
    ).toBe(false);
  });
});

describe("AddThresholdFormSchema — an empty form", () => {
  it("refuses it", () => {
    expect(AddThresholdFormSchema.safeParse({}).success).toBe(false);
  });

  it("complains about all four required questions at once", () => {
    const result = AddThresholdFormSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual([
        "category",
        "fixedAmount",
        "month",
        "thresholdName",
      ]);
    }
  });

  it("does not complain about isEnabled, which has a default", () => {
    const result = AddThresholdFormSchema.safeParse({});
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).not.toContain("isEnabled");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The stored shape
// ═══════════════════════════════════════════════════════════════════════════

describe("ExpenseThresholdItemSchema — the stored threshold", () => {
  it("accepts a stored threshold", () => {
    expect(ExpenseThresholdItemSchema.safeParse(storedItem()).success).toBe(true);
  });

  it("carries no category — that is the key it is filed under", () => {
    const result = ExpenseThresholdItemSchema.safeParse(
      storedItem({ category: "groceries" })
    );
    expect(result.success).toBe(false);
  });

  it("carries no month either", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ month: "2026-09" })).success
    ).toBe(false);
  });

  it("is strict — an unknown key is refused, not stripped", () => {
    // Unlike the form schema. The home record is validated on the way in, so a
    // stray field would corrupt the stored shape rather than be ignored.
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ stray: 1 })).success
    ).toBe(false);
  });

  it("accepts optional audit timestamps", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(
        storedItem({
          createdAt: "2026-09-01T10:00:00.000Z",
          modifiedAt: "2026-09-02T10:00:00.000Z",
        })
      ).success
    ).toBe(true);
  });

  it("refuses a createdAt that is not a datetime", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ createdAt: "2026-09-01" }))
        .success
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ thresholdName: "" })).success
    ).toBe(false);
  });

  it("requires a non-negative amount", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ fixedAmount: -1 })).success
    ).toBe(false);
  });

  it("defaults isEnabled to true", () => {
    const { isEnabled, ...rest } = storedItem();
    const result = ExpenseThresholdItemSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });

  it("does not coerce the amount from a string", () => {
    expect(
      ExpenseThresholdItemSchema.safeParse(storedItem({ fixedAmount: "1000" })).success
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The year → month → category tree
// ═══════════════════════════════════════════════════════════════════════════

describe("BudgetThresholdsSchema — the stored tree", () => {
  /**
   * The tree is nested under a `thresholds` key, and that key is `.optional()`
   * on a non-strict object — so handing this schema the bare
   * `{ "2026": … }` tree passes VACUOUSLY: the year is stripped as an unknown
   * key and the absent `thresholds` is fine. Every assertion below wraps
   * properly, and the first test pins the trap.
   */
  const wrap = (tree: Record<string, any>) => ({ thresholds: tree });
  const tree = () => ({ "2026": { sep: { groceries: storedItem() } } });

  it("[trap] accepts the bare tree without validating any of it", () => {
    const rubbish = { "2026": { sep: { rent: { nonsense: true } } } };
    expect(BudgetThresholdsSchema.safeParse(rubbish).success).toBe(true);
    expect(BudgetThresholdsSchema.safeParse(wrap(rubbish)).success).toBe(false);
  });

  it("accepts a year holding a month holding a category", () => {
    expect(BudgetThresholdsSchema.safeParse(wrap(tree())).success).toBe(true);
  });

  it("accepts a home with no caps set at all", () => {
    expect(BudgetThresholdsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts an empty tree", () => {
    expect(BudgetThresholdsSchema.safeParse(wrap({})).success).toBe(true);
  });

  it("accepts several categories in one month", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({
          "2026": {
            sep: {
              groceries: storedItem(),
              utilities: storedItem({ thresholdName: "Power Cap" }),
            },
          },
        })
      ).success
    ).toBe(true);
  });

  it("accepts several months in one year", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({
          "2026": { sep: { groceries: storedItem() }, oct: { medical: storedItem() } },
        })
      ).success
    ).toBe(true);
  });

  it("accepts several years", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({
          "2025": { dec: { groceries: storedItem() } },
          "2026": { sep: { groceries: storedItem() } },
        })
      ).success
    ).toBe(true);
  });

  it("accepts all six expense categories", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({
          "2026": {
            sep: {
              groceries: storedItem(),
              utilities: storedItem(),
              entertainment: storedItem(),
              transport: storedItem(),
              medical: storedItem(),
              misc: storedItem(),
            },
          },
        })
      ).success
    ).toBe(true);
  });

  it("refuses a category outside the six", () => {
    // The month object is `.strict()`, so this is the one place a category IS
    // constrained — the form schema lets any string through.
    expect(
      BudgetThresholdsSchema.safeParse(wrap({ "2026": { sep: { rent: storedItem() } } }))
        .success
    ).toBe(false);
  });

  it("[as-built] cannot cap payroll, though the expense side reports it", () => {
    // Payroll is derived from the pay stubs rather than entered, so the
    // Overview shows a Payroll row that no threshold can ever govern.
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({ "2026": { sep: { payroll: storedItem() } } })
      ).success
    ).toBe(false);
  });

  it("refuses a month name outside the twelve abbreviations", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({ "2026": { september: { groceries: storedItem() } } })
      ).success
    ).toBe(false);
  });

  it("refuses a year that is not four digits", () => {
    expect(
      BudgetThresholdsSchema.safeParse(wrap({ "26": { sep: { groceries: storedItem() } } }))
        .success
    ).toBe(false);
  });

  it("refuses a malformed threshold inside an otherwise valid tree", () => {
    expect(
      BudgetThresholdsSchema.safeParse(
        wrap({ "2026": { sep: { groceries: { thresholdName: "Cap" } } } })
      ).success
    ).toBe(false);
  });

  it("reports the full path to the offending threshold", () => {
    const result = BudgetThresholdsSchema.safeParse(
      wrap({ "2026": { sep: { groceries: storedItem({ fixedAmount: -5 }) } } })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual([
        "thresholds",
        "2026",
        "sep",
        "groceries",
        "fixedAmount",
      ]);
    }
  });
});
