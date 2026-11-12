import { z } from 'zod';
import { chatBotSchema, CustomerSchema, Documents } from './customer.model';

const baseUsersSchema = z
  .object({
    home: z.string({ message: 'home must be a string' }),
    homeId: z.string().uuid({
      message: 'homeId must has an invalid UUID format',
    }),
    userId: z
      .string({ message: 'userId should be a string' })
      .uuid({ message: 'userId has an invalid UUID format' })
      .optional(),
    firstName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: 'First Name accepts only alphabets and numbers',
      }),
    middleName: z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: 'Middle Name accepts only alphabets and numbers',
      })
      .optional(),
    lastName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: 'Last Name accepts only alphabets and numbers',
      }),
    name: z.string().regex(/^[A-Za-z0-9\s]+$/, {
      message: 'Name accepts only alphabets and numbers',
    }),
    email: z.string().email({ message: 'Email has an invalid email format' }).toLowerCase(),
    mobile: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Mobile accepts numbers only' })
      .length(10, {
        message: 'Mobile must be exactly 10 digits',
      }),
    createdAt: z
      .string()
      .datetime({ message: 'createdAt has an invalid datetime format' })
      .optional(),
    isDeleted: z.boolean().default(false).optional(),
    deletedOn: z.string().datetime().optional(),
  })
  .strict();

export const CreatePCHOOrPCGLeadSchema = baseUsersSchema
  .extend({
    role: z.enum(['PCHO', 'PCGLead'], {
      message: 'Role accepts only PCHO or PCGLead',
    }),
    isCompliancePartner: z.boolean().optional().default(false),
    documents: Documents.optional(),
    associatedHomeIds: z
      .array(z.string().uuid({ message: 'associatedHomeIds has invalid UUID format' }), {
        message: 'associatedHomeIds must be an array of UUIDs',
      })
      .optional(),
  })
  .strict();

export const CreateHomeAdminSchema = baseUsersSchema
  .extend({
    role: z.literal('HomeAdmin', {
      message: 'Role accepts only HomeAdmin',
    }),
    isCompliancePartner: z.boolean().optional().default(false),
    documents: Documents.optional(),
    associatedHomeIds: z
      .array(z.string().uuid({ message: 'associatedHomeIds has invalid UUID format' }), {
        message: 'associatedHomeIds must be an array of UUIDs',
      })
      .optional(),
  })
  .strict();

export const CreateLeadSchema = baseUsersSchema
  .extend({
    role: z.literal('Lead', {
      message: 'Role accepts only Lead',
    }),
    email: z
      .string()
      .email({ message: 'Email has an invalid email format' })
      .toLowerCase()
      .optional(),
    mobile: z
      .string()
      .regex(/^[0-9]+$/, { message: 'Mobile accepts only numbers' })
      .length(10, {
        message: 'Mobile must be exactly 10 digits',
      })
      .optional(),
    milestone: z.array(
      z.enum(['initial contact', 'tour', 'onboarding', 'contract'], {
        message: 'Milestone accepts only initial contact, tour, onboarding, contract',
      })
    ),
    isReferredByUserId: z
      .string({ message: 'isReferredByUserId must be a string' })
      .uuid({ message: 'isReferredByUserId has an invalid UUID format' })
      .optional(),
    documents: Documents.optional(),
  })
  .strict();

export const CreateReferralSchema = baseUsersSchema
  .extend({
    role: z.literal('Referral', {
      message: 'Role accepts only Referral',
    }),
    referralOrgName: z
      .string()
      .regex(/^[A-Za-z\s]+$/, {
        message: 'Referral Org Name accepts only alphabets',
      })
      .optional(),
    referralFollowupStatus: z
      .enum(['Not Contacted', 'Contacted', 'Followup Required', 'Not Interested'], {
        message:
          'Referral Followup Status accepts only Not Contacted, Contacted, Followup Required or Not Interested',
      })
      .default('Not Contacted')
      .optional(),
  })
  .strict();

export const CreateComplianceGuestSchema = baseUsersSchema.extend({
  role: z.literal('ComplianceGuest', {
    message: 'Role accepts only ComplianceGuest',
  }),
});

export const UpdateComplianceGuestSchema = CreateComplianceGuestSchema.extend({
  completedComplianceDocumentIds: z
    .array(
      z.string().uuid({
        message: 'completedComplianceDocumentIds has an invalid UUID format',
      }),
      { message: 'completedComplianceDocumentIds must be an array of UUIDs' }
    )
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
  documents: Documents.optional(),
  complianceCertificates: z.record(z.string()).optional(),
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
});

export const UpdatePCHOOrPCGLeadOrPCGSchema = CreatePCHOOrPCGLeadSchema.extend({
  role: z.enum(['PCHO', 'PCGLead', 'PCG'], {
    message: 'Role accepts only PCHO, PCGLead or PCG',
  }),
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  facesheet: z.record(z.string(), z.any()).optional(),
  biography: z
    .object({
      personalDetails: z.object({
        emergencyContactName: z
          .string()
          .regex(/^[A-Za-z0-9\s]+$/, {
            message: 'Emergency Contact Name accepts only alphabets',
          })
          .optional(),
        emergencyContactNumber: z
          .string()
          .regex(/^[0-9]+$/, {
            message: 'Emergency Contact Number accepts only numbers',
          })
          .length(10, {
            message: 'Emergency Contact Number must be exactly 10 digits',
          })
          .optional(),
      }),
    })
    .strict()
    .optional(),
  completedComplianceDocumentIds: z
    .array(
      z.string().uuid({
        message: 'completedComplianceDocumentIds has an invalid UUID format',
      }),
      { message: 'completedComplianceDocumentIds must be an array of UUIDs' }
    )
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
  complianceCertificates: z.record(z.string()).optional(),
  chatbot: chatBotSchema.optional(),
  docusignEnvelopeId: z.string().optional(),
  docusignEnvelopeStatus: z.string().optional(),
  onboardingESignEnvelopeId: z
    .string({ message: 'onboardingESignEnvelopeId must be a string' })
    .optional(),
  onboardingESignEnvelopeStatus: z.enum(['completed', 'declined', 'expired', 'pending']).optional(),
  onboardingESignEnvelopeCreatedAt: z
    .string({
      message: 'onboardingESignEnvelopeCreatedAt must be a date time string',
    })
    .datetime()
    .optional(),
  contractCompletedOn: z.string().date().optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  stripeAccountId: z.string().nullable().default(null).optional(),
  stripeOnboardingStatus: z
    .enum(['NOT_STARTED', 'RESTRICTED', 'ACTIVE', 'UNDER_REVIEW', 'IN_PROGRESS'])
    .default('NOT_STARTED')
    .optional(),
  stripeChargesEnabled: z.boolean().default(false).optional(),
  stripePayoutsEnabled: z.boolean().default(false).optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const UpdateHomeAdminSchema = CreateHomeAdminSchema.extend({
  role: z.literal('HomeAdmin', {
    message: 'Role accepts only HomeAdmin',
  }),
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  facesheet: z.record(z.string(), z.any()).optional(),
  contractCompletedOn: z.string().date().optional(),
  biography: z
    .object({
      personalDetails: z.object({
        emergencyContactName: z
          .string()
          .regex(/^[A-Za-z0-9\s]+$/, {
            message: 'Emergency Contact Name accepts only alphabets',
          })
          .optional(),
        emergencyContactNumber: z
          .string()
          .regex(/^[0-9]+$/, {
            message: 'Emergency Contact Number accepts only numbers',
          })
          .length(10, {
            message: 'Emergency Contact Number must be exactly 10 digits',
          })
          .optional(),
      }),
    })
    .strict()
    .optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const CreateNurseOrNurseLeadSchema = baseUsersSchema
  .extend({
    role: z.enum(['Nurse', 'NurseLead'], {
      message: 'Role accepts only Nurse or NurseLead',
    }),
    documents: Documents.optional(),
    associatedHomeIds: z
      .array(z.string().uuid({ message: 'associatedHomeIds has invalid UUID format' }), {
        message: 'associatedHomeIds must be an array of UUIDs',
      })
      .optional(),
  })
  .strict();

export const UpdateNurseOrNurseLeadSchema = CreateNurseOrNurseLeadSchema.extend({
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  biography: z
    .object({
      personalDetails: z.object({
        emergencyContactName: z
          .string()
          .regex(/^[A-Za-z0-9\s]+$/, {
            message: 'Emergency Contact Name accepts only alphabets',
          })
          .optional(),
        emergencyContactNumber: z
          .string()
          .regex(/^[0-9]+$/, {
            message: 'Emergency Contact Number accepts only numbers',
          })
          .length(10, {
            message: 'Emergency Contact Number must be exactly 10 digits',
          })
          .optional(),
      }),
    })
    .strict()
    .optional(),
  onboardingESignEnvelopeId: z
    .string({ message: 'onboardingESignEnvelopeId must be a string' })
    .optional(),
  onboardingESignEnvelopeStatus: z.enum(['completed', 'declined', 'expired', 'pending']).optional(),
  onboardingESignEnvelopeCreatedAt: z
    .string({
      message: 'onboardingESignEnvelopeCreatedAt must be a date time string',
    })
    .datetime()
    .optional(),
  contractCompletedOn: z.string().date().optional(),
  associatedUserIds: z
    .array(z.string().uuid({ message: 'associatedUserIds must be valid uuids' }))
    .transform((arr) => Array.from(new Set(arr))) // Ensure uniqueness
    .optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const CreateSalesRepresentativeSchema = baseUsersSchema
  .extend({
    role: z.literal('SalesRepresentative', {
      message: 'Role accepts only SalesRepresentative',
    }),
    documents: Documents.optional(),
  })
  .strict();

export const CreateSalesDirectorSchema = baseUsersSchema
  .extend({
    role: z.literal('SalesDirector', {
      message: 'Role accepts only SalesDirector',
    }),
    documents: Documents.optional(),
  })
  .strict();

export const UpdateSalesRepresentativeSchema = CreateSalesRepresentativeSchema.extend({
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const UpdateSalesDirectorSchema = CreateSalesDirectorSchema.extend({
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  associatedUserIds: z
    .array(z.string().uuid({ message: 'associatedUserIds must be valid uuids' }))
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
  lastLoginTimestamp: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
    )
    .optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const UpdateLeadOrSeniorSchema = CreateLeadSchema.extend({
  role: z.enum(['Lead', 'Senior'], {
    message: 'Role accepts only Lead or Senior',
  }),
  milestone: z.array(
    z.enum(['initial contact', 'tour', 'onboarding', 'contract', 'lost'], {
      message: 'Milestone accepts only initial contact, tour, onboarding, contract or lost',
    })
  ),
  lostCategory: z
    .enum(['Family Chose Another', 'Pricing', 'Location', 'Timing', 'Clinical Fit', 'Other'], {
      message:
        'lostCategory accepts only Family Chose Another, Pricing, Location, Timing, Clinical Fit or Other',
    })
    .optional(),
  profileImageUrl: z.string({ message: 'profileImageUrl must be a string' }).optional(),
  tourDateTime: z.string().datetime().nullable().optional(),
  isTourCompleted: z.boolean().default(false).optional(),
  tourNotes: z.string({ message: 'Tour Notes must be a string' }).optional(),
  contractCompletedOn: z.string().date().optional(),
  monthlyRent: z.number({ message: 'Monthly Rent must be a number' }).optional(),
  clientRate: z
    .number({ message: 'Client rate must be a number' })
    .min(0, { message: 'Client rate must be a positive number' })
    .optional(),
  payRate: z
    .number({ message: 'Pay rate must be a number' })
    .min(0, { message: 'Pay rate must be a positive number' })
    .optional(),
  facesheet: z.record(z.string(), z.any()).optional(),
  notes: z.string({ message: 'Notes must be a string' }).optional(),
  docusignEnvelopeId: z.string({ message: 'docusignEnvelopeId must be a string' }).optional(),
  docusignEnvelopeStatus: z
    .string({ message: 'docusignEnvelopeStatus must be a string' })
    .optional(),
  onboardingESignEnvelopeId: z
    .string({ message: 'onboardingESignEnvelopeId must be a string' })
    .optional(),
  onboardingESignEnvelopeStatus: z.enum(['completed', 'declined', 'expired', 'pending']).optional(),
  onboardingESignEnvelopeCreatedAt: z
    .string({
      message: 'onboardingESignEnvelopeCreatedAt must be a date time string',
    })
    .datetime()
    .optional(),
  latitude: z.number({ message: 'Latitude must be a number' }).optional(),
  longitude: z.number({ message: 'Longitude must be a number' }).optional(),
  lastLoginTimestamp: z.preprocess(
    (val) => (val === '' ? null : val),
    z
      .union([
        z.string().datetime({
          message: 'lastLoginTimestamp has an invalid datetime format',
        }),
        z.literal(null),
      ])
      .optional()
  ),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
})
  .merge(CustomerSchema)
  .strict();

export const UpdateReferralSchema = CreateReferralSchema.extend({
  referralContactedOn: z
    .string()
    .datetime({ message: 'referralContactedOn has an invalid datetime format' })
    .optional(),
  notes: z.string({ message: 'Notes must be a string' }).max(500).optional(),
  createdAt: z
    .string()
    .datetime({ message: 'createdAt has an invalid datetime format' })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: 'modifiedAt has an invalid datetime format' })
    .optional(),
}).strict();

export const getAllUsersSchema = z
  .object({
    userType: z.enum(
      [
        'PCHO',
        'PCGLead',
        'PCG',
        'Lead',
        'Senior',
        'Referral',
        'ComplianceGuest',
        'Nurse',
        'NurseLead',
        'SalesRepresentative',
        'SalesDirector',
        'HomeAdmin',
      ],
      {
        message:
          'Role is required and accepts only PCHO, PCG, PCGLead, Senior, Lead, Referral, ComplianceGuest, Nurse, NurseLead, SalesRepresentative, SalesDirector, HomeAdmin',
      }
    ),
    home: z.string().nonempty({ message: 'Home is required' }).optional(),
    homeId: z.string().uuid({ message: 'homeId has an invalid UUID format' }).optional(),
    milestone: z
      .enum(['initial contact', 'tour', 'onboarding', 'contract', 'lost'], {
        message: 'Milestone accepts only initial contact, tour, onboarding, contract, lost',
      })
      .optional(),
    isReferredByUserId: z
      .union([
        z.string().uuid({ message: 'isReferredByUserId has an invalid UUID format' }),
        z.array(z.string().uuid({ message: 'isReferredByUserId has an invalid UUID format' })),
      ])
      .optional(),
  })
  .strict();
