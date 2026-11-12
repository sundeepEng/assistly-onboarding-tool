import { z } from "zod";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";
import { nameRegex } from "../crm/customer.model";

export const documentFieldSchema = z.object({
  documentId: z.string().optional(),
  documentName: z.string().optional(),
  fileUrl: z.string().url().optional(),
  file: z.any().optional(),
  status: z.enum(["empty", "existing", "new", "remove"]).default("empty"),
});

const faceSheetBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  gender: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["Male", "Female", "Other"]),
  ),
  birthdate: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Invalid date format",
    }),
  room: z.coerce
    .number({
      invalid_type_error: "Room Number must be a number",
    })
    .nonnegative({
      message: "Room Number should be greater than or equal to zero",
    })
    .optional(),
 address: z.object({
  street: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  zipCode: z.string().trim(),
}).refine(
  (val) =>
    !val.street && !val.city && !val.state && !val.zipCode ||
    (!!val.street &&
      !!val.city &&
      !!val.state &&
      /^\d{5}(-\d{4})?$/.test(val.zipCode)),
  {
    message: "Complete street, city, state, and valid ZIP code",
    path: ["zipCode"],
  }
),
  primaryLanguage: z.string().trim().min(1, "Primary language is required"),
  emergencyPrimaryName: makeOptionalOnEmpty(
    z
      .string()
      .regex(nameRegex, {
        message: "Accepts only alphabets and numbers",
      })
      .trim()
      .optional(),
  ),
  emergencyPrimaryRelationship: z.string().trim(),
  emergencyPrimaryPhone: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
  ),
  emergencySecondaryName: makeOptionalOnEmpty(
    z
      .string()
      .regex(nameRegex, {
        message: "Accepts only alphabets and numbers",
      })
      .trim()
      .optional(),
  ),
  emergencySecondaryRelationship: z.string().trim().optional(),
  emergencySecondaryPhone: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
  ),
  allergies: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceMemberId: z.string().optional(),
  medicaid: z.string().optional(),
  keyConditions: z.string().optional(),

  dnr: z.enum(["Yes", "No", "Not on file"]),
  advanceDirective: z.enum(["Yes", "No", "Not on file"]),
  documents: z
    .object({
      insuranceDocument: documentFieldSchema.optional(),
      dnrForm: documentFieldSchema.optional(),
      advanceDirectiveWill: documentFieldSchema.optional(),
    })
    .optional(),
});

export const faceSheetSchema = faceSheetBaseSchema.superRefine((data, ctx) => {
  const hasGender = data.gender !== undefined;

  const hasBirthdate =
    data.birthdate !== undefined &&
    data.birthdate !== null &&
    String(data.birthdate).trim() !== "";

  const hasEmergencyPrimaryName =
    typeof data.emergencyPrimaryName === "string" &&
    data.emergencyPrimaryName.trim() !== "";

  const hasEmergencyPrimaryPhone =
    typeof data.emergencyPrimaryPhone === "string" &&
    data.emergencyPrimaryPhone.trim() !== "";

  const hasAnyEmergencyPrimary =
    hasEmergencyPrimaryName || hasEmergencyPrimaryPhone;

  // gender => birthdate + emergency name + emergency phone
  if (hasGender) {
    if (!hasBirthdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthdate"],
        message: "Birthdate is required when gender is updated",
      });
    }

    if (!hasEmergencyPrimaryName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emergencyPrimaryName"],
        message: "Emergency contact name is required when gender is updated",
      });
    }

    if (!hasEmergencyPrimaryPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emergencyPrimaryPhone"],
        message: "Emergency contact phone number is required when gender is updated",
      });
    }
  }

  // birthdate => gender + emergency name + emergency phone
  if (hasBirthdate) {
    if (!hasGender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gender"],
        message: "Gender is required when birthdate is updated",
      });
    }

    if (!hasEmergencyPrimaryName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emergencyPrimaryName"],
        message: "Emergency contact name is required when birthdate is updated",
      });
    }

    if (!hasEmergencyPrimaryPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emergencyPrimaryPhone"],
        message: "Emergency contact phone number is required when birthdate is updated",
      });
    }
  }

  // emergency contact => gender + birthdate
  if (hasAnyEmergencyPrimary) {
    if (!hasGender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gender"],
        message: "Gender is required when emergency contact details are updated",
      });
    }

    if (!hasBirthdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthdate"],
        message: "Birthdate is required when emergency contact details are updated",
      });
    }
  }

  // emergency name => emergency phone
  if (hasEmergencyPrimaryName && !hasEmergencyPrimaryPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyPrimaryPhone"],
      message: "Emergency contact phone number is required when name is updated",
    });
  }

  // emergency phone => emergency name
  if (hasEmergencyPrimaryPhone && !hasEmergencyPrimaryName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyPrimaryName"],
      message: "Emergency contact name is required when phone number is updated",
    });
  }
});
export { faceSheetBaseSchema };

export type FaceSheetDraft = z.infer<typeof faceSheetBaseSchema>;
