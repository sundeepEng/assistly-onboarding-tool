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

const careTeamFaceSheetBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string({ required_error: "Email is required" })
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Invalid email",
    }).optional(),
  mobile: z
    .string({ required_error: "Phone number is required" })
    .regex(/^[0-9]+$/, { message: "Only numbers are allowed" }) // Only digits
    .refine((val) => val.length === 10, {
      message: "Mobile number must be exactly 10 digits",
    }).optional(),
  emergencyContactName: makeOptionalOnEmpty(
    z
      .string()
      .regex(nameRegex, {
        message: "Accepts only alphabets and numbers",
      })
      .trim()
      .optional(),
  ),
  emergencyContactRelationship: z.string().trim(),
  emergencyContactPhone: makeOptionalOnEmpty(
    z
      .string()
      .regex(/^[0-9]+$/, { message: "Only numbers are allowed" })
      .refine((val) => val.length === 10, {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
  ),
  backgroundCheck: z.enum(["Yes", "No", "Not on file"]),
  tbTest: z.enum(["Yes", "No", "Not on file"]),
  documents: z
    .object({
      backgroundCheck: documentFieldSchema.optional(),
      tbTestResult: documentFieldSchema.optional(),
      drivingLicense: documentFieldSchema.optional(),
      cprCertificate: documentFieldSchema.optional(),
    })
    .optional(),
});

export { careTeamFaceSheetBaseSchema };

export type CareTeamFaceSheetDraft = z.infer<typeof careTeamFaceSheetBaseSchema>;
