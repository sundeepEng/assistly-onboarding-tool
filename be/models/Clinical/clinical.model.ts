import { z } from 'zod';

//#region Incident Report Schema
const IncidentTypeEnum = z.enum([
  'ABUSE',
  'DEATH',
  'SERIOUS_INJURY',
  'EXTERNAL_DISASTER',
  'MISSING_RESIDENT',
  'OTHER',
]);

const AbuseIncidentTypes = z
  .object({
    physical: z.boolean().optional(),
    verbal: z.boolean().optional(),
    sexual: z.boolean().optional(),
    mental: z.boolean().optional(),
    residentToResident: z.boolean().optional(),
    staffToResident: z.boolean().optional(),
  })
  .strict();

const DeathIncidentTypes = z
  .object({
    unexpected: z.boolean().optional(),
    waiverRequestPending: z.boolean().optional(),
    hospiceProvided: z.boolean().optional(),
    called911At: z.string().datetime().optional(),
    pchInitiatedCprBy: z.string().optional(),
  })
  .strict();

const SeriousInjuryIncidentTypes = z
  .object({
    resultedInDeath: z.boolean().optional(),
    hospitalAdmission: z.boolean().optional(),
    erVisit: z.boolean().optional(),
    mdVisit: z.boolean().optional(),
  })
  .strict();

const ExternalDisasterIncidentTypes = z
  .object({
    fire: z.boolean().optional(),
    flood: z.boolean().optional(),
    damageToPhysicalPlant: z.boolean().optional(),
    residentsRelocated: z.boolean().optional(),
  })
  .strict();

const MissingResidentIncidentTypes = z
  .object({
    policeNotifiedAt: z.string().datetime().optional(),
    residentHasMemoryImpairment: z.boolean().optional(),
  })
  .strict();

const OtherIncidentTypes = z
  .object({
    neglect: z.boolean().optional(),
    exploitation: z.boolean().optional(),
    ownerStaffCriminalRecord: z.boolean().optional(),
    insuranceWill: z.boolean().optional(),
    other: z.string().optional(),
  })
  .strict();

const NotificationRoleEnum = z.enum([
  'FAMILY/GUARDIAN/RESPONSIBLE_PARTY',
  'PHYSICIAN',
  'POLICE',
  'OTHER',
]);

const NotificationEntry = z
  .object({
    role: NotificationRoleEnum,
    name: z.string().optional(),
    notifiedAt: z.string().datetime().optional(),
  })
  .strict();

const WitnessEntry = z
  .object({
    name: z.string().min(1),
    address: z.string().optional(),
    phone: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Mobile accepts numbers only' })
      .length(10, {
        message: 'Mobile must be exactly 10 digits',
      }),
    relationshipToResident: z.string().optional(),
  })
  .strict();

const AllegedPerpetrator = z
  .object({
    name: z.string().min(1),
    relationshipToResident: z.string().optional(),
    address: z.string().optional(),
    phone: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Mobile accepts numbers only' })
      .length(10, {
        message: 'Mobile must be exactly 10 digits',
      })
      .optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z
      .string()
      .regex(/^[0-9]+$/, { message: 'zip accepts numbers only' })
      .length(5, { message: 'zip must be exactly 5 digits' })
      .optional(),
  })
  .strict();

const IncidentEntry = z
  .object({
    incidentType: z.array(IncidentTypeEnum),
    abuseTypes: AbuseIncidentTypes.optional(),
    deathTypes: DeathIncidentTypes.optional(),
    seriousInjuryTypes: SeriousInjuryIncidentTypes.optional(),
    externalDisasterTypes: ExternalDisasterIncidentTypes.optional(),
    missingResidentTypes: MissingResidentIncidentTypes.optional(),
    other: OtherIncidentTypes.optional(),
  })
  .strict();

const IncidentReportSchema = z
  .object({
    incidentId: z.string().uuid(),
    facilityName: z.string().min(1),
    facilityCounty: z.string().min(1).optional(),
    facilityPhone: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Mobile accepts numbers only' })
      .length(10, {
        message: 'Mobile must be exactly 10 digits',
      }),
    facilityFax: z.string().optional(),
    facilityEmail: z
      .string()
      .email({ message: 'Email has an invalid email format' })
      .toLowerCase()
      .optional(),
    facilityAdministrator: z.string().min(1),
    incidentType: z.array(IncidentEntry),
    residentName: z.array(z.string().min(1)),
    incidentDate: z.string().datetime(),
    incidentDetails: z.string().optional(),
    notifications: z.array(NotificationEntry).optional(),
    allegedPerpetratorDetails: AllegedPerpetrator.optional(),
    immediateCorrections: z.string().optional(),
    witnesses: z.array(WitnessEntry).optional(),
    reporterName: z.string().min(1),
    reporterTitle: z.string().optional(),
    incidentReportedAt: z.string().datetime(),
    signature: z.string().optional(),
    createdAt: z.string().datetime(),
  })
  .strict();
//#endregion

export const ClinicalSchema = z
  .object({
    userId: z.string().uuid(),
    status: z
      .string()
      .max(10, { message: 'Status should not be more than 10 characters' })
      .optional(),
    roomNumber: z
      .number()
      .nonnegative({
        message: 'Room Number should be greater than or equal to zero',
      })
      .optional(),
    emarSignedDocumentUrls: z
      .array(
        z.object({
          url: z.string().url(),
          date: z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Date must be in MM/YYYY format'),
        })
      )
      .optional(),
    medication: z
      .array(
        z
          .object({
            id: z.string().uuid({ message: 'Id must be a valid UUID' }),
            name: z.string().regex(/^[A-Za-z0-9\s()_,\-/%'.+&;:]+$/, {
              message:
                "Only alphabets, numbers, and special characters (, -, _, /, %, ., +, ', &, ;, :) are allowed",
            }),
            dosage: z.string(),
            directions: z.string().optional(),
            startdate: z.string().date(),
            enddate: z.string().date().optional(),
            timings: z.array(
              z.string({ message: 'Must be a string' }).time({ message: 'Invalid time format' }),
              { message: 'Must be an array of strings' }
            ),
            additionalComments: z.string().optional(),
            overTheCounter: z.boolean({
              message: 'Values must be either true or false',
            }), // Attribute to differentiate between daily and Over the counter medications
            is_deleted: z.boolean().default(false).optional(),
          })
          .strict()
      )
      .optional(),
    medPass: z
      .object({
        services: z.array(
          z
            .object({
              medicationId: z.string().uuid({ message: 'MedicationId must be a valid UUID' }),
              passOrRefuse: z.enum(['Pass', 'Refuse'], {
                message: 'Values must be either Pass or Refuse',
              }),
              timing: z
                .string({ message: 'Must be a string' })
                .time({ message: 'Invalid time format' }),
              remarks: z.string().optional(),
              providedAt: z.string().datetime().optional(),
              providedBy: z.string().uuid({ message: 'ProvidedBy must be a valid UUID' }), // Desribes the UUID of PCG who provided the medication
            })
            .strict()
        ),
        comments: z
          .array(
            z
              .object({
                messageId: z.string().uuid({ message: 'messageId has an invalid UUID format' }),
                message: z.string().nonempty({ message: 'Message should be non empty' }),
                parentMessageId: z
                  .string()
                  .uuid({
                    message: 'parentMessageId has an invalid UUID format',
                  })
                  .nullable()
                  .optional(),
                createdAt: z.string().datetime({
                  message: 'createdAt has an invalid datetime format',
                }),
                createdByUserId: z.string().uuid({
                  message: 'createdByUserID has an invalid UUID format',
                }),
                createdByUserName: z.string().regex(/^[A-Za-z0-9\s]+$/, {
                  message: 'CreatedByUserName accepts only aplhabets and numbers',
                }),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),
    carePlan: z
      .object({
        services: z.array(
          z
            .object({
              serviceCategory: z
                .enum(['ADL', 'Vital Signs', 'House Keeping'], {
                  message: 'Service category must be ADL, Vital Signs, or House Keeping',
                })
                .optional(),
              serviceName: z.string().nonempty(),
              providedOrNot: z
                .enum(['Provided', 'Not Provided'], {
                  message: 'Values must be either Provided or Not Provided',
                })
                .optional(),
              providedBy: z
                .string()
                .uuid({ message: 'ProvidedBy must be a valid UUID' })
                .optional(),
              providedAt: z.string().datetime().optional(),
              readings: z
                .array(
                  z.object({
                    time: z.string().datetime(),
                    value: z.string(),
                  })
                )
                .optional(),
            })
            .strict()
        ),
        comments: z
          .array(
            z
              .object({
                messageId: z.string().uuid({ message: 'messageId has an invalid UUID format' }),
                message: z.string().nonempty({ message: 'Message should be non empty' }),
                parentMessageId: z
                  .string()
                  .uuid({
                    message: 'parentMessageId has an invalid UUID format',
                  })
                  .nullable()
                  .optional(),
                createdAt: z.string().datetime({
                  message: 'createdAt has an invalid datetime format',
                }),
                createdByUserId: z.string().uuid({
                  message: 'createdByUserID has an invalid UUID format',
                }),
                createdByUserName: z.string().regex(/^[A-Za-z0-9\s]+$/, {
                  message: 'createdByUserName accepts only alphabets and numbers',
                }),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),

    incidentReport: z.array(IncidentReportSchema).optional(),
  })
  .strict();

export type Clinical = z.infer<typeof ClinicalSchema>;
