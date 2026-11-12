import { z } from "zod";
import {
  arrayOfNonEmpty,
  makeOptionalOnEmpty,
  makeOptionalOnEmptyObject,
} from "../../utils/makeOptional";

/**
 * FRONTEND FORM SCHEMA
 * - Matches backend keys EXCEPT datetime fields are split (date+time strings).
 * - `incidentType` INSIDE EACH ENTRY is OPTIONAL here (we derive it onSubmit).
 */

export const IncidentTypeEnum = z.enum([
  "ABUSE",
  "DEATH",
  "SERIOUS_INJURY",
  "EXTERNAL_DISASTER",
  "MISSING_RESIDENT",
  "OTHER",
]);

export const NotificationRoleEnum = z.enum([
  "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
  "PHYSICIAN",
  "POLICE",
  "OTHER",
]);

export const AbuseIncidentTypes = z
  .object({
    physical: z.boolean().optional(),
    verbal: z.boolean().optional(),
    sexual: z.boolean().optional(),
    mental: z.boolean().optional(),
    residentToResident: z.boolean().optional(),
    staffToResident: z.boolean().optional(),
  })
  .strict();

export const DeathIncidentTypesForm = z
  .object({
    unexpected: z.boolean().optional(),
    waiverRequestPending: z.boolean().optional(),
    hospiceProvided: z.boolean().optional(),
    called911Date: z.string().optional(), // UI split of called911At
    called911Time: z.string().optional(),
    pchInitiatedCprBy: z.string().optional(),
  })
  .strict();

export const SeriousInjuryIncidentTypes = z
  .object({
    resultedInDeath: z.boolean().optional(),
    hospitalAdmission: z.boolean().optional(),
    erVisit: z.boolean().optional(),
    mdVisit: z.boolean().optional(),
  })
  .strict();

export const ExternalDisasterIncidentTypes = z
  .object({
    fire: z.boolean().optional(),
    flood: z.boolean().optional(),
    damageToPhysicalPlant: z.boolean().optional(),
    residentsRelocated: z.boolean().optional(),
  })
  .strict();

export const MissingResidentIncidentTypesForm = z
  .object({
    policeNotifiedDate: z.string().optional(), // UI split of policeNotifiedAt
    policeNotifiedTime: z.string().optional(),
    residentHasMemoryImpairment: z.boolean().optional(),
  })
  .strict();

export const OtherIncidentTypes = z
  .object({
    neglect: z.boolean().optional(),
    exploitation: z.boolean().optional(),
    ownerStaffCriminalRecord: z.boolean().optional(),
    insuranceWill: z.boolean().optional(),
    other: z.string().optional(),
  })
  .strict();

export const NotificationEntryForm = z
  .object({
    role: NotificationRoleEnum,
    name: makeOptionalOnEmpty(z.string()),
    notifiedDate: z.string().optional(), // UI split of notifiedAt
    notifiedTime: z.string().optional(),
  })
  .strict();

const phoneDigits10 = z.preprocess(
  (val) => (typeof val === "string" ? val.replace(/\D+/g, "") : val),
  z
    .string()
    .regex(/^[0-9]+$/, { message: "Mobile accepts numbers only" })
    .length(10, {
      message: "Mobile must be exactly 10 digits",
    }),
);

const zipDigits5 = z.preprocess(
  (val) => (typeof val === "string" ? val.replace(/\D+/g, "") : val),
  z
    .string()
    .regex(/^[0-9]+$/, { message: "zip accepts numbers only" })
    .length(5, { message: "zip must be exactly 5 digits" }),
);

export const WitnessEntryForm = z
  .object({
    name: makeOptionalOnEmpty(z.string().min(1)),
    address: makeOptionalOnEmpty(z.string()),
    phone: makeOptionalOnEmpty(phoneDigits10),
    relationshipToResident: makeOptionalOnEmpty(z.string()),
  })
  .strict()
  .superRefine((val, ctx) => {
    const anyFilled = Object.values(val).some(
      (v) => v !== undefined && v !== null && v !== "",
    );
    if (!anyFilled) return;

    if (!val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Witness name is required",
      });
    }

    if (!val.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Mobile must be exactly 10 digits",
      });
    }
  });

const AllegedPerpetratorBase = z
  .object({
    name: makeOptionalOnEmpty(z.string().min(1)),
    relationshipToResident: makeOptionalOnEmpty(z.string()),
    address: makeOptionalOnEmpty(z.string()),
    phone: makeOptionalOnEmpty(phoneDigits10),
    city: makeOptionalOnEmpty(z.string()),
    state: makeOptionalOnEmpty(z.string()),
    zip: makeOptionalOnEmpty(zipDigits5),
  })
  .strict()
  .superRefine((val, ctx) => {
    const anyFilled = Object.values(val).some(
      (v) => v !== undefined && v !== null && v !== "",
    );
    if (!anyFilled) return;

    if (!val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Alleged perpetrator name is required",
      });
    }
  });

export const AllegedPerpetratorForm = makeOptionalOnEmptyObject(
  AllegedPerpetratorBase,
);

export const IncidentEntryForm = z
  .object({
    // OPTIONAL in the UI; we’ll derive it from the checked groups on submit
    incidentType: z.array(IncidentTypeEnum).optional(),

    abuseTypes: AbuseIncidentTypes.optional(),
    deathTypes: DeathIncidentTypesForm.optional(), // split DT
    seriousInjuryTypes: SeriousInjuryIncidentTypes.optional(),
    externalDisasterTypes: ExternalDisasterIncidentTypes.optional(),
    missingResidentTypes: MissingResidentIncidentTypesForm.optional(), // split DT
    other: OtherIncidentTypes.optional(),
  })
  .strict();

export const IncidentReportFormSchema = z
  .object({
    incidentId: z.string().uuid().optional(), // backend-required; we generate on submit

    facilityName: z.string().min(1),
    facilityCounty: makeOptionalOnEmpty(z.string().min(1)),
    facilityPhone: phoneDigits10,
    facilityFax: makeOptionalOnEmpty(z.string()),
    facilityEmail: makeOptionalOnEmpty(
      z
        .string()
        .email({ message: "Email has an invalid email format" })
        .toLowerCase(),
    ),
    facilityAdministrator: z.string().min(1),

    incidentType: z.array(IncidentEntryForm),

    residentName: z.array(z.string().min(1)),

    // UI split of backend incidentDate (datetime)
    incidentDate: z.string().min(1),
    incidentTime: z.string().min(1),

    notifications: arrayOfNonEmpty(NotificationEntryForm),

    allegedPerpetratorDetails: AllegedPerpetratorForm.optional(),
    witnesses: arrayOfNonEmpty(WitnessEntryForm),

    reporterName: z.string().min(1),
    reporterTitle: makeOptionalOnEmpty(z.string()),

    // UI split of backend incidentReportedAt (datetime)
    incidentReportedDate: z.string().min(1),
    incidentReportedTime: z.string().min(1),

    detailsOfIncident: z.string().min(1),
    immediateCorrections: z.string().optional(),
    reporterSignature: z.string().optional(),
  })
  .strict();

export type IncidentReportFormType = z.infer<typeof IncidentReportFormSchema>;
