import { z } from 'zod';

export const InitiateESignEnvelopeSchema = z.object({
  homeId: z.string().uuid({ message: 'homeId has an invalid UUID format' }),
  recipientUserId: z.string().uuid({ message: 'recipientUserId has an invalid UUID format' }),
  senderUserId: z.string().uuid({ message: 'senderUserId has an invalid UUID format' }),
});

export const EmbeddedSignSchema = z.object({
  templateId: z.number({ message: 'templateId is required' }),
  submitters: z.array(
    z.object({
      role: z.string({ message: 'role is required' }),
      email: z.string().email({ message: 'Invalid email format' }),
      values: z.record(z.string()).optional(),
      external_id: z.string({ message: 'externalId is required' }),
    })
  ),
});

export const SeniorOnboardingDocumentFieldsSchema = z
  .object({
    home_name: z.string().optional(),
    resident_name: z.string().optional(),
    rent: z.string().optional(),
    clothing_responsible: z.string().optional(),
    clothing_fee: z.string().optional(),
    medication_refills_responsible: z.string().optional(),
    medication_refills_fee: z.string().optional(),
    medical_transport_responsible: z.string().optional(),
    medical_transport_fee: z.string().optional(),
    activity_transport_responsible: z.string().optional(),
    activity_transport_fee: z.string().optional(),
    laundry_responsible: z.string().optional(),
    laundry_fee: z.string().optional(),
    transfer_responsible: z.string().optional(),
    transfer_fee: z.string().optional(),
    home_owner_name: z.string().optional(),
    sign_date: z.string().optional(),
    personal_needs_allowance_amount: z.string().optional(),
    date_of_move_in: z.string().optional(),
    resident_address: z.string().optional(),
    financial_responsible_person: z.string().optional(),
    personal_needs_responsible_person: z.string().optional(),
    representative_name_and_address: z.string().optional(),
    representative_phone_number: z.string().optional(),
  })
  .strict();

export const PCGOnboardingDocumentFieldsSchema = z
  .object({
    date_of_execution: z.string().optional(),
    home_name: z.string().optional(),
    home_address: z.string().optional(),
    caregiver_name: z.string().optional(),
    home_phone: z.string().optional(),
    home_email: z.string().optional(),
    contract_date: z.string().optional(),
    caregiver_address: z.string().optional(),
    role: z.string().optional(),
    contract_start_date: z.string().optional(),
    wage_rate: z.string().optional(),
    payment_schedule: z.string().optional(),
    signed_by: z.string().optional(),
    home_owner_name: z.string().optional(),
    sign_date: z.string().optional(),
  })
  .strict();

export const CreateDocusealSubmissionSchema = z
  .object({
    pdfBase64: z.string().min(1, { message: 'pdfBase64 is required' }),
    signerEmail: z.string().email({ message: 'Invalid signer email format' }),
  })
  .strict();

export const DocusealBuilderTokenRequestSchema = z
  .object({
    integrationEmail: z.string().email().optional(),
    name: z.string().min(1).optional(),
    documentUrls: z.array(z.string().url()).optional(),
    templateId: z.number().int().optional(),
    externalId: z.string().min(1).optional(),
    roles: z.array(z.string().min(1)).optional(),
    residentUserId: z
      .string()
      .uuid({ message: 'residentUserId has an invalid UUID format' })
      .optional(),
    pchoUserId: z.string().uuid({ message: 'pchoUserId has an invalid UUID format' }).optional(),
  })
  .strict();
