/**
 * RevOps — the pay-stub domain layer
 *
 *   utils/revops/constants.ts
 *
 * Every label, code and option the Payment screen uses comes from this one
 * file, and none of it had unit coverage. The Cypress specs exercise it through
 * the UI, which means a change here fails a dozen opaque end-to-end tests
 * rather than one obvious unit test.
 *
 * THE TWO CONVERTERS DEFAULT RATHER THAN THROW
 *   `revopsPayStubPeriodTypeFromBackend` and `revopsPayStubStatusFromBackend`
 *   both test for one value and fall through to the other. An unrecognised
 *   status therefore renders as **Due** and an unrecognised period type as
 *   **Monthly** — a new backend state would silently display as an existing
 *   one rather than as an error. Pinned in both directions below.
 *
 * THE OPTION BUILDERS MOVE WITH THE CLOCK
 *   `buildRevopsMonthOptions` walks back from `new Date()`, so every test that
 *   touches it freezes time first. Left unfrozen these assertions would pass
 *   today and fail next month, which is worse than no test at all.
 */

import {
  buildRevopsBiWeeklyDateRangeOptions,
  buildRevopsMonthOptions,
  REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS,
  REVOPS_MANUAL_PAYMENT_TYPE_UI,
  REVOPS_PAYMENT_ERROR_MESSAGES,
  REVOPS_PAYMENT_LOADER_TEXT,
  REVOPS_PAYMENT_PROVIDER_BACKEND,
  REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND,
  REVOPS_PAY_STUB_ACTION_TITLES,
  REVOPS_PAY_STUB_PAYMENT_METHOD_UI,
  REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND,
  REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS,
  REVOPS_PAY_STUB_PERIOD_TYPE_UI,
  REVOPS_PAY_STUB_PLACEHOLDERS,
  REVOPS_PAY_STUB_STATUS_BACKEND,
  REVOPS_PAY_STUB_STATUS_UI,
  REVOPS_PAY_STUB_VALIDATION_MESSAGES,
  REVOPS_PROCESS_PAYMENT_TEXT,
  revopsManualMethodToBackend,
  revopsPayStubPeriodTypeFromBackend,
  revopsPayStubStatusFromBackend,
} from "../../../utils/revops/constants";

/** Mon 14 Sep 2026, local noon. */
const SEP_2026 = new Date(2026, 8, 14, 12, 0, 0);

const freeze = (at: Date) => {
  jest.useFakeTimers();
  jest.setSystemTime(at);
};

afterEach(() => {
  jest.useRealTimers();
});

// ─── Period type, backend → UI ───────────────────────────────────────────────

describe("revopsPayStubPeriodTypeFromBackend", () => {
  it("turns BIWEEKLY into the hyphenated label the UI shows", () => {
    expect(revopsPayStubPeriodTypeFromBackend("BIWEEKLY")).toBe("Bi-Weekly");
  });

  it("turns MONTHLY into Monthly", () => {
    expect(revopsPayStubPeriodTypeFromBackend("MONTHLY")).toBe("Monthly");
  });

  it("[as-built] defaults anything unrecognised to Monthly", () => {
    // Only BIWEEKLY is tested for; everything else falls through. A new period
    // type would be displayed as Monthly rather than flagged.
    expect(revopsPayStubPeriodTypeFromBackend("WEEKLY")).toBe("Monthly");
  });

  it("[as-built] defaults undefined to Monthly", () => {
    expect(revopsPayStubPeriodTypeFromBackend(undefined)).toBe("Monthly");
  });

  it("[as-built] defaults an empty string to Monthly", () => {
    expect(revopsPayStubPeriodTypeFromBackend("")).toBe("Monthly");
  });

  it("is case-sensitive — lower-case biweekly is not recognised", () => {
    expect(revopsPayStubPeriodTypeFromBackend("biweekly")).toBe("Monthly");
  });

  it("round-trips the backend constant", () => {
    expect(
      revopsPayStubPeriodTypeFromBackend(REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY)
    ).toBe(REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY);
    expect(
      revopsPayStubPeriodTypeFromBackend(REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.MONTHLY)
    ).toBe(REVOPS_PAY_STUB_PERIOD_TYPE_UI.MONTHLY);
  });
});

// ─── Status, backend → UI ────────────────────────────────────────────────────

describe("revopsPayStubStatusFromBackend", () => {
  it("turns PAID into Paid", () => {
    expect(revopsPayStubStatusFromBackend("PAID")).toBe("Paid");
  });

  it("[as-built] shows a DRAFT stub as Due", () => {
    // The pay stubs table has exactly two pills, so every non-PAID state —
    // DRAFT, FINALIZED, PENDING — reads as "Due" and is offered a Pay button.
    expect(revopsPayStubStatusFromBackend("DRAFT")).toBe("Due");
  });

  it("[as-built] shows a FINALIZED stub as Due", () => {
    expect(revopsPayStubStatusFromBackend("FINALIZED")).toBe("Due");
  });

  it("[as-built] shows a VOID stub as Due", () => {
    // Worth knowing: a voided payout would still invite a payment.
    expect(revopsPayStubStatusFromBackend("VOID")).toBe("Due");
  });

  it("[as-built] shows an undefined status as Due", () => {
    expect(revopsPayStubStatusFromBackend(undefined)).toBe("Due");
  });

  it("is case-sensitive — lower-case paid reads as Due", () => {
    expect(revopsPayStubStatusFromBackend("paid")).toBe("Due");
  });

  it("round-trips the backend constant", () => {
    expect(revopsPayStubStatusFromBackend(REVOPS_PAY_STUB_STATUS_BACKEND.PAID)).toBe(
      REVOPS_PAY_STUB_STATUS_UI.PAID
    );
  });
});

// ─── Month options ───────────────────────────────────────────────────────────

describe("buildRevopsMonthOptions", () => {
  it("offers two years of months by default", () => {
    freeze(SEP_2026);
    expect(buildRevopsMonthOptions()).toHaveLength(24);
  });

  it("starts at the current month", () => {
    freeze(SEP_2026);
    expect(buildRevopsMonthOptions()[0]).toEqual({
      option: "September 2026",
      value: "2026-09",
    });
  });

  it("walks backwards, never forwards — you cannot pay a future month", () => {
    freeze(SEP_2026);
    const values = buildRevopsMonthOptions().map((o) => o.value);
    expect(values[1]).toBe("2026-08");
    expect(values).not.toContain("2026-10");
  });

  it("crosses the year boundary correctly", () => {
    freeze(SEP_2026);
    const values = buildRevopsMonthOptions().map((o) => o.value);
    expect(values).toContain("2025-12");
    expect(values).toContain("2025-01");
  });

  it("reaches back exactly 23 months from the current one", () => {
    freeze(SEP_2026);
    const values = buildRevopsMonthOptions().map((o) => o.value);
    expect(values[23]).toBe("2024-10");
  });

  it("zero-pads single-digit months", () => {
    freeze(new Date(2026, 0, 15, 12));
    expect(buildRevopsMonthOptions()[0].value).toBe("2026-01");
  });

  it("honours a shorter window", () => {
    freeze(SEP_2026);
    expect(buildRevopsMonthOptions({ monthsBack: 3 })).toHaveLength(3);
  });

  it("[boundary] returns nothing for a zero-month window", () => {
    freeze(SEP_2026);
    expect(buildRevopsMonthOptions({ monthsBack: 0 })).toEqual([]);
  });

  it("labels months in long form with the year", () => {
    freeze(SEP_2026);
    const options = buildRevopsMonthOptions({ monthsBack: 2 }).map((o) => o.option);
    expect(options).toEqual(["September 2026", "August 2026"]);
  });

  it("produces unique values", () => {
    freeze(SEP_2026);
    const values = buildRevopsMonthOptions().map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("works from the last day of a month", () => {
    // `new Date(y, m - i, 1)` always lands on the 1st, so the 31st cannot
    // overflow into the next month the way `setMonth` would.
    freeze(new Date(2026, 0, 31, 12));
    expect(buildRevopsMonthOptions({ monthsBack: 2 }).map((o) => o.value)).toEqual([
      "2026-01",
      "2025-12",
    ]);
  });

  it("works from a leap day", () => {
    freeze(new Date(2028, 1, 29, 12));
    expect(buildRevopsMonthOptions({ monthsBack: 1 })[0].value).toBe("2028-02");
  });
});

// ─── Bi-weekly halves ────────────────────────────────────────────────────────

describe("buildRevopsBiWeeklyDateRangeOptions", () => {
  it("always offers two halves", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-09")).toHaveLength(2);
  });

  it("starts the first half on the 1st", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-09")[0]).toEqual({
      option: "1st - 15th",
      value: "1-15",
    });
  });

  it("ends the second half on the month's real last day", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-09")[1]).toEqual({
      option: "16th - 30th",
      value: "16-30",
    });
  });

  it("[boundary] gets a 31-day month right", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-07")[1].value).toBe("16-31");
  });

  it("[boundary] gets February right in a common year", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-02")[1]).toEqual({
      option: "16th - 28th",
      value: "16-28",
    });
  });

  it("[boundary] gets February right in a leap year", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2028-02")[1]).toEqual({
      option: "16th - 29th",
      value: "16-29",
    });
  });

  it("[boundary] suffixes the 31st as 'st'", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-01")[1].option).toBe("16th - 31st");
  });

  it("[boundary] suffixes the 30th as 'th'", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-04")[1].option).toBe("16th - 30th");
  });

  it("[boundary] suffixes the 28th as 'th'", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-02")[1].option).toBe("16th - 28th");
  });

  it("falls back to a generic 31st when no month is given", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions()[1].value).toBe("16-31");
  });

  it("falls back for an unparseable month", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("not-a-month")[1].value).toBe("16-31");
  });

  it("falls back for an empty string", () => {
    expect(buildRevopsBiWeeklyDateRangeOptions("")[1].value).toBe("16-31");
  });

  it("[as-built] falls back when the month is 00", () => {
    // `if (!yyyy || !mm)` treats month 0 as missing, so an out-of-range month
    // quietly yields the default halves rather than an error.
    expect(buildRevopsBiWeeklyDateRangeOptions("2026-00")[1].value).toBe("16-31");
  });

  it("never leaves a gap between the two halves", () => {
    for (const month of ["2026-01", "2026-02", "2026-04", "2028-02"]) {
      const [first, second] = buildRevopsBiWeeklyDateRangeOptions(month);
      const firstEnd = Number(first.value.split("-")[1]);
      const secondStart = Number(second.value.split("-")[0]);
      expect(secondStart).toBe(firstEnd + 1);
    }
  });

  it("covers the whole month between the two halves", () => {
    const [first, second] = buildRevopsBiWeeklyDateRangeOptions("2026-09");
    expect(Number(first.value.split("-")[0])).toBe(1);
    expect(Number(second.value.split("-")[1])).toBe(30);
  });
});

// ─── Manual payment method, UI → backend ─────────────────────────────────────

describe("revopsManualMethodToBackend", () => {
  it("maps Bank Transfer to a snake-cased code", () => {
    expect(revopsManualMethodToBackend("Bank Transfer")).toBe("BANK_TRANSFER");
  });

  it("maps Check", () => {
    expect(revopsManualMethodToBackend("Check")).toBe("CHECK");
  });

  it("maps Cash", () => {
    expect(revopsManualMethodToBackend("Cash")).toBe("CASH");
  });

  it("maps PayPal", () => {
    expect(revopsManualMethodToBackend("PayPal")).toBe("PAYPAL");
  });

  it("maps Zelle", () => {
    expect(revopsManualMethodToBackend("Zelle")).toBe("ZELLE");
  });

  it("maps Venmo", () => {
    expect(revopsManualMethodToBackend("Venmo")).toBe("VENMO");
  });

  it("maps Other", () => {
    expect(revopsManualMethodToBackend("Other")).toBe("OTHER");
  });

  it("[as-built] falls back to OTHER for anything unrecognised", () => {
    // A payment made by a method the UI does not list is recorded as OTHER
    // rather than rejected, so the reference field is the only record of how.
    expect(revopsManualMethodToBackend("Crypto")).toBe("OTHER");
  });

  it("[as-built] falls back to OTHER for an empty string", () => {
    expect(revopsManualMethodToBackend("")).toBe("OTHER");
  });

  it("is case-sensitive — lower-case cash becomes OTHER", () => {
    expect(revopsManualMethodToBackend("cash")).toBe("OTHER");
  });

  it("maps every option the dropdown offers to a distinct code", () => {
    const codes = REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.map((o) =>
      revopsManualMethodToBackend(o.value)
    );
    expect(new Set(codes).size).toBe(REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.length);
  });

  it("never returns OTHER for a listed option except Other itself", () => {
    const unexpected = REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.filter(
      (o) => o.value !== "Other" && revopsManualMethodToBackend(o.value) === "OTHER"
    );
    expect(unexpected).toEqual([]);
  });
});

// ─── The option lists and label maps ─────────────────────────────────────────

describe("The pay period type options", () => {
  it("offers exactly two", () => {
    expect(REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS).toHaveLength(2);
  });

  it("uses the UI label as the value, not a code", () => {
    // The form stores "Bi-Weekly" and converts on submit, which is why the
    // modal compares against the UI constant rather than the backend one.
    expect(REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS[0]).toEqual({
      option: "Bi-Weekly",
      value: "Bi-Weekly",
    });
  });

  it("offers Bi-Weekly before Monthly", () => {
    expect(REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS.map((o) => o.option)).toEqual([
      "Bi-Weekly",
      "Monthly",
    ]);
  });
});

describe("The manual payment type options", () => {
  it("offers all seven methods", () => {
    expect(REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS).toHaveLength(7);
  });

  it("defaults to Bank Transfer", () => {
    expect(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE).toBe("Bank Transfer");
  });

  it("offers the default as a selectable option", () => {
    const values = REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
  });

  it("lists every method the UI map declares", () => {
    const declared = Object.values(REVOPS_MANUAL_PAYMENT_TYPE_UI);
    const offered = REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.map((o) => o.value);
    expect(offered.sort()).toEqual([...declared].sort());
  });

  it("uses the label as the value throughout", () => {
    REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS.forEach((o) => expect(o.option).toBe(o.value));
  });
});

describe("The status and period pills", () => {
  it("offers only Paid and Due", () => {
    expect(Object.values(REVOPS_PAY_STUB_STATUS_UI).sort()).toEqual(["Due", "Paid"]);
  });

  it("knows only PAID on the backend side", () => {
    // There is one backend status constant, which is why every other state
    // collapses to Due.
    expect(Object.keys(REVOPS_PAY_STUB_STATUS_BACKEND)).toEqual(["PAID"]);
  });

  it("offers two period types on each side", () => {
    expect(Object.keys(REVOPS_PAY_STUB_PERIOD_TYPE_UI)).toHaveLength(2);
    expect(Object.keys(REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND)).toHaveLength(2);
  });
});

describe("The form copy", () => {
  it("names a placeholder for every question", () => {
    expect(REVOPS_PAY_STUB_PLACEHOLDERS).toEqual({
      PERIOD_TYPE: "Select type",
      MONTH: "Select month",
      DATE_RANGE: "Select date range",
      CAREGIVER: "Select caregiver",
      CAREGIVER_LOADING: "Loading caregivers...",
    });
  });

  it("[defect] reuses the same string for the month placeholder and its error", () => {
    // "Select month" is both the empty-state option and the validation
    // message, so a test — or a user — cannot tell a pristine field from a
    // rejected one, and the complaint is invisible in the dropdown.
    expect(REVOPS_PAY_STUB_VALIDATION_MESSAGES.MONTH_REQUIRED).toBe(
      REVOPS_PAY_STUB_PLACEHOLDERS.MONTH
    );
  });

  it("[defect] reuses the same string for the date range too", () => {
    expect(REVOPS_PAY_STUB_VALIDATION_MESSAGES.DATE_RANGE_REQUIRED).toBe(
      REVOPS_PAY_STUB_PLACEHOLDERS.DATE_RANGE
    );
  });

  it("[defect] and for the caregiver", () => {
    expect(REVOPS_PAY_STUB_VALIDATION_MESSAGES.CAREGIVER_REQUIRED).toBe(
      REVOPS_PAY_STUB_PLACEHOLDERS.CAREGIVER
    );
  });

  it("distinguishes the period type message from its placeholder", () => {
    // The only one of the four that does.
    expect(REVOPS_PAY_STUB_VALIDATION_MESSAGES.PERIOD_TYPE_REQUIRED).not.toBe(
      REVOPS_PAY_STUB_PLACEHOLDERS.PERIOD_TYPE
    );
  });

  it("explains why a paid stub cannot be edited", () => {
    expect(REVOPS_PAY_STUB_ACTION_TITLES.EDIT_DISABLED_PAID).toBe(
      "Paid pay stubs cannot be edited"
    );
  });

  it("titles the enabled edit action plainly", () => {
    expect(REVOPS_PAY_STUB_ACTION_TITLES.EDIT).toBe("Edit pay stub");
  });

  it("labels the two payment methods and their CTAs", () => {
    expect(REVOPS_PROCESS_PAYMENT_TEXT.STRIPE_TITLE).toBe("Stripe");
    expect(REVOPS_PROCESS_PAYMENT_TEXT.MANUAL_TITLE).toBe("Record Manual Payment");
    expect(REVOPS_PROCESS_PAYMENT_TEXT.CTA_STRIPE).toBe("Pay with Stripe");
    expect(REVOPS_PROCESS_PAYMENT_TEXT.CTA_MANUAL).toBe("Mark as Paid");
  });

  it("gives the reference field an example", () => {
    expect(REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_PLACEHOLDER).toContain("TXN-");
  });
});

describe("The payment codes", () => {
  it("names the two providers", () => {
    expect(REVOPS_PAYMENT_PROVIDER_BACKEND).toEqual({
      STRIPE: "STRIPE",
      MANUAL: "MANUAL",
    });
  });

  it("distinguishes a payout from an invoice as the subject", () => {
    // The same /v1/revops/payment endpoint settles both, so this is what tells
    // the backend which one is being paid.
    expect(REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND).toEqual({
      INVOICE: "INVOICE",
      PAYROLL_PAYOUT: "PAYROLL_PAYOUT",
    });
  });

  it("uses a different loader message per method", () => {
    expect(REVOPS_PAYMENT_LOADER_TEXT.STRIPE_REDIRECT).not.toBe(
      REVOPS_PAYMENT_LOADER_TEXT.PROCESSING
    );
  });

  it("warns that Stripe will take the user off site", () => {
    expect(REVOPS_PAYMENT_LOADER_TEXT.STRIPE_REDIRECT).toContain("redirected");
  });

  it("has a fallback message for a failed payment", () => {
    expect(REVOPS_PAYMENT_ERROR_MESSAGES.CREATE_FAILED).toBe(
      "Payment failed. Please try again."
    );
  });

  it("names the two payment methods the UI switches on", () => {
    expect(REVOPS_PAY_STUB_PAYMENT_METHOD_UI).toEqual({
      STRIPE: "Stripe",
      MANUAL: "Manual",
    });
  });
});
