import { z } from "zod";

import { withNullsAsUndefined } from "../../utils/zodUtils";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";

export const ClinicalSchema = withNullsAsUndefined(
  z
    .object({
      userId: z.string().uuid().optional(),
      status: z
        .string()
        .max(10, { message: "Status should not be more than 10 characters" })
        .optional(),
      roomNumber: z
        .number()
        .nonnegative({
          message: "Room Number should be greater than or equal to zero",
        })
        .optional(),
      medication: z
        .object({
          id: z
            .string()
            .uuid({ message: "Id must be a valid UUID" })
            .optional(),
          name: z.string().regex(/^[A-Za-z0-9\s()_-]+$/, {
            message:
              "Only alphabets, numbers, and special characters (, -, _ are allowed",
          }),
          dosage: z.string(),
          directions: z.string().optional(),
          startdate: z.string().refine(
            (val) => !isNaN(Date.parse(val)), // Ensures valid date format
            { message: "Invalid date format" },
          ),
          // TODO: need to check with BE about this date conversion
          // .transform((val) => new Date(val)), // Converts string to Date object
          enddate: makeOptionalOnEmpty(
            z.string().refine(
              (val) => !isNaN(Date.parse(val)), // valid date only
              { message: "Invalid date format" },
            ),
          ),
          timings: z
            .array(z.string().time({ message: "Invalid time format" }), {
              message: "Should select atleast 1 medpass time",
            })
            .min(1, { message: "At least one time must be selected" }),
          additionalComments: z.string().optional(),
          overTheCounter: z
            .boolean({
              message: "Values must be either true or false",
            })
            .optional(), // Attribute to differentiate between daily and Over the counter medications
        })
        .strip()
        .optional(),
      medPass: z
        .object({
          services: z.array(
            z
              .object({
                medicationId: z
                  .string()
                  .uuid({ message: "MedicationId must be a valid UUID" }),
                passOrRefuse: z.enum(["Pass", "Refuse"], {
                  message: "Values must be either Pass or Refuse",
                }),
                timing: z
                  .string({ message: "Must be a string" })
                  .time({ message: "Invalid time format" }),
                remarks: z.string().optional(),
                providedAt: z.string().datetime().optional(),
                 providedBy: z
                .string()
                .uuid({ message: 'ProvidedBy must be a valid UUID' })
                .optional()
              })
              .strip(),
          ),
          comments: z
            .array(
              z
                .object({
                  messageId: z
                    .string()
                    .uuid({ message: "UUID must be a valid UUID" }),
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
                .strip(),
            )
            .optional(),
        })
        .strip()
        .optional(),
      carePlan: z
        .object({
          services: z.array(
            z
              .object({
                serviceCategory: z
                  .enum(["ADL", "Vital Signs", "House Keeping"], {
                    message:
                      "Service category must be ADL, Vital Signs, or House Keeping",
                  })
                  .optional(),
                serviceName: z.string().nonempty(),
                providedOrNot: z
                  .enum(["Provided", "Not Provided"], {
                    message: "Values must be either Provided or Not Provided",
                  })
                  .optional(),
                // ADL and House Keeping services: single UTC ISO timestamp of when service was provided
                providedAt: z.string().datetime().optional(),
                // Vital Signs only: multiple readings, each with a UTC ISO time and a recorded value (e.g. "120/80")
                readings: z
                  .array(
                    z.object({
                      time: z.string().datetime(),
                      value: z.string(),
                    }),
                  )
                  .optional(),
              })
              .strip(),
          ),
          comments: z
            .array(
              z
                .object({
                  messageId: z
                    .string()
                    .uuid({ message: "UUID must be a valid UUID" }),
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
                .strip(),
            )
            .optional(),
        })
        .strip()
        .optional(),

      incidentReport: z
        .object({
          incidentStartTime: z
            .string()
            .transform((val) => (val ? `${val}:00` : val)), // Append ":00" if a value exists
          incidentEndTime: z
            .string()
            .transform((val) => (val ? `${val}:00` : val)) // Append ":00" if a value exists
            .optional(),
          incidentDescription: z.string(), // this is the functional name holder for the incident
          comments: z.string().optional(), // This field gives additional comments / context for the incident
        })
        .strip()
        .optional(),
    })
    .strip(),
);

export type Clinical = z.infer<typeof ClinicalSchema>;
