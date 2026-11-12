/**
 * Budget and payroll schemas — model/revops/budget-model.ts, model/revops/payout-model.ts
 *
 * Both work in **cents** (`amount_cents`, `total_amount_cents`), unlike the
 * invoice schemas which use plain dollars. The tests say so explicitly because
 * the two live one directory apart and a mix-up is a factor-of-100 error.
 */

import {
  BudgetEntryModeSchema,
  BudgetExpenseCategorySchema,
  BudgetIncomeCategorySchema,
  BudgetSchema,
  BudgetTransactionTypeSchema,
} from "../../../model/revops/budget-model";
import {
  CreatePaymentRequestSchema,
  PayOutItemSchema,
  PayOutSchema,
  PayOutWithItemsSchema,
} from "../../../model/revops/payout-model";
import {
  makeBudgetEntry,
  makePaymentRequest,
  makePayout,
  makePayoutItem,
  UUIDS,
} from "../../test-utils/factories";

const parse = (schema: any, input: unknown) => schema.safeParse(input);

const errorFor = (schema: any, input: unknown, field: string) => {
  const result = schema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((i: any) => i.path.join(".") === field)?.message;
};

// ─── Budget enums ────────────────────────────────────────────────────────────

describe("Budget enums", () => {
  it("BudgetTransactionTypeSchema accepts income and expense only", () => {
    expect(BudgetTransactionTypeSchema.safeParse("income").success).toBe(true);
    expect(BudgetTransactionTypeSchema.safeParse("expense").success).toBe(true);
    expect(BudgetTransactionTypeSchema.safeParse("Income").success).toBe(false);
    expect(BudgetTransactionTypeSchema.safeParse("transfer").success).toBe(false);
  });

  it("BudgetEntryModeSchema accepts one_time and recurring only", () => {
    expect(BudgetEntryModeSchema.safeParse("one_time").success).toBe(true);
    expect(BudgetEntryModeSchema.safeParse("recurring").success).toBe(true);
    expect(BudgetEntryModeSchema.safeParse("oneTime").success).toBe(false);
    expect(BudgetEntryModeSchema.safeParse("monthly").success).toBe(false);
  });

  describe("income vs expense categories", () => {
    it.each(["CARE_FEE", "MONTHLY_FEE", "ENTERTAINMENT", "TRANSPORT", "MEDICAL", "MISC"])(
      "income accepts %s",
      (category) => {
        expect(BudgetIncomeCategorySchema.safeParse(category).success).toBe(true);
      }
    );

    it.each(["GROCERIES", "UTILITIES", "ENTERTAINMENT", "TRANSPORT", "MEDICAL", "MISC"])(
      "expense accepts %s",
      (category) => {
        expect(BudgetExpenseCategorySchema.safeParse(category).success).toBe(true);
      }
    );

    it("income rejects the expense-only categories", () => {
      expect(BudgetIncomeCategorySchema.safeParse("GROCERIES").success).toBe(false);
      expect(BudgetIncomeCategorySchema.safeParse("UTILITIES").success).toBe(false);
    });

    it("expense rejects the income-only categories", () => {
      expect(BudgetExpenseCategorySchema.safeParse("CARE_FEE").success).toBe(false);
      expect(BudgetExpenseCategorySchema.safeParse("MONTHLY_FEE").success).toBe(false);
    });

    it("both report the same friendly message", () => {
      const income = BudgetIncomeCategorySchema.safeParse("NOPE");
      const expense = BudgetExpenseCategorySchema.safeParse("NOPE");
      expect(income.success).toBe(false);
      expect(expense.success).toBe(false);
      expect((income as any).error.issues[0].message).toBe("Please select a category");
      expect((expense as any).error.issues[0].message).toBe("Please select a category");
    });
  });
});

// ─── BudgetSchema ────────────────────────────────────────────────────────────

describe("BudgetSchema", () => {
  it("accepts a minimal expense entry", () => {
    expect(parse(BudgetSchema, makeBudgetEntry()).success).toBe(true);
  });

  it("accepts a minimal income entry", () => {
    expect(
      parse(
        BudgetSchema,
        makeBudgetEntry({ transaction_type: "income", category_type: "CARE_FEE" })
      ).success
    ).toBe(true);
  });

  /**
   * Pinned: `category_type` is a plain union of the income and expense enums with
   * no cross-field refinement, so an *expense* can carry an income-only category
   * and vice versa. Nothing in the schema ties the two fields together.
   */
  it("accepts an expense tagged with an income-only category", () => {
    expect(
      parse(
        BudgetSchema,
        makeBudgetEntry({ transaction_type: "expense", category_type: "CARE_FEE" })
      ).success
    ).toBe(true);
  });

  it("accepts income tagged with an expense-only category", () => {
    expect(
      parse(
        BudgetSchema,
        makeBudgetEntry({ transaction_type: "income", category_type: "GROCERIES" })
      ).success
    ).toBe(true);
  });

  it("rejects a category in neither set", () => {
    expect(errorFor(BudgetSchema, makeBudgetEntry({ category_type: "RENT" }), "category_type")).toBe(
      "Please select a category"
    );
  });

  describe("amount_cents", () => {
    it("accepts a non-negative integer count of cents", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ amount_cents: 0 })).success).toBe(true);
      expect(parse(BudgetSchema, makeBudgetEntry({ amount_cents: 15000 })).success).toBe(true);
    });

    it("rejects a negative amount", () => {
      expect(errorFor(BudgetSchema, makeBudgetEntry({ amount_cents: -1 }), "amount_cents")).toBe(
        "amount_cents must be a non-negative number"
      );
    });

    it("coerces a numeric string — the form supplies strings", () => {
      const result = parse(BudgetSchema, makeBudgetEntry({ amount_cents: "15000" }));
      expect(result.success).toBe(true);
      expect(result.data.amount_cents).toBe(15000);
    });

    /**
     * Pinned: `z.coerce.number()` runs `Number("")`, which is `0` — so an empty
     * amount field becomes a valid zero-cent entry instead of a "required" error.
     */
    it("turns an empty string into 0 rather than reporting it as missing", () => {
      const result = parse(BudgetSchema, makeBudgetEntry({ amount_cents: "" }));
      expect(result.success).toBe(true);
      expect(result.data.amount_cents).toBe(0);
    });

    /** Same coercion trap: `Number(null)` is 0. */
    it("turns null into 0", () => {
      const result = parse(BudgetSchema, makeBudgetEntry({ amount_cents: null }));
      expect(result.success).toBe(true);
      expect(result.data.amount_cents).toBe(0);
    });

    it("rejects a non-numeric string", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ amount_cents: "abc" })).success).toBe(false);
    });

    /** Pinned: nothing requires whole cents, so fractional cents are accepted. */
    it("accepts a fractional cent value", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ amount_cents: 10.5 })).success).toBe(true);
    });
  });

  describe("transaction_date", () => {
    it("accepts a calendar date", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ transaction_date: "2026-02-10" })).success).toBe(
        true
      );
    });

    it.each(["2026-02-10T00:00:00.000Z", "02/10/2026", "2026-2-10", ""])(
      "rejects %s",
      (date) => {
        expect(errorFor(BudgetSchema, makeBudgetEntry({ transaction_date: date }), "transaction_date")).toBe(
          "transaction_date must be a valid date"
        );
      }
    );
  });

  describe("description", () => {
    it("rejects an empty description", () => {
      expect(errorFor(BudgetSchema, makeBudgetEntry({ description: "" }), "description")).toBe(
        "Description is required"
      );
    });

    it("accepts a description at the 500-character limit", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ description: "x".repeat(500) })).success).toBe(
        true
      );
    });

    it("rejects a description over 500 characters", () => {
      expect(errorFor(BudgetSchema, makeBudgetEntry({ description: "x".repeat(501) }), "description")).toBe(
        "Description must not exceed 500 characters"
      );
    });
  });

  describe("notes", () => {
    it("accepts null and undefined", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ notes: null })).success).toBe(true);
      expect(parse(BudgetSchema, makeBudgetEntry({ notes: undefined })).success).toBe(true);
    });

    it("accepts notes at the 1000-character limit", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ notes: "x".repeat(1000) })).success).toBe(true);
    });

    it("rejects notes over 1000 characters", () => {
      expect(errorFor(BudgetSchema, makeBudgetEntry({ notes: "x".repeat(1001) }), "notes")).toBe(
        "Notes must not exceed 1000 characters"
      );
    });
  });

  describe("receipt_url", () => {
    it("accepts an absolute URL", () => {
      expect(
        parse(BudgetSchema, makeBudgetEntry({ receipt_url: "https://example.com/r.pdf" })).success
      ).toBe(true);
    });

    it("accepts null — a receipt is optional", () => {
      expect(parse(BudgetSchema, makeBudgetEntry({ receipt_url: null })).success).toBe(true);
    });

    /**
     * Pinned: receipts are uploaded to S3 and referenced by key elsewhere in the
     * app, but `.url()` rejects a bare key — only an absolute URL passes.
     */
    it("rejects a bare S3 key", () => {
      expect(
        parse(BudgetSchema, makeBudgetEntry({ receipt_url: "home-id/receipts/r.pdf" })).success
      ).toBe(false);
    });
  });

  describe("ids", () => {
    it("requires a uuid home_id", () => {
      expect(errorFor(BudgetSchema, makeBudgetEntry({ home_id: "home-1" }), "home_id")).toBe(
        "home_id must be a valid uuid"
      );
    });

    it("requires a uuid created_by_user_id", () => {
      expect(
        errorFor(BudgetSchema, makeBudgetEntry({ created_by_user_id: "me" }), "created_by_user_id")
      ).toBe("created_by_user_id must be a valid uuid");
    });

    it("coerces a string id into a number", () => {
      const result = parse(BudgetSchema, makeBudgetEntry({ id: "42" }));
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(42);
    });
  });

  /**
   * Pinned: unlike every other RevOps schema, BudgetSchema is not `.strict()`.
   * Unknown keys are silently dropped rather than rejected, so a typo'd field
   * name is never reported — the value simply never reaches the API.
   */
  it("silently drops unknown keys instead of rejecting them", () => {
    const result = parse(BudgetSchema, makeBudgetEntry({ ammount_cents: 999, vendor: "Acme" }));
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("ammount_cents");
    expect(result.data).not.toHaveProperty("vendor");
  });
});

// ─── PayOutSchema ────────────────────────────────────────────────────────────

describe("PayOutSchema", () => {
  it("accepts a minimal payout", () => {
    expect(parse(PayOutSchema, makePayout()).success).toBe(true);
  });

  it("accepts the optional hours and rate fields", () => {
    expect(
      parse(PayOutSchema, makePayout({ hours_worked_minutes: 4800, hourly_rate_cents: 1200 }))
        .success
    ).toBe(true);
  });

  describe("period_type", () => {
    it.each(["BIWEEKLY", "MONTHLY"])("accepts %s", (period) => {
      expect(parse(PayOutSchema, makePayout({ period_type: period })).success).toBe(true);
    });

    it.each(["WEEKLY", "biweekly", "SEMI_MONTHLY"])("rejects %s", (period) => {
      expect(errorFor(PayOutSchema, makePayout({ period_type: period }), "period_type")).toBe(
        "period_type must be BIWEEKLY or MONTHLY"
      );
    });
  });

  describe("status", () => {
    it.each(["DRAFT", "FINALIZED", "PAID", "VOID"])("accepts %s", (status) => {
      expect(parse(PayOutSchema, makePayout({ status })).success).toBe(true);
    });

    /**
     * The payout lifecycle uses FINALIZED where invoices use DUE/OVERDUE. The two
     * status vocabularies do not overlap beyond DRAFT/PAID/VOID.
     */
    it("rejects the invoice-only statuses", () => {
      expect(parse(PayOutSchema, makePayout({ status: "DUE" })).success).toBe(false);
      expect(parse(PayOutSchema, makePayout({ status: "OVERDUE" })).success).toBe(false);
    });

    it("reports the four valid statuses", () => {
      expect(errorFor(PayOutSchema, makePayout({ status: "NOPE" }), "status")).toBe(
        "status must be DRAFT, FINALIZED, PAID, or VOID"
      );
    });
  });

  describe("amounts in cents", () => {
    it("requires whole-cent integers", () => {
      expect(parse(PayOutSchema, makePayout({ base_amount_cents: 960.5 })).success).toBe(false);
      expect(parse(PayOutSchema, makePayout({ total_amount_cents: 960.5 })).success).toBe(false);
    });

    it("rejects negative totals", () => {
      expect(parse(PayOutSchema, makePayout({ total_amount_cents: -1 })).success).toBe(false);
    });

    it("accepts zero", () => {
      expect(
        parse(PayOutSchema, makePayout({ base_amount_cents: 0, total_amount_cents: 0 })).success
      ).toBe(true);
    });

    it("does not coerce a numeric string — unlike BudgetSchema", () => {
      expect(parse(PayOutSchema, makePayout({ total_amount_cents: "96000" })).success).toBe(false);
    });

    /** Nothing requires total >= base, so a total below the base amount passes. */
    it("does not check total_amount_cents against base_amount_cents", () => {
      expect(
        parse(PayOutSchema, makePayout({ base_amount_cents: 96000, total_amount_cents: 1 })).success
      ).toBe(true);
    });
  });

  describe("period dates", () => {
    it("requires calendar dates", () => {
      expect(
        parse(PayOutSchema, makePayout({ period_start_date: "2026-02-01T00:00:00Z" })).success
      ).toBe(false);
    });

    /** Nothing enforces start <= end, so an inverted period is accepted. */
    it("accepts a period that ends before it starts", () => {
      expect(
        parse(
          PayOutSchema,
          makePayout({ period_start_date: "2026-02-14", period_end_date: "2026-02-01" })
        ).success
      ).toBe(true);
    });
  });

  it("requires every uuid id", () => {
    expect(errorFor(PayOutSchema, makePayout({ home_id: "h" }), "home_id")).toBe(
      "home_id must be a valid uuid"
    );
    expect(errorFor(PayOutSchema, makePayout({ pcg_user_id: "p" }), "pcg_user_id")).toBe(
      "pcg_user_id must be a valid uuid"
    );
    expect(errorFor(PayOutSchema, makePayout({ pcho_user_id: "p" }), "pcho_user_id")).toBe(
      "pcho_user_id must be a valid uuid"
    );
  });

  /**
   * Pinned: `updated_by_user_id` is `.uuid()` with no custom message and no
   * `.optional()`, so a payout drafted before anyone edits it must still name an
   * updater — and an empty field reports zod's generic "Required".
   */
  it("requires updated_by_user_id even on a brand-new DRAFT payout", () => {
    const payout = makePayout({ status: "DRAFT" });
    delete (payout as any).updated_by_user_id;
    const result = parse(PayOutSchema, payout);
    expect(result.success).toBe(false);
    expect(errorFor(PayOutSchema, payout, "updated_by_user_id")).toBe("Required");
  });

  it("rejects unknown keys", () => {
    expect(parse(PayOutSchema, makePayout({ bonus_cents: 100 })).success).toBe(false);
  });
});

// ─── PayOutItemSchema / PayOutWithItemsSchema ────────────────────────────────

describe("PayOutItemSchema", () => {
  it("accepts a minimal item", () => {
    expect(parse(PayOutItemSchema, makePayoutItem()).success).toBe(true);
  });

  it("allows a negative amount — deductions are line items", () => {
    expect(parse(PayOutItemSchema, makePayoutItem({ amount_cents: -2500 })).success).toBe(true);
  });

  it("requires whole cents", () => {
    expect(errorFor(PayOutItemSchema, makePayoutItem({ amount_cents: 25.5 }), "amount_cents")).toBe(
      "amount_cents must be an integer (can be negative for deductions)"
    );
  });

  it("requires a description", () => {
    expect(errorFor(PayOutItemSchema, makePayoutItem({ description: "" }), "description")).toBe(
      "description is required"
    );
  });

  /** Unlike invoice items, `payout_id` is required — items cannot precede the payout. */
  it("requires payout_id", () => {
    const item = makePayoutItem();
    delete (item as any).payout_id;
    expect(parse(PayOutItemSchema, item).success).toBe(false);
  });

  it("requires a uuid payout_item_id", () => {
    expect(
      errorFor(PayOutItemSchema, makePayoutItem({ payout_item_id: "item-1" }), "payout_item_id")
    ).toBe("payout_item_id must be a valid uuid");
  });
});

describe("PayOutWithItemsSchema", () => {
  it("accepts a payout with items", () => {
    expect(
      parse(PayOutWithItemsSchema, { ...makePayout(), items: [makePayoutItem()] }).success
    ).toBe(true);
  });

  it("requires the items array", () => {
    expect(parse(PayOutWithItemsSchema, makePayout()).success).toBe(false);
  });

  it("reports which item failed", () => {
    const result = parse(PayOutWithItemsSchema, {
      ...makePayout(),
      items: [makePayoutItem(), makePayoutItem({ amount_cents: 1.5 })],
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(["items", 1, "amount_cents"]);
  });
});

// ─── CreatePaymentRequestSchema ──────────────────────────────────────────────

describe("CreatePaymentRequestSchema", () => {
  it("accepts a manual invoice payment", () => {
    expect(
      parse(CreatePaymentRequestSchema, makePaymentRequest({ manual_method: "CHECK" })).success
    ).toBe(true);
  });

  it("accepts a Stripe checkout request", () => {
    expect(
      parse(
        CreatePaymentRequestSchema,
        makePaymentRequest({
          provider: "STRIPE",
          success_url: "https://app.assistly.com/stripe/return",
          cancel_url: "https://app.assistly.com/stripe/refresh",
        })
      ).success
    ).toBe(true);
  });

  it.each(["INVOICE", "PAYROLL_PAYOUT"])("accepts subject_type %s", (subject) => {
    expect(parse(CreatePaymentRequestSchema, makePaymentRequest({ subject_type: subject })).success).toBe(
      true
    );
  });

  it.each(["CASH", "CHECK", "BANK_TRANSFER", "PAYPAL", "ZELLE", "VENMO", "OTHER"])(
    "accepts manual_method %s",
    (method) => {
      expect(
        parse(CreatePaymentRequestSchema, makePaymentRequest({ manual_method: method })).success
      ).toBe(true);
    }
  );

  it("rejects an unknown manual_method", () => {
    expect(
      parse(CreatePaymentRequestSchema, makePaymentRequest({ manual_method: "CRYPTO" })).success
    ).toBe(false);
  });

  it("rejects a non-URL success_url", () => {
    expect(
      parse(CreatePaymentRequestSchema, makePaymentRequest({ success_url: "/stripe/return" }))
        .success
    ).toBe(false);
  });

  it("requires a non-empty subject_public_id", () => {
    expect(parse(CreatePaymentRequestSchema, makePaymentRequest({ subject_public_id: "" })).success).toBe(
      false
    );
  });

  it("requires uuid payer and initiator ids", () => {
    expect(parse(CreatePaymentRequestSchema, makePaymentRequest({ payer_user_id: "u" })).success).toBe(
      false
    );
    expect(
      parse(CreatePaymentRequestSchema, makePaymentRequest({ initiated_by_user_id: "u" })).success
    ).toBe(false);
  });

  /**
   * Pinned: the comments split the fields into "Stripe-only" and "Manual-only",
   * but every one of them is `.optional()` with no refinement joining them to
   * `provider`. A STRIPE request carrying a manual cheque reference validates,
   * and so does a MANUAL request carrying Stripe redirect URLs.
   */
  it("accepts a STRIPE request carrying manual-only fields", () => {
    expect(
      parse(
        CreatePaymentRequestSchema,
        makePaymentRequest({
          provider: "STRIPE",
          manual_method: "CASH",
          manual_reference: "cheque #42",
          manual_paid_at: "2026-02-10T10:00:00.000Z",
        })
      ).success
    ).toBe(true);
  });

  it("accepts a MANUAL request carrying Stripe-only fields", () => {
    expect(
      parse(
        CreatePaymentRequestSchema,
        makePaymentRequest({
          provider: "MANUAL",
          success_url: "https://app.assistly.com/ok",
          cancel_url: "https://app.assistly.com/no",
        })
      ).success
    ).toBe(true);
  });

  /** A MANUAL payment with no method at all is also accepted. */
  it("does not require manual_method for a MANUAL payment", () => {
    expect(parse(CreatePaymentRequestSchema, makePaymentRequest({ provider: "MANUAL" })).success).toBe(
      true
    );
  });

  it("rejects unknown keys", () => {
    expect(parse(CreatePaymentRequestSchema, makePaymentRequest({ amount: 100 })).success).toBe(
      false
    );
  });

  it("carries the payer through unchanged", () => {
    const result = parse(CreatePaymentRequestSchema, makePaymentRequest());
    expect(result.success).toBe(true);
    expect(result.data.payer_user_id).toBe(UUIDS.senior);
  });
});
