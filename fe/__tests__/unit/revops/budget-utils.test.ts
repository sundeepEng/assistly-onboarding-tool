/**
 * Budget helpers — utils/budget-utils.ts
 *
 * These drive the Budget screen's period picker, its threshold table and its
 * alert list. Everything here is pure, but most of it is *time-dependent*, so
 * the clock is frozen to 2026-02-13T12:00:00Z. That instant is deliberately
 * mid-day and mid-month: every timezone from UTC-12 to UTC+14 still reads it as
 * February 2026, so the assertions do not depend on where the suite runs.
 */

import {
  ALL_EXPENSE_CATEGORY_KEYS,
  ALL_INCOME_CATEGORY_KEYS,
  BUDGET_CATEGORY_COLORS,
  extractThresholds,
  formatCategoryName,
  formatCurrency,
  generateBudgetAlerts,
  getCategoryColor,
  getCurrentPeriod,
  getDateRange,
  getLast6MonthsOptions,
  getMonthYear,
  getQuarterlyOptions,
  MONTH_ABBR,
  snakeToCamel,
} from "../../../utils/budget-utils";
import { makeDashboardMetrics, makeHomeWithThresholds } from "../../test-utils/factories";

/** Mid-day, mid-month — see the file header. */
const FROZEN_NOW = new Date("2026-02-13T12:00:00.000Z");

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

// ─── getDateRange ────────────────────────────────────────────────────────────

describe("getDateRange", () => {
  describe("monthly (periodType = false)", () => {
    it("spans the first to the last day of the month", () => {
      expect(getDateRange(false, "2026-03")).toEqual({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      });
    });

    it("ends on the 30th for a 30-day month", () => {
      expect(getDateRange(false, "2026-04")).toEqual({
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      });
    });

    it("ends on the 28th for a non-leap February", () => {
      expect(getDateRange(false, "2026-02").endDate).toBe("2026-02-28");
    });

    it("ends on the 29th for a leap February", () => {
      expect(getDateRange(false, "2024-02").endDate).toBe("2024-02-29");
    });

    it("handles December without rolling into the next year", () => {
      expect(getDateRange(false, "2026-12")).toEqual({
        startDate: "2026-12-01",
        endDate: "2026-12-31",
      });
    });
  });

  describe("quarterly (periodType = true)", () => {
    it.each([
      ["2026-Q1", "2026-01-01", "2026-03-31"],
      ["2026-Q2", "2026-04-01", "2026-06-30"],
      ["2026-Q3", "2026-07-01", "2026-09-30"],
      ["2026-Q4", "2026-10-01", "2026-12-31"],
    ])("%s spans %s to %s", (period, startDate, endDate) => {
      expect(getDateRange(true, period)).toEqual({ startDate, endDate });
    });

    it("ends Q1 on the 29th in a leap year — the quarter ends in March, not February", () => {
      expect(getDateRange(true, "2024-Q1").endDate).toBe("2024-03-31");
    });
  });

  it("returns empty strings when no period is selected", () => {
    expect(getDateRange(false, "")).toEqual({ startDate: "", endDate: "" });
    expect(getDateRange(true, "")).toEqual({ startDate: "", endDate: "" });
  });
});

// ─── Period option builders ──────────────────────────────────────────────────

describe("getLast6MonthsOptions", () => {
  it("returns nine options — three future months then six ending with the current one", () => {
    expect(getLast6MonthsOptions()).toHaveLength(9);
  });

  it("leads with the three upcoming months, furthest first", () => {
    const values = getLast6MonthsOptions().map((o) => o.value);
    expect(values.slice(0, 3)).toEqual(["2026-05", "2026-04", "2026-03"]);
  });

  it("puts the current month at index 3, then walks backwards", () => {
    const values = getLast6MonthsOptions().map((o) => o.value);
    expect(values.slice(3)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
    ]);
  });

  it("labels each option in Month YYYY form", () => {
    const options = getLast6MonthsOptions();
    expect(options.find((o) => o.value === "2026-02")?.option).toBe("February 2026");
    expect(options.find((o) => o.value === "2025-12")?.option).toBe("December 2025");
  });

  it("produces values that getDateRange can consume", () => {
    getLast6MonthsOptions().forEach(({ value }) => {
      const { startDate, endDate } = getDateRange(false, value);
      expect(startDate).toMatch(/^\d{4}-\d{2}-01$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

describe("getQuarterlyOptions", () => {
  it("returns five options — next quarter plus the current one and the previous three", () => {
    expect(getQuarterlyOptions()).toHaveLength(5);
  });

  it("leads with the upcoming quarter", () => {
    expect(getQuarterlyOptions()[0]).toEqual({ option: "Q2 2026", value: "2026-Q2" });
  });

  it("walks backwards from the current quarter across the year boundary", () => {
    expect(getQuarterlyOptions().map((o) => o.value)).toEqual([
      "2026-Q2",
      "2026-Q1",
      "2025-Q4",
      "2025-Q3",
      "2025-Q2",
    ]);
  });

  it("produces values that getDateRange can consume", () => {
    getQuarterlyOptions().forEach(({ value }) => {
      const { startDate, endDate } = getDateRange(true, value);
      expect(startDate).toMatch(/^\d{4}-\d{2}-01$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

describe("getCurrentPeriod", () => {
  it("returns the current month when periodType is false", () => {
    expect(getCurrentPeriod(false)).toBe("2026-02");
  });

  it("returns the current quarter when periodType is true", () => {
    expect(getCurrentPeriod(true)).toBe("2026-Q1");
  });

  it("agrees with the first non-future entry of getLast6MonthsOptions", () => {
    expect(getCurrentPeriod(false)).toBe(getLast6MonthsOptions()[3].value);
  });

  it("agrees with the second entry of getQuarterlyOptions", () => {
    expect(getCurrentPeriod(true)).toBe(getQuarterlyOptions()[1].value);
  });

  /**
   * Pinned: the monthly branch slices `toISOString()`, which is UTC, while every
   * other helper here builds dates in local time. Around a month boundary the two
   * disagree — a home in UTC+13 on the 1st at 00:30 local is still the previous
   * month in UTC, so the picker defaults to a month the option list is walking
   * from differently. Mid-month, as frozen here, they agree.
   */
  it("derives the month from UTC rather than local time", () => {
    expect(getCurrentPeriod(false)).toBe(new Date().toISOString().slice(0, 7));
  });
});

// ─── Small formatters ────────────────────────────────────────────────────────

describe("snakeToCamel", () => {
  it.each([
    ["care_fee", "careFee"],
    ["budget_expense_groceries", "budgetExpenseGroceries"],
    ["misc", "misc"],
    ["", ""],
  ])("converts %s to %s", (input, expected) => {
    expect(snakeToCamel(input)).toBe(expected);
  });

  /**
   * The pattern is `_([a-z])`, so an underscore followed by a digit is left in
   * place while the next letter-led segment is still camel-cased — one string can
   * come out half converted.
   */
  it("keeps an underscore that precedes a digit but converts the rest", () => {
    expect(snakeToCamel("q_1_total")).toBe("q_1Total");
  });

  it("leaves an underscore before an uppercase letter alone", () => {
    expect(snakeToCamel("care_Fee")).toBe("care_Fee");
  });
});

describe("formatCategoryName", () => {
  it.each([
    ["care_fee", "Care Fee"],
    ["monthly_fee", "Monthly Fee"],
    ["groceries", "Groceries"],
    ["misc", "Misc"],
  ])("titles %s as %s", (input, expected) => {
    expect(formatCategoryName(input)).toBe(expected);
  });

  it("leaves an already-capitalised name untouched", () => {
    expect(formatCategoryName("Utilities")).toBe("Utilities");
  });

  it("returns an empty string unchanged", () => {
    expect(formatCategoryName("")).toBe("");
  });
});

describe("formatCurrency", () => {
  it("renders whole dollars with two decimal places", () => {
    expect(formatCurrency(1500)).toBe("$1,500.00");
  });

  it("rounds to the nearest cent", () => {
    expect(formatCurrency(1500.555)).toBe("$1,500.56");
  });

  it("renders zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("renders a negative balance with a leading minus", () => {
    expect(formatCurrency(-250)).toBe("-$250.00");
  });
});

describe("getMonthYear", () => {
  it("formats an ISO datetime as Month YYYY", () => {
    expect(getMonthYear("2026-02-13T12:00:00.000Z")).toBe("February 2026");
  });

  it("returns an empty string for undefined", () => {
    expect(getMonthYear(undefined)).toBe("");
  });

  it("returns an empty string for an empty input", () => {
    expect(getMonthYear("")).toBe("");
  });

  /** Pinned: an unparseable date renders "Invalid Date" rather than throwing. */
  it("renders 'Invalid Date' for an unparseable string", () => {
    expect(getMonthYear("not-a-date")).toBe("Invalid Date");
  });
});

// ─── Category colours ────────────────────────────────────────────────────────

describe("getCategoryColor", () => {
  it("returns the income colour for an income category", () => {
    expect(getCategoryColor("Care Fee", "income")).toBe("#10b981");
  });

  it("returns the expense colour for an expense category", () => {
    expect(getCategoryColor("Groceries", "expense")).toBe("#e35518");
  });

  it("defaults to the income palette when no type is given", () => {
    expect(getCategoryColor("Care Fee")).toBe("#10b981");
  });

  it("falls back to grey for an unknown category", () => {
    expect(getCategoryColor("Nonexistent", "expense")).toBe("#6b7280");
  });

  /**
   * Care Fee and Monthly Fee are income-only, so asking the expense palette for
   * them yields the grey fallback rather than their income colour.
   */
  it("returns grey when an income category is looked up in the expense palette", () => {
    expect(getCategoryColor("Care Fee", "expense")).toBe("#6b7280");
  });

  it("gives Entertainment the same colour in both palettes", () => {
    expect(getCategoryColor("Entertainment", "income")).toBe(
      getCategoryColor("Entertainment", "expense")
    );
  });

  it("is case-sensitive — the keys are display labels", () => {
    expect(getCategoryColor("care fee", "income")).toBe("#6b7280");
  });
});

describe("category key lists", () => {
  it("derives income keys as snake_case from the colour labels", () => {
    expect(ALL_INCOME_CATEGORY_KEYS).toEqual([
      "care_fee",
      "monthly_fee",
      "entertainment",
      "transport",
      "medical",
      "misc",
    ]);
  });

  it("derives expense keys the same way, including payroll", () => {
    expect(ALL_EXPENSE_CATEGORY_KEYS).toEqual([
      "payroll",
      "groceries",
      "utilities",
      "entertainment",
      "transport",
      "medical",
      "misc",
    ]);
  });

  /**
   * Payroll is an expense category in the colour map but is *not* a member of
   * `BudgetExpenseCategorySchema` — it is computed from shifts rather than
   * entered by hand, so it can never be the category of a saved budget row.
   */
  it("includes payroll in the expense palette even though the schema has no such category", () => {
    expect(Object.keys(BUDGET_CATEGORY_COLORS.expense)).toContain("Payroll");
    expect(ALL_EXPENSE_CATEGORY_KEYS).toContain("payroll");
  });

  it("keeps every key round-trippable through formatCategoryName", () => {
    ALL_INCOME_CATEGORY_KEYS.forEach((key) => {
      expect(BUDGET_CATEGORY_COLORS.income[formatCategoryName(key)]).toBeDefined();
    });
  });
});

describe("MONTH_ABBR", () => {
  it("has twelve lower-case abbreviations in calendar order", () => {
    expect(MONTH_ABBR).toHaveLength(12);
    expect(MONTH_ABBR[0]).toBe("jan");
    expect(MONTH_ABBR[11]).toBe("dec");
  });

  it("indexes February at 1 — the offset extractThresholds relies on", () => {
    expect(MONTH_ABBR[2 - 1]).toBe("feb");
  });
});

// ─── extractThresholds ───────────────────────────────────────────────────────

describe("extractThresholds", () => {
  const feb2026 = { startDate: "2026-02-01", endDate: "2026-02-28" };

  it("reads thresholds nested under `home`", () => {
    const result = extractThresholds(makeHomeWithThresholds(), feb2026, "monthly");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "2026-feb-groceries",
      name: "Groceries Cap",
      category: "Groceries",
      month: "February 2026",
      thresholdAmount: 2000,
      status: "active",
      enabled: true,
    });
  });

  it("also reads thresholds at the top level", () => {
    const { home } = makeHomeWithThresholds();
    const result = extractThresholds({ thresholds: home.thresholds }, feb2026, "monthly");
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when the home has no thresholds", () => {
    expect(extractThresholds({ home: {} }, feb2026, "monthly")).toEqual([]);
  });

  it("returns an empty array when there is no date range", () => {
    expect(extractThresholds(makeHomeWithThresholds(), undefined, "monthly")).toEqual([]);
  });

  it("returns an empty array when the range has no start date", () => {
    expect(
      extractThresholds(makeHomeWithThresholds(), { startDate: "", endDate: "" }, "monthly")
    ).toEqual([]);
  });

  it("includes disabled thresholds, marked inactive", () => {
    const home = makeHomeWithThresholds({
      "2026": {
        feb: { groceries: { thresholdName: "Off", fixedAmount: 500, isEnabled: false } },
      },
    });
    const result = extractThresholds(home, feb2026, "monthly");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("inactive");
    expect(result[0].enabled).toBe(false);
  });

  it("walks every month in a quarterly range", () => {
    const home = makeHomeWithThresholds({
      "2026": {
        jan: { groceries: { fixedAmount: 100, isEnabled: true } },
        feb: { groceries: { fixedAmount: 200, isEnabled: true } },
        mar: { groceries: { fixedAmount: 300, isEnabled: true } },
      },
    });
    const result = extractThresholds(
      home,
      { startDate: "2026-01-01", endDate: "2026-03-31" },
      "quarterly"
    );
    expect(result.map((t) => t.thresholdAmount)).toEqual([100, 200, 300]);
  });

  it("crosses a year boundary", () => {
    const home = makeHomeWithThresholds({
      "2025": { dec: { groceries: { fixedAmount: 50, isEnabled: true } } },
      "2026": { jan: { groceries: { fixedAmount: 75, isEnabled: true } } },
    });
    const result = extractThresholds(
      home,
      { startDate: "2025-12-01", endDate: "2026-01-31" },
      "monthly"
    );
    expect(result.map((t) => t.month)).toEqual(["December 2025", "January 2026"]);
  });

  it("skips months with no threshold data", () => {
    const home = makeHomeWithThresholds({
      "2026": { mar: { groceries: { fixedAmount: 300, isEnabled: true } } },
    });
    expect(extractThresholds(home, feb2026, "monthly")).toEqual([]);
  });

  it("falls back to a derived name when thresholdName is missing", () => {
    const home = makeHomeWithThresholds({
      "2026": { feb: { groceries: { fixedAmount: 2000, isEnabled: true } } },
    });
    expect(extractThresholds(home, feb2026, "monthly")[0].name).toBe("groceries Threshold");
  });

  it("defaults a missing fixedAmount to 0", () => {
    const home = makeHomeWithThresholds({
      "2026": { feb: { groceries: { isEnabled: true } } },
    });
    expect(extractThresholds(home, feb2026, "monthly")[0].thresholdAmount).toBe(0);
  });

  /**
   * Pinned: the row id is `year-month-category`, so two thresholds on the same
   * category in the same month cannot be told apart — but the source object is
   * keyed by category, so that shape is unreachable in practice.
   */
  it("keys each row by year, month and category", () => {
    const home = makeHomeWithThresholds({
      "2026": {
        feb: {
          groceries: { fixedAmount: 100, isEnabled: true },
          utilities: { fixedAmount: 200, isEnabled: true },
        },
      },
    });
    expect(extractThresholds(home, feb2026, "monthly").map((t) => t.id)).toEqual([
      "2026-feb-groceries",
      "2026-feb-utilities",
    ]);
  });
});

// ─── generateBudgetAlerts ────────────────────────────────────────────────────

describe("generateBudgetAlerts", () => {
  const feb2026 = { startDate: "2026-02-01", endDate: "2026-02-28" };

  const homeWith = (fixedAmount: number, extra: Record<string, any> = {}) =>
    makeHomeWithThresholds({
      "2026": {
        feb: {
          groceries: {
            thresholdName: "Groceries Cap",
            fixedAmount,
            isEnabled: true,
            ...extra,
          },
        },
      },
    });

  it("stays silent below 80% of the threshold", () => {
    // 150000 cents = $1,500 against a $2,000 cap = 75%.
    const alerts = generateBudgetAlerts(homeWith(2000), makeDashboardMetrics(), feb2026);
    expect(alerts).toEqual([]);
  });

  it("warns at exactly 80%", () => {
    const alerts = generateBudgetAlerts(
      homeWith(2000),
      makeDashboardMetrics({ budget_expense_groceries: 160000 }),
      feb2026
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("warning");
    expect(alerts[0].percentageUsed).toBe(80);
    expect(alerts[0].message).toBe("Groceries expenses have reached 80% of the threshold");
  });

  it("escalates to critical once spending reaches the threshold exactly", () => {
    const alerts = generateBudgetAlerts(
      homeWith(2000),
      makeDashboardMetrics({ budget_expense_groceries: 200000 }),
      feb2026
    );
    expect(alerts[0].type).toBe("critical");
    expect(alerts[0].percentageUsed).toBe(100);
  });

  it("reports how far over budget a critical alert is", () => {
    const alerts = generateBudgetAlerts(
      homeWith(2000),
      makeDashboardMetrics({ budget_expense_groceries: 250000 }),
      feb2026
    );
    expect(alerts[0].message).toBe(
      "Groceries expenses have exceeded the budget limit by $500.00"
    );
    expect(alerts[0].currentValue).toBe(2500);
    expect(alerts[0].thresholdValue).toBe(2000);
  });

  it("converts the metric from cents before comparing", () => {
    // Without the /100 the $1,500 spend would read as 150,000 and trip a critical.
    const alerts = generateBudgetAlerts(homeWith(2000), makeDashboardMetrics(), feb2026);
    expect(alerts).toEqual([]);
  });

  it("labels the alert with its category and month", () => {
    const alerts = generateBudgetAlerts(
      homeWith(2000),
      makeDashboardMetrics({ budget_expense_groceries: 250000 }),
      feb2026
    );
    expect(alerts[0].category).toBe("Groceries (February 2026)");
    expect(alerts[0].thresholdName).toBe("Groceries Cap");
  });

  it("ignores disabled thresholds", () => {
    const alerts = generateBudgetAlerts(
      homeWith(2000, { isEnabled: false }),
      makeDashboardMetrics({ budget_expense_groceries: 999999 }),
      feb2026
    );
    expect(alerts).toEqual([]);
  });

  it("ignores a zero threshold — an unset cap is not a breach", () => {
    const alerts = generateBudgetAlerts(
      homeWith(0),
      makeDashboardMetrics({ budget_expense_groceries: 999999 }),
      feb2026
    );
    expect(alerts).toEqual([]);
  });

  it("treats a missing metric as zero spend", () => {
    const alerts = generateBudgetAlerts(homeWith(2000), { total_income: 0 }, feb2026);
    expect(alerts).toEqual([]);
  });

  it("sorts critical alerts ahead of warnings", () => {
    const home = makeHomeWithThresholds({
      "2026": {
        feb: {
          utilities: { fixedAmount: 1000, isEnabled: true },
          groceries: { fixedAmount: 2000, isEnabled: true },
        },
      },
    });
    const alerts = generateBudgetAlerts(
      home,
      makeDashboardMetrics({
        budget_expense_groceries: 160000, // 80% — warning
        budget_expense_utilities: 200000, // 200% — critical
      }),
      feb2026
    );
    expect(alerts.map((a) => a.type)).toEqual(["critical", "warning"]);
  });

  it("maps a camelCase threshold key onto its snake_case metric", () => {
    const home = makeHomeWithThresholds({
      "2026": { feb: { officeSupplies: { fixedAmount: 100, isEnabled: true } } },
    });
    const alerts = generateBudgetAlerts(
      home,
      { budget_expense_office_supplies: 20000 },
      feb2026
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("critical");
  });

  it("returns an empty array when any input is missing", () => {
    expect(generateBudgetAlerts(null, makeDashboardMetrics(), feb2026)).toEqual([]);
    expect(generateBudgetAlerts(homeWith(2000), null, feb2026)).toEqual([]);
    expect(generateBudgetAlerts(homeWith(2000), makeDashboardMetrics(), undefined)).toEqual([]);
  });

  it("skips a non-object threshold entry", () => {
    const home = makeHomeWithThresholds({ "2026": { feb: { groceries: "nope" } } });
    expect(generateBudgetAlerts(home, makeDashboardMetrics(), feb2026)).toEqual([]);
  });

  it("spans every month of a quarterly range", () => {
    const home = makeHomeWithThresholds({
      "2026": {
        jan: { groceries: { fixedAmount: 10, isEnabled: true } },
        feb: { groceries: { fixedAmount: 10, isEnabled: true } },
      },
    });
    const alerts = generateBudgetAlerts(
      home,
      makeDashboardMetrics({ budget_expense_groceries: 500000 }),
      { startDate: "2026-01-01", endDate: "2026-02-28" }
    );
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.category)).toEqual([
      "Groceries (February 2026)",
      "Groceries (January 2026)",
    ]);
  });
});
