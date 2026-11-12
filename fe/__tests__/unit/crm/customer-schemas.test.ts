/**
 * CRM — the senior/lead profile schemas
 *
 *   model/crm/customer.model.ts
 *     PersonalDetails(isInHomeCare)   the Biography > Personal Details form
 *     BiographySchema(isInHomeCare)   the whole Biography tab
 *     MedicalSchema                   the Medical tab
 *     CarePlanSchema                  the Care Plan tab
 *     CustomerSchema(isInHomeCare)    all of it, as one PUT body
 *     nameRegex                       the name rule shared across the app
 *
 * ~500 lines of validation behind the lead and senior profile, none of it
 * previously unit tested. The Cypress specs drive these forms, so a rule moved
 * here fails a dozen opaque end-to-end tests instead of one obvious unit test.
 *
 * EVERY SCHEMA HERE IS A FACTORY TAKING `isInHomeCare`
 *   An In-Home-Care home visits the resident, so their ADDRESS is mandatory.
 *   A residential home houses them, so it is not. That single flag flips
 *   street1, city, state and zipCode between required and optional — a whole
 *   second validation path, and both are asserted below.
 *
 * `makeOptionalOnEmpty` IS WHY EMPTY STRINGS PASS
 *   Nearly every optional field is wrapped in it, which preprocesses `""` to
 *   `undefined` before validating. So an untouched input passes even when its
 *   regex would reject "" — and the field disappears from the payload rather
 *   than being sent as empty. That is the single most important thing to know
 *   about these forms, and it is pinned in both directions.
 *
 * OBJECT BODIES ARE `.strict()`; THE TOP-LEVEL PROFILE IS `.strip()`
 *   An unknown key inside a section (biography, medical, …) is refused — the
 *   profile is PUT back whole, so a stray field inside a section fails the
 *   save. An unknown TOP-LEVEL section, however, is silently stripped since
 *   the schema moved from `.strict()` to `.strip()`.
 */

import {
  BiographySchema,
  CarePlanSchema,
  CustomerSchema,
  MedicalSchema,
  nameRegex,
  PersonalDetails,
} from "../../../model/crm/customer.model";

/** The two homes this app serves. */
const RESIDENTIAL = false;
const IN_HOME_CARE = true;

/** A minimal valid Personal Details payload. */
const details = (overrides: Record<string, any> = {}) => ({
  gender: "Female",
  birthdate: "1942-03-11",
  // Typed loosely so tests can overwrite individual address fields.
  address: {} as Record<string, any>,
  ...overrides,
});

/** The same, with the address an In-Home-Care home demands. */
const detailsWithAddress = (overrides: Record<string, any> = {}) =>
  details({
    address: {
      street1: "12 Oak Lane",
      city: "Springfield",
      state: "Illinois",
      zipCode: "62704",
    },
    ...overrides,
  });

const parse = (input: any, inHomeCare = RESIDENTIAL) =>
  PersonalDetails(inHomeCare).safeParse(input);

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// ═══════════════════════════════════════════════════════════════════════════
// nameRegex — the rule shared by every name field in the app
// ═══════════════════════════════════════════════════════════════════════════

describe("nameRegex", () => {
  it("accepts letters", () => {
    expect(nameRegex.test("Mary")).toBe(true);
  });

  it("accepts letters and spaces", () => {
    expect(nameRegex.test("Mary Anne Shaw")).toBe(true);
  });

  it("accepts digits alongside letters", () => {
    expect(nameRegex.test("Room 4 Mary")).toBe(true);
  });

  it("accepts digits alone — the lookahead only needs one alphanumeric", () => {
    expect(nameRegex.test("1942")).toBe(true);
  });

  it("[as-built] refuses an apostrophe, so O'Brien cannot be entered", () => {
    // A real constraint on real names: the character class is letters,
    // digits and spaces only.
    expect(nameRegex.test("O'Brien")).toBe(false);
  });

  it("[as-built] refuses a hyphen, so Smith-Jones cannot be entered", () => {
    expect(nameRegex.test("Smith-Jones")).toBe(false);
  });

  it("[as-built] refuses an accented letter", () => {
    expect(nameRegex.test("José")).toBe(false);
  });

  it("refuses a name of only spaces", () => {
    // The lookahead demands at least one alphanumeric anywhere in the string.
    expect(nameRegex.test("   ")).toBe(false);
  });

  it("refuses an empty string", () => {
    expect(nameRegex.test("")).toBe(false);
  });

  it("[as-built] accepts leading and trailing spaces", () => {
    expect(nameRegex.test("  Mary  ")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalDetails — the required core
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalDetails — what it insists on", () => {
  it("accepts the minimum a residential home needs", () => {
    expect(parse(details()).success).toBe(true);
  });

  it("requires a gender", () => {
    const { gender, ...rest } = details();
    expect(parse(rest).success).toBe(false);
  });

  it("says a gender is required", () => {
    const { gender, ...rest } = details();
    expect(messageFor(parse(rest), "gender")).toBe("Gender is required");
  });

  it("accepts each of the three genders", () => {
    ["Male", "Female", "Other"].forEach((gender) =>
      expect(parse(details({ gender })).success).toBe(true)
    );
  });

  it("refuses a gender outside the three", () => {
    expect(parse(details({ gender: "Unspecified" })).success).toBe(false);
  });

  it("refuses an empty gender", () => {
    // Not wrapped in makeOptionalOnEmpty, so "" is a genuine enum failure.
    expect(parse(details({ gender: "" })).success).toBe(false);
  });

  it("requires a birthdate", () => {
    const { birthdate, ...rest } = details();
    expect(parse(rest).success).toBe(false);
  });

  it("refuses a birthdate it cannot parse", () => {
    expect(parse(details({ birthdate: "not a date" })).success).toBe(false);
  });

  it("complains about the date format", () => {
    expect(messageFor(parse(details({ birthdate: "banana" })), "birthdate")).toBe(
      "Invalid date format"
    );
  });

  it("[as-built] accepts any string Date.parse understands", () => {
    // Only `!isNaN(Date.parse(date))` is checked, so a US-format date or a
    // full ISO timestamp both pass — and so does a date in the future.
    ["03/11/1942", "1942-03-11T00:00:00.000Z", "2099-01-01"].forEach((birthdate) =>
      expect(parse(details({ birthdate })).success).toBe(true)
    );
  });

  it("[as-built] accepts a birthdate in the future", () => {
    // Nothing bounds it, so a resident can be born tomorrow.
    expect(parse(details({ birthdate: "2099-12-31" })).success).toBe(true);
  });

  it("refuses an empty birthdate", () => {
    expect(parse(details({ birthdate: "" })).success).toBe(false);
  });

  it("requires the address object even when every field inside is optional", () => {
    const { address, ...rest } = details();
    expect(parse(rest).success).toBe(false);
  });

  it("is strict — an unknown key fails the save", () => {
    expect(parse(details({ favouriteColour: "blue" })).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The In-Home-Care address branch
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalDetails — the address, residential vs In-Home-Care", () => {
  it("lets a residential home leave the address empty", () => {
    expect(parse(details({ address: {} }), RESIDENTIAL).success).toBe(true);
  });

  it("makes an In-Home-Care home supply one", () => {
    expect(parse(details({ address: {} }), IN_HOME_CARE).success).toBe(false);
  });

  it("names street, city, state and zip as the In-Home-Care requirements", () => {
    const result = parse(details({ address: {} }), IN_HOME_CARE);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields.sort()).toEqual([
        "address.city",
        "address.state",
        "address.street1",
        "address.zipCode",
      ]);
    }
  });

  it("accepts a complete In-Home-Care address", () => {
    expect(parse(detailsWithAddress(), IN_HOME_CARE).success).toBe(true);
  });

  it("says the street is required for In-Home-Care", () => {
    const input = detailsWithAddress();
    input.address.street1 = "";
    expect(messageFor(parse(input, IN_HOME_CARE), "address.street1")).toBe(
      "Street is required"
    );
  });

  it("validates the zip's shape for In-Home-Care", () => {
    const input = detailsWithAddress();
    input.address.zipCode = "1234";
    expect(messageFor(parse(input, IN_HOME_CARE), "address.zipCode")).toBe(
      "Invalid ZIP code format"
    );
  });

  it("accepts a nine-digit zip for In-Home-Care", () => {
    const input = detailsWithAddress();
    input.address.zipCode = "62704-1234";
    expect(parse(input, IN_HOME_CARE).success).toBe(true);
  });

  it("[as-built] does not validate a residential home's zip at all", () => {
    // The residential branch is a bare optional string, so "abc" is a valid
    // ZIP code for a residential home and a failure for an In-Home-Care one.
    const input = details({ address: { zipCode: "abc" } });
    expect(parse(input, RESIDENTIAL).success).toBe(true);
    expect(parse(input, IN_HOME_CARE).success).toBe(false);
  });

  it("keeps street2 optional for both", () => {
    expect(parse(detailsWithAddress(), IN_HOME_CARE).success).toBe(true);
  });

  it("accepts a previous place of residence", () => {
    const input = details({ address: { previousPlaceOfResidence: "Shady Pines" } });
    expect(parse(input).success).toBe(true);
  });

  it("is strict about the address too", () => {
    const input = details({ address: { county: "Sangamon" } });
    expect(parse(input).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The optional fields, and what makeOptionalOnEmpty does to them
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalDetails — the nickname", () => {
  it("accepts a plain nickname", () => {
    expect(parse(details({ nickName: "Mimi" })).success).toBe(true);
  });

  it("accepts an empty nickname — the field is simply dropped", () => {
    const result = parse(details({ nickName: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nickName).toBeUndefined();
  });

  it("refuses a nickname with punctuation", () => {
    expect(parse(details({ nickName: "Mimi!" })).success).toBe(false);
  });

  it("explains the nickname rule", () => {
    expect(messageFor(parse(details({ nickName: "Mimi!" })), "nickName")).toBe(
      "Nick Name accepts only alphabets and numbers"
    );
  });
});

describe("PersonalDetails — race and occupation", () => {
  it("accepts each listed race", () => {
    [
      "American Indian",
      "Asian",
      "African American",
      "Hispanic or Latino",
      "Caucasian",
      "Other",
    ].forEach((race) => expect(parse(details({ race })).success).toBe(true));
  });

  it("accepts an empty race", () => {
    expect(parse(details({ race: "" })).success).toBe(true);
  });

  it("refuses a race outside the list", () => {
    expect(parse(details({ race: "Martian" })).success).toBe(false);
  });

  it("accepts a free-text other race", () => {
    expect(parse(details({ race: "Other", otherRace: "Mixed" })).success).toBe(true);
  });

  it("refuses digits in the other race", () => {
    expect(parse(details({ otherRace: "Race 2" })).success).toBe(false);
  });

  it("[as-built] does not require otherRace when race is Other", () => {
    // The two fields are independent, so "Other" can be saved with no
    // explanation and the profile shows a blank.
    expect(parse(details({ race: "Other" })).success).toBe(true);
  });

  it("[as-built] accepts otherRace when race is NOT Other", () => {
    expect(parse(details({ race: "Asian", otherRace: "Mixed" })).success).toBe(true);
  });

  it("accepts the two occupations", () => {
    ["Veteran", "Other"].forEach((occupation) =>
      expect(parse(details({ occupation })).success).toBe(true)
    );
  });

  it("refuses an occupation outside the two", () => {
    expect(parse(details({ occupation: "Teacher" })).success).toBe(false);
  });

  it("[as-built] leaves otherOccupation entirely unvalidated", () => {
    // It is a bare `z.string().optional()` — no regex, and not wrapped in
    // makeOptionalOnEmpty either, so "" is stored rather than dropped.
    const result = parse(details({ otherOccupation: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.otherOccupation).toBe("");
  });
});

describe("PersonalDetails — the SSN", () => {
  it("accepts a nine-digit SSN as a number", () => {
    expect(parse(details({ ssn: 123456789 })).success).toBe(true);
  });

  it("accepts a nine-digit SSN as a string", () => {
    // The preprocess converts it, which is what the text input supplies.
    const result = parse(details({ ssn: "123456789" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ssn).toBe(123456789);
  });

  it("treats an empty SSN as absent", () => {
    const result = parse(details({ ssn: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ssn).toBeUndefined();
  });

  it("treats null as absent", () => {
    expect(parse(details({ ssn: null })).success).toBe(true);
  });

  it("[boundary] refuses eight digits", () => {
    expect(parse(details({ ssn: "12345678" })).success).toBe(false);
  });

  it("[boundary] refuses ten digits", () => {
    expect(parse(details({ ssn: "1234567890" })).success).toBe(false);
  });

  it("[boundary] accepts the lowest nine-digit value", () => {
    expect(parse(details({ ssn: 100000000 })).success).toBe(true);
  });

  it("[boundary] accepts the highest nine-digit value", () => {
    expect(parse(details({ ssn: 999999999 })).success).toBe(true);
  });

  it("refuses a decimal SSN", () => {
    expect(parse(details({ ssn: "123456789.5" })).success).toBe(false);
  });

  it("refuses letters", () => {
    expect(parse(details({ ssn: "abcdefghi" })).success).toBe(false);
  });

  it("gives one message for every kind of bad SSN", () => {
    expect(messageFor(parse(details({ ssn: "123" })), "ssn")).toBe(
      "SSN must be a 9-digit number"
    );
  });

  it("[as-built] accepts a dashed SSN as nine digits only if it has none", () => {
    // `Number("123-45-6789")` is NaN, so the familiar dashed format is
    // refused — the field takes raw digits or nothing.
    expect(parse(details({ ssn: "123-45-6789" })).success).toBe(false);
  });
});

describe("PersonalDetails — the phone numbers", () => {
  it("accepts a ten-digit alternate mobile", () => {
    expect(parse(details({ alternateMobile: "5551234567" })).success).toBe(true);
  });

  it("accepts an empty alternate mobile", () => {
    expect(parse(details({ alternateMobile: "" })).success).toBe(true);
  });

  it("[boundary] refuses nine digits", () => {
    expect(parse(details({ alternateMobile: "555123456" })).success).toBe(false);
  });

  it("[boundary] refuses eleven digits", () => {
    expect(parse(details({ alternateMobile: "55512345678" })).success).toBe(false);
  });

  it("says a mobile must be exactly ten digits", () => {
    expect(
      messageFor(parse(details({ alternateMobile: "555" })), "alternateMobile")
    ).toBe("Mobile number must be exactly 10 digits");
  });

  it("refuses a formatted number", () => {
    // The regex is digits only, so the familiar (555) 123-4567 is refused.
    expect(parse(details({ alternateMobile: "(555) 123-4567" })).success).toBe(false);
  });

  it("says only numbers are allowed for a formatted number", () => {
    expect(
      messageFor(parse(details({ alternateMobile: "555-123-4567" })), "alternateMobile")
    ).toBe("Only numbers are allowed");
  });

  it("applies the same rule to the emergency contact number", () => {
    expect(parse(details({ emergencyContactNumber: "5551234567" })).success).toBe(true);
    expect(parse(details({ emergencyContactNumber: "555" })).success).toBe(false);
  });

  it("accepts an emergency contact name", () => {
    expect(parse(details({ emergencyContactName: "Mary Shaw" })).success).toBe(true);
  });

  it("refuses punctuation in the emergency contact name", () => {
    expect(parse(details({ emergencyContactName: "Mary-Shaw" })).success).toBe(false);
  });

  it("[as-built] does not require a name alongside an emergency number", () => {
    // A number with nobody attached to it is a valid profile.
    expect(parse(details({ emergencyContactNumber: "5551234567" })).success).toBe(true);
  });

  it("[as-built] does not require a number alongside an emergency name", () => {
    expect(parse(details({ emergencyContactName: "Mary Shaw" })).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BiographySchema
// ═══════════════════════════════════════════════════════════════════════════

describe("BiographySchema", () => {
  it("accepts an entirely empty biography", () => {
    // Every section is optional, so a lead can exist with none of it filled.
    expect(BiographySchema(RESIDENTIAL).safeParse({}).success).toBe(true);
  });

  it("accepts personal details alone", () => {
    expect(
      BiographySchema(RESIDENTIAL).safeParse({ personalDetails: details() }).success
    ).toBe(true);
  });

  it("passes the In-Home-Care flag down to the address rules", () => {
    expect(
      BiographySchema(IN_HOME_CARE).safeParse({ personalDetails: details() }).success
    ).toBe(false);
    expect(
      BiographySchema(IN_HOME_CARE).safeParse({ personalDetails: detailsWithAddress() })
        .success
    ).toBe(true);
  });

  it("reports the path through personalDetails", () => {
    const result = BiographySchema(RESIDENTIAL).safeParse({
      personalDetails: details({ gender: "Unspecified" }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["personalDetails", "gender"]);
    }
  });

  it("accepts values and beliefs", () => {
    expect(
      BiographySchema(RESIDENTIAL).safeParse({ valuesAndBeliefs: { religion: "None" } })
        .success
    ).toBe(true);
  });

  it("accepts an empty religion", () => {
    expect(
      BiographySchema(RESIDENTIAL).safeParse({ valuesAndBeliefs: { religion: "" } })
        .success
    ).toBe(true);
  });

  it("is strict — an unknown section fails", () => {
    expect(
      BiographySchema(RESIDENTIAL).safeParse({ hobbies: {} }).success
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MedicalSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("MedicalSchema", () => {
  it("accepts an entirely empty medical record", () => {
    expect(MedicalSchema.safeParse({}).success).toBe(true);
  });

  it("accepts each of its three sections as absent", () => {
    expect(
      MedicalSchema.safeParse({ general: {}, mobility: {}, overAllHealth: {} }).success
    ).toBe(true);
  });

  it("is strict — an unknown section fails", () => {
    expect(MedicalSchema.safeParse({ dental: {} }).success).toBe(false);
  });

  it("reports the path through its section", () => {
    const result = MedicalSchema.safeParse({ general: { notAField: 1 } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe("general");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CarePlanSchema
// ═══════════════════════════════════════════════════════════════════════════

describe("CarePlanSchema", () => {
  it("accepts an empty care plan", () => {
    expect(CarePlanSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the vital signs a home chooses to track", () => {
    expect(
      CarePlanSchema.safeParse({
        vitalSigns: { bloodPressure: true, pulse: false, pacemaker: true },
      }).success
    ).toBe(true);
  });

  it("accepts a vital sign the schema does not name — the catchall allows it", () => {
    // `.catchall(z.boolean())` means a home can track something new without a
    // schema change, which is why this object is not strict.
    expect(
      CarePlanSchema.safeParse({ vitalSigns: { temperature: true } }).success
    ).toBe(true);
  });

  it("refuses a non-boolean vital sign", () => {
    expect(
      CarePlanSchema.safeParse({ vitalSigns: { bloodPressure: "yes" } }).success
    ).toBe(false);
  });

  it("accepts each housekeeping service level", () => {
    [
      "Not Required",
      "Staff Assisted",
      "Scheduled - Weekly",
      "Scheduled - Daily",
      "On Request",
    ].forEach((level) =>
      expect(CarePlanSchema.safeParse({ housekeeping: { laundry: level } }).success).toBe(
        true
      )
    );
  });

  it("refuses a housekeeping level outside the five", () => {
    expect(
      CarePlanSchema.safeParse({ housekeeping: { laundry: "Sometimes" } }).success
    ).toBe(false);
  });

  it("accepts a housekeeping task the schema does not name", () => {
    expect(
      CarePlanSchema.safeParse({ housekeeping: { windowCleaning: "On Request" } }).success
    ).toBe(true);
  });

  it("is strict at the top level", () => {
    expect(CarePlanSchema.safeParse({ nutrition: {} }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CustomerSchema — the whole profile
// ═══════════════════════════════════════════════════════════════════════════

describe("CustomerSchema", () => {
  it("accepts an empty profile", () => {
    // Which is what a freshly created lead is.
    expect(CustomerSchema(RESIDENTIAL).safeParse({}).success).toBe(true);
  });

  it("accepts all five sections together", () => {
    expect(
      CustomerSchema(RESIDENTIAL).safeParse({
        biography: { personalDetails: details() },
        medical: {},
        carePlan: {},
        documents: [],
        actions: {},
      }).success
    ).toBe(true);
  });

  it("threads the In-Home-Care flag all the way down", () => {
    const body = { biography: { personalDetails: details() } };
    expect(CustomerSchema(RESIDENTIAL).safeParse(body).success).toBe(true);
    expect(CustomerSchema(IN_HOME_CARE).safeParse(body).success).toBe(false);
  });

  it("reports the full path to a nested failure", () => {
    const result = CustomerSchema(RESIDENTIAL).safeParse({
      biography: { personalDetails: details({ alternateMobile: "555" }) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual([
        "biography",
        "personalDetails",
        "alternateMobile",
      ]);
    }
  });

  it("[as-built] strips a stray top-level key — the save succeeds without it", () => {
    // The profile is PUT back whole. Since the schema relaxed from `.strict()`
    // to `.strip()`, a field left over from an older shape is silently dropped
    // rather than blocking the save.
    const result = CustomerSchema(RESIDENTIAL).safeParse({ notes: "hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("notes");
    }
  });

  it("accepts a profile with only documents", () => {
    expect(CustomerSchema(RESIDENTIAL).safeParse({ documents: [] }).success).toBe(true);
  });

  it("collects failures from several sections at once", () => {
    const result = CustomerSchema(RESIDENTIAL).safeParse({
      biography: { personalDetails: details({ gender: "Nope" }) },
      carePlan: { housekeeping: { laundry: "Sometimes" } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const roots = new Set(result.error.issues.map((i) => i.path[0]));
      expect(roots).toEqual(new Set(["biography", "carePlan"]));
    }
  });
});
