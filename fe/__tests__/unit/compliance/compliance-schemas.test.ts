/**
 * Compliance schemas.
 *
 * Two unrelated shapes share this module:
 *   - `uploadTraningModule` (model/home/home-model.ts) validates the Create
 *     Training Module form. Note the spelling — the export really is "Traning".
 *   - `CreateComplianceGuestSchema` (model/crm/user.model.ts) validates the
 *     external auditor account created from CRM › Compliance Guests.
 */

import { uploadTraningModule } from "../../../model/home/home-model";
import {
  CreateComplianceGuestSchema,
  UpdateComplianceGuestSchema,
} from "../../../model/crm/user.model";
import { makeComplianceGuestInput, makeTrainingModuleInput, UUIDS } from "../../test-utils/factories";

const parse = (schema: any, input: unknown) => schema.safeParse(input);

const errorFor = (schema: any, input: unknown, field: string) => {
  const result = schema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((i: any) => i.path.join(".") === field)?.message;
};

// ─── uploadTraningModule ─────────────────────────────────────────────────────

describe("uploadTraningModule — the Create Training Module form", () => {
  it("accepts a minimal module", () => {
    expect(parse(uploadTraningModule, makeTrainingModuleInput()).success).toBe(true);
  });

  describe("moduleName", () => {
    it("requires a title", () => {
      expect(errorFor(uploadTraningModule, makeTrainingModuleInput({ moduleName: "" }), "moduleName")).toBe(
        "Module Title is required"
      );
    });

    it("accepts a single character", () => {
      expect(parse(uploadTraningModule, makeTrainingModuleInput({ moduleName: "A" })).success).toBe(
        true
      );
    });

    it("rejects a missing title", () => {
      const input = makeTrainingModuleInput();
      delete (input as any).moduleName;
      expect(parse(uploadTraningModule, input).success).toBe(false);
    });

    /** Pinned: `.min(1)` is not `.trim()`, so a whitespace-only title passes. */
    it("accepts a whitespace-only title", () => {
      expect(parse(uploadTraningModule, makeTrainingModuleInput({ moduleName: "   " })).success).toBe(
        true
      );
    });
  });

  describe("moduleDescription", () => {
    it("requires a description", () => {
      expect(
        errorFor(uploadTraningModule, makeTrainingModuleInput({ moduleDescription: "" }), "moduleDescription")
      ).toBe("Description is required");
    });

    it("has no upper bound", () => {
      expect(
        parse(uploadTraningModule, makeTrainingModuleInput({ moduleDescription: "x".repeat(5000) }))
          .success
      ).toBe(true);
    });
  });

  describe("certificateDurationType", () => {
    it("requires a duration", () => {
      expect(
        errorFor(
          uploadTraningModule,
          makeTrainingModuleInput({ certificateDurationType: "" }),
          "certificateDurationType"
        )
      ).toBe("Certificate duration is required");
    });

    /**
     * Pinned: the field is a bare `z.string()`, not an enum — any string is
     * accepted. Only the literal "custom" carries meaning, and it is matched by
     * value in the refinement below.
     */
    it("accepts any non-empty string, not a fixed set", () => {
      ["1year", "2years", "lifetime", "banana"].forEach((value) => {
        expect(
          parse(uploadTraningModule, makeTrainingModuleInput({ certificateDurationType: value }))
            .success
        ).toBe(true);
      });
    });
  });

  describe("custom duration", () => {
    it("requires the day count when the type is 'custom'", () => {
      const result = parse(
        uploadTraningModule,
        makeTrainingModuleInput({ certificateDurationType: "custom" })
      );
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("Please enter custom days");
      expect(result.error.issues[0].path).toEqual(["certificateDurationCustomDays"]);
    });

    it("accepts 'custom' once the day count is supplied", () => {
      expect(
        parse(
          uploadTraningModule,
          makeTrainingModuleInput({
            certificateDurationType: "custom",
            certificateDurationCustomDays: 45,
          })
        ).success
      ).toBe(true);
    });

    it("requires at least one day", () => {
      expect(
        errorFor(
          uploadTraningModule,
          makeTrainingModuleInput({
            certificateDurationType: "custom",
            certificateDurationCustomDays: 0,
          }),
          "certificateDurationCustomDays"
        )
      ).toBe("Days must be at least 1");
    });

    it("rejects a non-numeric day count", () => {
      expect(
        errorFor(
          uploadTraningModule,
          makeTrainingModuleInput({
            certificateDurationType: "custom",
            certificateDurationCustomDays: "forty",
          }),
          "certificateDurationCustomDays"
        )
      ).toBe("Enter valid days");
    });

    /**
     * Pinned: the field is `z.number()` with no coercion, so the string a number
     * input yields must be converted before it reaches the schema — otherwise a
     * perfectly valid "45" is reported as "Enter valid days".
     */
    it("rejects a numeric string — there is no coercion", () => {
      expect(
        parse(
          uploadTraningModule,
          makeTrainingModuleInput({
            certificateDurationType: "custom",
            certificateDurationCustomDays: "45",
          })
        ).success
      ).toBe(false);
    });

    /**
     * Pinned: the day count is only *required* for "custom", never *forbidden*
     * elsewhere — a one-year certificate can carry a stray 45-day override that
     * nothing validates against the chosen duration.
     */
    it("accepts a day count on a non-custom duration", () => {
      expect(
        parse(
          uploadTraningModule,
          makeTrainingModuleInput({
            certificateDurationType: "1year",
            certificateDurationCustomDays: 45,
          })
        ).success
      ).toBe(true);
    });

    it("is case-sensitive about the word 'custom'", () => {
      // "Custom" misses the refinement, so no day count is demanded.
      expect(
        parse(uploadTraningModule, makeTrainingModuleInput({ certificateDurationType: "Custom" }))
          .success
      ).toBe(true);
    });
  });

  /** The schema is not `.strict()`, so extra form state is dropped, not rejected. */
  it("silently drops unknown keys", () => {
    const result = parse(
      uploadTraningModule,
      makeTrainingModuleInput({ moduleId: "module-1", documents: [] })
    );
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("moduleId");
    expect(result.data).not.toHaveProperty("documents");
  });
});

// ─── CreateComplianceGuestSchema ─────────────────────────────────────────────

describe("CreateComplianceGuestSchema", () => {
  it("accepts a minimal guest", () => {
    expect(parse(CreateComplianceGuestSchema, makeComplianceGuestInput()).success).toBe(true);
  });

  describe("names", () => {
    it("requires a first name", () => {
      expect(
        errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ firstName: "" }), "firstName")
      ).toBe("First Name should be more than (1) character");
    });

    it("requires a last name", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ lastName: "" })).success
      ).toBe(false);
    });

    it("rejects punctuation in a name", () => {
      expect(
        errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ firstName: "O'Brien" }), "firstName")
      ).toBe("First Name accepts only alphabets and numbers");
    });

    it("accepts digits in a name", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ firstName: "Guest2" })).success
      ).toBe(true);
    });

    it("treats an empty middle name as absent", () => {
      const result = parse(
        CreateComplianceGuestSchema,
        makeComplianceGuestInput({ middleName: "" })
      );
      expect(result.success).toBe(true);
      expect(result.data.middleName).toBeUndefined();
    });

    it("accepts a middle name when given", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ middleName: "Ann" })).success
      ).toBe(true);
    });
  });

  describe("email", () => {
    it.each(["cora.guest@assistly.com", "a@b.co", "first+tag@sub.domain.org"])(
      "accepts %s",
      (email) => {
        expect(parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ email })).success).toBe(
          true
        );
      }
    );

    it.each(["cora.guest", "cora@", "@assistly.com", "cora@assistly", ""])(
      "rejects %s",
      (email) => {
        expect(errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ email }), "email")).toBe(
          "Invalid email"
        );
      }
    );
  });

  describe("mobile", () => {
    it("requires exactly ten digits", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ mobile: "5550001111" })).success
      ).toBe(true);
    });

    it.each(["555000111", "55500011112"])("rejects %s — wrong length", (mobile) => {
      expect(errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ mobile }), "mobile")).toBe(
        "Mobile number must be exactly 10 digits"
      );
    });

    it("rejects formatting characters", () => {
      expect(
        errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ mobile: "555-000-1111" }), "mobile")
      ).toBe("Only numbers are allowed");
    });
  });

  describe("role", () => {
    it("accepts the ComplianceGuest literal", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ role: "ComplianceGuest" }))
          .success
      ).toBe(true);
    });

    it("rejects any other role", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ role: "PCG" })).success
      ).toBe(false);
    });

    it("treats role as optional — the handler adds it", () => {
      expect(parse(CreateComplianceGuestSchema, makeComplianceGuestInput()).success).toBe(true);
    });

    /**
     * Pinned: zod 3 ignores the custom `message` on `z.literal`, so the friendly
     * "Role accepts only ComplianceGuest" copy never reaches the user — the
     * generic literal mismatch is reported instead. Same defect as
     * `CreateLeadSchema.role`; see __tests__/unit/crm/crm-schemas.test.ts.
     */
    it("never surfaces its custom role message", () => {
      expect(
        errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ role: "PCG" }), "role")
      ).not.toBe("Role accepts only ComplianceGuest");
    });
  });

  describe("strictness", () => {
    it("rejects unknown keys", () => {
      expect(
        parse(CreateComplianceGuestSchema, makeComplianceGuestInput({ homeName: "Comfort Cove" }))
          .success
      ).toBe(false);
    });

    /**
     * `add-compliance-guest.tsx` submits `name`, `home` and `homeId` alongside the
     * form fields. `home` and `homeId` are inherited from `baseUsersSchema`, but
     * `name` is not declared anywhere — so the exact object the component POSTs
     * would fail its own schema if it were re-validated after the handler runs.
     */
    it("rejects the `name` field the Add Compliance Guest handler derives", () => {
      const asSubmitted = {
        ...makeComplianceGuestInput(),
        name: "Cora Guest",
        role: "ComplianceGuest",
        home: "Comfort Cove",
        homeId: UUIDS.home,
      };
      const result = parse(CreateComplianceGuestSchema, asSubmitted);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].code).toBe("unrecognized_keys");
    });

    it("accepts home and homeId, which the base schema does declare", () => {
      expect(
        parse(
          CreateComplianceGuestSchema,
          makeComplianceGuestInput({ home: "Comfort Cove", homeId: UUIDS.home })
        ).success
      ).toBe(true);
    });

    it("rejects a non-uuid homeId", () => {
      expect(
        errorFor(CreateComplianceGuestSchema, makeComplianceGuestInput({ homeId: "home-1" }), "homeId")
      ).toBe("homeId must has an invalid UUID format");
    });
  });
});

// ─── UpdateComplianceGuestSchema ─────────────────────────────────────────────

describe("UpdateComplianceGuestSchema", () => {
  it("extends the create schema", () => {
    expect(parse(UpdateComplianceGuestSchema, makeComplianceGuestInput()).success).toBe(true);
  });

  it("accepts the completed-document ids as uuids", () => {
    expect(
      parse(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ completedComplianceDocumentIds: [UUIDS.lead, UUIDS.senior] })
      ).success
    ).toBe(true);
  });

  it("rejects a non-uuid document id", () => {
    expect(
      errorFor(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ completedComplianceDocumentIds: ["doc-1"] }),
        "completedComplianceDocumentIds.0"
      )
    ).toBe("completedComplianceDocumentIds has an invalid UUID format");
  });

  /** The transform dedupes, so re-completing a document cannot double-count it. */
  it("dedupes repeated document ids", () => {
    const result = parse(
      UpdateComplianceGuestSchema,
      makeComplianceGuestInput({
        completedComplianceDocumentIds: [UUIDS.lead, UUIDS.lead, UUIDS.senior],
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.completedComplianceDocumentIds).toEqual([UUIDS.lead, UUIDS.senior]);
  });

  it("preserves the order of first appearance while deduping", () => {
    const result = parse(
      UpdateComplianceGuestSchema,
      makeComplianceGuestInput({
        completedComplianceDocumentIds: [UUIDS.senior, UUIDS.lead, UUIDS.senior],
      })
    );
    expect(result.data.completedComplianceDocumentIds).toEqual([UUIDS.senior, UUIDS.lead]);
  });

  it("accepts a certificates map of strings", () => {
    expect(
      parse(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ complianceCertificates: { "fire-safety": "s3://cert.pdf" } })
      ).success
    ).toBe(true);
  });

  it("rejects a non-string certificate value", () => {
    expect(
      parse(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ complianceCertificates: { "fire-safety": 1 } })
      ).success
    ).toBe(false);
  });

  it("requires ISO datetimes for the audit fields", () => {
    expect(
      parse(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ modifiedAt: "2026-02-13T12:00:00.000Z" })
      ).success
    ).toBe(true);
    expect(
      errorFor(
        UpdateComplianceGuestSchema,
        makeComplianceGuestInput({ modifiedAt: "2026-02-13" }),
        "modifiedAt"
      )
    ).toBe("modifiedAt has an invalid datetime format");
  });

  /**
   * Pinned: `.extend()` on a strict schema keeps the strictness, so the update
   * payload rejects unknown keys exactly like the create one — including the
   * `name` the app derives.
   */
  it("stays strict after extending", () => {
    expect(
      parse(UpdateComplianceGuestSchema, makeComplianceGuestInput({ name: "Cora Guest" })).success
    ).toBe(false);
  });
});
