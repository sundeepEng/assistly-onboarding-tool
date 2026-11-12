/**
 * CRM record schemas — model/crm/user.model.ts
 *
 * Every CRM record (senior lead, referral agent, care lead, nurse lead,
 * compliance guest) is created through one of these. They are strict, so a field
 * the UI adds without a matching schema entry silently blocks the whole form —
 * which is exactly what these tests are here to catch.
 */

import {
  CreateComplianceGuestSchema,
  CreateLeadSchema,
  CreateNurseOrNurseLeadSchema,
  CreatePCHOOrPCGLeadSchema,
  CreateReferralSchema,
  UpdateComplianceGuestSchema,
  UpdateNurseOrNurseLeadSchema,
} from "../../../model/crm/user.model";
import { TEST_HOME_ID } from "../../test-utils/auth";
import {
  makeComplianceGuestInput,
  makeLeadInput,
  makeNurseInput,
  makeReferralInput,
  UUIDS,
} from "../../test-utils/factories";

const errorFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// `CreateLeadSchema` is a factory: an In-Home-Care home makes the phone number
// mandatory, a residential home does not.
const residentialLeadSchema = CreateLeadSchema(false);
const inHomeCareLeadSchema = CreateLeadSchema(true);

// ─── Shared base fields ──────────────────────────────────────────────────────

describe("CRM base user fields (shared by every CRM schema)", () => {
  const schema = CreateReferralSchema;

  describe("firstName / lastName", () => {
    it("requires a first name", () => {
      const result = schema.safeParse(makeReferralInput({ firstName: undefined }));
      expect(errorFor(result, "firstName")).toBe("First Name is required");
    });

    it("rejects an empty first name", () => {
      const result = schema.safeParse(makeReferralInput({ firstName: "" }));
      expect(errorFor(result, "firstName")).toBe(
        "First Name should be more than (1) character"
      );
    });

    it("requires a last name", () => {
      const result = schema.safeParse(makeReferralInput({ lastName: undefined }));
      expect(errorFor(result, "lastName")).toBe("Last Name is required");
    });

    it.each(["Jane@", "O'Brien", "Marie-Claire", "Ann_Marie", "José"])(
      "rejects the name %p — only alphabets, numbers and spaces are allowed",
      (firstName) => {
        const result = schema.safeParse(makeReferralInput({ firstName }));
        expect(errorFor(result, "firstName")).toBe(
          "First Name accepts only alphabets and numbers"
        );
      }
    );

    it.each(["Jane", "Mary Jane", "Room 12", "A1"])(
      "accepts the name %p",
      (firstName) => {
        expect(schema.safeParse(makeReferralInput({ firstName })).success).toBe(true);
      }
    );

    it("trims surrounding whitespace rather than rejecting it", () => {
      const result = schema.safeParse(makeReferralInput({ firstName: "  Jane  " }));
      expect(result.success).toBe(true);
      expect((result as any).data.firstName).toBe("Jane");
    });

    it("treats a whitespace-only name as empty", () => {
      const result = schema.safeParse(makeReferralInput({ firstName: "   " }));
      expect(result.success).toBe(false);
    });
  });

  describe("middleName", () => {
    it("is optional", () => {
      expect(
        schema.safeParse(makeReferralInput({ middleName: undefined })).success
      ).toBe(true);
    });

    it("accepts an empty string — `makeOptionalOnEmpty` drops it", () => {
      expect(schema.safeParse(makeReferralInput({ middleName: "" })).success).toBe(
        true
      );
    });

    it("still validates the characters when a value is supplied", () => {
      const result = schema.safeParse(makeReferralInput({ middleName: "K." }));
      expect(errorFor(result, "middleName")).toBe(
        "Middle Name accepts only alphabets and numbers"
      );
    });
  });

  describe("email", () => {
    it.each([
      "plainaddress",
      "no-domain@",
      "@no-local.com",
      "spaces in@email.com",
      "trailing.dot@domain.c",
    ])("rejects %p", (email) => {
      const result = schema.safeParse(makeReferralInput({ email }));
      expect(errorFor(result, "email")).toBe("Invalid email");
    });

    it.each([
      "user@assistly.com",
      "user+tag@assistly.com",
      "first.last@sub.assistly.co.uk",
    ])("accepts %p", (email) => {
      expect(schema.safeParse(makeReferralInput({ email })).success).toBe(true);
    });
  });

  describe("mobile", () => {
    it("requires exactly 10 digits", () => {
      const result = schema.safeParse(makeReferralInput({ mobile: "12345" }));
      expect(errorFor(result, "mobile")).toBe(
        "Mobile number must be exactly 10 digits"
      );
    });

    it("rejects 11 digits", () => {
      const result = schema.safeParse(makeReferralInput({ mobile: "12345678901" }));
      expect(errorFor(result, "mobile")).toBe(
        "Mobile number must be exactly 10 digits"
      );
    });

    it.each(["555-123-4567", "(555) 1234567", "+15551234567", "555123456a"])(
      "rejects the formatted number %p — digits only",
      (mobile) => {
        const result = schema.safeParse(makeReferralInput({ mobile }));
        expect(errorFor(result, "mobile")).toBe("Only numbers are allowed");
      }
    );

    it("accepts a bare 10-digit number", () => {
      expect(
        schema.safeParse(makeReferralInput({ mobile: "5551234567" })).success
      ).toBe(true);
    });
  });

  describe("homeId", () => {
    it("accepts a UUID", () => {
      expect(
        schema.safeParse(makeReferralInput({ homeId: TEST_HOME_ID })).success
      ).toBe(true);
    });

    it("rejects a non-UUID", () => {
      const result = schema.safeParse(makeReferralInput({ homeId: "home-123" }));
      expect(errorFor(result, "homeId")).toBe("homeId must has an invalid UUID format");
    });
  });
});

// ─── Senior lead ─────────────────────────────────────────────────────────────

describe("CreateLeadSchema — senior leads", () => {
  it("accepts the minimum Add Lead payload for a residential home", () => {
    expect(residentialLeadSchema.safeParse(makeLeadInput()).success).toBe(true);
  });

  it("accepts a lead with no contact details at a residential home", () => {
    // Walk-in leads often arrive with just a name.
    const result = residentialLeadSchema.safeParse({
      firstName: "Walk",
      lastName: "In",
    });
    expect(result.success).toBe(true);
  });

  describe("In-Home Care makes the phone number mandatory", () => {
    it("rejects a lead with no mobile when the home is In-Home Care", () => {
      const result = inHomeCareLeadSchema.safeParse(
        makeLeadInput({ mobile: undefined })
      );
      expect(result.success).toBe(false);
      expect(errorFor(result, "mobile")).toBeDefined();
    });

    it("accepts a lead with no mobile at a residential home", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ mobile: undefined })).success
      ).toBe(true);
    });

    it("still enforces the 10-digit rule for In-Home Care", () => {
      const result = inHomeCareLeadSchema.safeParse(makeLeadInput({ mobile: "123" }));
      expect(errorFor(result, "mobile")).toBe(
        "Mobile number must be exactly 10 digits"
      );
    });
  });

  describe("milestone", () => {
    it.each(["initial contact", "tour", "onboarding", "contract", "lost"])(
      "accepts the milestone %p",
      (milestone) => {
        expect(
          residentialLeadSchema.safeParse(makeLeadInput({ milestone: [milestone] }))
            .success
        ).toBe(true);
      }
    );

    it("accepts a lead that has progressed through several milestones", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ milestone: ["initial contact", "tour", "onboarding"] })
      );
      expect(result.success).toBe(true);
    });

    it("rejects an unknown milestone", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ milestone: ["closed won"] })
      );
      expect(errorFor(result, "milestone.0")).toBe(
        "Milestone accepts only initial contact, tour, onboarding, contract or lost"
      );
    });

    it("rejects a bare string instead of an array", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ milestone: "tour" })).success
      ).toBe(false);
    });
  });

  describe("lostCategory — why a lead was lost", () => {
    it.each([
      "Family Chose Another",
      "Pricing",
      "Location",
      "Timing",
      "Clinical Fit",
      "Other",
    ])("accepts the reason %p", (lostCategory) => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ lostCategory })).success
      ).toBe(true);
    });

    it("is optional — a lead need not have been lost", () => {
      expect(residentialLeadSchema.safeParse(makeLeadInput()).success).toBe(true);
    });

    it("rejects a reason outside the list", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ lostCategory: "Budget" })
      );
      expect(errorFor(result, "lostCategory")).toBe(
        "lostCategory accepts only Family Chose Another, Pricing, Location, Timing, Clinical Fit or Other"
      );
    });

    it("is not tied to the 'lost' milestone — the schema allows either alone", () => {
      // Worth knowing: nothing stops a lead being marked lost with no reason, or
      // carrying a reason while still active. Any such rule lives in the UI.
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ milestone: ["lost"] })).success
      ).toBe(true);
      expect(
        residentialLeadSchema.safeParse(
          makeLeadInput({ milestone: ["tour"], lostCategory: "Pricing" })
        ).success
      ).toBe(true);
    });
  });

  describe("isReferredByUserId — the lead owner", () => {
    it("accepts a UUID", () => {
      expect(
        residentialLeadSchema.safeParse(
          makeLeadInput({ isReferredByUserId: "44444444-4444-4444-8444-444444444444" })
        ).success
      ).toBe(true);
    });

    it("is optional", () => {
      expect(residentialLeadSchema.safeParse(makeLeadInput()).success).toBe(true);
    });

    /**
     * The empty string is the case that matters: `AddLeadFormWrapper` seeds it as
     * the form's default whenever no owner resolves, and because `.optional()`
     * does not treat "" as absent, the whole form fails to submit. See the
     * "silently blocks Save" test in add-lead.test.tsx.
     */
    it("rejects an empty string rather than treating it as absent", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ isReferredByUserId: "" })
      );
      expect(errorFor(result, "isReferredByUserId")).toBe("Lead owner is required");
    });
  });

  describe("role", () => {
    it("accepts the literal 'Lead'", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ role: "Lead" })).success
      ).toBe(true);
    });

    it("rejects any other role — a senior lead cannot be created as a Nurse", () => {
      const result = residentialLeadSchema.safeParse(makeLeadInput({ role: "Nurse" }));
      // The schema passes `{ message: "role must be Lead" }` to `z.literal`, but
      // zod 3 ignores `message` for `invalid_literal` and emits its own text.
      // Asserting the real string keeps this honest; if the schema is fixed to
      // surface the custom message, this test is the reminder to update the UI copy.
      expect(errorFor(result, "role")).toBe('Invalid literal value, expected "Lead"');
    });
  });

  describe("home tour fields", () => {
    it("accepts an ISO tour date-time", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ tourDateTime: "2026-04-01T15:30:00.000Z" })
      );
      expect(result.success).toBe(true);
    });

    it("accepts a null tour date-time (tour cleared)", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ tourDateTime: null })).success
      ).toBe(true);
    });

    it("rejects a non-ISO tour date-time", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ tourDateTime: "04/01/2026" }))
          .success
      ).toBe(false);
    });

    it("leaves isTourCompleted undefined when omitted — `.optional()` defeats `.default(false)`", () => {
      // `z.boolean().default(false).optional()` short-circuits on undefined, so
      // the default never applies. Consumers must treat "absent" as "not
      // completed" themselves rather than relying on the schema to fill it in.
      const result = residentialLeadSchema.safeParse(makeLeadInput());
      expect((result as any).data.isTourCompleted).toBeUndefined();
    });

    it("preserves an explicit isTourCompleted flag", () => {
      const result = residentialLeadSchema.safeParse(
        makeLeadInput({ isTourCompleted: true })
      );
      expect((result as any).data.isTourCompleted).toBe(true);
    });

    it("accepts empty tour notes", () => {
      expect(
        residentialLeadSchema.safeParse(makeLeadInput({ tourNotes: "" })).success
      ).toBe(true);
    });
  });

  it("rejects an unknown field — the schema is strict", () => {
    // The Add Lead form spreads the whole form object into the payload, so a new
    // input with no schema entry fails validation instead of being ignored.
    expect(
      residentialLeadSchema.safeParse(makeLeadInput({ favouriteColour: "blue" }))
        .success
    ).toBe(false);
  });
});

// ─── Referral agent ──────────────────────────────────────────────────────────

describe("CreateReferralSchema", () => {
  it("accepts a referral agent with an organisation", () => {
    expect(CreateReferralSchema.safeParse(makeReferralInput()).success).toBe(true);
  });

  it("treats an empty organisation name as absent", () => {
    expect(
      CreateReferralSchema.safeParse(makeReferralInput({ referralOrgName: "" }))
        .success
    ).toBe(true);
  });

  it("rejects an organisation name containing digits — alphabets only", () => {
    const result = CreateReferralSchema.safeParse(
      makeReferralInput({ referralOrgName: "Partner Org 2" })
    );
    expect(errorFor(result, "referralOrgName")).toBe("only alphabets are allowed");
  });

  it("requires email and mobile — a referral agent must be contactable", () => {
    const result = CreateReferralSchema.safeParse(
      makeReferralInput({ email: undefined, mobile: undefined })
    );
    expect(errorFor(result, "email")).toBe("Email is required");
    expect(errorFor(result, "mobile")).toBe("Phone number is required");
  });
});

// ─── Care lead (PCG) ─────────────────────────────────────────────────────────

describe("CreatePCHOOrPCGLeadSchema — care leads", () => {
  const careLead = (overrides: Record<string, any> = {}) => ({
    firstName: "Priya",
    lastName: "Patel",
    email: "priya@assistly.com",
    mobile: "5551112222",
    ...overrides,
  });

  it("accepts a care lead with no associated homes", () => {
    expect(CreatePCHOOrPCGLeadSchema.safeParse(careLead()).success).toBe(true);
  });

  it("accepts a list of associated home UUIDs", () => {
    const result = CreatePCHOOrPCGLeadSchema.safeParse(
      careLead({ associatedHomeIds: [TEST_HOME_ID, UUIDS.home] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID in associatedHomeIds", () => {
    const result = CreatePCHOOrPCGLeadSchema.safeParse(
      careLead({ associatedHomeIds: ["home-1"] })
    );
    expect(errorFor(result, "associatedHomeIds.0")).toBe(
      "associatedHomeIds has invalid UUID format"
    );
  });

  it("rejects a referral-only field — care leads have no organisation", () => {
    // A key present with an `undefined` value still counts as unrecognised under
    // `.strict()`, so callers must omit the key entirely, not blank it out.
    expect(
      CreatePCHOOrPCGLeadSchema.safeParse(careLead({ referralOrgName: undefined }))
        .success
    ).toBe(false);
  });
});

// ─── Nurse / nurse lead ──────────────────────────────────────────────────────

describe("CreateNurseOrNurseLeadSchema", () => {
  it("accepts a nurse", () => {
    expect(CreateNurseOrNurseLeadSchema.safeParse(makeNurseInput()).success).toBe(
      true
    );
  });

  it.each(["Nurse", "NurseLead"])("accepts the role %p", (role) => {
    expect(
      CreateNurseOrNurseLeadSchema.safeParse(makeNurseInput({ role })).success
    ).toBe(true);
  });

  it("rejects a role outside the nurse family", () => {
    expect(
      CreateNurseOrNurseLeadSchema.safeParse(makeNurseInput({ role: "PCG" })).success
    ).toBe(false);
  });
});

describe("UpdateNurseOrNurseLeadSchema", () => {
  it("accepts an emergency contact block", () => {
    const result = UpdateNurseOrNurseLeadSchema.safeParse(
      makeNurseInput({
        biography: {
          personalDetails: {
            emergencyContactName: "Ann Smith",
            emergencyContactNumber: "5559998888",
          },
        },
      })
    );
    expect(result.success).toBe(true);
  });

  it("requires an emergency contact number of exactly 10 digits", () => {
    const result = UpdateNurseOrNurseLeadSchema.safeParse(
      makeNurseInput({
        biography: {
          personalDetails: { emergencyContactNumber: "555" },
        },
      })
    );
    expect(
      errorFor(result, "biography.personalDetails.emergencyContactNumber")
    ).toBe("Emergency Contact Number must be exactly 10 digits");
  });

  it.each(["completed", "declined", "expired", "pending"])(
    "accepts the e-sign envelope status %p",
    (onboardingESignEnvelopeStatus) => {
      expect(
        UpdateNurseOrNurseLeadSchema.safeParse(
          makeNurseInput({ onboardingESignEnvelopeStatus })
        ).success
      ).toBe(true);
    }
  );

  it("rejects an unknown e-sign envelope status", () => {
    expect(
      UpdateNurseOrNurseLeadSchema.safeParse(
        makeNurseInput({ onboardingESignEnvelopeStatus: "sent" })
      ).success
    ).toBe(false);
  });

  it("requires createdAt to be an ISO datetime", () => {
    const result = UpdateNurseOrNurseLeadSchema.safeParse(
      makeNurseInput({ createdAt: "2026-01-15" })
    );
    expect(errorFor(result, "createdAt")).toBe(
      "createdAt has an invalid datetime format"
    );
  });
});

// ─── Compliance guest ────────────────────────────────────────────────────────

describe("CreateComplianceGuestSchema", () => {
  it("accepts a compliance guest", () => {
    expect(
      CreateComplianceGuestSchema.safeParse(makeComplianceGuestInput()).success
    ).toBe(true);
  });

  it("accepts the literal role 'ComplianceGuest'", () => {
    expect(
      CreateComplianceGuestSchema.safeParse(
        makeComplianceGuestInput({ role: "ComplianceGuest" })
      ).success
    ).toBe(true);
  });

  it("rejects any other role", () => {
    const result = CreateComplianceGuestSchema.safeParse(
      makeComplianceGuestInput({ role: "PCHO" })
    );
    // As with CreateLeadSchema's `role`, zod 3 ignores the custom `message` on
    // `z.literal` and reports its own text.
    expect(errorFor(result, "role")).toBe(
      'Invalid literal value, expected "ComplianceGuest"'
    );
  });
});

describe("UpdateComplianceGuestSchema", () => {
  it("accepts completed compliance document ids as UUIDs", () => {
    const result = UpdateComplianceGuestSchema.safeParse(
      makeComplianceGuestInput({
        completedComplianceDocumentIds: [UUIDS.lead, UUIDS.referral],
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID document id", () => {
    const result = UpdateComplianceGuestSchema.safeParse(
      makeComplianceGuestInput({ completedComplianceDocumentIds: ["doc-1"] })
    );
    expect(errorFor(result, "completedComplianceDocumentIds.0")).toBe(
      "completedComplianceDocumentIds has an invalid UUID format"
    );
  });
});
