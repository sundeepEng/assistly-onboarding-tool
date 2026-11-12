import { z } from 'zod';

//Task Types
export const TaskTypeSchema = z.enum(
  ['Cleaning', 'Kitchen', 'Laundry', 'Medication', 'Inventory', 'Security', 'Outdoor', 'Other'],
  {
    message:
      'type must be one of: Cleaning, Kitchen, Laundry, Medication, Inventory, Security, Outdoor, Other',
  }
);

export const TaskShiftSchema = z.enum(['morning', 'afternoon', 'evening'], {
  message: "shift must be 'morning', 'afternoon', or 'evening'",
});

export const TaskTrackingStatusSchema = z.enum(['pending', 'completed'], {
  message: "status must be 'pending' or 'completed'",
});

export const WeekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], {
  message: "weekday must be one of 'Mon'...'Sun'",
});

//Task Base Schema
const TaskBaseSchema = z
  .object({
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
    title: z.string().min(1, 'title is required'),
    type: TaskTypeSchema,
    shift: TaskShiftSchema.default('morning'),
    shift_notes: z.string().nullable().optional(),
    days_of_week: z.array(WeekdaySchema),
    assigned_to_user_id: z.string().uuid().nullable().optional(),
    is_deleted: z.boolean().default(false),
    created_by_user_id: z.string().uuid({ message: 'created_by_user_id must be a valid uuid' }),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strict();

export const CreateTaskSchema = TaskBaseSchema;

export const UpdateTaskSchema = TaskBaseSchema.extend({
  id: z.string().uuid({ message: 'id must be a valid uuid' }),
}).strict();

//Task Daily Tracking Base Schema
const TaskDailyTrackingBaseSchema = z
  .object({
    task_id: z.string().uuid({ message: 'task_id must be a valid uuid' }),
    updated_by_user_id: z.string().uuid({ message: 'updated_by_user_id must be a valid uuid' }).optional(),
    status: TaskTrackingStatusSchema.default('pending'),
    comments: z.array(
      z.object({
        user_id: z.string().uuid({ message: 'user_id must be a valid uuid' }),
        comment: z.string().min(1, 'comment is required'),
        created_at: z.string().datetime().optional(),
      })
    ),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strict();

export const CreateTaskDailyTrackingSchema = TaskDailyTrackingBaseSchema;

export const UpdateTaskDailyTrackingSchema = TaskDailyTrackingBaseSchema.extend({
  id: z.string().uuid({ message: 'id must be a valid uuid' }),
}).strict();

export const TaskFormSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  category: z.string().min(1, 'Category is required'),
  shift: z.string().min(1, 'Shift is required'),
  notes: z.string().optional(),
  days: z.array(z.string()).default([]),
});
