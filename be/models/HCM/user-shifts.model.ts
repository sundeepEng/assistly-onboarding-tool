import { z } from 'zod';

export const createUserShiftSchema = z
  .object({
    user_id: z.string().uuid(),

    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),

    shift_status: z.enum(['available', 'timeoff', 'vacation']),

    shift_color: z.string().nonempty().default('#3b82f6'),

    shift_start_time: z.string().datetime({ offset: false }),

    shift_end_time: z.string().datetime({ offset: false }),

    is_unavailability_approved: z.boolean().nullable().optional(),

    unavailability_reason: z.string().nullable().optional(),

    pay_frequency: z.enum(['Hourly', 'Monthly']).default('Hourly'),

    pay_rate: z.number(),

    notes: z.string().max(500).nullable().optional(),

    clock_in_timestamp: z.string().datetime().nullable().optional(),

    clock_out_timestamp: z.string().datetime().nullable().optional(),

    assigned_to_user_id: z.string().uuid().nullable().optional(),

    created_by_user_id: z.string().uuid({ message: 'created_by_user_id must be a valid uuid' }),

    isOverlap: z.boolean().default(false),
  })
  .strict();

export const updateUserShiftSchema = createUserShiftSchema
  .extend({
    id: z.number().int().positive(), // Primary key, auto-incremented
  })
  .strict();
