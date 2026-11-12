import { z } from 'zod';

export const rbacSchema = z
  .object({
    role: z.enum([
      'PCHO',
      'Senior',
      'Lead',
      'PCG',
      'PCGLead',
      'Nurse',
      'NurseLead',
      'SalesRepresentative',
      'SalesDirector',
    ]),
    view: z
      .array(
        z.enum([
          'CLINICAL_TABS',
          'CLINICAL_MEDPASS',
          'CLINICAL_OTC',
          'CLINICAL_CAREPLAN',
          'CLINICAL_INCIDENT',
        ])
      )
      .optional(),
    edit: z.array(
      z.enum([
        'CRM_DASHBOARD',
        'CRM_BIOGRAPHY',
        'CRM_ACTIONS',
        'CLINICAL_DASHBOARD',
        'CLINICAL_TABS',
        'CLINICAL_CAROUSEL',
        'CRM_REFERRAL',
        'CRM_PCG',
        'CRM_SIDENAV',
        'CRM_ADDNEW',
        'CLINICAL_SENIOR_ROOM_NUMBER',
      ])
    ),
    initialRoute: z.enum(['/crm', '/clinical']),
    modifiedAt: z.string().datetime().optional(),
  })
  .strict();
