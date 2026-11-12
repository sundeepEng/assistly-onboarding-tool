import { z } from "zod";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";
import { withNullsAsUndefined } from "../../utils/zodUtils";
import { CustomerSchema } from "./customer.model";

const nameRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]+$/;

const baseUsersSchema = z
  .object({
    home: z.string({ message: "home must be a string" }).optional(),
    homeId: z
      .string()
      .uuid({
        message: "homeId must has an invalid UUID format",
      })
      .optional(),
    firstName: z
      .string({ required_error: "First Name is required" })
      .trim()
      .min(1, "First Name should be more than (1) character")
      .regex(nameRegex, {
        message: "First Name accepts only alphabets and numbers",
      }),
    middleName: makeOptionalOnEmpty(
      z
        .string()
        .trim()
        .regex(nameRegex, {
          message: "Middle Name accepts only alphabets and numbers",
        })
        .optional(),
    ),
    lastName: z
      .string({ required_error: "Last Name is required" })
      .trim()
      .min(1, { message: "Last Name shoudld be more than (1) character" })
      .regex(nameRegex, {
        message: "Last Name accepts only alphabets and numbers",
      }),
    email: z
      .string({ required_error: "Email is required" })
      .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
        message: "Invalid email",
      }),
    mobile: z
      .string({ required_error: "Phone number is required" })
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      }),
    clientRate: z
      .number({ message: "Client rate must be a number" })
      .min(0, { message: "Client rate must be a positive number" })
      .optional(),
    payRate: z
      .number({ message: "Pay rate must be a number" })
      .min(0, { message: "Pay rate must be a positive number" })
      .optional(),
  })
  .strict();

export const CreatePCHOOrPCGLeadSchema = baseUsersSchema
  .extend({
    associatedHomeIds: z
      .array(
        z
          .string()
          .uuid({ message: "associatedHomeIds has invalid UUID format" }),
        { message: "associatedHomeIds must be an array of UUIDs" },
      )
      .optional(),
  })
  .strict();

export const CreateNurseOrNurseLeadSchema = baseUsersSchema
  .extend({
    name: z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: "only alphabets, numbers and spaces are allowed",
      })
      .optional(),
    role: z.enum(["Nurse", "NurseLead"]).optional(),
  })
  .strict();

// Schema for creating a Sales Representative or Sales Director (matching backend)
export const CreateSalesRepresentativeOrSalesDirectorSchema = baseUsersSchema
  .extend({
    role: z
      .enum(["SalesRepresentative", "SalesDirector"], {
        message: "Role accepts only SalesRepresentative or SalesDirector",
      })
      .optional(),
  })
  .strict();

export const UpdateNurseOrNurseLeadSchema = CreateNurseOrNurseLeadSchema.extend(
  {
    profileImageUrl: z
      .string({ message: "profileImageUrl must be a string" })
      .optional(),
    biography: z
      .object({
        personalDetails: z.object({
          emergencyContactName: z
            .string()
            .regex(/^[A-Za-z0-9\s]+$/, {
              message: "Emergency Contact Name accepts only alphabets",
            })
            .optional(),
          emergencyContactNumber: z
            .string()
            .regex(/^[0-9]+$/, {
              message: "Emergency Contact Number accepts only numbers",
            })
            .length(10, {
              message: "Emergency Contact Number must be exactly 10 digits",
            })
            .optional(),
        }),
      })
      .strict()
      .optional(),
    onboardingESignEnvelopeId: z
      .string({ message: "onboardingESignEnvelopeId must be a string" })
      .optional(),
    onboardingESignEnvelopeStatus: z
      .enum(["completed", "declined", "expired", "pending"])
      .optional(),
    onboardingESignEnvelopeCreatedAt: z
      .string({
        message: "onboardingESignEnvelopeCreatedAt must be a date time string",
      })
      .datetime()
      .optional(),
    contractCompletedOn: z.string().date().optional(),
    associatedUserIds: z
      .array(
        z.string().uuid({ message: "associatedUserIds must be valid uuids" }),
      )
      .optional(),
    notes: z.string({ message: "Notes must be a string" }).optional(),
    createdAt: z
      .string()
      .datetime({ message: "createdAt has an invalid datetime format" })
      .optional(),
    modifiedAt: z
      .string()
      .datetime({ message: "modifiedAt has an invalid datetime format" })
      .optional(),
  },
).strict();

export const CreateLeadSchema = (isInHomeCare: boolean) =>
  baseUsersSchema
    .extend({
      role: z
        .literal("Lead", {
          message: "role must be Lead",
        })
        .optional(),
      name: z
        .string()
        .regex(/^[A-Za-z0-9\s]+$/, {
          message: "only alphabets, numbers and spaces are allowed",
        })
        .optional(),
      milestone: z
        .array(
          z.enum(
            ["initial contact", "tour", "onboarding", "contract", "lost"],
            {
              message:
                "Milestone accepts only initial contact, tour, onboarding, contract or lost",
            },
          ),
        )
        .optional(),
      lostCategory: z
        .enum(
          [
            "Family Chose Another",
            "Pricing",
            "Location",
            "Timing",
            "Clinical Fit",
            "Other",
          ],
          {
            message:
              "lostCategory accepts only Family Chose Another, Pricing, Location, Timing, Clinical Fit or Other",
          },
        )
        .optional(),
      tourDateTime: z.string().datetime().nullable().optional(),
      isTourCompleted: z.boolean().default(false).optional(),
      tourNotes: makeOptionalOnEmpty(z.string().optional()),
      email: z
        .string()
        .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
          message: "Invalid email",
        })
        .optional(),
      mobile: isInHomeCare
        ? z
            .string()
            .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
            .refine((val) => val.length === 10, {
              message: "Mobile number must be exactly 10 digits",
            })
        : z
            .string()
            .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
            .refine((val) => val.length === 10, {
              message: "Mobile number must be exactly 10 digits",
            })
            .optional(),
      isReferredByUserId: z
        .string()
        .uuid({ message: "Lead owner is required" })
        .optional(),
    })
    .strict();

export const CreateReferralSchema = baseUsersSchema
  .extend({
    referralOrgName: makeOptionalOnEmpty(
      z
        .string()
        .regex(/^[A-Za-z\s]+$/, { message: "only alphabets are allowed" })
        .optional(),
    ),
  })
  .strict();

export const CreateComplianceGuestSchema = baseUsersSchema
  .extend({
    role: z
      .literal("ComplianceGuest", {
        message: "Role accepts only ComplianceGuest",
      })
      .optional(),
  })
  .strict();

export const UpdateComplianceGuestSchema = CreateComplianceGuestSchema.extend({
  completedComplianceDocumentIds: z
    .array(
      z.string().uuid({
        message: "completedComplianceDocumentIds has an invalid UUID format",
      }),
      { message: "completedComplianceDocumentIds must be an array of UUIDs" },
    )
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
  complianceCertificates: z.record(z.string()).optional(),
  profileImageUrl: z
    .string({ message: "profileImageUrl must be a string" })
    .optional(),
  lastLoginTimestamp: z
    .string()
    .datetime({
      message: "lastLoginTimestamp has an invalid datetime format",
    })
    .optional(),
  modifiedAt: z
    .string()
    .datetime({ message: "modifiedAt has an invalid datetime format" })
    .optional(),
});

export const UpdateLeadOrSeniorSchema = (isInHomeCare: boolean) =>
  withNullsAsUndefined(
    CreateLeadSchema(isInHomeCare)
      .extend({
        role: z
          .enum(["Lead", "Senior"], {
            message: "role must be Lead/Senior",
          })
          .optional(),
        notes: z.string().optional(),
        profileImageUrl: z.string().optional(),
        docusignEnvelopeId: z.string().optional(),
        docusignEnvelopeStatus: z.string().optional(),
        onboardingESignEnvelopeId: z.string().optional(),
        onboardingESignEnvelopeStatus: z
          .enum(["completed", "declined", "expired", "pending"])
          .optional(),
        onboardingESignEnvelopeCreatedAt: z.string().optional(),
        contractCompletedOn: z.string().date().optional(),
        latitude: z.number({ message: "Latitude must be a number" }).optional(),
        longitude: z
          .number({ message: "Longitude must be a number" })
          .optional(),
        facesheet: z.record(z.string(), z.any()).optional(),
      })
      .merge(CustomerSchema(isInHomeCare))
      .strip(),
  );

export const UpdatePCGSchema = withNullsAsUndefined(
  CreatePCHOOrPCGLeadSchema.merge(
    z.object({
      biography: z
        .object({
          personalDetails: z.object({
            emergencyContactName: makeOptionalOnEmpty(
              z
                .string()
                .regex(/^[A-Za-z0-9\s]+$/, {
                  message: "Only alphabets are allowed",
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
          }),
        })
        .optional(),
      contractCompletedOn: z.string().date().optional(),
    }),
  ).strip(),
);

export const signInSchema = z
  .object({
    email: z.string().email({ message: "Invalid Email" }).nonempty(),
    password: z
      .string()
      .min(8)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      )
      .nonempty(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().email({ message: "Invalid Email" }).nonempty(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .nonempty({ message: "Email is required" })
      .email({ message: "Please enter a valid email address" }),

    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password should be of minimum length 8 characters with atleast one uppercase, one lowercase, one number, one special character",
        },
      )
      .nonempty({
        message: "Password is required!",
      }),
  })
  .strict();

export const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password should be at least 8 characters." })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password must have uppercase, lowercase, number, and special character.",
        },
      )
      .nonempty({ message: "New password is required" }),
    confirmPassword: z
      .string()
      .min(8, { message: "Password should be at least 8 characters." })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password must have uppercase, lowercase, number, and special character.",
        },
      )
      .nonempty({ message: "New password is required" }),
  })
  .strict();
export const updatePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(8, { message: "Old password must be at least 8 characters." })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password must have uppercase, lowercase, number, and special character.",
        },
      )
      .nonempty({ message: "Old password is required!" }),

    newPassword: z
      .string()
      .min(8, { message: "Password should be at least 8 characters." })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password must have uppercase, lowercase, number, and special character.",
        },
      )
      .nonempty({ message: "New password is required" }),

    reEnterNewPassword: z
      .string()
      .nonempty({ message: "Please re-enter your new password" }),
  })
  .strict()
  .refine((data) => data.newPassword === data.reEnterNewPassword, {
    message: "Passwords do not match.",
    path: ["reEnterNewPassword"],
  });

export const activateAccountSchema = z
  .object({
    email: z
      .string({ message: "Email must be a string" })
      .email({ message: "Email has invalid format" }),
    password: z
      .string()
      .min(8, { message: "Password should be at least 8 characters." })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        {
          message:
            "Password must have uppercase, lowercase, number, and special character.",
        },
      )
      .nonempty({ message: "New password is required" }),

    confirmPassword: z
      .string()
      .nonempty({ message: "Please re-enter your new password" }),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const PersonalDetailsSchemaPCHO = z.object({
  firstName: z
    .string()
    .min(1, { message: "First Name should be more than (1) character" })
    .regex(/^[A-Za-z0-9\s]+$/, {
      message: "Only alphabets, numbers are allowed",
    }),

  middleName: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: "Only alphabets, numbers are allowed",
      })
      .optional(),
  ),

  lastName: z
    .string()
    .min(1, { message: "Last Name should be more than (1) character" })
    .regex(/^[A-Za-z0-9\s]+$/, {
      message: "Only alphabets, numbers are allowed",
    }),

  email: makeOptionalOnEmpty(
    z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((val) => !val || /^\S+@\S+\.\S+$/.test(val), {
        message: "invalid email format",
      }),
  ),

  mobile: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
  ),

  biography: z
    .object({
      personalDetails: z
        .object({
          emergencyContactName: makeOptionalOnEmpty(
            z
              .string()
              .regex(/^[A-Za-z\s]+$/, { message: "Only alphabets are allowed" })
              .optional(),
          ),
          emergencyContactNumber: makeOptionalOnEmpty(
            z
              .string()
              .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
              .refine((val) => val.length === 10, {
                message: "Mobile number must be exactly 10 digits",
              })
              .optional(),
          ),
        })
        .optional(),
    })
    .optional(),
});

export const PersonalDetailsSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: "First Name should be more than (1) character" })
    .regex(/^[A-Za-z0-9\s]+$/, {
      message: "Only alphabets, numbers are allowed",
    }),
  middleName: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[A-Za-z0-9\s]+$/, {
        message: "Only alphabets, numbers are allowed",
      })
      .optional(),
  ),

  lastName: z
    .string()
    .min(1, { message: "Last Name should be more than (1) character" })
    .regex(/^[A-Za-z0-9\s]+$/, {
      message: "Only alphabets, numbers are allowed",
    }),

  email: makeOptionalOnEmpty(
    z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((val) => !val || /^\S+@\S+\.\S+$/.test(val), {
        message: "invalid email format",
      }),
  ),

  mobile: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
  ),
  biography: z
    .object({
      personalDetails: z
        .object({
          emergencyContactName: makeOptionalOnEmpty(
            z
              .string()
              .regex(/^[A-Za-z\s]+$/, { message: "Only alphabets are allowed" })
              .optional(),
          ),
          emergencyContactNumber: makeOptionalOnEmpty(
            z
              .string()
              .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
              .refine((val) => val.length === 10, {
                message: "Mobile number must be exactly 10 digits",
              })
              .optional(),
          ),
          gender: z.enum(["Male", "Female", "Other"], {
            required_error: "Gender is required",
          }),
          birthdate: z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid date format",
          }),
        })
        .optional(),
    })
    .optional(),
});

export const ScheduleHomeTourSchema = z.object({
  scheduleDate: z.string().min(1, "Please select a date"),
  scheduleTime: z.string().min(1, "Please select a time"),
});
