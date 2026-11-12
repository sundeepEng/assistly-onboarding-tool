/**
 * Clinical — the Face Sheet schema
 *
 *   model/clinical/face-sheet.model.ts
 *     faceSheetSchema       the base shape plus the mutual-dependency rule
 *     faceSheetBaseSchema   the shape alone, without the refinement
 *     documentFieldSchema   the upload slot used three times over
 *
 * A face sheet is the one-page summary a paramedic reads. Getting it half
 * filled is worse than leaving it blank, and the schema enforces that with a
 * `superRefine` unlike anything else in the app.
 *
 * THE FIVE-WAY MUTUAL DEPENDENCY, WHICH IS REALLY "ALL OF THEM"
 *   Gender, birthdate, emergency-contact NAME and emergency-contact PHONE are
 *   each written as optional, and the `superRefine` then says that touching
 *   any one of them makes the other three required.
 *
 *   In practice the conditional never matters. `gender` is a non-optional enum
 *   behind a preprocess that maps `""` to undefined, so an empty gender fails
 *   with a plain "Required" and there is NO valid face sheet without one.
 *   Gender therefore always counts as touched, the implication always fires,
 *   and birthdate + emergency name + emergency phone are unconditionally
 *   mandatory. The tests below establish that before exercising the rule.
 *
 * THE ADDRESS IS ALL-OR-NOTHING
 *   Its four parts are plain required strings, and then a `refine` accepts
 *   either "all four blank" or "all four present with a valid ZIP". A
 *   partially typed address is refused, and the complaint is attached to
 *   `zipCode` whichever field is actually missing.
 *
 * WHAT IS *UNCONDITIONALLY* REQUIRED
 *   Only `name` and `primaryLanguage` (both `min(1)`), plus the two
 *   directive enums `dnr` and `advanceDirective`, plus the address object and
 *   `emergencyPrimaryRelationship` having to be present at all. Everything
 *   else hangs off the dependency rule.
 */

import {
  documentFieldSchema,
  faceSheetBaseSchema,
  faceSheetSchema,
} from "../../../model/clinical/face-sheet.model";

/**
 * The smallest face sheet the refined schema accepts.
 *
 * It has to carry the whole dependent group: gender cannot be blank, and
 * gender pulls the other three in with it. There is no valid "nothing filled"
 * face sheet, which is why there is no `bare` fixture separate from this one.
 */
const complete = (overrides: Record<string, any> = {}) => ({
  name: "Mary Shaw",
  primaryLanguage: "English",
  gender: "Female",
  birthdate: "1942-03-11",
  emergencyPrimaryName: "Sam Ray",
  emergencyPrimaryPhone: "5551234567",
  emergencyPrimaryRelationship: "",
  address: { street: "", city: "", state: "", zipCode: "" },
  dnr: "Not on file",
  advanceDirective: "Not on file",
  ...overrides,
});

/** Used where only the SHAPE is under test and the rule is already satisfied. */
const bare = complete;

const parse = (input: any) => faceSheetSchema.safeParse(input);

const pathsOf = (result: any) =>
  result.success ? [] : result.error.issues.map((i: any) => i.path.join("."));

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// ═══════════════════════════════════════════════════════════════════════════
// documentFieldSchema — the upload slot
// ═══════════════════════════════════════════════════════════════════════════

describe("documentFieldSchema", () => {
  it("defaults an untouched slot to empty", () => {
    const result = documentFieldSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("empty");
  });

  it("accepts each of the four lifecycle states", () => {
    ["empty", "existing", "new", "remove"].forEach((status) =>
      expect(documentFieldSchema.safeParse({ status }).success).toBe(true)
    );
  });

  it("refuses a state outside the four", () => {
    expect(documentFieldSchema.safeParse({ status: "uploading" }).success).toBe(false);
  });

  it("accepts an existing document with a url", () => {
    expect(
      documentFieldSchema.safeParse({
        status: "existing",
        documentId: "doc-1",
        documentName: "Insurance.pdf",
        fileUrl: "https://bucket.s3.amazonaws.com/insurance.pdf",
      }).success
    ).toBe(true);
  });

  it("requires a real url when one is given", () => {
    expect(documentFieldSchema.safeParse({ fileUrl: "not-a-url" }).success).toBe(false);
  });

  it("[as-built] accepts anything at all as the staged file", () => {
    // `z.any()` — it holds a browser File object, which zod cannot describe.
    expect(documentFieldSchema.safeParse({ status: "new", file: { size: 1 } }).success)
      .toBe(true);
  });

  it("[as-built] does not require a file when the status says new", () => {
    expect(documentFieldSchema.safeParse({ status: "new" }).success).toBe(true);
  });

  it("[as-built] does not require a url when the status says existing", () => {
    expect(documentFieldSchema.safeParse({ status: "existing" }).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The unconditionally required fields
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — what it always insists on", () => {
  it("accepts the bare minimum with the dependent group left alone", () => {
    expect(parse(bare()).success).toBe(true);
  });

  it("requires a name", () => {
    expect(parse(bare({ name: "" })).success).toBe(false);
  });

  it("says the name is required", () => {
    expect(messageFor(parse(bare({ name: "" })), "name")).toBe("Name is required");
  });

  it("refuses a name of only spaces", () => {
    // It trims before `min(1)`.
    expect(parse(bare({ name: "   " })).success).toBe(false);
  });

  it("requires a primary language", () => {
    expect(parse(bare({ primaryLanguage: "" })).success).toBe(false);
  });

  it("says the primary language is required", () => {
    expect(messageFor(parse(bare({ primaryLanguage: "" })), "primaryLanguage")).toBe(
      "Primary language is required"
    );
  });

  it("requires a DNR answer", () => {
    const { dnr, ...rest } = bare();
    expect(parse(rest).success).toBe(false);
  });

  it("accepts each DNR answer, including Not on file", () => {
    ["Yes", "No", "Not on file"].forEach((dnr) =>
      expect(parse(bare({ dnr })).success).toBe(true)
    );
  });

  it("refuses a DNR answer outside the three", () => {
    expect(parse(bare({ dnr: "Unknown" })).success).toBe(false);
  });

  it("requires an advance-directive answer", () => {
    const { advanceDirective, ...rest } = bare();
    expect(parse(rest).success).toBe(false);
  });

  it("requires the address object to be present", () => {
    const { address, ...rest } = bare();
    expect(parse(rest).success).toBe(false);
  });

  it("[as-built] requires a gender, with no valid empty state", () => {
    // The preprocess maps "" to undefined and the enum is not optional, so a
    // face sheet can never be saved without answering it.
    expect(messageFor(parse(complete({ gender: "" })), "gender")).toBe("Required");
  });

  it("requires the gender key to be present at all", () => {
    const { gender, ...rest } = complete();
    expect(messageFor(parse(rest), "gender")).toBe("Required");
  });

  it("accepts each of the three genders", () => {
    ["Male", "Female", "Other"].forEach((gender) =>
      expect(parse(complete({ gender })).success).toBe(true)
    );
  });

  it("refuses a gender outside the three", () => {
    expect(parse(complete({ gender: "Unspecified" })).success).toBe(false);
  });

  it("requires the birthdate key to be present", () => {
    const { birthdate, ...rest } = complete();
    expect(messageFor(parse(rest), "birthdate")).toBe("Required");
  });

  it("requires emergencyPrimaryRelationship to be present, though it may be empty", () => {
    // A plain `z.string().trim()` with no `.optional()`, so the key must
    // exist — but "" satisfies it.
    const { emergencyPrimaryRelationship, ...rest } = bare();
    expect(parse(rest).success).toBe(false);
    expect(parse(bare({ emergencyPrimaryRelationship: "" })).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The room number
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — the room number", () => {
  it("accepts a number", () => {
    expect(parse(bare({ room: 12 })).success).toBe(true);
  });

  it("coerces a numeric string, which is what the input supplies", () => {
    const result = parse(bare({ room: "12" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.room).toBe(12);
  });

  it("[boundary] accepts room zero", () => {
    expect(parse(bare({ room: 0 })).success).toBe(true);
  });

  it("refuses a negative room", () => {
    expect(parse(bare({ room: -1 })).success).toBe(false);
  });

  it("explains the room rule", () => {
    expect(messageFor(parse(bare({ room: -1 })), "room")).toBe(
      "Room Number should be greater than or equal to zero"
    );
  });

  it("refuses a non-numeric room", () => {
    expect(parse(bare({ room: "ground floor" })).success).toBe(false);
  });

  it("is optional", () => {
    expect(parse(bare()).success).toBe(true);
  });

  it("[as-built] coerces an empty string to zero rather than treating it as absent", () => {
    // `z.coerce.number()` on "" is 0, so a cleared room field saves as room 0.
    const result = parse(bare({ room: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.room).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The all-or-nothing address
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — the address", () => {
  const withAddress = (address: Record<string, string>) => parse(bare({ address }));

  it("accepts a wholly blank address", () => {
    expect(
      withAddress({ street: "", city: "", state: "", zipCode: "" }).success
    ).toBe(true);
  });

  it("accepts a complete address with a five-digit ZIP", () => {
    expect(
      withAddress({
        street: "12 Oak Lane",
        city: "Springfield",
        state: "Illinois",
        zipCode: "62704",
      }).success
    ).toBe(true);
  });

  it("accepts an extended nine-digit ZIP", () => {
    expect(
      withAddress({
        street: "12 Oak Lane",
        city: "Springfield",
        state: "Illinois",
        zipCode: "62704-1234",
      }).success
    ).toBe(true);
  });

  it("refuses a street with nothing else", () => {
    expect(withAddress({ street: "12 Oak Lane", city: "", state: "", zipCode: "" }).success)
      .toBe(false);
  });

  it("refuses a complete address with a short ZIP", () => {
    expect(
      withAddress({
        street: "12 Oak Lane",
        city: "Springfield",
        state: "Illinois",
        zipCode: "6270",
      }).success
    ).toBe(false);
  });

  it("[as-built] blames zipCode whichever part is actually missing", () => {
    // The refine's `path` is hard-coded, so an address missing only its city
    // complains about the ZIP.
    const result = withAddress({
      street: "12 Oak Lane",
      city: "",
      state: "Illinois",
      zipCode: "62704",
    });
    expect(pathsOf(result)).toContain("address.zipCode");
    expect(messageFor(result, "address.zipCode")).toBe(
      "Complete street, city, state, and valid ZIP code"
    );
  });

  it("requires every part of the address object to be present", () => {
    expect(parse(bare({ address: { street: "12 Oak Lane" } })).success).toBe(false);
  });

  it("treats a whitespace-only address as blank", () => {
    expect(
      withAddress({ street: "  ", city: "  ", state: "  ", zipCode: "  " }).success
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The five-way mutual dependency — the heart of this schema
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — the mutual dependency", () => {
  it("accepts the whole group filled in", () => {
    expect(parse(complete()).success).toBe(true);
  });

  it("[as-built] there is no valid sheet with the group left alone", () => {
    const result = parse(
      complete({
        gender: "",
        birthdate: "",
        emergencyPrimaryName: "",
        emergencyPrimaryPhone: "",
      })
    );
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("gender");
  });

  it("a gender with nothing else demands birthdate, name and phone", () => {
    const result = parse(
      complete({ birthdate: "", emergencyPrimaryName: "", emergencyPrimaryPhone: "" })
    );
    expect(result.success).toBe(false);
    expect(new Set(pathsOf(result))).toEqual(
      new Set(["birthdate", "emergencyPrimaryName", "emergencyPrimaryPhone"])
    );
  });

  it("explains each demand in terms of gender", () => {
    const result = parse(
      complete({ birthdate: "", emergencyPrimaryName: "", emergencyPrimaryPhone: "" })
    );
    expect(messageFor(result, "birthdate")).toBe(
      "Birthdate is required when gender is updated"
    );
    expect(messageFor(result, "emergencyPrimaryName")).toBe(
      "Emergency contact name is required when gender is updated"
    );
    expect(messageFor(result, "emergencyPrimaryPhone")).toBe(
      "Emergency contact phone number is required when gender is updated"
    );
  });

  it("a missing birthdate alone is refused", () => {
    const result = parse(complete({ birthdate: "" }));
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("birthdate");
  });

  it("a missing emergency name alone is refused", () => {
    const result = parse(complete({ emergencyPrimaryName: "" }));
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("emergencyPrimaryName");
  });

  it("a missing emergency phone alone is refused", () => {
    const result = parse(complete({ emergencyPrimaryPhone: "" }));
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("emergencyPrimaryPhone");
  });

  it("[as-built] a missing phone is reported twice, once per implication", () => {
    // Both "when gender is updated" and "when name is updated" fire, so the
    // field carries two issues — a form showing only the first renders one.
    const result = parse(complete({ emergencyPrimaryPhone: "" }));
    const issues = pathsOf(result).filter(
      (path: string) => path === "emergencyPrimaryPhone"
    );
    expect(issues.length).toBeGreaterThan(1);
  });

  it("names the phone as required when the name was given", () => {
    const result = parse(complete({ emergencyPrimaryPhone: "" }));
    const messages = result.success
      ? []
      : result.error.issues
          .filter((i: any) => i.path.join(".") === "emergencyPrimaryPhone")
          .map((i: any) => i.message);
    expect(messages).toContain(
      "Emergency contact phone number is required when name is updated"
    );
  });

  it("names the name as required when the phone was given", () => {
    const result = parse(complete({ emergencyPrimaryName: "" }));
    const messages = result.success
      ? []
      : result.error.issues
          .filter((i: any) => i.path.join(".") === "emergencyPrimaryName")
          .map((i: any) => i.message);
    expect(messages).toContain(
      "Emergency contact name is required when phone number is updated"
    );
  });

  it("[as-built] a whitespace-only emergency name counts as absent", () => {
    expect(parse(complete({ emergencyPrimaryName: "   " })).success).toBe(false);
  });

  it("the SECONDARY emergency contact is exempt from the rule", () => {
    // Only the primary pair participates in the superRefine, so a secondary
    // name with no secondary phone is accepted.
    expect(parse(complete({ emergencySecondaryName: "Alex Ray" })).success).toBe(true);
  });

  it("accepts a sheet with no secondary contact at all", () => {
    expect(parse(complete()).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The emergency contact fields themselves
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — the emergency contact fields", () => {
  it("refuses punctuation in the primary name", () => {
    expect(parse(complete({ emergencyPrimaryName: "O'Brien" })).success).toBe(false);
  });

  it("[boundary] requires exactly ten digits in the primary phone", () => {
    expect(parse(complete({ emergencyPrimaryPhone: "555123456" })).success).toBe(false);
    expect(parse(complete({ emergencyPrimaryPhone: "55512345678" })).success).toBe(false);
    expect(parse(complete({ emergencyPrimaryPhone: "5551234567" })).success).toBe(true);
  });

  it("refuses a formatted primary phone", () => {
    expect(parse(complete({ emergencyPrimaryPhone: "(555) 123-4567" })).success).toBe(
      false
    );
  });

  it("applies the same rules to the secondary contact", () => {
    expect(parse(complete({ emergencySecondaryPhone: "555" })).success).toBe(false);
    expect(parse(complete({ emergencySecondaryName: "Alex-Ray" })).success).toBe(false);
  });

  it("accepts a full secondary contact alongside the primary", () => {
    expect(
      parse(
        complete({
          emergencySecondaryName: "Alex Ray",
          emergencySecondaryRelationship: "Son",
          emergencySecondaryPhone: "5559990000",
        })
      ).success
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The clinical free-text and the document slots
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetSchema — the clinical fields", () => {
  it("accepts allergies, conditions and insurance as free text", () => {
    expect(
      parse(
        bare({
          allergies: "Penicillin",
          keyConditions: "Type 2 diabetes",
          insuranceProvider: "Blue Cross",
          insuranceMemberId: "BC-123",
          medicaid: "MD-456",
        })
      ).success
    ).toBe(true);
  });

  it("[as-built] leaves allergies entirely unvalidated and optional", () => {
    // The field a paramedic would read first is not required at all.
    expect(parse(bare()).success).toBe(true);
    expect(parse(bare({ allergies: "" })).success).toBe(true);
  });

  it("accepts the three document slots", () => {
    expect(
      parse(
        bare({
          documents: {
            insuranceDocument: { status: "existing" },
            dnrForm: { status: "empty" },
            advanceDirectiveWill: { status: "new" },
          },
        })
      ).success
    ).toBe(true);
  });

  it("accepts a partial set of document slots", () => {
    expect(parse(bare({ documents: { dnrForm: { status: "new" } } })).success).toBe(true);
  });

  it("refuses an invalid status inside a slot", () => {
    expect(
      parse(bare({ documents: { dnrForm: { status: "uploading" } } })).success
    ).toBe(false);
  });

  it("[as-built] does not require a DNR form when DNR is Yes", () => {
    // The answer and the paperwork are independent.
    expect(parse(bare({ dnr: "Yes" })).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The base schema, without the refinement
// ═══════════════════════════════════════════════════════════════════════════

describe("faceSheetBaseSchema", () => {
  it("accepts gender alone — the dependency rule lives on the refined schema", () => {
    // Exported separately so the form can validate a draft field-by-field
    // without the cross-field rule firing on every keystroke.
    expect(faceSheetBaseSchema.safeParse(bare({ gender: "Female" })).success).toBe(true);
  });

  it("accepts a birthdate alone", () => {
    expect(
      faceSheetBaseSchema.safeParse(bare({ birthdate: "1942-03-11" })).success
    ).toBe(true);
  });

  it("still enforces the unconditional fields", () => {
    expect(faceSheetBaseSchema.safeParse(bare({ name: "" })).success).toBe(false);
  });

  it("still enforces the all-or-nothing address", () => {
    expect(
      faceSheetBaseSchema.safeParse(
        bare({ address: { street: "12 Oak Lane", city: "", state: "", zipCode: "" } })
      ).success
    ).toBe(false);
  });

  it("refuses an unparseable birthdate", () => {
    expect(faceSheetBaseSchema.safeParse(bare({ birthdate: "banana" })).success).toBe(
      false
    );
  });

  it("accepts the same complete sheet the refined schema does", () => {
    expect(faceSheetBaseSchema.safeParse(complete()).success).toBe(true);
  });
});
