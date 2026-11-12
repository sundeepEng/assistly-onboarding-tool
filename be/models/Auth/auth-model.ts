import { z } from 'zod';

export const CommonSignUpSchema = z
  .object({
    email: z
      .string({ message: 'Email must be a string' })
      .email({ message: 'Email has invalid format' })
      .toLowerCase(),
    role: z.enum(
      [
        'Senior',
        'PCG',
        'Lead',
        'PCGLead',
        'ComplianceGuest',
        'Nurse',
        'NurseLead',
        'SalesRepresentative',
        'SalesDirector',
      ],
      {
        message:
          'Role accepts only Senior, Lead, PCGLead, PCG, ComplianceGuest, Nurse, NurseLead, SalesRepresentative, SalesDirector',
      }
    ),
  })
  .strict();

export const AccountActivationSchema = z
  .object({
    email: z
      .string({ message: 'Email must be a string' })
      .email({ message: 'Email has invalid format' })
      .toLowerCase(),
    token: z
      .string({ message: 'token must be a string' })
      .nonempty({ message: 'token is required' }),
    password: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'password should contain a minimum of 8 characters with at least one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'password is required',
      }),
    confirmPassword: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'confirm password should contain a minimum of 8 characters with at least one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'confirm password is required',
      }),
  })
  .strict();

export const ResetPasswordSchema = z
  .object({
    email: z
      .string({ message: 'Provided data type is not a string' })
      .email({ message: 'Invalid email format' })
      .toLowerCase()
      .nonempty({ message: 'Email should not be empty' }),
  })
  .strict();

export const ConfirmResetPasswordSchema = z
  .object({
    email: z
      .string({ message: 'Provided data type is not a string' })
      .email({ message: 'Invalid email format' })
      .toLowerCase()
      .nonempty({ message: 'Email should not be empty' }),
    newPassword: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'password should contain a minimum of 8 characters with at least one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'password is required',
      }),
    confirmationCode: z
      .string()
      .regex(/^\d{6}$/, {
        message: 'Confirmation code should contain exactly 6 digits',
      })
      .refine((value) => Number(value) >= 0, {
        message: 'Confirmation code should be greater than zero',
      }),
  })
  .strict();

export const signInSchema = z
  .object({
    email: z
      .string()
      .email({ message: 'Invalid Email' })
      .toLowerCase()
      .nonempty({ message: 'email is required' }),
    password: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'password should contain a minimum of 8 characters with atleast one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'password is required',
      }),
  })
  .strict();

export const updatePasswordSchema = z
  .object({
    accessToken: z.string().nonempty({ message: 'token is required' }),
    oldPassword: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'password should contain a minimum of 8 characters with atleast one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'oldPassword is required',
      }),
    newPassword: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$#!%*?&])[A-Za-z\d@$#!%*?&]{8,}$/, {
        message:
          'password should contain a minimum of 8 characters with atleast one uppercase(A-Z), one lowercase(a-z), one number(0-9), one special character(@$#!%*?&)',
      })
      .nonempty({
        message: 'newPassword is required',
      }),
  })
  .strict();

export const refreshTokenSchema = z.object({
  refreshToken: z.string().nonempty({ message: 'refreshToken is required' }),
});
