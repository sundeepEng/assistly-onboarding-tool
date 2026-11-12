/**
 * The last uncovered schemas and cookie helpers
 *
 *   model/home/home-model.ts        HomeDetailsSchema      the Home Details form
 *   model/hcm/team-model.ts         updateHcmTeamMember    the wage/roster save
 *   model/support/support.model.ts  SupportRequestSchema, SupportAttachmentSchema
 *   utils/auth.ts                   the isSalesRequired cookie trio
 *   utils/revops/constants.ts       the Stripe return URLs
 *
 * These close out the audit: every file under `utils/`, `model/` and
 * `services/` with real logic in it now has coverage, apart from the PDF
 * pipeline, the AWS/DocuSeal/Google SDK wrappers and the plain constant lists.
 *
 * `updateHcmTeamMember` IS THE ONLY PLACE PAY IS VALIDATED
 *   `pay_rate` is `.positive()`, so a zero wage is refused outright — which is
 *   why the scheduling board has a distinct "no wage set" popup rather than
 *   treating 0 as unpaid. It is also a strict NUMBER, and the roster stores
 *   rates as strings, which is the root of the pay-period export crash pinned
 *   in `hcm-pay-period-report.test.ts`.
 */

import Cookies from "js-cookie";
import { updateHcmTeamMember } from "../../../model/hcm/team-model";
import { HomeDetailsSchema } from "../../../model/home/home-model";
import {
  SupportAttachmentSchema,
  SupportRequestSchema,
} from "../../../model/support/support.model";
import {
  getIsSalesRequiredFromCookie,
  removeIsSalesRequiredCookie,
  setIsSalesRequiredInCookie,
} from "../../../utils/auth";
import {
  REVOPS_PAYMENT_REDIRECT_URLS,
  REVOPS_PAYROLL_PERIOD_STATUS_UI,
  REVOPS_SENIOR_PAYMENT_REDIRECT_URLS,
} from "../../../utils/revops/constants";

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// ═══════════════════════════════════════════════════════════════════════════
// HomeDetailsSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("HomeDetailsSchema", () => {
  const home = (overrides: Record<string, any> = {}) => ({
    homeName: "Comfort Cove",
    ...overrides,
  });
  const parse = (input: any) => HomeDetailsSchema.safeParse(input);

  it("accepts a name alone", () => {
    expect(parse(home()).success).toBe(true);
  });

  it("requires a home name", () => {
    expect(parse({}).success).toBe(false);
  });

  it("says the home name is required", () => {
    expect(messageFor(parse(home({ homeName: "" })), "homeName")).toBe(
      "Home name is required"
    );
  });

  it("accepts a capacity", () => {
    expect(parse(home({ homeCapacity: 12 })).success).toBe(true);
  });

  it("treats capacity as optional", () => {
    expect(parse(home()).success).toBe(true);
  });

  it("[boundary] refuses a capacity of zero", () => {
    // A home with no beds is not a home — and the occupancy helper guards
    // against dividing by it separately.
    expect(parse(home({ homeCapacity: 0 })).success).toBe(false);
  });

  it("[boundary] accepts a capacity of one", () => {
    expect(parse(home({ homeCapacity: 1 })).success).toBe(true);
  });

  it("refuses a capacity as a string — no coercion here", () => {
    expect(parse(home({ homeCapacity: "12" })).success).toBe(false);
  });

  it("says the capacity must be a number", () => {
    expect(messageFor(parse(home({ homeCapacity: "12" })), "homeCapacity")).toBe(
      "Capacity must be a number"
    );
  });

  it("accepts a full address", () => {
    expect(
      parse(
        home({
          homeAddress: {
            street: "12 Oak Lane",
            city: "Springfield",
            state: "Illinois",
            zipCode: "62704",
          },
        })
      ).success
    ).toBe(true);
  });

  it("treats the address as optional", () => {
    expect(parse(home()).success).toBe(true);
  });

  it("requires every part once an address is given", () => {
    expect(parse(home({ homeAddress: { street: "12 Oak Lane" } })).success).toBe(false);
  });

  it("refuses digits in the city", () => {
    const address = {
      street: "12 Oak Lane",
      city: "Springfield 2",
      state: "Illinois",
      zipCode: "62704",
    };
    expect(messageFor(parse(home({ homeAddress: address })), "homeAddress.city")).toBe(
      "City accepts only alphabets"
    );
  });

  it("refuses digits in the state", () => {
    const address = {
      street: "12 Oak Lane",
      city: "Springfield",
      state: "IL1",
      zipCode: "62704",
    };
    expect(parse(home({ homeAddress: address })).success).toBe(false);
  });

  it("accepts a city with a space", () => {
    const address = {
      street: "12 Oak Lane",
      city: "New Springfield",
      state: "Illinois",
      zipCode: "62704",
    };
    expect(parse(home({ homeAddress: address })).success).toBe(true);
  });

  it("[boundary] accepts a nine-digit ZIP", () => {
    const address = {
      street: "12 Oak Lane",
      city: "Springfield",
      state: "Illinois",
      zipCode: "62704-1234",
    };
    expect(parse(home({ homeAddress: address })).success).toBe(true);
  });

  it("[boundary] refuses a four-digit ZIP", () => {
    const address = {
      street: "12 Oak Lane",
      city: "Springfield",
      state: "Illinois",
      zipCode: "6270",
    };
    expect(parse(home({ homeAddress: address })).success).toBe(false);
  });

  it("[as-built] strips an unknown address field — the save succeeds without it", () => {
    // `homeAddress` moved from `.strict()` to `.strip()`, so a stray field is
    // silently dropped rather than failing the save.
    const address = {
      street: "12 Oak Lane",
      city: "Springfield",
      state: "Illinois",
      zipCode: "62704",
      county: "Sangamon",
    };
    const result = parse(home({ homeAddress: address }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homeAddress).not.toHaveProperty("county");
    }
  });

  it("[as-built] is NOT strict at the top level", () => {
    const result = parse(home({ authorizedModules: ["CRM"] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("authorizedModules");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateHcmTeamMember
// ═══════════════════════════════════════════════════════════════════════════

describe("updateHcmTeamMember", () => {
  const roster = (overrides: Record<string, any> = {}) => ({
    pay_rate: 20,
    ...overrides,
  });
  const parse = (input: any) => updateHcmTeamMember.safeParse(input);

  it("accepts a pay rate alone", () => {
    expect(parse(roster()).success).toBe(true);
  });

  it("defaults the frequency to Hourly", () => {
    const result = parse(roster());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pay_frequency).toBe("Hourly");
  });

  it("accepts Monthly", () => {
    expect(parse(roster({ pay_frequency: "Monthly" })).success).toBe(true);
  });

  it("refuses a frequency outside the two", () => {
    expect(parse(roster({ pay_frequency: "Weekly" })).success).toBe(false);
  });

  it("requires a pay rate", () => {
    expect(parse({}).success).toBe(false);
  });

  it("[boundary] refuses a pay rate of zero", () => {
    // `.positive()`, not `.nonnegative()` — which is why the board has a
    // separate "this carer has no wage" popup instead of showing $0.
    expect(parse(roster({ pay_rate: 0 })).success).toBe(false);
  });

  it("explains that pay must be positive", () => {
    expect(messageFor(parse(roster({ pay_rate: 0 })), "pay_rate")).toBe(
      "pay must be positive"
    );
  });

  it("refuses a negative pay rate", () => {
    expect(parse(roster({ pay_rate: -5 })).success).toBe(false);
  });

  it("[as-built] refuses a pay rate as a string, though the roster stores one", () => {
    // The API returns `pay_rate` as a string on existing rosters, so a
    // round-trip has to convert — the same mismatch behind the pay-period
    // export crash.
    expect(parse(roster({ pay_rate: "20" })).success).toBe(false);
  });

  it("says pay must be a number", () => {
    expect(messageFor(parse(roster({ pay_rate: "20" })), "pay_rate")).toBe(
      "pay must be a number"
    );
  });

  it("accepts a fractional pay rate", () => {
    expect(parse(roster({ pay_rate: 17.5 })).success).toBe(true);
  });

  it("accepts an optional role", () => {
    expect(parse(roster({ role: "Caregiver" })).success).toBe(true);
  });

  it("treats an empty role as absent", () => {
    const result = parse(roster({ role: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBeUndefined();
  });

  it("accepts a start date as a Date", () => {
    expect(parse(roster({ start_date: new Date("2026-09-01") })).success).toBe(true);
  });

  it("[as-built] refuses a start date as a string", () => {
    // `z.date()`, so the form has to hand over a Date object.
    expect(parse(roster({ start_date: "2026-09-01" })).success).toBe(false);
  });

  it("treats an empty start date as absent", () => {
    expect(parse(roster({ start_date: "" })).success).toBe(true);
  });

  it("accepts the wage label as a string", () => {
    expect(parse(roster({ wage: "$20.00/hour" })).success).toBe(true);
  });

  it("accepts a contract completion date and an effective date as strings", () => {
    expect(
      parse(roster({ contractCompletedOn: "2026-09-01", effective_date: "2026-09-15" }))
        .success
    ).toBe(true);
  });

  it("[as-built] does not validate the shape of either date string", () => {
    expect(parse(roster({ effective_date: "next Tuesday" })).success).toBe(true);
  });

  it("[as-built] is not strict — an unknown field is stripped", () => {
    const result = parse(roster({ bonus: 500 }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("bonus");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The support request
// ═══════════════════════════════════════════════════════════════════════════

describe("SupportAttachmentSchema", () => {
  const attachment = (overrides: Record<string, any> = {}) => ({
    filename: "screenshot.png",
    contentType: "image/png",
    data: "aGVsbG8=",
    ...overrides,
  });
  const parse = (input: any) => SupportAttachmentSchema.safeParse(input);

  it("accepts a base64 attachment", () => {
    expect(parse(attachment()).success).toBe(true);
  });

  it("requires a filename", () => {
    expect(parse(attachment({ filename: "" })).success).toBe(false);
  });

  it("requires a content type", () => {
    expect(parse(attachment({ contentType: "" })).success).toBe(false);
  });

  it("requires base64 data", () => {
    expect(parse(attachment({ data: "" })).success).toBe(false);
  });

  it("refuses data that is not base64", () => {
    expect(parse(attachment({ data: "hello world!" })).success).toBe(false);
  });

  it("explains the base64 rule", () => {
    expect(messageFor(parse(attachment({ data: "not base64!" })), "data")).toBe(
      "data must be base64 encoded"
    );
  });

  it("accepts base64 padding", () => {
    expect(parse(attachment({ data: "aGVsbG8gd29ybGQ=" })).success).toBe(true);
  });

  it("[as-built] does not check the content type is a real mime type", () => {
    // The message says "must be a valid mime type" but the rule is `min(1)`.
    expect(parse(attachment({ contentType: "banana" })).success).toBe(true);
  });

  it("[as-built] does not cap the attachment size", () => {
    expect(parse(attachment({ data: "a".repeat(100_000) })).success).toBe(true);
  });

  it("is strict", () => {
    expect(parse(attachment({ size: 1024 })).success).toBe(false);
  });
});

describe("SupportRequestSchema", () => {
  const request = (overrides: Record<string, any> = {}) => ({
    userEmail: "mary@assistly.com",
    subject: "Cannot save a pay stub",
    body: "The Save button does nothing.",
    ...overrides,
  });
  const parse = (input: any) => SupportRequestSchema.safeParse(input);

  it("accepts a complete request", () => {
    expect(parse(request()).success).toBe(true);
  });

  it("requires a subject", () => {
    expect(parse(request({ subject: "" })).success).toBe(false);
  });

  it("requires a body", () => {
    expect(parse(request({ body: "" })).success).toBe(false);
  });

  it("requires a user email", () => {
    const { userEmail, ...rest } = request();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] does not validate the email's format", () => {
    // A plain `z.string()` with no `.email()`, so a support request can be
    // raised with an address nobody can reply to.
    expect(parse(request({ userEmail: "not-an-email" })).success).toBe(true);
  });

  it("[as-built] accepts an empty email", () => {
    expect(parse(request({ userEmail: "" })).success).toBe(true);
  });

  it("accepts attachments", () => {
    expect(
      parse(
        request({
          attachments: [
            { filename: "a.png", contentType: "image/png", data: "aGVsbG8=" },
          ],
        })
      ).success
    ).toBe(true);
  });

  it("treats attachments as optional", () => {
    expect(parse(request()).success).toBe(true);
  });

  it("accepts an empty attachment list", () => {
    expect(parse(request({ attachments: [] })).success).toBe(true);
  });

  it("rejects the whole request for one bad attachment", () => {
    const result = parse(
      request({
        attachments: [
          { filename: "a.png", contentType: "image/png", data: "aGVsbG8=" },
          { filename: "", contentType: "image/png", data: "aGVsbG8=" },
        ],
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["attachments", 1, "filename"]);
    }
  });

  it("is strict", () => {
    expect(parse(request({ priority: "high" })).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The isSalesRequired cookie
// ═══════════════════════════════════════════════════════════════════════════

describe("the isSalesRequired cookie", () => {
  afterEach(() => {
    Cookies.remove("isSalesRequired");
  });

  it("reads back true", () => {
    setIsSalesRequiredInCookie(true);
    expect(getIsSalesRequiredFromCookie()).toBe(true);
  });

  it("reads back false", () => {
    setIsSalesRequiredInCookie(false);
    expect(getIsSalesRequiredFromCookie()).toBe(false);
  });

  it("returns null when it was never set", () => {
    // Deliberately three-valued: null means "not yet known", which is what
    // makes `getInitialRoute` skip its sales branch.
    expect(getIsSalesRequiredFromCookie()).toBeNull();
  });

  it("returns null after it is removed", () => {
    setIsSalesRequiredInCookie(true);
    removeIsSalesRequiredCookie();
    expect(getIsSalesRequiredFromCookie()).toBeNull();
  });

  it("stores the value as a string", () => {
    setIsSalesRequiredInCookie(true);
    expect(Cookies.get("isSalesRequired")).toBe("true");
  });

  it("[as-built] treats any value other than the literal 'true' as false", () => {
    Cookies.set("isSalesRequired", "yes");
    expect(getIsSalesRequiredFromCookie()).toBe(false);
  });

  it("[as-built] treats the string 'false' as false, not as absent", () => {
    Cookies.set("isSalesRequired", "false");
    expect(getIsSalesRequiredFromCookie()).toBe(false);
  });

  it("overwrites a previous value", () => {
    setIsSalesRequiredInCookie(true);
    setIsSalesRequiredInCookie(false);
    expect(getIsSalesRequiredFromCookie()).toBe(false);
  });

  it("is safe to remove when it was never set", () => {
    expect(() => removeIsSalesRequiredCookie()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The Stripe return URLs
// ═══════════════════════════════════════════════════════════════════════════

describe("the RevOps payment redirect URLs", () => {
  it("sends a payroll payment back to the Payment screen", () => {
    expect(REVOPS_PAYMENT_REDIRECT_URLS.SUCCESS).toContain("/revops/payments");
  });

  it("sends a cancelled payroll payment to the same place", () => {
    // Same URL for both, so a cancelled Stripe checkout lands where it
    // started rather than on an error page.
    expect(REVOPS_PAYMENT_REDIRECT_URLS.CANCEL).toBe(
      REVOPS_PAYMENT_REDIRECT_URLS.SUCCESS
    );
  });

  it("sends a resident's invoice payment back to Billing", () => {
    expect(REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.SUCCESS).toContain(
      "/revops/billing-invoice"
    );
  });

  it("sends a cancelled invoice payment to the same place", () => {
    expect(REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.CANCEL).toBe(
      REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.SUCCESS
    );
  });

  it("keeps the two audiences on different screens", () => {
    expect(REVOPS_PAYMENT_REDIRECT_URLS.SUCCESS).not.toBe(
      REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.SUCCESS
    );
  });

  it("builds absolute URLs, as Stripe requires", () => {
    expect(REVOPS_PAYMENT_REDIRECT_URLS.SUCCESS).toMatch(/^https?:\/\//);
  });
});

describe("REVOPS_PAYROLL_PERIOD_STATUS_UI", () => {
  it("names the three payroll-period states", () => {
    expect(REVOPS_PAYROLL_PERIOD_STATUS_UI).toEqual({
      PAID: "Paid",
      PROCESSED: "Processed",
      PENDING: "Pending",
    });
  });

  it("[as-built] is richer than the pay stub pill, which has only Paid and Due", () => {
    // The Summary tab these were written for is commented out in
    // `revops-payroll.tsx`, so nothing renders them today.
    expect(Object.keys(REVOPS_PAYROLL_PERIOD_STATUS_UI)).toHaveLength(3);
  });
});
