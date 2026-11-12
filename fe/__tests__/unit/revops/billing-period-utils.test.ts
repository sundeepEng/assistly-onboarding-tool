/**
 * Billing helpers — utils/billingPeriodUtils.ts, plus the two `formatCurrency`
 * variants that live beside the RevOps components.
 *
 * The clock is frozen to 2026-02-13T12:00:00Z (mid-day, mid-month) so the period
 * builders assert exact values without depending on the runner's timezone.
 */

import {
  calculateTotalAmount,
  formatBillingPeriod,
  formatBillingPeriodMonth,
  formatCurrency,
  generateInvoiceItemId,
  getBillingPeriodOptions,
  getCurrentBillingPeriod,
  getDefaultDueDate,
  INVOICE_ITEM_CATEGORIES,
  INVOICE_STATUSES,
  isValidBillingPeriod,
  transformFormDataToInvoice,
} from "../../../utils/billingPeriodUtils";
import {
  formatCurrency as payrollFormatCurrency,
  formatShortDate,
} from "../../../components/revops/payroll/payroll-utils";
import {
  clamp,
  formatCurrency as chartFormatCurrency,
} from "../../../components/revops/charts/chart-utils";
import { InvoiceSchema, InvoiceWithItemsSchema } from "../../../model/billing/invoice.model";
import { MONTH_RANGE } from "../../../utils/constants";
import { TEST_HOME_ID } from "../../test-utils/auth";
import { UUIDS } from "../../test-utils/factories";

const FROZEN_NOW = new Date("2026-02-13T12:00:00.000Z");

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

// ─── Period options ──────────────────────────────────────────────────────────

describe("getBillingPeriodOptions", () => {
  it("returns MONTH_RANGE options", () => {
    expect(getBillingPeriodOptions()).toHaveLength(MONTH_RANGE);
  });

  it("starts at the current month and walks backwards", () => {
    expect(getBillingPeriodOptions().map((o) => o.value)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });

  it("labels each option in Month YYYY form", () => {
    expect(getBillingPeriodOptions().map((o) => o.option)).toEqual([
      "February 2026",
      "January 2026",
      "December 2025",
    ]);
  });

  /**
   * Unlike the Budget picker, billing offers no future months — an invoice can
   * only be raised for a period that has started.
   */
  it("offers no future periods", () => {
    const values = getBillingPeriodOptions().map((o) => o.value);
    expect(values).not.toContain("2026-03");
  });

  it("produces values the invoice schema accepts", () => {
    getBillingPeriodOptions().forEach(({ value }) => {
      expect(isValidBillingPeriod(value)).toBe(true);
    });
  });
});

describe("getCurrentBillingPeriod", () => {
  it("returns the current month in YYYY-MM", () => {
    expect(getCurrentBillingPeriod()).toBe("2026-02");
  });

  it("matches the first billing period option", () => {
    expect(getCurrentBillingPeriod()).toBe(getBillingPeriodOptions()[0].value);
  });
});

describe("getDefaultDueDate", () => {
  it("returns the 15th of next month", () => {
    expect(getDefaultDueDate()).toBe("2026-03-15");
  });

  it("is a date the invoice schema accepts", () => {
    expect(
      InvoiceSchema.safeParse({
        home_id: TEST_HOME_ID,
        user_id: UUIDS.senior,
        billing_period: getCurrentBillingPeriod(),
        status: "DRAFT",
        total_amount: 0,
        due_date: getDefaultDueDate(),
        created_by_user_id: UUIDS.user,
      }).success
    ).toBe(true);
  });

  it("falls after the current billing period", () => {
    expect(getDefaultDueDate() > `${getCurrentBillingPeriod()}-28`).toBe(true);
  });
});

// ─── Validation and display ──────────────────────────────────────────────────

describe("isValidBillingPeriod", () => {
  it.each(["2026-01", "2026-09", "2026-10", "2026-12"])("accepts %s", (period) => {
    expect(isValidBillingPeriod(period)).toBe(true);
  });

  it.each(["2026-00", "2026-13", "2026-1", "26-01", "2026/01", "2026-01-15", ""])(
    "rejects %s",
    (period) => {
      expect(isValidBillingPeriod(period)).toBe(false);
    }
  );

  it("agrees with the invoice schema's own regex", () => {
    ["2026-01", "2026-13", "26-01"].forEach((period) => {
      const schemaAccepts = InvoiceSchema.safeParse({
        home_id: TEST_HOME_ID,
        user_id: UUIDS.senior,
        billing_period: period,
        status: "DRAFT",
        total_amount: 0,
        due_date: "2026-03-15",
        created_by_user_id: UUIDS.user,
      }).success;
      expect(isValidBillingPeriod(period)).toBe(schemaAccepts);
    });
  });
});

describe("formatBillingPeriod", () => {
  it("renders YYYY-MM as Month YYYY", () => {
    expect(formatBillingPeriod("2026-02")).toBe("February 2026");
    expect(formatBillingPeriod("2025-12")).toBe("December 2025");
  });

  it("returns an invalid period unchanged rather than throwing", () => {
    expect(formatBillingPeriod("2026-13")).toBe("2026-13");
    expect(formatBillingPeriod("nonsense")).toBe("nonsense");
    expect(formatBillingPeriod("")).toBe("");
  });

  /** `formatBillingPeriodMonth` is a duplicate of `formatBillingPeriod`. */
  it("behaves identically to formatBillingPeriodMonth", () => {
    ["2026-02", "2026-13", ""].forEach((period) => {
      expect(formatBillingPeriodMonth(period)).toBe(formatBillingPeriod(period));
    });
  });
});

describe("formatCurrency (billingPeriodUtils)", () => {
  it("formats dollars with two decimals", () => {
    expect(formatCurrency(1500)).toBe("$1,500.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("renders negatives with a leading minus", () => {
    expect(formatCurrency(-99.5)).toBe("-$99.50");
  });

  it("is pinned to en-US regardless of the runner's locale", () => {
    // `new Intl.NumberFormat('en-US', ...)` — a grouping comma, not a period.
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });
});

// ─── Totals and ids ──────────────────────────────────────────────────────────

describe("calculateTotalAmount", () => {
  it("sums the line items", () => {
    expect(calculateTotalAmount([{ amount: 100 }, { amount: 250.5 }])).toBe(350.5);
  });

  it("returns 0 for an empty list", () => {
    expect(calculateTotalAmount([])).toBe(0);
  });

  it("treats a missing amount as 0", () => {
    expect(calculateTotalAmount([{ amount: 100 }, {} as any])).toBe(100);
  });

  it("nets out a negative line item", () => {
    expect(calculateTotalAmount([{ amount: 100 }, { amount: -40 }])).toBe(60);
  });

  /**
   * Pinned: `sum + (item.amount || 0)` coerces rather than validating, so a
   * numeric *string* concatenates instead of adding — the total silently becomes
   * a string. Nothing upstream stops a form field reaching here as a string.
   */
  it("concatenates instead of adding when an amount arrives as a string", () => {
    expect(calculateTotalAmount([{ amount: 100 }, { amount: "50" as any }])).toBe("10050");
  });
});

describe("generateInvoiceItemId", () => {
  it("produces an item- prefixed id", () => {
    expect(generateInvoiceItemId()).toMatch(/^item-\d+-[a-z0-9]+$/);
  });

  it("produces distinct ids within the same millisecond", () => {
    const ids = new Set(Array.from({ length: 25 }, () => generateInvoiceItemId()));
    expect(ids.size).toBe(25);
  });

  /**
   * Pinned: `InvoiceItemSchema.invoice_item_id` is `.uuid()`, and this id is not
   * a uuid — so every line item the app builds locally fails the schema that is
   * meant to describe it.
   */
  it("does not produce a uuid, so InvoiceItemSchema rejects it", () => {
    const id = generateInvoiceItemId();
    expect(id).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

// ─── transformFormDataToInvoice ──────────────────────────────────────────────

describe("transformFormDataToInvoice", () => {
  const formData = {
    billingPeriod: "2026-02",
    dueDate: "2026-03-15",
    notes: "Split payment",
    lineItems: [
      { category: "CARE_FEE", description: "Monthly care fee", amount: 2000 },
      { category: "MEDICAL", description: "Physio", amount: 500 },
    ],
  };

  it("maps the camelCase form fields onto the snake_case API contract", () => {
    const payload = transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID);
    expect(payload).toMatchObject({
      home_id: TEST_HOME_ID,
      user_id: UUIDS.senior,
      billing_period: "2026-02",
      due_date: "2026-03-15",
    });
  });

  it("always creates the invoice as a DRAFT", () => {
    expect(transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID).status).toBe("DRAFT");
  });

  it("derives total_amount from the line items", () => {
    expect(transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID).total_amount).toBe(2500);
  });

  it("carries each line item across with a generated id", () => {
    const { items } = transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      item_category: "CARE_FEE",
      description: "Monthly care fee",
      amount: 2000,
    });
    expect(items[0].invoice_item_id).toMatch(/^item-/);
  });

  it("normalises empty notes to null", () => {
    const payload = transformFormDataToInvoice(
      { ...formData, notes: "" },
      UUIDS.senior,
      TEST_HOME_ID
    );
    expect(payload.notes).toBeNull();
  });

  it("copes with no line items at all", () => {
    const payload = transformFormDataToInvoice(
      { billingPeriod: "2026-02", dueDate: "2026-03-15" },
      UUIDS.senior,
      TEST_HOME_ID
    );
    expect(payload.total_amount).toBe(0);
    expect(payload.items).toEqual([]);
  });

  /**
   * Pinned: the transformed payload does not validate against the schema that
   * describes it, for two independent reasons —
   *   1. `created_by_user_id` is never set, and `InvoiceSchema` requires it;
   *   2. `invoice_item_id` comes from `generateInvoiceItemId()`, which is not a uuid.
   * Neither is caught anywhere in the app, because nothing runs the payload
   * through `InvoiceWithItemsSchema` before POSTing it.
   */
  it("produces a payload InvoiceWithItemsSchema rejects", () => {
    const payload = transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID);
    const result = InvoiceWithItemsSchema.safeParse(payload);

    expect(result.success).toBe(false);
    const paths = (result as any).error.issues.map((i: any) => i.path.join("."));
    expect(paths).toContain("created_by_user_id");
    expect(paths).toContain("items.0.invoice_item_id");
  });

  it("omits created_by_user_id entirely", () => {
    expect(transformFormDataToInvoice(formData, UUIDS.senior, TEST_HOME_ID)).not.toHaveProperty(
      "created_by_user_id"
    );
  });
});

// ─── Option lists ────────────────────────────────────────────────────────────

describe("INVOICE_ITEM_CATEGORIES", () => {
  it("offers four categories", () => {
    expect(INVOICE_ITEM_CATEGORIES.map((c) => c.value)).toEqual([
      "ENTERTAINMENT",
      "TRANSPORT",
      "MEDICAL",
      "MISC",
    ]);
  });

  it("offers only values InvoiceItemSchema accepts", () => {
    INVOICE_ITEM_CATEGORIES.forEach(({ value }) => {
      expect(
        InvoiceSchema.safeParse({
          home_id: TEST_HOME_ID,
          user_id: UUIDS.senior,
          billing_period: "2026-02",
          status: "DRAFT",
          total_amount: 0,
          due_date: "2026-03-15",
          created_by_user_id: UUIDS.user,
        }).success
      ).toBe(true);
      expect(["ENTERTAINMENT", "TRANSPORT", "MEDICAL", "MISC"]).toContain(value);
    });
  });

  /**
   * Pinned: `InvoiceItemSchema` also accepts CARE_FEE and MONTHLY_FEE — the two
   * recurring charges that make up most of a resident's bill — but the dropdown
   * never offers them, so they can only be set outside this form.
   */
  it("omits CARE_FEE and MONTHLY_FEE even though the schema accepts them", () => {
    const values = INVOICE_ITEM_CATEGORIES.map((c) => c.value as string);
    expect(values).not.toContain("CARE_FEE");
    expect(values).not.toContain("MONTHLY_FEE");
  });
});

describe("INVOICE_STATUSES", () => {
  it("offers four statuses", () => {
    expect(INVOICE_STATUSES.map((s) => s.value)).toEqual([
      "DRAFT",
      "FINALIZED",
      "PAID",
      "VOID",
    ]);
  });

  /**
   * Pinned: this list is the *payout* vocabulary, not the invoice one. FINALIZED
   * is not a member of `InvoiceSchema.status`, so selecting it produces a payload
   * the schema rejects — while DUE and OVERDUE, which the schema does accept and
   * which the billing screen filters on, are missing from the list entirely.
   */
  it("offers FINALIZED, which InvoiceSchema rejects", () => {
    const invoice = {
      home_id: TEST_HOME_ID,
      user_id: UUIDS.senior,
      billing_period: "2026-02",
      status: "FINALIZED",
      total_amount: 0,
      due_date: "2026-03-15",
      created_by_user_id: UUIDS.user,
    };
    expect(INVOICE_STATUSES.map((s) => s.value as string)).toContain("FINALIZED");
    expect(InvoiceSchema.safeParse(invoice).success).toBe(false);
  });

  it("omits DUE and OVERDUE, which InvoiceSchema accepts", () => {
    const values = INVOICE_STATUSES.map((s) => s.value as string);
    expect(values).not.toContain("DUE");
    expect(values).not.toContain("OVERDUE");
  });
});

// ─── Component-local formatters ──────────────────────────────────────────────

describe("payroll-utils formatCurrency", () => {
  it("always shows two decimal places", () => {
    expect(payrollFormatCurrency(1500)).toBe("$1,500.00");
    expect(payrollFormatCurrency(1500.5)).toBe("$1,500.50");
  });

  it("treats null and undefined as zero", () => {
    expect(payrollFormatCurrency(null)).toBe("$0.00");
    expect(payrollFormatCurrency(undefined)).toBe("$0.00");
  });

  it("coerces a numeric string", () => {
    expect(payrollFormatCurrency("1500" as any)).toBe("$1,500.00");
  });
});

describe("payroll-utils formatShortDate", () => {
  it("renders an ISO date as M/D/YYYY without zero padding", () => {
    expect(formatShortDate("2026-02-05")).toBe("2/5/2026");
    expect(formatShortDate("2026-12-25")).toBe("12/25/2026");
  });

  it("passes through the placeholder dash", () => {
    expect(formatShortDate("-")).toBe("-");
  });

  it("passes through an empty string", () => {
    expect(formatShortDate("")).toBe("");
  });

  it("passes anything that is not a bare ISO date through untouched", () => {
    expect(formatShortDate("2026-02-05T10:00:00.000Z")).toBe("2026-02-05T10:00:00.000Z");
    expect(formatShortDate("Feb 5")).toBe("Feb 5");
  });

  /**
   * Parsing is string-only, so no timezone shift can move the day — unlike the
   * `new Date(...)`-based formatters elsewhere in the app.
   */
  it("does not shift the day across timezones", () => {
    expect(formatShortDate("2026-01-01")).toBe("1/1/2026");
  });
});

describe("chart-utils formatCurrency", () => {
  it("drops the cents — chart axes show whole dollars", () => {
    expect(chartFormatCurrency(1500)).toBe("$1,500");
  });

  it("rounds to the nearest dollar", () => {
    expect(chartFormatCurrency(1500.6)).toBe("$1,501");
  });

  /** The three RevOps `formatCurrency`s disagree on precision by design. */
  it("differs from the payroll formatter on the same input", () => {
    expect(chartFormatCurrency(1500)).not.toBe(payrollFormatCurrency(1500));
  });
});

describe("chart-utils clamp", () => {
  it("returns the value when it is inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to the bounds", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it("returns the bounds themselves unchanged", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  /** Pinned: with min > max the max wins, because Math.min is applied last. */
  it("returns min when the bounds are inverted", () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});
