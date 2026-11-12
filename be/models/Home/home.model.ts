import { z } from 'zod';

const IncomeBudgetSchema = z.object({
  careFee: z.number().optional(),
  monthlyFee: z.number().optional(),
  entertainment: z.number().optional(),
  transport: z.number().optional(),
  medical: z.number().optional(),
  misc: z.number().optional(),
});

const ExpenseBudgetSchema = z.object({
  groceries: z.number().optional(),
  utilities: z.number().optional(),
  entertainment: z.number().optional(),
  transport: z.number().optional(),
  medical: z.number().optional(),
  payroll: z.number().optional(),
  misc: z.number().optional(),
});

const ExpenseThresholdItemSchema = z
  .object({
    thresholdName: z.string().nonempty({ message: 'ThresholdName is required' }),
    fixedAmount: z
      .number({ message: 'FixedAmount must be a number' })
      .min(0, { message: 'FixedAmount must be 0 or greater' }),
    isEnabled: z.boolean().default(true),
    createdAt: z.string().datetime({ message: 'CreatedAt must be a valid datetime' }).optional(),
    modifiedAt: z.string().datetime({ message: 'ModifiedAt must be a valid datetime' }).optional(),
  })
  .strict();

const ExpenseThresholdMonthSchema = z
  .object({
    groceries: ExpenseThresholdItemSchema.optional(),
    utilities: ExpenseThresholdItemSchema.optional(),
    entertainment: ExpenseThresholdItemSchema.optional(),
    transport: ExpenseThresholdItemSchema.optional(),
    medical: ExpenseThresholdItemSchema.optional(),
    misc: ExpenseThresholdItemSchema.optional(),
  })
  .strict();

const BudgetMonthSchema = z.object({
  income: IncomeBudgetSchema.optional(),
  expense: ExpenseBudgetSchema.optional(),
});

export const CampaignSchema = z
  .object({
    campaignId: z.string().uuid({ message: 'CampaignId must be a valid UUID' }),
    campaignChannel: z.enum(['EMAIL', 'SMS'], {
      message: 'CampaignChannel accepts only Email or SMS',
    }),
    campaignType: z.enum(['SENIOR', 'REFERRAL'], {
      message: 'CampaignType accepts only Senior or Referral',
    }),
    campaignUsers: z.array(
      z
        .object({
          userId: z.string().uuid({ message: 'UserId must be a valid UUID' }),
          userName: z.string({ message: 'UserName is required' }),
          userEmail: z
            .string()
            .email({ message: 'UserEmail must be a valid email' })
            .toLowerCase()
            .optional(),
          userMobile: z
            .string()
            .regex(/^[0-9]+$/, { message: 'Mobile accepts numbers only' })
            .length(10, {
              message: 'Mobile must be exactly 10 digits',
            })
            .optional(),
        })
        .strict()
    ),
    campaignMetadata: z
      .object({
        subject: z.string(),
        body: z.string(),
        goal: z.string().optional(),
      })
      .strict(),
    campaignScheduleDate: z
      .string()
      .datetime({
        message: 'ScheduleDate must be a valid datetime',
      })
      .optional(),
    campaignStatus: z
      .enum(['SCHEDULED', 'FAILED', 'DELIVERED'], {
        message: 'Status accepts only Scheduled, Failed, or Delivered',
      })
      .optional(),
    campaignCreatedByUserId: z.string().uuid({ message: 'CreatedByUserId must be a valid UUID' }),
    campaignSenderEmail: z.string().email({ message: 'SenderEmail must be a valid email' }),
    createdAt: z.string().datetime({ message: 'CreatedAt must be a valid datetime' }),
  })
  .strict();

export const HomeSchema = z
  .object({
    homeId: z.string().uuid({ message: 'HomeId must be a valid UUID' }).optional(),
    homeName: z.string().nonempty({ message: 'HomeName is required' }),
    homeType: z
      .enum([
        'Personal Care Home',
        'In Home Care',
        'Assisted Living',
        'Memory Care',
        'Adult Day Center',
      ])
      .optional(),
    homeCapacity: z
      .number({ message: 'HomeCapacity must be a number' })
      .positive({ message: 'HomeCapacity must be a positive number' })
      .optional(),
    isSalesRequired: z
      .boolean({ message: 'isSalesRequired must be boolean' })
      .optional()
      .default(false),
    homeAddress: z
      .object({
        street: z.string().nonempty({ message: 'Street is required' }).optional(),
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
      })
      .strict()
      .optional(),
    latitude: z.number({ message: 'Latitude must be a number' }).optional(),
    longitude: z.number({ message: 'Longitude must be a number' }).optional(),
    authorizedModules: z
      .array(z.enum(['CRM', 'CLINICAL', 'STAFF MANAGEMENT', 'COMPLIANCE']).default('CRM'))
      .optional(),
    complianceTraining: z
      .array(
        z
          .object({
            moduleId: z.string().uuid({ message: 'ModuleId has an invalid UUID format' }),
            moduleName: z.string(),
            moduleDescription: z.string().optional(),
            certificateDurationDays: z
              .number()
              .int({ message: 'certificateDurationDays must be an integer' })
              .optional(),
            documents: z.array(
              z
                .object({
                  documentId: z.string().uuid({ message: 'DocumentID has an invalid UUID format' }),
                  documentType: z.enum(['.mp4', '.ppt', '.pptx'], {
                    message: 'DocumentType accepts only .mp4, .ppt, .pptx',
                  }),
                  documentName: z.string(),
                  documentUrl: z.string(),
                  documentCreatedAt: z.string().datetime({
                    message: 'CreatedAt has invalid datetime format',
                  }),
                  documentCreatedByUserId: z
                    .string()
                    .uuid({
                      message: 'CreatedByUserID has an invalid UUID format',
                    })
                    .optional(),
                })
                .strict()
            ),
            createdByUserId: z
              .string()
              .uuid({ message: 'CreatedByUserID has an invalid UUID format' })
              .optional(),
            createdAt: z.string().datetime({ message: 'CreatedAt has invalid datetime format' }),
            modifiedAt: z.string().datetime({ message: 'ModifiedAt has invalid datetime format' }),
          })
          .strict()
      )
      .optional(),
    documents: z
      .array(
        z
          .object({
            documentId: z.string().uuid({ message: 'DocumentID has an invalid UUID format' }),
            documentCategory: z
              .enum(['onboarding', 'certificate', 'other'], {
                message: 'Document category accepts only onboarding, certificate or other',
              })
              .default('onboarding'),
            documentType: z.enum(['.pdf', '.doc', '.docx', '.png', '.jpg', '.webp'], {
              message: 'DocumentType accepts only .pdf, .doc, .docx, .png, .jpg, or .webp',
            }),
            documentName: z.string(),
            documentUrl: z.string(),
            documentTemplateId: z.number().nullable().optional(),
            signedDocumentUrl: z
              .array(
                z.object({
                  url: z.string(),
                  createdAt: z
                    .string()
                    .datetime({ message: 'CreatedAt has invalid datetime format' }),
                })
              )
              .optional(),
            version: z.number().optional(),
            documentStatus: z
              .enum(['pending', 'completed', 'declined'], {
                message: 'DocumentStatus accepts only pending, completed or declined',
              })
              .optional(),
            documentExpiryDate: z.string().date().optional(),
            isRequiredDocument: z
              .boolean({ message: 'isRequiredDocument must be boolean' })
              .default(false),
            createdByUserId: z
              .string()
              .uuid({ message: 'CreatedByUserID has an invalid UUID format' }),
            createdAt: z.string().datetime({ message: 'CreatedAt has invalid datetime format' }),
          })
          .strict()
      )
      .optional(),
    campaigns: z.array(CampaignSchema).optional(),
    budget: z
      .record(
        z.string().regex(/^\d{4}$/, 'Year must be a 4 digit string'),
        z
          .object({
            jan: BudgetMonthSchema.optional(),
            feb: BudgetMonthSchema.optional(),
            mar: BudgetMonthSchema.optional(),
            apr: BudgetMonthSchema.optional(),
            may: BudgetMonthSchema.optional(),
            jun: BudgetMonthSchema.optional(),
            jul: BudgetMonthSchema.optional(),
            aug: BudgetMonthSchema.optional(),
            sep: BudgetMonthSchema.optional(),
            oct: BudgetMonthSchema.optional(),
            nov: BudgetMonthSchema.optional(),
            dec: BudgetMonthSchema.optional(),
          })
          .strict()
      )
      .optional(),
    thresholds: z
      .record(
        z.string().regex(/^\d{4}$/, 'Year must be a 4 digit string'),
        z
          .object({
            jan: ExpenseThresholdMonthSchema.optional(),
            feb: ExpenseThresholdMonthSchema.optional(),
            mar: ExpenseThresholdMonthSchema.optional(),
            apr: ExpenseThresholdMonthSchema.optional(),
            may: ExpenseThresholdMonthSchema.optional(),
            jun: ExpenseThresholdMonthSchema.optional(),
            jul: ExpenseThresholdMonthSchema.optional(),
            aug: ExpenseThresholdMonthSchema.optional(),
            sep: ExpenseThresholdMonthSchema.optional(),
            oct: ExpenseThresholdMonthSchema.optional(),
            nov: ExpenseThresholdMonthSchema.optional(),
            dec: ExpenseThresholdMonthSchema.optional(),
          })
          .strict()
      )
      .optional(),
    createdAt: z
      .string()
      .datetime({ message: 'CreatedAt must be a valid date-time string' })
      .optional(),
    modifiedAt: z
      .string()
      .datetime({ message: 'modifiedAt must be a valid date-time string' })
      .optional(),
  })
  .strict();

export const HomeTourSchema = z
  .object({
    tourDateTime: z.string().datetime({ message: 'tourDateTime has an invalid datetime format' }),
    pchoUserId: z.string().uuid({ message: 'pchoUserId has an invalid UUID format' }),
    leadUserId: z.string().uuid({ message: 'leadUserId has an invalid UUID format' }),
  })
  .strict();
