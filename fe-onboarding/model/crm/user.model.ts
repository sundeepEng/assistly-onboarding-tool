import { z } from "zod";

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

export const signupSchema = z.object({
  user: z.object({
    firstName: z.string().trim().nonempty({ message: "First name is required" }),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().nonempty({ message: "Last name is required" }),
    email: z
      .string()
      .nonempty({ message: "Email is required" })
      .email({ message: "Please enter a valid email address" }),
    mobile: z
      .string()
      .regex(/^\d{10}$/, { message: "Enter a valid 10-digit mobile number" }),
  }),
  home: z.object({
    homeType: z.string().nonempty({ message: "Home type is required" }),
    homeName: z.string().trim().nonempty({ message: "Home name is required" }),
    homeCapacity: z.coerce
      .number({ message: "Capacity must be a number" })
      .int()
      .min(1, { message: "Capacity must be at least 1" }),
    homeAddress: z.object({
      street: z.string().trim().nonempty({ message: "Street is required" }),
      city: z.string().trim().nonempty({ message: "City is required" }),
      state: z.string().trim().nonempty({ message: "State is required" }),
      zipCode: z
        .string()
        .regex(/^\d{5}(-\d{4})?$/, { message: "Enter a valid zip code" }),
    }),
  }),
});
