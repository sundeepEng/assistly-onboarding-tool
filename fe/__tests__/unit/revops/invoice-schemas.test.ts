/**
 * Billing schemas — model/billing/invoice.model.ts
 *
 * These four schemas guard the money path: what the API is allowed to return
 * (`InvoiceSchema` / `InvoiceItemSchema` / `InvoiceWithItemsSchema`) and what the
 * Add Invoice form is allowed to submit (`InvoiceFormValidationSchema`).
 *
 * Amounts are plain numbers here — unlike Budget and Payroll, which work in
 * cents — so the tests state that explicitly rather than leaving it implied.
 */

import {
  InvoiceFormValidationSchema,
  InvoiceItemSchema,
  InvoiceSchema,
  InvoiceWithItemsSchema,
} from "../../../model/billing/invoice.model";
import {
  makeInvoiceFormInput,
  makeInvoiceInput,
  makeInvoiceItem,
  UUIDS,
} from "../../test-utils/factories";
import { TEST_HOME_ID, TEST_USER_ID } from "../../test-utils/auth";

/** First error message for `field`, or undefined when the field passed. */
const errorFor = (schema: any, input: unknown, field: string) => {
  const result = schema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((i: any) => i.path.join(".") === field)?.message;
};

const parse = (schema: any, input: unknown) => schema.safeParse(input);

// ─── InvoiceSchema ───────────────────────────────────────────────────────────

describe("InvoiceSchema", () => {
  it("accepts a minimal invoice", () => {
    expect(parse(InvoiceSchema, makeInvoiceInput()).success).toBe(true);
  });

  it("accepts the optional server-assigned fields", () => {
    const result = parse(
      InvoiceSchema,
      makeInvoiceInput({
        id: 12,
        invoice_id: "INV-2026-0001",
        parent_invoice_id: 4,
        created_at: "2026-02-01T10:00:00.000Z",
        updated_at: "2026-02-02T10:00:00.000Z",
      })
    );
    expect(result.success).toBe(true);
  });

  describe("home_id / user_id / created_by_user_id", () => {
    it.each([
      ["home_id", "home_id must be a valid uuid"],
      ["user_id", "user_id must be a valid uuid"],
      ["created_by_user_id", "created_by_user_id must be a valid uuid"],
    ])("rejects a non-uuid %s", (field, message) => {
      expect(errorFor(InvoiceSchema, makeInvoiceInput({ [field]: "not-a-uuid" }), field)).toBe(
        message
      );
    });

    it.each(["home_id", "user_id", "created_by_user_id"])("requires %s", (field) => {
      const input = makeInvoiceInput();
      delete (input as any)[field];
      expect(parse(InvoiceSchema, input).success).toBe(false);
    });

    it("accepts a well-formed uuid", () => {
      expect(
        parse(InvoiceSchema, makeInvoiceInput({ home_id: TEST_HOME_ID, user_id: UUIDS.senior }))
          .success
      ).toBe(true);
    });
  });

  describe("billing_period", () => {
    it.each(["2026-01", "2026-09", "2026-10", "2026-12", "1999-06"])(
      "accepts %s",
      (period) => {
        expect(parse(InvoiceSchema, makeInvoiceInput({ billing_period: period })).success).toBe(
          true
        );
      }
    );

    it.each([
      ["2026-00", "month 00 is not a real month"],
      ["2026-13", "month 13 is not a real month"],
      ["2026-1", "the month must be zero-padded"],
      ["26-01", "the year must be four digits"],
      ["2026/01", "a slash is not the separator"],
      ["2026-01-15", "a full date is not a billing period"],
      ["", "empty is not a billing period"],
    ])("rejects %s — %s", (period) => {
      expect(errorFor(InvoiceSchema, makeInvoiceInput({ billing_period: period }), "billing_period")).toBe(
        "billing_period must be in YYYY-MM format"
      );
    });
  });

  describe("status", () => {
    it.each(["DRAFT", "DUE", "OVERDUE", "VOID", "PAID"])("accepts %s", (status) => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ status })).success).toBe(true);
    });

    it.each(["draft", "Due", "FINALIZED", "PENDING_APPROVAL", ""])(
      "rejects %s",
      (status) => {
        expect(parse(InvoiceSchema, makeInvoiceInput({ status })).success).toBe(false);
      }
    );

    /**
     * Pinned: the enum accepts five values but its message names four. OVERDUE is
     * valid and never mentioned, so a rejected value is described by a list that
     * is missing one of the options it could have used.
     */
    it("reports a message that omits OVERDUE from the valid values", () => {
      expect(errorFor(InvoiceSchema, makeInvoiceInput({ status: "NOPE" }), "status")).toBe(
        "status must be DRAFT, DUE, PAID, or VOID"
      );
    });

    /**
     * Pinned: `utils/constants.ts` exports a PENDING_APPROVAL status that the
     * schema does not accept. Anything persisting that value fails validation.
     */
    it("rejects PENDING_APPROVAL even though InvoiceStatus exports it", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ status: "PENDING_APPROVAL" })).success).toBe(
        false
      );
    });
  });

  describe("total_amount", () => {
    it("accepts a plain number — invoices are not in cents", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ total_amount: 2500.75 })).success).toBe(true);
    });

    it("rejects a numeric string — there is no coercion here", () => {
      expect(errorFor(InvoiceSchema, makeInvoiceInput({ total_amount: "2500" }), "total_amount")).toBe(
        "total_amount must be a number"
      );
    });

    it("accepts zero", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ total_amount: 0 })).success).toBe(true);
    });

    /** Pinned: nothing forbids a negative invoice total. */
    it("accepts a negative total", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ total_amount: -100 })).success).toBe(true);
    });

    it("requires total_amount", () => {
      const input = makeInvoiceInput();
      delete (input as any).total_amount;
      expect(parse(InvoiceSchema, input).success).toBe(false);
    });
  });

  describe("due_date", () => {
    it.each(["2026-03-15", "2026-12-31", "2026-01-01"])("accepts %s", (date) => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ due_date: date })).success).toBe(true);
    });

    it.each(["2026-03-15T00:00:00.000Z", "03/15/2026", "2026-3-15", "2026-02-30", ""])(
      "rejects %s",
      (date) => {
        expect(parse(InvoiceSchema, makeInvoiceInput({ due_date: date })).success).toBe(false);
      }
    );
  });

  describe("parent_invoice_id", () => {
    it("accepts null — a top-level invoice has no parent", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ parent_invoice_id: null })).success).toBe(true);
    });

    it("accepts a number", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ parent_invoice_id: 7 })).success).toBe(true);
    });

    it("rejects a string", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ parent_invoice_id: "7" })).success).toBe(false);
    });
  });

  describe("notes", () => {
    it("accepts a string", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ notes: "Paid by cheque" })).success).toBe(true);
    });

    it("accepts null", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ notes: null })).success).toBe(true);
    });

    it("treats an empty string as absent — makeOptionalOnEmpty preprocesses it away", () => {
      const result = parse(InvoiceSchema, makeInvoiceInput({ notes: "" }));
      expect(result.success).toBe(true);
      expect(result.data.notes).toBeUndefined();
    });
  });

  describe("created_at / updated_at", () => {
    it("accepts a full ISO datetime", () => {
      expect(
        parse(InvoiceSchema, makeInvoiceInput({ created_at: "2026-02-01T10:00:00.000Z" })).success
      ).toBe(true);
    });

    it("rejects a date-only string", () => {
      expect(errorFor(InvoiceSchema, makeInvoiceInput({ created_at: "2026-02-01" }), "created_at")).toBe(
        "created_at must be a valid datetime string"
      );
    });
  });

  describe("strictness", () => {
    it("rejects an unknown key", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ discount: 10 })).success).toBe(false);
    });

    /**
     * `items` lives on InvoiceWithItemsSchema, not here — so the list endpoint's
     * rows must be validated with the extended schema, never the base one.
     */
    it("rejects `items` — the base schema does not model line items", () => {
      expect(parse(InvoiceSchema, makeInvoiceInput({ items: [makeInvoiceItem()] })).success).toBe(
        false
      );
    });
  });
});

// ─── InvoiceItemSchema ───────────────────────────────────────────────────────

describe("InvoiceItemSchema", () => {
  it("accepts a minimal line item", () => {
    expect(parse(InvoiceItemSchema, makeInvoiceItem()).success).toBe(true);
  });

  it("requires a uuid invoice_item_id", () => {
    expect(
      errorFor(InvoiceItemSchema, makeInvoiceItem({ invoice_item_id: "item-123" }), "invoice_item_id")
    ).toBe("invoice_item_id must be a valid uuid");
  });

  /**
   * Pinned: `generateInvoiceItemId()` in utils/billingPeriodUtils.ts produces
   * `item-<timestamp>-<random>`, which is not a uuid — so ids minted by the app's
   * own helper fail this schema.
   */
  it("rejects the id shape generateInvoiceItemId() produces", () => {
    expect(
      parse(InvoiceItemSchema, makeInvoiceItem({ invoice_item_id: "item-1739000000000-abc123xyz" }))
        .success
    ).toBe(false);
  });

  describe("item_category", () => {
    it.each(["CARE_FEE", "MONTHLY_FEE", "ENTERTAINMENT", "TRANSPORT", "MEDICAL", "MISC"])(
      "accepts %s",
      (category) => {
        expect(parse(InvoiceItemSchema, makeInvoiceItem({ item_category: category })).success).toBe(
          true
        );
      }
    );

    it.each(["GROCERIES", "UTILITIES", "care_fee", ""])("rejects %s", (category) => {
      expect(parse(InvoiceItemSchema, makeInvoiceItem({ item_category: category })).success).toBe(
        false
      );
    });

    /**
     * The invoice categories are the *income* set. Expense-only categories from
     * the budget module (GROCERIES, UTILITIES) cannot be billed to a resident.
     */
    it("names all six valid categories in its error", () => {
      expect(errorFor(InvoiceItemSchema, makeInvoiceItem({ item_category: "GROCERIES" }), "item_category")).toBe(
        "item_category must be CARE_FEE, MONTHLY_FEE, ENTERTAINMENT, TRANSPORT, MEDICAL, or MISC"
      );
    });
  });

  describe("description", () => {
    it("rejects an empty description", () => {
      expect(errorFor(InvoiceItemSchema, makeInvoiceItem({ description: "" }), "description")).toBe(
        "description is required"
      );
    });

    it("rejects a non-string description", () => {
      expect(errorFor(InvoiceItemSchema, makeInvoiceItem({ description: 12 }), "description")).toBe(
        "description must be a string"
      );
    });

    /** Pinned: whitespace is not trimmed, so "   " counts as a description. */
    it("accepts whitespace as a description", () => {
      expect(parse(InvoiceItemSchema, makeInvoiceItem({ description: "   " })).success).toBe(true);
    });
  });

  describe("amount", () => {
    it("accepts a decimal amount", () => {
      expect(parse(InvoiceItemSchema, makeInvoiceItem({ amount: 99.99 })).success).toBe(true);
    });

    it("rejects a numeric string", () => {
      expect(errorFor(InvoiceItemSchema, makeInvoiceItem({ amount: "100" }), "amount")).toBe(
        "amount must be a number"
      );
    });

    /** Pinned: a negative line item is accepted — the schema allows credits. */
    it("accepts a negative amount", () => {
      expect(parse(InvoiceItemSchema, makeInvoiceItem({ amount: -50 })).success).toBe(true);
    });
  });

  it("rejects unknown keys", () => {
    expect(parse(InvoiceItemSchema, makeInvoiceItem({ tax: 5 })).success).toBe(false);
  });

  it("treats invoice_id as optional — items are built before the invoice has an id", () => {
    const item = makeInvoiceItem();
    expect(parse(InvoiceItemSchema, item).success).toBe(true);
    expect(parse(InvoiceItemSchema, { ...item, invoice_id: 3 }).success).toBe(true);
  });
});

// ─── InvoiceWithItemsSchema ──────────────────────────────────────────────────

describe("InvoiceWithItemsSchema", () => {
  it("accepts an invoice carrying line items", () => {
    const result = parse(InvoiceWithItemsSchema, {
      ...makeInvoiceInput(),
      items: [makeInvoiceItem()],
    });
    expect(result.success).toBe(true);
  });

  it("requires the items array", () => {
    expect(parse(InvoiceWithItemsSchema, makeInvoiceInput()).success).toBe(false);
  });

  /** Pinned: an invoice with no line items is structurally valid. */
  it("accepts an empty items array", () => {
    expect(
      parse(InvoiceWithItemsSchema, { ...makeInvoiceInput(), items: [] }).success
    ).toBe(true);
  });

  it("rejects the whole invoice when one item is malformed", () => {
    const result = parse(InvoiceWithItemsSchema, {
      ...makeInvoiceInput(),
      items: [makeInvoiceItem(), makeInvoiceItem({ description: "" })],
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(["items", 1, "description"]);
  });

  /**
   * Nothing reconciles the header total with the sum of its items, so an invoice
   * whose lines add up to a different number than it charges is accepted.
   */
  it("does not check that total_amount equals the sum of its items", () => {
    const result = parse(InvoiceWithItemsSchema, {
      ...makeInvoiceInput({ total_amount: 9999 }),
      items: [makeInvoiceItem({ amount: 1 })],
    });
    expect(result.success).toBe(true);
  });
});

// ─── InvoiceFormValidationSchema ─────────────────────────────────────────────

describe("InvoiceFormValidationSchema — the Add Invoice form", () => {
  it("accepts the minimal form payload", () => {
    expect(parse(InvoiceFormValidationSchema, makeInvoiceFormInput()).success).toBe(true);
  });

  it("labels user_id for a human — 'Resident is required'", () => {
    expect(errorFor(InvoiceFormValidationSchema, makeInvoiceFormInput({ user_id: "" }), "user_id")).toBe(
      "Resident is required"
    );
  });

  it("uses form-facing copy for the billing period too", () => {
    expect(
      errorFor(
        InvoiceFormValidationSchema,
        makeInvoiceFormInput({ billing_period: "2026-13" }),
        "billing_period"
      )
    ).toBe("Billing period must be in YYYY-MM format");
  });

  it("requires a calendar due date", () => {
    expect(
      parse(InvoiceFormValidationSchema, makeInvoiceFormInput({ due_date: "not-a-date" })).success
    ).toBe(false);
  });

  it("accepts optional notes and null notes", () => {
    expect(
      parse(InvoiceFormValidationSchema, makeInvoiceFormInput({ notes: "Split payment" })).success
    ).toBe(true);
    expect(parse(InvoiceFormValidationSchema, makeInvoiceFormInput({ notes: null })).success).toBe(
      true
    );
  });

  /**
   * Pinned: the form schema is *not* `.strict()` while `InvoiceSchema` is. Extra
   * keys pass here and are silently dropped, so the form cannot catch a field
   * that the API contract would reject.
   */
  it("silently strips unknown keys instead of rejecting them", () => {
    const result = parse(
      InvoiceFormValidationSchema,
      makeInvoiceFormInput({ lineItems: [{ amount: 10 }], home_id: TEST_HOME_ID })
    );
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("lineItems");
    expect(result.data).not.toHaveProperty("home_id");
  });

  /**
   * The form never collects `status`, `total_amount` or `created_by_user_id` —
   * `transformFormDataToInvoice` adds them. So the form schema passing is not
   * evidence that the resulting API payload is valid.
   */
  it("does not require the fields transformFormDataToInvoice fills in", () => {
    const result = parse(InvoiceFormValidationSchema, makeInvoiceFormInput());
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("status");
    expect(result.data).not.toHaveProperty("total_amount");
    expect(parse(InvoiceSchema, { ...makeInvoiceFormInput(), created_by_user_id: TEST_USER_ID }).success).toBe(
      false
    );
  });
});
