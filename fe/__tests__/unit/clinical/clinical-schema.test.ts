/**
 * Clinical record schema — model/clinical/clinical.model.ts
 *
 * One schema covers the whole clinical record: medications, med-pass
 * results, care-plan services and incident reports. These are the fields a
 * caregiver enters at the bedside, so a rule that silently blocks a save (or
 * silently accepts a bad time) is a patient-safety problem, not a cosmetic one.
 * Unknown keys are `.strip()`ed rather than rejected — a stray field is
 * silently dropped from the save.
 */

import { ClinicalSchema } from "../../../model/clinical/clinical.model";
import { TEST_USER_ID } from "../../test-utils/auth";
import {
  makeIncidentReport,
  makeMedication,
  makeMedPassService,
  UUIDS,
} from "../../test-utils/factories";

const errorFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const parse = (record: Record<string, any>) => ClinicalSchema.safeParse(record);

// ─── Record shell ────────────────────────────────────────────────────────────

describe("ClinicalSchema — record shell", () => {
  it("accepts an empty record — every section is optional", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts a userId in UUID form", () => {
    expect(parse({ userId: UUIDS.senior }).success).toBe(true);
  });

  it("rejects a non-UUID userId", () => {
    expect(parse({ userId: "senior-1" }).success).toBe(false);
  });

  it("[as-built] strips an unknown top-level section — the save still succeeds", () => {
    const result = parse({ vitalsHistory: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("vitalsHistory");
    }
  });

  describe("status", () => {
    it("accepts a short status", () => {
      expect(parse({ status: "In Home" }).success).toBe(true);
    });

    it("rejects a status longer than 10 characters", () => {
      const result = parse({ status: "Discharged Yesterday" });
      expect(errorFor(result, "status")).toBe(
        "Status should not be more than 10 characters"
      );
    });
  });

  describe("roomNumber", () => {
    it("accepts a positive room number", () => {
      expect(parse({ roomNumber: 12 }).success).toBe(true);
    });

    it("accepts room zero", () => {
      expect(parse({ roomNumber: 0 }).success).toBe(true);
    });

    it("rejects a negative room number", () => {
      const result = parse({ roomNumber: -1 });
      expect(errorFor(result, "roomNumber")).toBe(
        "Room Number should be greater than or equal to zero"
      );
    });

    it("rejects a room number sent as a string", () => {
      // Form inputs yield strings; the field must be coerced before submission.
      expect(parse({ roomNumber: "12" }).success).toBe(false);
    });
  });
});

// ─── Medication ──────────────────────────────────────────────────────────────

describe("ClinicalSchema — medication", () => {
  const withMed = (overrides: Record<string, any> = {}) =>
    parse({ medication: makeMedication(overrides) });

  it("accepts a complete medication", () => {
    expect(withMed().success).toBe(true);
  });

  it("requires a name and a dosage", () => {
    expect(parse({ medication: { startdate: "2026-02-01", timings: ["07:00:00"] } }).success).toBe(
      false
    );
  });

  it.each(["Metformin", "Vitamin D3", "Co-codamol", "Insulin (rapid)", "B_12"])(
    "accepts the medication name %p",
    (name) => {
      expect(withMed({ name }).success).toBe(true);
    }
  );

  it.each(["Aspirin!", "Ibuprofen@200", "Med#1"])(
    "rejects the medication name %p",
    (name) => {
      const result = withMed({ name });
      expect(errorFor(result, "medication.name")).toBe(
        "Only alphabets, numbers, and special characters (, -, _ are allowed"
      );
    }
  );

  describe("dates", () => {
    it("accepts an ISO start date", () => {
      expect(withMed({ startdate: "2026-02-01T00:00:00.000Z" }).success).toBe(true);
    });

    it("rejects an unparseable start date", () => {
      const result = withMed({ startdate: "tomorrow" });
      expect(errorFor(result, "medication.startdate")).toBe("Invalid date format");
    });

    it("accepts an empty end date — an open-ended prescription", () => {
      expect(withMed({ enddate: "" }).success).toBe(true);
    });

    it("accepts a valid end date", () => {
      expect(withMed({ enddate: "2026-06-01" }).success).toBe(true);
    });

    it("rejects an unparseable end date", () => {
      const result = withMed({ enddate: "never" });
      expect(errorFor(result, "medication.enddate")).toBe("Invalid date format");
    });
  });

  describe("timings (med-pass slots)", () => {
    it("requires at least one timing", () => {
      const result = withMed({ timings: [] });
      expect(errorFor(result, "medication.timings")).toBe(
        "At least one time must be selected"
      );
    });

    it("accepts several timings a day", () => {
      expect(withMed({ timings: ["07:00:00", "12:00:00", "21:00:00"] }).success).toBe(
        true
      );
    });

    it.each(["7:00", "25:00:00", "07:60:00", "morning"])(
      "rejects the malformed timing %p",
      (timing) => {
        const result = withMed({ timings: [timing] });
        expect(errorFor(result, "medication.timings.0")).toBe("Invalid time format");
      }
    );

    it("also accepts the seconds-less form HH:mm", () => {
      // zod's `.time()` treats "07:00" as valid, so both shapes reach the API.
      // Anything comparing timings as strings has to normalise first.
      expect(withMed({ timings: ["07:00"] }).success).toBe(true);
    });
  });

  it("flags an over-the-counter medication with a boolean", () => {
    expect(withMed({ overTheCounter: true }).success).toBe(true);
    expect(withMed({ overTheCounter: "yes" }).success).toBe(false);
  });

  it("[as-built] strips an unknown medication field — the save still succeeds", () => {
    const result = withMed({ prescriber: "Dr Ross" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.medication).not.toHaveProperty("prescriber");
    }
  });
});

// ─── Med pass ────────────────────────────────────────────────────────────────

describe("ClinicalSchema — medPass", () => {
  const withMedPass = (services: any[], comments?: any[]) =>
    parse({ medPass: { services, ...(comments ? { comments } : {}) } });

  it("accepts a Pass record", () => {
    expect(withMedPass([makeMedPassService()]).success).toBe(true);
  });

  it("accepts a Refuse record with remarks", () => {
    expect(
      withMedPass([
        makeMedPassService({ passOrRefuse: "Refuse", remarks: "Resident declined" }),
      ]).success
    ).toBe(true);
  });

  it("rejects any outcome other than Pass or Refuse", () => {
    const result = withMedPass([makeMedPassService({ passOrRefuse: "Skipped" })]);
    expect(errorFor(result, "medPass.services.0.passOrRefuse")).toBe(
      "Values must be either Pass or Refuse"
    );
  });

  it("requires the medication to be identified by UUID", () => {
    const result = withMedPass([makeMedPassService({ medicationId: "med-1" })]);
    expect(errorFor(result, "medPass.services.0.medicationId")).toBe(
      "MedicationId must be a valid UUID"
    );
  });

  it("requires the administering caregiver to be identified by UUID", () => {
    // Who administered a dose is the audit trail; a free-text name is not enough.
    const result = withMedPass([makeMedPassService({ providedBy: "Priya" })]);
    expect(errorFor(result, "medPass.services.0.providedBy")).toBe(
      "ProvidedBy must be a valid UUID"
    );
  });

  it("rejects a malformed administration time", () => {
    const result = withMedPass([makeMedPassService({ timing: "7am" })]);
    expect(errorFor(result, "medPass.services.0.timing")).toBe("Invalid time format");
  });

  it("accepts an ISO providedAt timestamp", () => {
    expect(
      withMedPass([makeMedPassService({ providedAt: "2026-02-01T07:05:00.000Z" })])
        .success
    ).toBe(true);
  });

  it("rejects a non-ISO providedAt timestamp", () => {
    expect(
      withMedPass([makeMedPassService({ providedAt: "2026-02-01 07:05" })]).success
    ).toBe(false);
  });

  it("accepts an empty services list — a med pass with nothing due", () => {
    expect(withMedPass([]).success).toBe(true);
  });

  describe("comments", () => {
    const comment = (overrides: Record<string, any> = {}) => ({
      messageId: UUIDS.medication,
      message: "Resident was asleep at the first attempt",
      createdAt: "2026-02-01T07:10:00.000Z",
      createdByUserId: TEST_USER_ID,
      createdByUserName: "Priya Patel",
      ...overrides,
    });

    it("accepts a comment", () => {
      expect(withMedPass([], [comment()]).success).toBe(true);
    });

    it("accepts a threaded reply", () => {
      expect(
        withMedPass([], [comment({ parentMessageId: UUIDS.senior })]).success
      ).toBe(true);
    });

    it("accepts a top-level comment with an explicit null parent", () => {
      expect(withMedPass([], [comment({ parentMessageId: null })]).success).toBe(true);
    });

    it("rejects an empty comment body", () => {
      const result = withMedPass([], [comment({ message: "" })]);
      expect(errorFor(result, "medPass.comments.0.message")).toBe(
        "Message should be non empty"
      );
    });

    it("rejects an author name containing digits", () => {
      const result = withMedPass([], [comment({ createdByUserName: "Priya 2" })]);
      expect(errorFor(result, "medPass.comments.0.createdByUserName")).toBe(
        "Only alphabets are allowed"
      );
    });

    it("rejects a non-ISO createdAt", () => {
      const result = withMedPass([], [comment({ createdAt: "2026-02-01" })]);
      expect(errorFor(result, "medPass.comments.0.createdAt")).toBe(
        "CreatedAt must be a valid datetime string"
      );
    });
  });
});

// ─── Care plan ───────────────────────────────────────────────────────────────

describe("ClinicalSchema — carePlan services", () => {
  const withServices = (services: any[]) => parse({ carePlan: { services } });

  it.each(["ADL", "Vital Signs", "House Keeping"])(
    "accepts the service category %p",
    (serviceCategory) => {
      expect(
        withServices([{ serviceCategory, serviceName: "Bathing" }]).success
      ).toBe(true);
    }
  );

  it("rejects an unknown service category", () => {
    const result = withServices([
      { serviceCategory: "Nutrition", serviceName: "Feeding" },
    ]);
    expect(errorFor(result, "carePlan.services.0.serviceCategory")).toBe(
      "Service category must be ADL, Vital Signs, or House Keeping"
    );
  });

  it("requires a non-empty service name", () => {
    expect(withServices([{ serviceCategory: "ADL", serviceName: "" }]).success).toBe(
      false
    );
  });

  it.each(["Provided", "Not Provided"])("accepts the outcome %p", (providedOrNot) => {
    expect(
      withServices([{ serviceName: "Bathing", providedOrNot }]).success
    ).toBe(true);
  });

  it("rejects an unknown outcome", () => {
    const result = withServices([
      { serviceName: "Bathing", providedOrNot: "Partially" },
    ]);
    expect(errorFor(result, "carePlan.services.0.providedOrNot")).toBe(
      "Values must be either Provided or Not Provided"
    );
  });

  it("records an ADL service with a single providedAt timestamp", () => {
    expect(
      withServices([
        {
          serviceCategory: "ADL",
          serviceName: "Bathing",
          providedOrNot: "Provided",
          providedAt: "2026-02-01T08:00:00.000Z",
        },
      ]).success
    ).toBe(true);
  });

  it("records a vital sign as timestamped readings", () => {
    expect(
      withServices([
        {
          serviceCategory: "Vital Signs",
          serviceName: "Blood Pressure",
          readings: [
            { time: "2026-02-01T08:00:00.000Z", value: "120/80" },
            { time: "2026-02-01T20:00:00.000Z", value: "118/76" },
          ],
        },
      ]).success
    ).toBe(true);
  });

  it("requires each reading to carry both a time and a value", () => {
    expect(
      withServices([
        {
          serviceCategory: "Vital Signs",
          serviceName: "Pulse",
          readings: [{ time: "2026-02-01T08:00:00.000Z" }],
        },
      ]).success
    ).toBe(false);
  });

  it("rejects a non-ISO reading time", () => {
    expect(
      withServices([
        {
          serviceName: "Pulse",
          readings: [{ time: "08:00", value: "72" }],
        },
      ]).success
    ).toBe(false);
  });

  it("[as-built] strips an unknown field on a service — the save still succeeds", () => {
    const result = withServices([{ serviceName: "Bathing", notes: "went well" }]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.carePlan.services[0]).not.toHaveProperty("notes");
    }
  });
});

// ─── Incident report ─────────────────────────────────────────────────────────

describe("ClinicalSchema — incidentReport", () => {
  const withIncident = (overrides: Record<string, any> = {}) =>
    parse({ incidentReport: makeIncidentReport(overrides) });

  it("accepts a minimal incident report", () => {
    expect(withIncident().success).toBe(true);
  });

  it("appends seconds to the HH:mm the time picker produces", () => {
    // The picker yields "09:30"; the API expects "09:30:00".
    const result = withIncident({ incidentStartTime: "09:30" });
    expect((result as any).data.incidentReport.incidentStartTime).toBe("09:30:00");
  });

  it("appends seconds to the end time too", () => {
    const result = withIncident({ incidentEndTime: "10:15" });
    expect((result as any).data.incidentReport.incidentEndTime).toBe("10:15:00");
  });

  it("leaves an empty time untouched rather than turning it into ':00'", () => {
    const result = withIncident({ incidentStartTime: "" });
    expect((result as any).data.incidentReport.incidentStartTime).toBe("");
  });

  it("requires a description", () => {
    expect(parse({ incidentReport: { incidentStartTime: "09:30" } }).success).toBe(
      false
    );
  });

  it("accepts optional additional comments", () => {
    expect(withIncident({ comments: "Family notified" }).success).toBe(true);
  });

  it("[as-built] strips an unknown incident field — the save still succeeds", () => {
    const result = withIncident({ severity: "high" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incidentReport).not.toHaveProperty("severity");
    }
  });
});

// ─── Whole record ────────────────────────────────────────────────────────────

describe("ClinicalSchema — a complete record", () => {
  it("accepts every section together", () => {
    const result = parse({
      userId: UUIDS.senior,
      status: "In Home",
      roomNumber: 12,
      medication: makeMedication(),
      medPass: { services: [makeMedPassService()] },
      carePlan: {
        services: [
          {
            serviceCategory: "ADL",
            serviceName: "Bathing",
            providedOrNot: "Provided",
            providedAt: "2026-02-01T08:00:00.000Z",
          },
        ],
      },
      incidentReport: makeIncidentReport(),
    });
    expect(result.success).toBe(true);
  });

  it("reports errors from several sections at once", () => {
    const result = parse({
      roomNumber: -1,
      medication: makeMedication({ timings: [] }),
    });
    expect(errorFor(result, "roomNumber")).toBeDefined();
    expect(errorFor(result, "medication.timings")).toBeDefined();
  });
});
