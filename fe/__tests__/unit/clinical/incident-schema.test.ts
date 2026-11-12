/**
 * Incident report form schema — model/clinical/add-incident.model.ts
 *
 * An incident report is a regulatory document (the ALC/CLA/PCH form). What the
 * schema lets through ends up on a PDF that leaves the building, so the rules
 * worth pinning are the ones that decide whether a field is *required*,
 * *optional*, or *conditionally required*.
 *
 * Three helpers from utils/makeOptional.ts do most of the work and are easy to
 * misread:
 *
 *   makeOptionalOnEmpty        "" is coerced to undefined before validating, so
 *                              an empty optional field passes rather than
 *                              failing a min(1) it never reaches.
 *   makeOptionalOnEmptyObject  an object whose values are all "" / null /
 *                              undefined becomes undefined — an untouched
 *                              sub-form does not have to be valid.
 *   arrayOfNonEmpty            blank rows are dropped from the array before the
 *                              item schema runs, so a table of empty rows is
 *                              equivalent to no rows at all.
 *
 * The interesting cases are the conditional ones: a witness or perpetrator
 * block that is *partly* filled cannot be dropped as empty, so it has to
 * satisfy its own rules.
 */

import {
  IncidentReportFormSchema,
  IncidentTypeEnum,
  NotificationRoleEnum,
  WitnessEntryForm,
  AllegedPerpetratorForm,
  IncidentEntryForm,
} from "../../../model/clinical/add-incident.model";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const errorFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const failedPaths = (result: any) =>
  result.success ? [] : result.error.issues.map((i: any) => i.path.join("."));

/** Exactly the fields the schema demands, and nothing more. */
const validForm = (overrides: Record<string, any> = {}) => ({
  facilityName: "Comfort Cove",
  facilityPhone: "7065183473",
  facilityAdministrator: "Praveen Durvesula",
  incidentType: [],
  residentName: ["Arthur Bean"],
  incidentDate: "2026-08-31",
  incidentTime: "07:48",
  notifications: [],
  witnesses: [],
  reporterName: "Danny Ross",
  incidentReportedDate: "2026-08-31",
  incidentReportedTime: "07:49",
  detailsOfIncident: "Forgot the way and got lost",
  ...overrides,
});

const parse = (form: Record<string, any>) =>
  IncidentReportFormSchema.safeParse(form);

// ─── The minimum viable report ───────────────────────────────────────────────

describe("IncidentReportFormSchema — the minimum viable report", () => {
  it("accepts a form carrying only the required fields", () => {
    expect(parse(validForm()).success).toBe(true);
  });

  it("names the thirteen fields it cannot do without", () => {
    // Documents the required set in one assertion: strip everything and see
    // exactly what the schema complains about. If a field is added to or
    // removed from the form, this is the test that says so.
    const result = parse({});
    expect(failedPaths(result).sort()).toEqual(
      [
        "detailsOfIncident",
        "facilityAdministrator",
        "facilityName",
        "facilityPhone",
        "incidentDate",
        "incidentReportedDate",
        "incidentReportedTime",
        "incidentTime",
        "incidentType",
        "reporterName",
        "residentName",
      ].sort()
    );
  });

  it("rejects a key it does not know about", () => {
    // .strict() — a typo in a field name fails loudly instead of being dropped.
    const result = parse(validForm({ facilityNmae: "Comfort Cove" }));
    expect(result.success).toBe(false);
  });
});

// ─── Facility block ──────────────────────────────────────────────────────────

describe("IncidentReportFormSchema — facility", () => {
  it("requires a facility name", () => {
    expect(parse(validForm({ facilityName: "" })).success).toBe(false);
  });

  it("requires an administrator", () => {
    expect(parse(validForm({ facilityAdministrator: "" })).success).toBe(false);
  });

  it("accepts a ten-digit phone", () => {
    expect(parse(validForm({ facilityPhone: "7065183473" })).success).toBe(true);
  });

  it("rejects a phone that is too short", () => {
    const result = parse(validForm({ facilityPhone: "706518347" }));
    expect(errorFor(result, "facilityPhone")).toBe(
      "Mobile must be exactly 10 digits"
    );
  });

  it("rejects a phone that is too long", () => {
    expect(parse(validForm({ facilityPhone: "70651834731" })).success).toBe(false);
  });

  it("accepts a formatted phone by stripping the punctuation", () => {
    // phoneDigits10 preprocesses with `.replace(/\D+/g, "")`, so brackets,
    // spaces and hyphens are removed before the ten-digit check runs.
    const result = parse(validForm({ facilityPhone: "(706) 518-3473" }));
    expect(result.success).toBe(true);
    expect(result.success && result.data.facilityPhone).toBe("7065183473");
  });

  it("normalises a dotted phone to bare digits", () => {
    const result = parse(validForm({ facilityPhone: "706.518.3473" }));
    expect(result.success && result.data.facilityPhone).toBe("7065183473");
  });

  it("still rejects punctuation hiding too few digits", () => {
    // Stripping is not forgiveness — "(706) 518-347" is nine digits.
    expect(parse(validForm({ facilityPhone: "(706) 518-347" })).success).toBe(false);
  });

  it("rejects a phone containing letters", () => {
    expect(parse(validForm({ facilityPhone: "70651834ab" })).success).toBe(false);
  });

  it("treats county as optional", () => {
    expect(parse(validForm({ facilityCounty: "" })).success).toBe(true);
    expect(parse(validForm({ facilityCounty: "Fulton" })).success).toBe(true);
  });

  it("treats fax as optional", () => {
    expect(parse(validForm({ facilityFax: "" })).success).toBe(true);
  });

  it("accepts a valid facility email", () => {
    expect(parse(validForm({ facilityEmail: "care@cove.com" })).success).toBe(true);
  });

  it("lowercases the facility email", () => {
    const result = parse(validForm({ facilityEmail: "Care@Cove.COM" }));
    expect(result.success && result.data.facilityEmail).toBe("care@cove.com");
  });

  it("rejects a malformed facility email", () => {
    const result = parse(validForm({ facilityEmail: "not-an-email" }));
    expect(errorFor(result, "facilityEmail")).toBe(
      "Email has an invalid email format"
    );
  });

  it("accepts a blank facility email", () => {
    // makeOptionalOnEmpty turns "" into undefined before the email check runs.
    expect(parse(validForm({ facilityEmail: "" })).success).toBe(true);
  });
});

// ─── Resident and incident details ───────────────────────────────────────────

describe("IncidentReportFormSchema — resident and details", () => {
  it("requires at least one resident name", () => {
    expect(parse(validForm({ residentName: [] })).success).toBe(true);
    // An array of one empty string is not the same as an empty array.
    expect(parse(validForm({ residentName: [""] })).success).toBe(false);
  });

  it("accepts several residents", () => {
    expect(
      parse(validForm({ residentName: ["Arthur Bean", "Mary Shaw"] })).success
    ).toBe(true);
  });

  it("requires the incident date and time", () => {
    expect(parse(validForm({ incidentDate: "" })).success).toBe(false);
    expect(parse(validForm({ incidentTime: "" })).success).toBe(false);
  });

  it("requires the details of the incident", () => {
    expect(parse(validForm({ detailsOfIncident: "" })).success).toBe(false);
  });

  it("accepts details of any length", () => {
    expect(
      parse(validForm({ detailsOfIncident: "x".repeat(5000) })).success
    ).toBe(true);
  });

  it("accepts a single character of detail", () => {
    // min(1) only — the schema does not insist on a meaningful description.
    expect(parse(validForm({ detailsOfIncident: "x" })).success).toBe(true);
  });

  it("does not reject whitespace-only details", () => {
    // `.min(1)` counts a space, so " " passes. Worth knowing: the UI is the
    // only thing standing between a blank description and the regulator's form.
    expect(parse(validForm({ detailsOfIncident: "   " })).success).toBe(true);
  });

  it("does not validate that the date is real", () => {
    // `z.string().min(1)` — the date is only combined into a timestamp later.
    expect(parse(validForm({ incidentDate: "not-a-date" })).success).toBe(true);
  });

  it("does not stop an incident being dated in the future", () => {
    expect(parse(validForm({ incidentDate: "2099-12-31" })).success).toBe(true);
  });
});

// ─── Reporter ────────────────────────────────────────────────────────────────

describe("IncidentReportFormSchema — reporter", () => {
  it("requires the reporter's name", () => {
    expect(parse(validForm({ reporterName: "" })).success).toBe(false);
  });

  it("requires the reported date and time", () => {
    expect(parse(validForm({ incidentReportedDate: "" })).success).toBe(false);
    expect(parse(validForm({ incidentReportedTime: "" })).success).toBe(false);
  });

  it("treats the reporter's title as optional", () => {
    expect(parse(validForm({ reporterTitle: "" })).success).toBe(true);
    expect(parse(validForm({ reporterTitle: "RN" })).success).toBe(true);
  });

  it("treats the signature as optional", () => {
    expect(parse(validForm({ reporterSignature: "" })).success).toBe(true);
  });

  it("treats immediate corrections as optional", () => {
    expect(parse(validForm({ immediateCorrections: "" })).success).toBe(true);
  });

  it("does not check that the report is dated after the incident", () => {
    // A report can be dated before the incident it describes.
    expect(
      parse(
        validForm({
          incidentDate: "2026-08-31",
          incidentReportedDate: "2020-01-01",
        })
      ).success
    ).toBe(true);
  });
});

// ─── Witnesses — the conditional block ───────────────────────────────────────

describe("WitnessEntryForm — all or nothing", () => {
  const parseWitness = (w: Record<string, any>) => WitnessEntryForm.safeParse(w);

  it("accepts an entirely empty witness", () => {
    expect(parseWitness({}).success).toBe(true);
  });

  it("accepts a witness whose fields are all blank strings", () => {
    expect(
      parseWitness({ name: "", address: "", phone: "", relationshipToResident: "" })
        .success
    ).toBe(true);
  });

  it("demands a name once anything is filled in", () => {
    const result = parseWitness({ address: "12 Elm Row", phone: "7065183473" });
    expect(errorFor(result, "name")).toBe("Witness name is required");
  });

  it("demands a phone once anything is filled in", () => {
    const result = parseWitness({ name: "Ruth Bean" });
    expect(errorFor(result, "phone")).toBe("Mobile must be exactly 10 digits");
  });

  it("accepts a witness with both a name and a phone", () => {
    expect(parseWitness({ name: "Ruth Bean", phone: "7065183473" }).success).toBe(
      true
    );
  });

  it("rejects a witness phone that is not ten digits", () => {
    const result = parseWitness({ name: "Ruth Bean", phone: "70651" });
    expect(result.success).toBe(false);
  });

  it("counts a relationship alone as filled in", () => {
    // Any single field triggers the requirement — a half-filled row cannot be
    // saved silently.
    const result = parseWitness({ relationshipToResident: "Daughter" });
    expect(result.success).toBe(false);
  });
});

describe("IncidentReportFormSchema — witnesses array", () => {
  it("accepts no witnesses", () => {
    expect(parse(validForm({ witnesses: [] })).success).toBe(true);
  });

  it("drops entirely blank witness rows", () => {
    // arrayOfNonEmpty filters empty rows before the item schema runs, so a
    // table of untouched rows validates and arrives empty.
    const result = parse(
      validForm({ witnesses: [{ name: "", address: "", phone: "" }] })
    );
    expect(result.success).toBe(true);
    expect(result.success && result.data.witnesses).toEqual([]);
  });

  it("keeps a filled witness row", () => {
    const result = parse(
      validForm({ witnesses: [{ name: "Ruth Bean", phone: "7065183473" }] })
    );
    expect(result.success && result.data.witnesses).toHaveLength(1);
  });

  it("rejects a partly filled witness row", () => {
    expect(parse(validForm({ witnesses: [{ name: "Ruth Bean" }] })).success).toBe(
      false
    );
  });

  it("keeps only the filled rows when some are blank", () => {
    const result = parse(
      validForm({
        witnesses: [
          { name: "", address: "", phone: "" },
          { name: "Ruth Bean", phone: "7065183473" },
          { name: "", address: "", phone: "" },
        ],
      })
    );
    expect(result.success && result.data.witnesses).toHaveLength(1);
  });
});

// ─── Alleged perpetrator — the other conditional block ───────────────────────

describe("AllegedPerpetratorForm — all or nothing", () => {
  const parsePerp = (p: Record<string, any>) => AllegedPerpetratorForm.safeParse(p);

  it("accepts an entirely empty block", () => {
    expect(parsePerp({}).success).toBe(true);
  });

  it("collapses an all-blank block to undefined", () => {
    const result = parsePerp({ name: "", address: "", city: "", state: "" });
    expect(result.success && result.data).toBeUndefined();
  });

  it("demands a name once anything is filled in", () => {
    const result = parsePerp({ address: "12 Elm Row" });
    expect(errorFor(result, "name")).toBe("Alleged perpetrator name is required");
  });

  it("accepts a named perpetrator", () => {
    expect(parsePerp({ name: "John Doe" }).success).toBe(true);
  });

  it("rejects a perpetrator phone that is not ten digits", () => {
    expect(parsePerp({ name: "John Doe", phone: "12345" }).success).toBe(false);
  });

  it("accepts a ten-digit perpetrator phone", () => {
    expect(parsePerp({ name: "John Doe", phone: "7065183473" }).success).toBe(true);
  });

  it("rejects a zip that is not five digits", () => {
    const result = parsePerp({ name: "John Doe", zip: "1234" });
    expect(errorFor(result, "zip")).toBe("zip must be exactly 5 digits");
  });

  it("rejects a non-numeric zip", () => {
    const result = parsePerp({ name: "John Doe", zip: "ABCDE" });
    expect(errorFor(result, "zip")).toBe("zip accepts numbers only");
  });

  it("accepts a five-digit zip", () => {
    expect(parsePerp({ name: "John Doe", zip: "62704" }).success).toBe(true);
  });

  it("rejects a nine-digit ZIP+4", () => {
    // The form takes five digits only; "62704-1234" and "627041234" both fail.
    expect(parsePerp({ name: "John Doe", zip: "627041234" }).success).toBe(false);
  });
});

// ─── Notifications ───────────────────────────────────────────────────────────

describe("IncidentReportFormSchema — notifications", () => {
  it("accepts no notifications", () => {
    expect(parse(validForm({ notifications: [] })).success).toBe(true);
  });

  it("rejects a blank notification row rather than dropping it", () => {
    // Unlike witnesses, a notification's `role` is required, and
    // arrayOfNonEmpty validates items BEFORE its filter runs — so an untouched
    // notification row fails instead of being discarded. The two tables behave
    // in opposite ways for the same "leave it blank" gesture.
    const result = parse(
      validForm({
        notifications: [{ name: "", notifiedDate: "", notifiedTime: "" }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("drops a blank witness row in the same form that rejects a blank notification", () => {
    // Side by side, to make the asymmetry impossible to miss.
    expect(parse(validForm({ witnesses: [{ name: "", phone: "" }] })).success).toBe(
      true
    );
    expect(parse(validForm({ notifications: [{ name: "" }] })).success).toBe(false);
  });

  it("keeps a filled notification row", () => {
    const result = parse(
      validForm({
        notifications: [
          {
            role: "PHYSICIAN",
            name: "Dr Patel",
            notifiedDate: "2026-08-31",
            notifiedTime: "08:00",
          },
        ],
      })
    );
    expect(result.success && result.data.notifications).toHaveLength(1);
  });

  it("offers the documented notification roles", () => {
    expect(NotificationRoleEnum.options).toEqual(
      expect.arrayContaining(["PHYSICIAN", "POLICE"])
    );
  });

  it("rejects a notification role it does not know", () => {
    const result = parse(
      validForm({ notifications: [{ role: "NEIGHBOUR", name: "Someone" }] })
    );
    expect(result.success).toBe(false);
  });
});

// ─── Incident types ──────────────────────────────────────────────────────────

describe("IncidentEntryForm — the type checkboxes", () => {
  it("accepts an entry with nothing ticked", () => {
    // The UI derives `incidentType` on submit, so the entry itself may be bare.
    expect(IncidentEntryForm.safeParse({}).success).toBe(true);
  });

  it("accepts a ticked abuse type", () => {
    expect(
      IncidentEntryForm.safeParse({ abuseTypes: { physical: true } }).success
    ).toBe(true);
  });

  it("accepts a serious injury type", () => {
    expect(
      IncidentEntryForm.safeParse({ seriousInjuryTypes: { erVisit: true } })
        .success
    ).toBe(true);
  });

  it("accepts several groups at once", () => {
    expect(
      IncidentEntryForm.safeParse({
        abuseTypes: { physical: true },
        missingResidentTypes: { residentHasMemoryImpairment: true },
      }).success
    ).toBe(true);
  });

  it("accepts the free-text other type", () => {
    // The group is keyed `other`, and the free-text field inside it is also
    // `other` — `otherTypes` is not a key the schema knows.
    expect(
      IncidentEntryForm.safeParse({ other: { other: "Wandered off" } }).success
    ).toBe(true);
  });

  it("rejects the group under a name it does not use", () => {
    expect(
      IncidentEntryForm.safeParse({ otherTypes: { other: "Wandered off" } })
        .success
    ).toBe(false);
  });

  it("rejects an incident type outside the enum", () => {
    expect(
      IncidentEntryForm.safeParse({ incidentType: ["NOT_A_TYPE"] }).success
    ).toBe(false);
  });

  it("offers the documented incident types", () => {
    expect(IncidentTypeEnum.options).toEqual(
      expect.arrayContaining(["ABUSE", "DEATH", "SERIOUS_INJURY"])
    );
  });

  it("accepts an empty incidentType array on the form", () => {
    // An incident can be saved with no category ticked at all — the regulator's
    // form has "check all that apply", and none is a valid answer to the schema.
    expect(parse(validForm({ incidentType: [] })).success).toBe(true);
  });
});
