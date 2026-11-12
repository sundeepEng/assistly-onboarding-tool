import { z } from 'zod';

const PersonalDetails = z
  .object({
    nickName: z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: 'Nick Name accepts only alphabets and numbers',
      })
      .optional(),
    gender: z.enum(['Male', 'Female', 'Other'], {
      message: 'Gender is required',
    }),
    race: z
      .enum([
        'American Indian',
        'Asian',
        'African American',
        'Hispanic or Latino',
        'Caucasian',
        'Other',
      ])
      .optional(),
    otherRace: z
      .string()
      .regex(/^[A-Za-z\s]+$/, {
        message: 'Other Race accepts only alphabets',
      })
      .optional(),
    birthdate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Birth Date has invalid date format',
    }),
    ssn: z
      .number()
      .min(100000000, { message: 'SSN must be a 9-digit number' })
      .max(999999999, { message: 'SSN must be a 9-digit number' })
      .optional(),
    alternateMobile: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Alternate Mobile accepts only numbers' })
      .length(10, { message: 'Alternate mobile must be 10 digits' })
      .optional(),
    address: z
      .object({
        street1: z.string().nonempty({ message: 'Street is required' }).optional(),
        street2: z.string().optional(),
        city: z
          .string()
          .nonempty({ message: 'City is required' })
          .regex(/^[A-Za-z\s]+$/, { message: 'City accepts only alphabets' })
          .optional(),
        state: z
          .string()
          .nonempty({ message: 'State is required' })
          .regex(/^[A-Za-z\s]+$/, { message: 'State accepts only alphabets' })
          .optional(),
        zipCode: z
          .string()
          .regex(/^\d{5}(-\d{4})?$/, {
            message: 'Zip Code has invalid format',
          })
          .optional(),
        previousPlaceOfResidence: z.string().optional(),
      })
      .strict()
      .optional(),
    emergencyContactName: z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: 'Emergency Contact Name accepts only alphabets and numbers',
      })
      .optional(),
    emergencyContactNumber: z
      .string()
      .regex(/^[0-9]+$/, {
        message: 'Emergency Contact Number numbers are allowed',
      })
      .length(10, {
        message: 'Emergency contact number must be exactly 10 digits',
      })
      .optional(),
    occupation: z.enum(['Veteran', 'Other']).optional(),
    otherOccupation: z.string().optional(),
    comments: z.string().optional(),
  })
  .strict();

const ValuesAndBeliefs = z
  .object({
    religiousEntity: z
      .string()
      .regex(/^[A-Za-z\s]+$/, {
        message: 'Religious Entity accepts alphabets only',
      })
      .optional(),
    religiousEntityContactNumber: z
      .string()
      .regex(/^[0-9]+$/, {
        message: 'Religious Entity Contact Number accepts numbers only',
      })
      .optional(),
    personalPhilosophy: z.string().optional(),
    importantDates: z.string().optional(),
  })
  .strict();

const ActivityReferences = z
  .object({
    otherActivities: z.string().optional(),
    hobbies: z
      .object({
        sports: z.boolean({ message: 'Sports must be boolean' }).optional(),
        music: z.boolean({ message: 'Music must be boolean' }).optional(),
        entertainment: z.boolean({ message: 'Entertainment must be boolean' }).optional(),
        readingAndWriting: z.boolean({ message: 'Reading and Writing must be boolean' }).optional(),
        collecting: z.boolean({ message: 'Collecting must be boolean' }).optional(),
        cooking: z.boolean({ message: 'Cooking must be boolean' }).optional(),
        arts: z.boolean({ message: 'Arts must be boolean' }).optional(),
        games: z.boolean({ message: 'Games must be boolean' }).optional(),
        exercise: z.boolean({ message: 'Exercise must be boolean' }).optional(),
        outdoorActivities: z.boolean({ message: 'Outdoor Activities must be boolean' }).optional(),
        cars: z.boolean({ message: 'Cars must be boolean' }).optional(),
        travel: z.boolean({ message: 'Travel must be boolean' }).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const MedicalGeneral = z
  .object({
    practiceName: z.string().nonempty({ message: 'Practice Name is required' }).optional(),
    practiceNumber: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Practice Number accepts only numbers' })
      .optional(),
    pharmacyName: z.string().nonempty({ message: 'Pharmacy Name is required' }).optional(),
    pharmacyNumber: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Pharmacy Number accepts only numbers' })
      .optional(),
    foodAllergies: z.string().nonempty({ message: 'Food allergies is/are required' }).optional(),
  })
  .strict();

const MedicalMobility = z
  .object({
    twoPersonTransfer: z
      .boolean({
        message: 'Two person transfer must be boolean',
      })
      .optional(),
    mechanicalLift: z.boolean({ message: 'Mechanical Lift must be boolean' }).optional(),
    bedridden: z
      .boolean({
        message: 'Bedridden must be boolean',
      })
      .optional(),
    nonAmbulatory: z
      .boolean({
        message: 'Non-ambulatory must be boolean',
      })
      .optional(),
    comments: z.string().optional(),
  })
  .strict();

const MedicalOverAllHealth = z
  .object({
    chronicIllness: z.boolean({ message: 'Chronic Illness must be boolean' }).optional(),
    alzheimersOrDementia: z
      .boolean({
        message: "Alzheimer's/Dementia must be boolean",
      })
      .optional(),
    developmentalDisability: z
      .boolean({
        message: 'Developmental disability must be boolean',
      })
      .optional(),
    mentalIllness: z
      .boolean({
        message: 'Mental illness must be boolean',
      })
      .optional(),
    smokesOrDrinks: z
      .boolean({
        message: 'Smoking/Drinking must be boolean',
      })
      .optional(),
    ableToDrive: z
      .boolean({
        message: 'Driving ability must be boolean',
      })
      .optional(),
  })
  .strict();

const AdlServiceValue = z
  .object({
    careLevel: z
      .enum(['Independent', 'Monitor & Cue', 'Full Assistance'], {
        message: 'Level of care must be Independent, Monitor & Cue, or Full Assistance',
      })
      .optional(),
  })
  .strict();

const CareplanADL = z
  .object({
    comments: z.string().optional(),
  })
  .catchall(z.union([AdlServiceValue.strict(), z.string().optional()]))
  .optional();

const BehaviourPatterns = z
  .object({
    wanderingRisk: z.boolean({ message: 'Wandering Risk must be boolean' }).optional(),
    evacuationAssistance: z
      .boolean({ message: 'Evacuation Assistance must be boolean' })
      .optional(),
    comments: z.string().optional(),
  })
  .strict();

const PhysicalHealth = z
  .object({
    painManagementCareLevel: z
      .enum(
        ['No Pain', 'Mild Pain', 'Moderate Pain', 'Severe Pain', 'Request Pain Management Support'],
        {
          message:
            'Pain Management - Level of Care accepts only No Pain, Mild Pain, Moderate Pain, Severe Pain, or Request Pain Management Support',
        }
      )
      .optional(),

    diabetisStatus: z
      .enum(['Yes', 'No'], {
        message: 'Diabetis status selection is accepts only Yes or No',
      })
      .optional(),

    chokingRisk: z
      .enum(['Yes', 'No'], {
        message: 'Choking Risk selection is accepts only Yes or No',
      })
      .optional(),

    recurringIllnessCareLevel: z
      .enum(['None', 'Minor', 'Moderate', 'Severe, Require regular monitoring'], {
        message:
          'Recurring Illness - Level of Care accepts only None, Minor, Moderate, or Severe, Require regular monitoring',
      })
      .optional(),

    nursingProceduresCareLevel: z
      .enum(
        [
          'Not Applicable',
          'Requires daily nursing procedures',
          'Requires weekly nursing procedures',
          'Requires specialized nursing procedures',
        ],
        {
          message:
            'Nursing Procedures - Level of Care accepts only Not Applicable, Requires daily nursing procedures, Requires weekly nursing procedures, or Requires specialized nursing procedures',
        }
      )
      .optional(),

    eyeSightCareLevel: z
      .enum(
        [
          'Normal Vision',
          'Requires glasses/Corrective lenses',
          'Partially impaired vision',
          'Severe vision impairment',
          'Blind',
        ],
        {
          message:
            'Eye Sight - Level of Care accepts only Normal Vision, Requires glasses/Corrective lenses, Partially impaired vision, Severe vision impairment, or Blind',
        }
      )
      .optional(),

    hearing: z
      .enum(
        [
          'Normal hearing',
          'Requires hearing aid',
          'Partially hearing impaired',
          'Completely hearing impaired',
        ],
        {
          message:
            'Hearing - Level of Care accepts only Normal hearing, Requires hearing aid, Partially hearing impaired, or Completely hearing impaired',
        }
      )
      .optional(),
  })
  .strict();

export const BiographySchema = z
  .object({
    personalDetails: PersonalDetails.optional(),
    valuesAndBeliefs: ValuesAndBeliefs.optional(),
    activityReferences: ActivityReferences.optional(),
  })
  .strict();

const MedicalSchema = z
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
  .strict();

const HousekeepingServiceLevel = z.enum([
  'Not Required',
  'Staff Assisted',
  'Scheduled - Weekly',
  'Scheduled - Daily',
  'On Request',
]);

const Housekeeping = z
  .object({
    dailyCleanSweep: HousekeepingServiceLevel.optional(),
    weeklyDeepClean: HousekeepingServiceLevel.optional(),
    laundry: HousekeepingServiceLevel.optional(),
  })
  .catchall(HousekeepingServiceLevel);

const CarePlanSchema = z
  .object({
    adl: CareplanADL.optional(),
    behaviourPatterns: BehaviourPatterns.optional(),
    physicalHealth: PhysicalHealth.optional(),
    vitalSigns: VitalSigns.optional(),
    housekeeping: Housekeeping.optional(),
  })
  .strict();

export const Documents = z.array(
  z
    .object({
      documentId: z.string().uuid({ message: 'DocumentID has an invalid UUID format' }),
      documentCategory: z
        .enum(['onboarding', 'certificate', 'other'], {
          message: 'Document category accepts only onboarding, certificate or other',
        })
        .default('onboarding'),
      documentType: z.enum(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp'], {
        message: 'DocumentType accepts only .pdf, .doc, .docx, .png, .jpg, .jpeg or .webp',
      }),
      documentName: z.string(),
      documentUrl: z.string(),
      signedDocumentUrl: z
        .array(
          z.object({
            url: z.string(),
            createdAt: z.string().datetime({ message: 'CreatedAt has invalid datetime format' }),
          })
        )
        .optional(),
      documentValues: z.record(z.string(), z.any()).optional(),
      version: z.number().optional(),
      documentStatus: z
        .enum(['pending', 'completed', 'declined'], {
          message: 'Document status accepts only pending, completed or declined',
        })
        .optional(),
      documentExpiryDate: z.string().date().optional(),
      documentTemplateId: z.number().nullable().optional(),
      moduleId: z.string().uuid({ message: 'ModuleID must be a valid UUID' }).optional(),
      isRequiredDocument: z
        .boolean({ message: 'isRequiredDocument must be boolean' })
        .default(false),
      createdByUserId: z.string().uuid({ message: 'CreatedByUserID has an invalid UUID format' }),
      createdAt: z.string().datetime({ message: 'CreatedAt has invalid datetime format' }),
    })
    .strict()
);

const Actions = z.object({
  comments: z.array(
    z
      .object({
        messageId: z.string().uuid({ message: 'messageId has an invalid UUID format' }),
        message: z.string().nonempty({ message: 'Message should be non empty' }),
        parentMessageId: z
          .string()
          .uuid({ message: 'parentMessageId has an invalid UUID format' })
          .nullable()
          .optional(),
        createdAt: z.string().datetime({
          message: 'createdAt has an invalid datetime format',
        }),
        createdByUserId: z.string().uuid({
          message: 'CreatedByUserID has an invalid UUID format',
        }),
        createdByUserName: z.string().regex(/^[A-Za-z0-9\s]+$/, {
          message: 'CreatedByUserName accepts only alphabets and numbers',
        }),
      })
      .strict()
  ),
});

export const CustomerSchema = z
  .object({
    biography: BiographySchema.optional(),
    medical: MedicalSchema.optional(),
    carePlan: CarePlanSchema.optional(),
    documents: Documents.optional(),
    actions: Actions.optional(),
  })
  .strict();

export const chatBotSchema = z.record(
  z.object({
    chatHistory: z
      .array(
        z
          .object({
            messageId: z.string({ message: 'messageId has an invalid UUID format' }).uuid(),
            message: z.string({ message: 'Message must be a string' }),
            documentUrl: z.string({ message: 'documentUrl must be a string' }).optional(),
            createdBy: z.enum(['User', 'Bot']),
            createdAt: z
              .string()
              .datetime({ message: 'createdAt has an invalid datetime format' })
              .default(() => new Date().toISOString()),
          })
          .strict()
          .optional()
      )
      .optional(),
    chatSummary: z.string({ message: 'chatSummary must be a string' }).optional(),
  })
);
