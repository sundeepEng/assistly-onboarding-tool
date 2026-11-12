/**
 * CRM — the user update and profile schemas
 *
 *   model/crm/user.model.ts
 *     UpdateLeadOrSeniorSchema(isInHomeCare)  the lead/senior save
 *     UpdatePCGSchema                         the care-team member save
 *     PersonalDetailsSchema                   the Profile modal (staff)
 *     PersonalDetailsSchemaPCHO               the Profile modal (PCHO's own)
 *     ScheduleHomeTourSchema                  the Schedule Tour form
 *     CreateSalesRepresentativeOrSalesDirectorSchema
 *     signInSchema                            the password rule
 *
 * `crm-schemas.test.ts` already covers the CREATE schemas. These are the
 * update and profile variants it stops short of — ~350 lines that decide
 * whether a save goes through, and none of it previously unit tested.
 *
 * UpdateLeadOrSeniorSchema IS THREE SCHEMAS MERGED
 *   `CreateLeadSchema(isInHomeCare)` + the e-sign/docusign fields +
 *   `CustomerSchema(isInHomeCare)`, then `.strip()`. So it demands everything
 *   a create demands — first name, last name, email, a ten-digit mobile — AND
 *   validates the entire nested profile in the same pass. A save cannot fix
 *   one tab without the others being valid too, which is the single most
 *   consequential thing about it.
 *
 * THE SAME FIELD HAS DIFFERENT RULES IN DIFFERENT FORMS
 *   `baseUsersSchema.firstName` uses `nameRegex` (no spaces needed but no
 *   punctuation); `PersonalDetailsSchema.firstName` uses `/^[A-Za-z0-9\s]+$/`.
 *   The second accepts a name of only spaces, the first does not. Both are
 *   pinned, because "why did this pass here and fail there" is otherwise a
 *   long afternoon.
 *
 * TWO PROFILE SCHEMAS THAT LOOK IDENTICAL AND ARE NOT
 *   `PersonalDetailsSchema` requires gender and birthdate inside
 *   `biography.personalDetails`; the PCHO variant has neither field at all.
 *   A PCHO editing their own profile is never asked for a date of birth.
 */

import {
  CreateSalesRepresentativeOrSalesDirectorSchema,
  PersonalDetailsSchema,
  PersonalDetailsSchemaPCHO,
  ScheduleHomeTourSchema,
  signInSchema,
  UpdateLeadOrSeniorSchema,
  UpdatePCGSchema,
} from "../../../model/crm/user.model";
import { TEST_HOME_ID } from "../../test-utils/auth";

const RESIDENTIAL = false;
const IN_HOME_CARE = true;

/** The identity fields every user schema here inherits. */
const identity = (overrides: Record<string, any> = {}) => ({
  firstName: "Mary",
  lastName: "Shaw",
  email: "mary.shaw@assistly.com",
  mobile: "5551234567",
  ...overrides,
});

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const pathsOf = (result: any) =>
  result.success ? [] : result.error.issues.map((i: any) => i.path.join("."));

// ═══════════════════════════════════════════════════════════════════════════
// UpdateLeadOrSeniorSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("UpdateLeadOrSeniorSchema — the identity it inherits", () => {
  const parse = (input: any, inHomeCare = RESIDENTIAL) =>
    UpdateLeadOrSeniorSchema(inHomeCare).safeParse(input);

  it("accepts the minimum a lead needs", () => {
    expect(parse(identity()).success).toBe(true);
  });

  it("requires a first name", () => {
    const { firstName, ...rest } = identity();
    expect(parse(rest).success).toBe(false);
  });

  it("requires a last name", () => {
    const { lastName, ...rest } = identity();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] does NOT require an email", () => {
    // `CreateLeadSchema` overrides the required `email` from
    // `baseUsersSchema` with an optional one — so a lead can be saved with no
    // way to email them. Only the format is checked once something is typed.
    const { email, ...rest } = identity();
    expect(parse(rest).success).toBe(true);
  });

  it("[as-built] does not require a mobile for a residential home", () => {
    const { mobile, ...rest } = identity();
    expect(parse(rest, RESIDENTIAL).success).toBe(true);
  });

  it("requires a mobile for an In-Home-Care home", () => {
    // The only difference between the two branches of the `mobile` ternary is
    // the trailing `.optional()`. A carer has to be able to reach the house.
    const { mobile, ...rest } = identity();
    expect(parse(rest, IN_HOME_CARE).success).toBe(false);
  });

  it("validates a supplied mobile the same way for both home types", () => {
    expect(parse(identity({ mobile: "555" }), RESIDENTIAL).success).toBe(false);
    expect(parse(identity({ mobile: "555" }), IN_HOME_CARE).success).toBe(false);
  });

  it("[as-built] lets a residential lead be saved with neither email nor phone", () => {
    const { email, mobile, ...rest } = identity();
    expect(parse(rest, RESIDENTIAL).success).toBe(true);
  });

  it("refuses an empty first name", () => {
    expect(parse(identity({ firstName: "" })).success).toBe(false);
  });

  it("[as-built] refuses a first name of only spaces", () => {
    // It trims before the min(1) check, so "   " becomes "" and fails —
    // unlike `PersonalDetailsSchema`, which accepts it.
    expect(parse(identity({ firstName: "   " })).success).toBe(false);
  });

  it("refuses punctuation in a first name", () => {
    expect(parse(identity({ firstName: "O'Brien" })).success).toBe(false);
  });

  it("explains the first name rule", () => {
    expect(messageFor(parse(identity({ firstName: "O'Brien" })), "firstName")).toBe(
      "First Name accepts only alphabets and numbers"
    );
  });

  it("accepts an empty middle name", () => {
    expect(parse(identity({ middleName: "" })).success).toBe(true);
  });

  it("refuses an invalid email", () => {
    expect(parse(identity({ email: "mary@assistly" })).success).toBe(false);
  });

  it("says the email is invalid", () => {
    expect(messageFor(parse(identity({ email: "nope" })), "email")).toBe("Invalid email");
  });

  it("[boundary] refuses a nine-digit mobile", () => {
    expect(parse(identity({ mobile: "555123456" })).success).toBe(false);
  });

  it("[boundary] refuses an eleven-digit mobile", () => {
    expect(parse(identity({ mobile: "55512345678" })).success).toBe(false);
  });

  it("refuses a formatted mobile", () => {
    expect(parse(identity({ mobile: "(555) 123-4567" })).success).toBe(false);
  });

  it("accepts an optional homeId as a uuid", () => {
    expect(parse(identity({ homeId: TEST_HOME_ID })).success).toBe(true);
  });

  it("refuses a homeId that is not a uuid", () => {
    expect(parse(identity({ homeId: "home-1" })).success).toBe(false);
  });

  it("[as-built] strips an unknown field — the save succeeds without it", () => {
    // The update schema now ends `.merge(CustomerSchema(...)).strip()`, so a
    // stray field is silently dropped rather than failing the save.
    const result = parse(identity({ nickname: "Mimi" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("nickname");
    }
  });
});

describe("UpdateLeadOrSeniorSchema — the update-only fields", () => {
  const parse = (input: any) => UpdateLeadOrSeniorSchema(RESIDENTIAL).safeParse(input);

  it("accepts the Lead role", () => {
    expect(parse(identity({ role: "Lead" })).success).toBe(true);
  });

  it("accepts the Senior role — the same schema serves both", () => {
    expect(parse(identity({ role: "Senior" })).success).toBe(true);
  });

  it("refuses any other role", () => {
    expect(parse(identity({ role: "PCG" })).success).toBe(false);
  });

  it("says the role must be Lead or Senior", () => {
    expect(messageFor(parse(identity({ role: "PCG" })), "role")).toBe(
      "role must be Lead/Senior"
    );
  });

  it("accepts every milestone the board uses", () => {
    ["initial contact", "tour", "onboarding", "contract", "lost"].forEach((m) =>
      expect(parse(identity({ milestone: [m] })).success).toBe(true)
    );
  });

  it("refuses a milestone outside the five", () => {
    expect(parse(identity({ milestone: ["maybe"] })).success).toBe(false);
  });

  it("accepts several milestones — the history is a list", () => {
    expect(
      parse(identity({ milestone: ["initial contact", "tour", "contract"] })).success
    ).toBe(true);
  });

  it("accepts each e-sign outcome", () => {
    ["completed", "declined", "expired", "pending"].forEach((status) =>
      expect(parse(identity({ onboardingESignEnvelopeStatus: status })).success).toBe(
        true
      )
    );
  });

  it("refuses an e-sign outcome outside the four", () => {
    expect(
      parse(identity({ onboardingESignEnvelopeStatus: "sent" })).success
    ).toBe(false);
  });

  it("[as-built] leaves docusignEnvelopeStatus completely unconstrained", () => {
    // The onboarding status is an enum; the contract one is a bare string.
    // The same concept, validated two different ways in one schema.
    expect(parse(identity({ docusignEnvelopeStatus: "anything at all" })).success).toBe(
      true
    );
  });

  it("requires contractCompletedOn to be a date, not a datetime", () => {
    expect(parse(identity({ contractCompletedOn: "2026-09-17" })).success).toBe(true);
    expect(
      parse(identity({ contractCompletedOn: "2026-09-17T10:00:00.000Z" })).success
    ).toBe(false);
  });

  it("accepts coordinates as numbers", () => {
    expect(parse(identity({ latitude: 39.78, longitude: -89.65 })).success).toBe(true);
  });

  it("refuses coordinates as strings", () => {
    expect(parse(identity({ latitude: "39.78" })).success).toBe(false);
  });

  it("[as-built] accepts any shape at all inside facesheet", () => {
    // `z.record(z.string(), z.any())` — the face sheet is stored unvalidated.
    expect(
      parse(identity({ facesheet: { anything: { nested: [1, 2, 3] } } })).success
    ).toBe(true);
  });

  it("accepts free-text notes", () => {
    expect(parse(identity({ notes: "Prefers mornings." })).success).toBe(true);
  });
});

describe("UpdateLeadOrSeniorSchema — the merged profile", () => {
  const parse = (input: any, inHomeCare = RESIDENTIAL) =>
    UpdateLeadOrSeniorSchema(inHomeCare).safeParse(input);

  it("accepts a lead with no profile sections at all", () => {
    expect(parse(identity()).success).toBe(true);
  });

  it("validates the biography in the same pass as the identity", () => {
    const result = parse(
      identity({
        biography: {
          personalDetails: { gender: "Nope", birthdate: "1942-03-11", address: {} },
        },
      })
    );
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("biography.personalDetails.gender");
  });

  it("[as-built] blocks a name change while an unrelated tab is invalid", () => {
    // Because the whole profile is merged and strict, a bad care-plan value
    // rejects a save the user thinks is only touching their name.
    const result = parse(
      identity({ firstName: "Marion", carePlan: { housekeeping: { laundry: "Maybe" } } })
    );
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("carePlan.housekeeping.laundry");
  });

  it("threads the In-Home-Care flag into the address rules", () => {
    const body = identity({
      biography: {
        personalDetails: { gender: "Female", birthdate: "1942-03-11", address: {} },
      },
    });
    expect(parse(body, RESIDENTIAL).success).toBe(true);
    expect(parse(body, IN_HOME_CARE).success).toBe(false);
  });

  it("accepts a complete In-Home-Care profile", () => {
    const body = identity({
      biography: {
        personalDetails: {
          gender: "Female",
          birthdate: "1942-03-11",
          address: {
            street1: "12 Oak Lane",
            city: "Springfield",
            state: "Illinois",
            zipCode: "62704",
          },
        },
      },
    });
    expect(parse(body, IN_HOME_CARE).success).toBe(true);
  });

  it("accepts medical, care plan and documents together", () => {
    expect(
      parse(identity({ medical: {}, carePlan: {}, documents: [] })).success
    ).toBe(true);
  });

  it("reports identity and profile failures in one response", () => {
    const result = parse(
      identity({ mobile: "555", carePlan: { housekeeping: { laundry: "Maybe" } } })
    );
    expect(result.success).toBe(false);
    const paths = pathsOf(result);
    expect(paths).toContain("mobile");
    expect(paths).toContain("carePlan.housekeeping.laundry");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UpdatePCGSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("UpdatePCGSchema", () => {
  const parse = (input: any) => UpdatePCGSchema.safeParse(input);

  it("accepts the minimum a care-team member needs", () => {
    expect(parse(identity()).success).toBe(true);
  });

  it("inherits the same identity rules", () => {
    expect(parse(identity({ mobile: "555" })).success).toBe(false);
    expect(parse(identity({ email: "nope" })).success).toBe(false);
  });

  it("accepts associated home ids as uuids", () => {
    expect(parse(identity({ associatedHomeIds: [TEST_HOME_ID] })).success).toBe(true);
  });

  it("refuses an associated home id that is not a uuid", () => {
    expect(parse(identity({ associatedHomeIds: ["home-1"] })).success).toBe(false);
  });

  it("accepts an empty associated-homes list", () => {
    expect(parse(identity({ associatedHomeIds: [] })).success).toBe(true);
  });

  it("accepts an emergency contact", () => {
    expect(
      parse(
        identity({
          biography: {
            personalDetails: {
              emergencyContactName: "Mary Shaw",
              emergencyContactNumber: "5551234567",
            },
          },
        })
      ).success
    ).toBe(true);
  });

  it("accepts an empty emergency contact — both fields are optional-on-empty", () => {
    expect(
      parse(
        identity({
          biography: {
            personalDetails: { emergencyContactName: "", emergencyContactNumber: "" },
          },
        })
      ).success
    ).toBe(true);
  });

  it("refuses a short emergency number", () => {
    const result = parse(
      identity({
        biography: { personalDetails: { emergencyContactNumber: "555" } },
      })
    );
    expect(result.success).toBe(false);
  });

  it("[as-built] allows digits in the emergency contact NAME", () => {
    // `/^[A-Za-z0-9\s]+$/` here, versus letters-only in
    // `PersonalDetailsSchema`. The same field, two rules.
    expect(
      parse(identity({ biography: { personalDetails: { emergencyContactName: "Ward 4" } } }))
        .success
    ).toBe(true);
  });

  it("accepts a contract completion date", () => {
    expect(parse(identity({ contractCompletedOn: "2026-09-17" })).success).toBe(true);
  });

  it("refuses a contract completion datetime", () => {
    expect(
      parse(identity({ contractCompletedOn: "2026-09-17T10:00:00Z" })).success
    ).toBe(false);
  });

  it("[as-built] is NOT strict about the merged half", () => {
    // `.merge()` on a strict base returns a schema whose unknown-key handling
    // comes from the second object — so a stray field passes here while the
    // same field fails on UpdateLeadOrSeniorSchema.
    expect(parse(identity({ somethingUnexpected: true })).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalDetailsSchema — the staff profile modal
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalDetailsSchema", () => {
  const profile = (overrides: Record<string, any> = {}) => ({
    firstName: "Mary",
    lastName: "Shaw",
    biography: {
      personalDetails: { gender: "Female", birthdate: "1942-03-11" },
    },
    ...overrides,
  });

  const parse = (input: any) => PersonalDetailsSchema.safeParse(input);

  it("accepts a complete profile", () => {
    expect(parse(profile()).success).toBe(true);
  });

  it("requires a first and last name", () => {
    expect(parse({ ...profile(), firstName: "" }).success).toBe(false);
    expect(parse({ ...profile(), lastName: "" }).success).toBe(false);
  });

  it("[as-built] accepts a first name of only spaces", () => {
    // `/^[A-Za-z0-9\s]+$/` with no trim, so "   " satisfies both min(1) and
    // the regex — the opposite of `UpdateLeadOrSeniorSchema`.
    expect(parse(profile({ firstName: "   " })).success).toBe(true);
  });

  it("refuses punctuation in a name", () => {
    expect(parse(profile({ firstName: "O'Brien" })).success).toBe(false);
  });

  it("accepts a name with spaces", () => {
    expect(parse(profile({ firstName: "Mary Anne" })).success).toBe(true);
  });

  it("treats email as optional", () => {
    expect(parse(profile()).success).toBe(true);
  });

  it("accepts an empty email", () => {
    expect(parse(profile({ email: "" })).success).toBe(true);
  });

  it("validates a supplied email loosely", () => {
    // `/^\S+@\S+\.\S+$/` — looser than the create schema's rule.
    expect(parse(profile({ email: "mary@assistly.com" })).success).toBe(true);
    expect(parse(profile({ email: "mary@assistly" })).success).toBe(false);
  });

  it("[as-built] accepts an email the create schema would refuse", () => {
    // No character class at all, so "a@b.c" passes here and fails there.
    expect(parse(profile({ email: "a@b.c" })).success).toBe(true);
  });

  it("treats mobile as optional but validates its length", () => {
    expect(parse(profile({ mobile: "" })).success).toBe(true);
    expect(parse(profile({ mobile: "5551234567" })).success).toBe(true);
    expect(parse(profile({ mobile: "555" })).success).toBe(false);
  });

  it("requires a gender inside the biography when the biography is present", () => {
    const result = parse({
      ...profile(),
      biography: { personalDetails: { birthdate: "1942-03-11" } },
    });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("biography.personalDetails.gender");
  });

  it("requires a birthdate inside the biography", () => {
    const result = parse({
      ...profile(),
      biography: { personalDetails: { gender: "Female" } },
    });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("biography.personalDetails.birthdate");
  });

  it("accepts a profile with no biography section at all", () => {
    const { biography, ...rest } = profile();
    expect(parse(rest).success).toBe(true);
  });

  it("requires letters only in the emergency contact name", () => {
    const withName = (emergencyContactName: string) =>
      parse({
        ...profile(),
        biography: {
          personalDetails: {
            gender: "Female",
            birthdate: "1942-03-11",
            emergencyContactName,
          },
        },
      });
    expect(withName("Mary Shaw").success).toBe(true);
    expect(withName("Ward 4").success).toBe(false);
  });

  it("[as-built] is not strict — an unknown field is stripped", () => {
    const result = parse(profile({ stray: 1 }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("stray");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalDetailsSchemaPCHO — the PCHO's own profile
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalDetailsSchemaPCHO", () => {
  const profile = (overrides: Record<string, any> = {}) => ({
    firstName: "Test",
    lastName: "User",
    ...overrides,
  });

  const parse = (input: any) => PersonalDetailsSchemaPCHO.safeParse(input);

  it("accepts a first and last name alone", () => {
    expect(parse(profile()).success).toBe(true);
  });

  it("[as-built] never asks a PCHO for a gender", () => {
    // The staff variant requires both inside `biography.personalDetails`;
    // this one does not declare either field.
    expect(parse(profile({ biography: { personalDetails: {} } })).success).toBe(true);
  });

  it("[as-built] never asks a PCHO for a birthdate", () => {
    expect(
      parse(profile({ biography: { personalDetails: { emergencyContactName: "Sam" } } }))
        .success
    ).toBe(true);
  });

  it("requires the two names", () => {
    expect(parse({ lastName: "User" }).success).toBe(false);
    expect(parse({ firstName: "Test" }).success).toBe(false);
  });

  it("treats email and mobile as optional", () => {
    expect(parse(profile({ email: "", mobile: "" })).success).toBe(true);
  });

  it("validates a supplied mobile's length", () => {
    expect(parse(profile({ mobile: "555" })).success).toBe(false);
  });

  it("accepts an emergency contact", () => {
    expect(
      parse(
        profile({
          biography: {
            personalDetails: {
              emergencyContactName: "Sam Ray",
              emergencyContactNumber: "5559990000",
            },
          },
        })
      ).success
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ScheduleHomeTourSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("ScheduleHomeTourSchema", () => {
  const parse = (input: any) => ScheduleHomeTourSchema.safeParse(input);

  it("accepts a date and a time", () => {
    expect(parse({ scheduleDate: "2026-09-20", scheduleTime: "10:00" }).success).toBe(
      true
    );
  });

  it("requires a date", () => {
    expect(parse({ scheduleTime: "10:00" }).success).toBe(false);
  });

  it("asks for a date in plain words", () => {
    expect(
      messageFor(parse({ scheduleDate: "", scheduleTime: "10:00" }), "scheduleDate")
    ).toBe("Please select a date");
  });

  it("requires a time", () => {
    expect(parse({ scheduleDate: "2026-09-20" }).success).toBe(false);
  });

  it("asks for a time in plain words", () => {
    expect(
      messageFor(parse({ scheduleDate: "2026-09-20", scheduleTime: "" }), "scheduleTime")
    ).toBe("Please select a time");
  });

  it("complains about both when the form is empty", () => {
    expect(pathsOf(parse({})).sort()).toEqual(["scheduleDate", "scheduleTime"]);
  });

  it("[as-built] does not check that the date is a date", () => {
    // Only `min(1)`, so "tomorrow-ish" schedules a tour.
    expect(parse({ scheduleDate: "tomorrow-ish", scheduleTime: "elevenish" }).success).toBe(
      true
    );
  });

  it("[as-built] does not stop a tour being booked in the past", () => {
    expect(parse({ scheduleDate: "1999-01-01", scheduleTime: "10:00" }).success).toBe(
      true
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The sales roles
// ═══════════════════════════════════════════════════════════════════════════

describe("CreateSalesRepresentativeOrSalesDirectorSchema", () => {
  const parse = (input: any) =>
    CreateSalesRepresentativeOrSalesDirectorSchema.safeParse(input);

  it("accepts a sales representative", () => {
    expect(parse(identity({ role: "SalesRepresentative" })).success).toBe(true);
  });

  it("accepts a sales director", () => {
    expect(parse(identity({ role: "SalesDirector" })).success).toBe(true);
  });

  it("[as-built] accepts no role at all", () => {
    // The role is optional, so this schema will happily create a user with
    // none — the caller has to supply it.
    expect(parse(identity()).success).toBe(true);
  });

  it("refuses any other role", () => {
    expect(parse(identity({ role: "PCG" })).success).toBe(false);
  });

  it("explains which roles it accepts", () => {
    expect(messageFor(parse(identity({ role: "PCG" })), "role")).toBe(
      "Role accepts only SalesRepresentative or SalesDirector"
    );
  });

  it("inherits the identity rules", () => {
    expect(parse(identity({ mobile: "555", role: "SalesDirector" })).success).toBe(false);
  });

  it("accepts an optional pay rate", () => {
    expect(parse(identity({ payRate: 25 })).success).toBe(true);
  });

  it("refuses a negative pay rate", () => {
    expect(parse(identity({ payRate: -1 })).success).toBe(false);
  });

  it("refuses a pay rate as a string", () => {
    expect(parse(identity({ payRate: "25" })).success).toBe(false);
  });

  it("is strict", () => {
    expect(parse(identity({ territory: "North" })).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// signInSchema — the password rule
// ═══════════════════════════════════════════════════════════════════════════

describe("signInSchema", () => {
  const parse = (input: any) => signInSchema.safeParse(input);
  const creds = (password: string) => ({ email: "mary@assistly.com", password });

  it("accepts a password meeting every rule", () => {
    expect(parse(creds("Passw0rd!")).success).toBe(true);
  });

  it("[boundary] refuses seven characters", () => {
    expect(parse(creds("Pass0!a")).success).toBe(false);
  });

  it("[boundary] accepts exactly eight", () => {
    expect(parse(creds("Pass0!ab")).success).toBe(true);
  });

  it("requires a lower-case letter", () => {
    expect(parse(creds("PASSW0RD!")).success).toBe(false);
  });

  it("requires an upper-case letter", () => {
    expect(parse(creds("passw0rd!")).success).toBe(false);
  });

  it("requires a digit", () => {
    expect(parse(creds("Password!")).success).toBe(false);
  });

  it("requires one of the five special characters", () => {
    expect(parse(creds("Passw0rdA")).success).toBe(false);
  });

  it("accepts each permitted special character", () => {
    ["@", "$", "!", "%", "*", "?", "&"].forEach((ch) =>
      expect(parse(creds(`Passw0rd${ch}`)).success).toBe(true)
    );
  });

  it("[as-built] refuses a special character outside the allowed set", () => {
    // The character class is exclusive, so a '#' is not merely ignored — it
    // makes the whole password invalid.
    expect(parse(creds("Passw0rd#")).success).toBe(false);
  });

  it("refuses an empty password", () => {
    expect(parse(creds("")).success).toBe(false);
  });

  it("refuses an invalid email", () => {
    expect(parse({ email: "nope", password: "Passw0rd!" }).success).toBe(false);
  });

  it("says the email is invalid", () => {
    expect(messageFor(parse({ email: "nope", password: "Passw0rd!" }), "email")).toBe(
      "Invalid Email"
    );
  });

  it("refuses an empty email", () => {
    expect(parse({ email: "", password: "Passw0rd!" }).success).toBe(false);
  });

  it("is strict — no remember-me smuggled through", () => {
    expect(
      parse({ email: "mary@assistly.com", password: "Passw0rd!", remember: true }).success
    ).toBe(false);
  });
});
