import { z } from "zod";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";

export const nameRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]+$/;
export const PersonalDetails = (isInHomeCare: boolean) =>
  z
    .object({
      nickName: makeOptionalOnEmpty(
        z
          .string()
          .regex(nameRegex, {
            message: "Nick Name accepts only alphabets and numbers",
          })
          .optional(),
      ),
      gender: z.enum(["Male", "Female", "Other"], {
        required_error: "Gender is required",
      }),
      race: makeOptionalOnEmpty(
        z
          .enum([
            "American Indian",
            "Asian",
            "African American",
            "Hispanic or Latino",
            "Caucasian",
            "Other",
          ])
          .optional(),
      ),
      otherRace: makeOptionalOnEmpty(
        z
          .string()
          .regex(/^[A-Za-z\s]+$/, {
            message: "Other Race accepts only alphabets",
          })
          .optional(),
      ),
      birthdate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      ssn: z.preprocess(
        (value) => {
          if (value === "" || value === null || value === undefined) {
            return undefined;
          }

          if (typeof value === "string") {
            return Number(value);
          }

          return value;
        },
        z
          .number({
            invalid_type_error: "SSN must be a 9-digit number",
          })
          .int("SSN must be a 9-digit number")
          .min(100000000, { message: "SSN must be a 9-digit number" })
          .max(999999999, { message: "SSN must be a 9-digit number" })
          .optional(),
      ),
      alternateMobile: makeOptionalOnEmpty(
        z
          .string()
          .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
          .refine((val) => val.length === 10, {
            message: "Mobile number must be exactly 10 digits",
          })
          .optional(),
      ),
      address: z
        .object({
          street1: isInHomeCare
            ? z.string().nonempty("Street is required")
            : makeOptionalOnEmpty(z.string().optional()),
          street2: makeOptionalOnEmpty(z.string().optional()),
          city: isInHomeCare
            ? z.string().nonempty("City is required")
            : makeOptionalOnEmpty(z.string().optional()),
          state: isInHomeCare
            ? z.string().nonempty("State is required")
            : makeOptionalOnEmpty(z.string().optional()),
          zipCode: isInHomeCare
            ? z.string().regex(/^\d{5}(-\d{4})?$/, {
                message: "Invalid ZIP code format",
              })
            : makeOptionalOnEmpty(z.string().optional()),

          previousPlaceOfResidence: makeOptionalOnEmpty(z.string().optional()),
        })
        .strict(),

      emergencyContactName: makeOptionalOnEmpty(
        z
          .string()
          .regex(nameRegex, {
            message: "Accepts only alphabets and numbers",
          })
          .optional(),
      ),
      emergencyContactNumber: makeOptionalOnEmpty(
        z
          .string()
          .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
          .refine((val) => val.length === 10, {
            message: "Mobile number must be exactly 10 digits",
          })
          .optional(),
      ),
      occupation: makeOptionalOnEmpty(z.enum(["Veteran", "Other"]).optional()),
      otherOccupation: z.string().optional(),
      comments: makeOptionalOnEmpty(z.string().optional()),
    })
    .strict();

const ValuesAndBeliefs = z
  .object({
    religion: makeOptionalOnEmpty(z.string().optional()),
    religiousEntity: makeOptionalOnEmpty(
      z
        .string()
        .regex(/^[A-Za-z\s]+$/, {
          message: "Entity Name must contain only alphabets",
        })
        .optional(),
    ),
    religiousEntityContactNumber: makeOptionalOnEmpty(
      z
        .string()
        .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
        .refine((val) => val.length === 10, {
          message: "Mobile number must be exactly 10 digits",
        })
        .optional(),
    ),
    personalPhilosophy: makeOptionalOnEmpty(z.string().optional()),
    importantDates: makeOptionalOnEmpty(z.string().optional()),
  })
  .strict();

const ActivityReferences = z
  .object({
    hobbies: z
      .object({
        sports: z.boolean().optional(),
        music: z.boolean().optional(),
        entertainment: z.boolean().optional(),
        readingAndWriting: z.boolean().optional(),
        collecting: z.boolean().optional(),
        cooking: z.boolean().optional(),
        arts: z.boolean().optional(),
        games: z.boolean().optional(),
        exercise: z.boolean().optional(),
        outdoorActivities: z.boolean().optional(),
        cars: z.boolean().optional(),
        travel: z.boolean().optional(),
      })
      .strict()
      .optional(),
    otherActivities: z.string().optional(),
  })
  .strict();

const MedicalGeneral = makeOptionalOnEmpty(
  z
    .object({
      practiceName: makeOptionalOnEmpty(
        z
          .string()
          .nonempty({ message: "Practice details are required" })
          .optional(),
      ),
      practiceNumber: makeOptionalOnEmpty(
        z
          .string()
          .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
          .refine((val) => val.length === 10, {
            message: "Mobile number must be exactly 10 digits",
          })
          .optional(),
      ),
      pharmacyName: makeOptionalOnEmpty(
        z
          .string()
          .nonempty({ message: "Pharmacy details are required" })
          .optional(),
      ),
      pharmacyNumber: makeOptionalOnEmpty(
        z
          .string()
          .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
          .refine((val) => val.length === 10, {
            message: "Mobile number must be exactly 10 digits",
          })
          .optional(),
      ),
      foodAllergies: makeOptionalOnEmpty(
        z
          .string()
          .nonempty({ message: "Food allergies are required" })
          .optional(),
      ),
    })
    .strict(),
);

const MedicalMobility = z
  .object({
    twoPersonTransfer: z.boolean().optional(),
    mechanicalLift: z.boolean().optional(),
    bedridden: z.boolean().optional(),
    nonAmbulatory: z.boolean().optional(),
    comments: z.string().optional(),
  })
  .strict();

const MedicalOverAllHealth = z
  .object({
    chronicIllness: z.boolean().optional(),
    alzheimersOrDementia: z.boolean().optional(),
    developmentalDisability: z.boolean().optional(),
    mentalIllness: z.boolean().optional(),
    smokesOrDrinks: z.boolean().optional(),
    ableToDrive: z.boolean().optional(),
  })
  .strict();

const AdlServiceValue = z
  .object({
    careLevel: z
      .enum(["Independent", "Monitor & Cue", "Full Assistance"], {
        message:
          "Level of care must be Independent, Monitor & Cue, or Full Assistance",
      })
      .optional(),
  })
  .optional();

const CareplanADL = z
  .object({
    comments: z.string().optional(),
  })
  .catchall(z.union([AdlServiceValue, z.string().optional()]))
  .optional();

const BehaviourPatterns = z
  .object({
    wanderingRisk: z.boolean().optional(),
    evacuationAssistance: z.boolean().optional(),
    comments: z.string().optional(),
  })
  .strict();

const PhysicalHealth = z
  .object({
    painManagementCareLevel: z
      .enum(
        [
          "No Pain",
          "Mild Pain",
          "Moderate Pain",
          "Severe Pain",
          "Request Pain Management Support",
        ],
        {
          message:
            "Pain Management - Level of Care must be No Pain, Mild Pain, Moderate Pain, Severe Pain, or Request Pain Management Support",
        },
      )
      .optional(),

    diabetisStatus: z
      .enum(["Yes", "No"], {
        message: "Diabetis Status selection is must be Yes or No",
      })
      .optional(),

    chokingRisk: z
      .enum(["Yes", "No"], {
        message: "Choking selection is must be Yes or No",
      })
      .optional(),

    recurringIllnessCareLevel: z
      .enum(
        ["None", "Minor", "Moderate", "Severe, Require regular monitoring"],
        {
          message:
            "Recurring Illness - Level of Care must be None, Minor, Moderate, or Severe, Require regular monitoring",
        },
      )
      .optional(),

    nursingProceduresCareLevel: z
      .enum(
        [
          "Not Applicable",
          "Requires daily nursing procedures",
          "Requires weekly nursing procedures",
          "Requires specialized nursing procedures",
        ],
        {
          message:
            "Nursing Procedures - Level of Care must be Not Applicable, Requires daily nursing procedures, Requires weekly nursing procedures, or Requires specialized nursing procedures",
        },
      )
      .optional(),

    eyeSightCareLevel: z
      .enum(
        [
          "Normal Vision",
          "Requires glasses/Corrective lenses",
          "Partially impaired vision",
          "Severe vision impairment",
          "Blind",
        ],
        {
          message:
            "Eye Sight - Level of Care must be Normal Vision, Requires glasses/Corrective lenses, Partially impaired vision, Severe vision impairment, or Blind",
        },
      )
      .optional(),

    hearing: z
      .enum(
        [
          "Normal hearing",
          "Requires hearing aid",
          "Partially hearing impaired",
          "Completely hearing impaired",
        ],
        {
          message:
            "Hearing - Level of Care must be Normal hearing, Requires hearing aid, Partially hearing impaired, or Completely hearing impaired",
        },
      )
      .optional(),
  })
  .strict();

export const BiographySchema = (isInHomeCare: boolean) =>
  z
    .object({
      personalDetails: PersonalDetails(isInHomeCare).optional(),
      valuesAndBeliefs: ValuesAndBeliefs.optional(),
      activityReferences: ActivityReferences.optional(),
    })
    .strict();

export const MedicalSchema = z
  .object({
    general: MedicalGeneral.optional(),
    mobility: MedicalMobility.optional(),
    overAllHealth: MedicalOverAllHealth.optional(),
  })
  .strict();

const VitalSigns = z
  .object({
    bloodPressure: z.boolean().optional(),
    bloodOxygen: z.boolean().optional(),
    pulse: z.boolean().optional(),
    bloodSugar: z.boolean().optional(),
    pacemaker: z.boolean().optional(),
  })
  .catchall(z.boolean().optional())
  .optional();

const HousekeepingServiceLevel = z
  .enum([
    "Not Required",
    "Staff Assisted",
    "Scheduled - Weekly",
    "Scheduled - Daily",
    "On Request",
  ])
  .optional();

const Housekeeping = z
  .object({
    dailyCleanSweep: HousekeepingServiceLevel,
    weeklyDeepClean: HousekeepingServiceLevel,
    laundry: HousekeepingServiceLevel,
  })
  .catchall(HousekeepingServiceLevel);

export const CarePlanSchema = z
  .object({
    adl: CareplanADL,
    behaviourPatterns: BehaviourPatterns.optional(),
    physicalHealth: PhysicalHealth.optional(),
    vitalSigns: VitalSigns.optional(),
    housekeeping: Housekeeping.optional(),
  })
  .strict();

export const Documents = z.array(
  z
    .object({
      documentId: z
        .string()
        .uuid({ message: "DocumentID must be a valid UUID" }),
      documentCategory: z
        .enum(["onboarding", "certificate", "other"], {
          message:
            "Document category accepts only onboarding, certificate or other",
        })
        .default("onboarding"),
      documentType: z.enum(
        [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"],
        {
          message: "DocumentType must be .pdf, .doc, .docx",
        },
      ), // For now only allow documents of the type word and pdf only
      documentName: z.string(),
      documentUrl: z.string(),
      isRequiredDocument: z
        .boolean({ message: "isRequiredDocument must be boolean" })
        .default(false),
      createdByUserId: z
        .string()
        .uuid({ message: "CreatedByUserID must be a valid UUID" }),
      createdAt: z
        .string()
        .datetime({ message: "CreatedAt must be a valid datetime" }),
      documentValues: z.record(z.string(), z.any()).optional(),
      version: z.number().optional(),
      documentExpiryDate: z.string().date().optional(),
      documentTemplateId: z.number().nullable().optional(),
      moduleId: z
        .string()
        .uuid({ message: "ModuleID must be a valid UUID" })
        .optional(),
      signedDocumentUrl: z
        .array(
          z.object({
            url: z.string(),
            createdAt: z
              .string()
              .datetime({ message: "CreatedAt has invalid datetime format" }),
          }),
        )
        .optional(),
      documentStatus: z
        .enum(["pending", "declined", "completed"], {
          message:
            "Document status accepts only pending, declined or completed",
        })
        .optional(),
    })
    .strip(),
);

const Actions = z.object({
  comments: z
    .array(
      z
        .object({
          messageId: z.string().uuid({ message: "UUID must be a valid UUID" }),
          message: z
            .string()
            .nonempty({ message: "Message should be non empty" }),
          parentMessageId: z
            .string()
            .uuid({ message: "ParentId must be a valid UUID" })
            .nullable()
            .optional(),
          createdAt: z.string().datetime({
            message: "CreatedAt must be a valid datetime string",
          }),
          createdByUserId: z.string().uuid({
            message: "CreatedByUserID must be a valid UUID",
          }),
          createdByUserName: z.string().regex(/^[A-Za-z\s]+$/, {
            message: "Only alphabets are allowed",
          }),
        })
        .strict(),
    )
    .optional(),
});

export const CustomerSchema = (isInHomeCare: boolean) =>
  z
    .object({
      biography: BiographySchema(isInHomeCare).optional(),
      medical: MedicalSchema.optional(),
      carePlan: CarePlanSchema.optional(),
      documents: Documents.optional(),
      actions: Actions.optional(),
    })
    .strip();
