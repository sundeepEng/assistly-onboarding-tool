/**
 * Clinical — the per-incident-type schemas
 *
 *   model/clinical/add-incident.model.ts
 *     AbuseIncidentTypes              the six abuse checkboxes
 *     DeathIncidentTypesForm          plus the split 911 date/time
 *     SeriousInjuryIncidentTypes
 *     ExternalDisasterIncidentTypes
 *     MissingResidentIncidentTypesForm  plus the split police date/time
 *     OtherIncidentTypes
 *     NotificationEntryForm           who was told, and when
 *     WitnessEntryForm / AllegedPerpetratorForm  the conditional groups
 *
 * `incident-schema.test.ts` covers the report as a whole. These are the six
 * type branches and three conditional groups it stops short of — the part of
 * the form that decides what a reportable incident actually records, and the
 * part a regulator would ask about.
 *
 * THE INCIDENT TYPE IS DERIVED, NOT CHOSEN
 *   `incidentType` is optional inside each entry; the component works out
 *   which types apply from whichever groups have something checked. So the
 *   schema will happily accept an entry with every group empty — a report of
 *   an incident with no type at all. Pinned below.
 *
 * DATETIMES ARE SPLIT IN THE UI AND UNVALIDATED
 *   Every backend datetime arrives here as a `date` string plus a `time`
 *   string, both bare `z.string().optional()`. The form can therefore record
 *   a 911 call at "yesterday" / "lunchtime", and the pairing is never checked
 *   — a date with no time passes, and so does a time with no date.
 *
 * TWO GROUPS ARE ALL-OR-NOTHING, VIA superRefine
 *   A witness and an alleged perpetrator are optional as a whole, but once
 *   ANY field is filled the name becomes mandatory (and for a witness, the
 *   phone too). That conditional is the only real branch in this file.
 */

import {
  AbuseIncidentTypes,
  AllegedPerpetratorForm,
  DeathIncidentTypesForm,
  ExternalDisasterIncidentTypes,
  IncidentEntryForm,
  IncidentTypeEnum,
  MissingResidentIncidentTypesForm,
  NotificationEntryForm,
  NotificationRoleEnum,
  OtherIncidentTypes,
  SeriousInjuryIncidentTypes,
  WitnessEntryForm,
} from "../../../model/clinical/add-incident.model";

const messageFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const pathsOf = (result: any) =>
  result.success ? [] : result.error.issues.map((i: any) => i.path.join("."));

// ═══════════════════════════════════════════════════════════════════════════
// The two enums
// ═══════════════════════════════════════════════════════════════════════════

describe("IncidentTypeEnum", () => {
  it("names the six reportable types", () => {
    expect(IncidentTypeEnum.options).toEqual([
      "ABUSE",
      "DEATH",
      "SERIOUS_INJURY",
      "EXTERNAL_DISASTER",
      "MISSING_RESIDENT",
      "OTHER",
    ]);
  });

  it("accepts each of them", () => {
    IncidentTypeEnum.options.forEach((t) =>
      expect(IncidentTypeEnum.safeParse(t).success).toBe(true)
    );
  });

  it("refuses a type outside the six", () => {
    expect(IncidentTypeEnum.safeParse("ELOPEMENT").success).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(IncidentTypeEnum.safeParse("abuse").success).toBe(false);
  });
});

describe("NotificationRoleEnum", () => {
  it("names the four parties a home must notify", () => {
    expect(NotificationRoleEnum.options).toEqual([
      "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
      "PHYSICIAN",
      "POLICE",
      "OTHER",
    ]);
  });

  it("accepts each of them", () => {
    NotificationRoleEnum.options.forEach((r) =>
      expect(NotificationRoleEnum.safeParse(r).success).toBe(true)
    );
  });

  it("refuses a party outside the four", () => {
    expect(NotificationRoleEnum.safeParse("OMBUDSMAN").success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Abuse
// ═══════════════════════════════════════════════════════════════════════════

describe("AbuseIncidentTypes", () => {
  const parse = (input: any) => AbuseIncidentTypes.safeParse(input);

  it("accepts nothing checked", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts each kind of abuse on its own", () => {
    [
      "physical",
      "verbal",
      "sexual",
      "mental",
      "residentToResident",
      "staffToResident",
    ].forEach((k) => expect(parse({ [k]: true }).success).toBe(true));
  });

  it("accepts several kinds together", () => {
    expect(parse({ physical: true, verbal: true, staffToResident: true }).success).toBe(
      true
    );
  });

  it("accepts a box explicitly unchecked", () => {
    expect(parse({ physical: false }).success).toBe(true);
  });

  it("refuses a non-boolean", () => {
    expect(parse({ physical: "yes" }).success).toBe(false);
  });

  it("is strict — a seventh kind of abuse cannot be smuggled in", () => {
    expect(parse({ financial: true }).success).toBe(false);
  });

  it("records who abused whom as two separate flags", () => {
    // resident-to-resident and staff-to-resident are independent of the
    // physical/verbal/sexual/mental nature, so both can be set.
    expect(parse({ physical: true, residentToResident: true }).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Death
// ═══════════════════════════════════════════════════════════════════════════

describe("DeathIncidentTypesForm", () => {
  const parse = (input: any) => DeathIncidentTypesForm.safeParse(input);

  it("accepts nothing filled", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts the three circumstance flags", () => {
    expect(
      parse({ unexpected: true, waiverRequestPending: false, hospiceProvided: true })
        .success
    ).toBe(true);
  });

  it("accepts a split 911 date and time", () => {
    expect(parse({ called911Date: "2026-09-17", called911Time: "14:30" }).success).toBe(
      true
    );
  });

  it("[as-built] accepts a 911 date with no time", () => {
    // The pair is never validated together, so a report can say the day an
    // ambulance was called but not the hour.
    expect(parse({ called911Date: "2026-09-17" }).success).toBe(true);
  });

  it("[as-built] accepts a 911 time with no date", () => {
    expect(parse({ called911Time: "14:30" }).success).toBe(true);
  });

  it("[as-built] does not check that the 911 date is a date", () => {
    expect(parse({ called911Date: "yesterday" }).success).toBe(true);
  });

  it("records who started CPR as free text", () => {
    expect(parse({ pchInitiatedCprBy: "Nurse Patel" }).success).toBe(true);
  });

  it("[as-built] does not require CPR details on an unexpected death", () => {
    expect(parse({ unexpected: true }).success).toBe(true);
  });

  it("refuses a non-boolean circumstance", () => {
    expect(parse({ unexpected: "yes" }).success).toBe(false);
  });

  it("refuses a numeric 911 date — the UI supplies strings", () => {
    expect(parse({ called911Date: 20260917 }).success).toBe(false);
  });

  it("is strict", () => {
    expect(parse({ causeOfDeath: "Natural" }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Serious injury
// ═══════════════════════════════════════════════════════════════════════════

describe("SeriousInjuryIncidentTypes", () => {
  const parse = (input: any) => SeriousInjuryIncidentTypes.safeParse(input);

  it("accepts nothing checked", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts each outcome", () => {
    ["resultedInDeath", "hospitalAdmission", "erVisit", "mdVisit"].forEach((k) =>
      expect(parse({ [k]: true }).success).toBe(true)
    );
  });

  it("[as-built] lets an injury be marked as resulting in death without a Death entry", () => {
    // The two type groups are independent, so `resultedInDeath` here does not
    // oblige the reporter to complete the Death section as well.
    expect(parse({ resultedInDeath: true }).success).toBe(true);
  });

  it("accepts an escalation path — ER then admission", () => {
    expect(parse({ erVisit: true, hospitalAdmission: true }).success).toBe(true);
  });

  it("refuses a non-boolean", () => {
    expect(parse({ erVisit: 1 }).success).toBe(false);
  });

  it("is strict", () => {
    expect(parse({ fracture: true }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// External disaster
// ═══════════════════════════════════════════════════════════════════════════

describe("ExternalDisasterIncidentTypes", () => {
  const parse = (input: any) => ExternalDisasterIncidentTypes.safeParse(input);

  it("accepts nothing checked", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts each kind of disaster", () => {
    ["fire", "flood", "damageToPhysicalPlant", "residentsRelocated"].forEach((k) =>
      expect(parse({ [k]: true }).success).toBe(true)
    );
  });

  it("accepts a fire that damaged the building and moved residents", () => {
    expect(
      parse({ fire: true, damageToPhysicalPlant: true, residentsRelocated: true }).success
    ).toBe(true);
  });

  it("[as-built] lets residents be relocated with no disaster named", () => {
    expect(parse({ residentsRelocated: true }).success).toBe(true);
  });

  it("refuses a non-boolean", () => {
    expect(parse({ fire: "yes" }).success).toBe(false);
  });

  it("is strict", () => {
    expect(parse({ earthquake: true }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Missing resident
// ═══════════════════════════════════════════════════════════════════════════

describe("MissingResidentIncidentTypesForm", () => {
  const parse = (input: any) => MissingResidentIncidentTypesForm.safeParse(input);

  it("accepts nothing filled", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts a split police-notified date and time", () => {
    expect(
      parse({ policeNotifiedDate: "2026-09-17", policeNotifiedTime: "09:15" }).success
    ).toBe(true);
  });

  it("records a memory impairment", () => {
    expect(parse({ residentHasMemoryImpairment: true }).success).toBe(true);
  });

  it("[as-built] does not require the police to have been notified", () => {
    // A resident can be recorded as missing with no police contact at all.
    expect(parse({ residentHasMemoryImpairment: true }).success).toBe(true);
  });

  it("[as-built] accepts a police date with no time", () => {
    expect(parse({ policeNotifiedDate: "2026-09-17" }).success).toBe(true);
  });

  it("[as-built] does not check that the police date is a date", () => {
    expect(parse({ policeNotifiedDate: "this morning" }).success).toBe(true);
  });

  it("refuses a non-boolean impairment flag", () => {
    expect(parse({ residentHasMemoryImpairment: "yes" }).success).toBe(false);
  });

  it("is strict", () => {
    expect(parse({ foundAt: "park" }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Other
// ═══════════════════════════════════════════════════════════════════════════

describe("OtherIncidentTypes", () => {
  const parse = (input: any) => OtherIncidentTypes.safeParse(input);

  it("accepts nothing checked", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts each named kind", () => {
    ["neglect", "exploitation", "ownerStaffCriminalRecord", "insuranceWill"].forEach(
      (k) => expect(parse({ [k]: true }).success).toBe(true)
    );
  });

  it("accepts a free-text description", () => {
    expect(parse({ other: "Medication delivery missed" }).success).toBe(true);
  });

  it("[as-built] the free-text field is a string, not a checkbox", () => {
    // Every sibling is a boolean; `other` alone is text, so `other: true`
    // fails while `other: "…"` passes.
    expect(parse({ other: true }).success).toBe(false);
    expect(parse({ other: "something else" }).success).toBe(true);
  });

  it("[as-built] accepts an empty free-text description", () => {
    expect(parse({ other: "" }).success).toBe(true);
  });

  it("[as-built] does not require a description alongside a named kind", () => {
    expect(parse({ neglect: true }).success).toBe(true);
  });

  it("is strict", () => {
    expect(parse({ theft: true }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The entry that ties the six groups together
// ═══════════════════════════════════════════════════════════════════════════

describe("IncidentEntryForm", () => {
  const parse = (input: any) => IncidentEntryForm.safeParse(input);

  it("[as-built] accepts an entry with no type and nothing checked", () => {
    // Every group is optional and the type array is derived on submit, so an
    // empty entry is valid here — the component is the only thing standing
    // between that and a typeless incident report.
    expect(parse({}).success).toBe(true);
  });

  it("accepts a derived type array", () => {
    expect(parse({ incidentType: ["ABUSE"] }).success).toBe(true);
  });

  it("accepts several derived types", () => {
    expect(parse({ incidentType: ["ABUSE", "SERIOUS_INJURY"] }).success).toBe(true);
  });

  it("refuses a type outside the six", () => {
    expect(parse({ incidentType: ["ELOPEMENT"] }).success).toBe(false);
  });

  it("[as-built] does not check the type against the groups that are filled", () => {
    // An entry can claim DEATH while only the abuse boxes are checked.
    expect(
      parse({ incidentType: ["DEATH"], abuseTypes: { physical: true } }).success
    ).toBe(true);
  });

  it("accepts all six groups at once", () => {
    expect(
      parse({
        abuseTypes: { physical: true },
        deathTypes: { unexpected: true },
        seriousInjuryTypes: { erVisit: true },
        externalDisasterTypes: { fire: true },
        missingResidentTypes: { residentHasMemoryImpairment: true },
        other: { neglect: true },
      }).success
    ).toBe(true);
  });

  it("reports the path into the offending group", () => {
    const result = parse({ abuseTypes: { financial: true } });
    expect(result.success).toBe(false);
    expect(pathsOf(result)[0]).toContain("abuseTypes");
  });

  it("is strict — a seventh group cannot be added", () => {
    expect(parse({ medicationErrorTypes: {} }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════════

describe("NotificationEntryForm", () => {
  const parse = (input: any) => NotificationEntryForm.safeParse(input);

  it("requires a role — you cannot record telling nobody", () => {
    expect(parse({}).success).toBe(false);
  });

  it("accepts a role alone", () => {
    expect(parse({ role: "PHYSICIAN" }).success).toBe(true);
  });

  it("accepts each of the four parties", () => {
    NotificationRoleEnum.options.forEach((role) =>
      expect(parse({ role }).success).toBe(true)
    );
  });

  it("refuses a party outside the four", () => {
    expect(parse({ role: "OMBUDSMAN" }).success).toBe(false);
  });

  it("accepts a name", () => {
    expect(parse({ role: "PHYSICIAN", name: "Dr Patel" }).success).toBe(true);
  });

  it("treats an empty name as absent", () => {
    const result = parse({ role: "PHYSICIAN", name: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeUndefined();
  });

  it("accepts a split notified date and time", () => {
    expect(
      parse({ role: "POLICE", notifiedDate: "2026-09-17", notifiedTime: "09:15" }).success
    ).toBe(true);
  });

  it("[as-built] does not require WHEN a party was notified", () => {
    // The most consequential gap in this group: a report can say the police
    // were told without saying when.
    expect(parse({ role: "POLICE" }).success).toBe(true);
  });

  it("[as-built] does not require a name for OTHER", () => {
    expect(parse({ role: "OTHER" }).success).toBe(true);
  });

  it("is strict", () => {
    expect(parse({ role: "POLICE", badgeNumber: "123" }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Witnesses — optional as a whole, then all-or-nothing
// ═══════════════════════════════════════════════════════════════════════════

describe("WitnessEntryForm", () => {
  const parse = (input: any) => WitnessEntryForm.safeParse(input);

  it("accepts an entirely empty witness — the row was never filled", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts a witness with a name and a phone", () => {
    expect(parse({ name: "Sam Ray", phone: "5551234567" }).success).toBe(true);
  });

  it("demands a name once anything is filled", () => {
    const result = parse({ address: "12 Oak Lane" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "name")).toBe("Witness name is required");
  });

  it("demands a phone once anything is filled", () => {
    const result = parse({ name: "Sam Ray" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "phone")).toBe("Mobile must be exactly 10 digits");
  });

  it("names both gaps at once", () => {
    const result = parse({ relationshipToResident: "Neighbour" });
    expect(pathsOf(result).sort()).toEqual(["name", "phone"]);
  });

  it("strips formatting from the phone before checking it", () => {
    // `phoneDigits10` preprocesses out every non-digit, so the familiar
    // format is accepted here — unlike the CRM mobile fields, which refuse it.
    const result = parse({ name: "Sam Ray", phone: "(555) 123-4567" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("5551234567");
  });

  it("[boundary] refuses nine digits", () => {
    expect(parse({ name: "Sam Ray", phone: "555123456" }).success).toBe(false);
  });

  it("[boundary] refuses eleven digits", () => {
    expect(parse({ name: "Sam Ray", phone: "55512345678" }).success).toBe(false);
  });

  it("refuses a phone of only punctuation", () => {
    expect(parse({ name: "Sam Ray", phone: "---" }).success).toBe(false);
  });

  it("accepts an address and relationship alongside the required pair", () => {
    expect(
      parse({
        name: "Sam Ray",
        phone: "5551234567",
        address: "12 Oak Lane",
        relationshipToResident: "Neighbour",
      }).success
    ).toBe(true);
  });

  it("[as-built] a row of only empty strings counts as never filled", () => {
    // Which is what an untouched row in the UI actually contains.
    expect(parse({ name: "", address: "", phone: "", relationshipToResident: "" }).success)
      .toBe(true);
  });

  it("is strict", () => {
    expect(parse({ name: "Sam Ray", phone: "5551234567", age: 40 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The alleged perpetrator — the same idea, one field looser
// ═══════════════════════════════════════════════════════════════════════════

describe("AllegedPerpetratorForm", () => {
  const parse = (input: any) => AllegedPerpetratorForm.safeParse(input);

  it("accepts being omitted entirely", () => {
    expect(parse(undefined).success).toBe(true);
  });

  it("accepts an empty object — the section was never opened", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts an object of only empty strings", () => {
    // `makeOptionalOnEmptyObject` collapses it to undefined before the
    // superRefine can demand a name.
    expect(parse({ name: "", address: "", phone: "" }).success).toBe(true);
  });

  it("accepts a named perpetrator", () => {
    expect(parse({ name: "Unknown Visitor" }).success).toBe(true);
  });

  it("[as-built] does NOT require a phone, unlike a witness", () => {
    // The only difference between the two conditional groups: a witness must
    // be contactable, an alleged perpetrator need only be named.
    expect(parse({ name: "Unknown Visitor" }).success).toBe(true);
  });

  it("demands a name once anything else is filled", () => {
    const result = parse({ address: "12 Oak Lane" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "name")).toBe("Alleged perpetrator name is required");
  });

  it("strips formatting from the phone", () => {
    const result = parse({ name: "Visitor", phone: "555-123-4567" });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as any).phone).toBe("5551234567");
  });

  it("[boundary] requires exactly five digits in the zip", () => {
    expect(parse({ name: "Visitor", zip: "62704" }).success).toBe(true);
    expect(parse({ name: "Visitor", zip: "6270" }).success).toBe(false);
    expect(parse({ name: "Visitor", zip: "627041" }).success).toBe(false);
  });

  it("strips formatting from the zip before checking it", () => {
    const result = parse({ name: "Visitor", zip: "62704-1234" });
    // Nine digits after stripping, so the extended form is refused here.
    expect(result.success).toBe(false);
  });

  it("explains the zip rule", () => {
    expect(messageFor(parse({ name: "Visitor", zip: "1" }), "zip")).toBe(
      "zip must be exactly 5 digits"
    );
  });

  it("accepts a full address for the perpetrator", () => {
    expect(
      parse({
        name: "Visitor",
        relationshipToResident: "Family friend",
        address: "12 Oak Lane",
        city: "Springfield",
        state: "Illinois",
        zip: "62704",
        phone: "5551234567",
      }).success
    ).toBe(true);
  });

  it("is strict", () => {
    expect(parse({ name: "Visitor", dateOfBirth: "1970-01-01" }).success).toBe(false);
  });
});
