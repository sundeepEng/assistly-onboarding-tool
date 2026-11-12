import { z } from 'zod';
import { RBACDAL } from '../../dal/rbac.dal';
import { FormatResponse } from '../../utils/response-formatter';

const rbacDAL: RBACDAL = new RBACDAL();

export const getRBACRoleHandler = async (queryParameters: any) => {
  if (!queryParameters) {
    console.error(`{api: '/get-rbac', error: No query parameters provided}`);

    return FormatResponse(400, {
      message: 'Failed to fetch RBAC role',
      error: 'No query parameters provided',
    });
  }

  const roles = z.enum([
    'PCHO',
    'PCGLead',
    'PCG',
    'Senior',
    'Lead',
    'NurseLead',
    'Nurse',
    'SalesRepresentative',
    'SalesDirector',
  ]);

  const role: string = queryParameters?.role;

  if (!role || !role?.length) {
    console.error(`{api: '/get-rbac', error: Role is required as query parameter}`);

    return FormatResponse(400, {
      message: 'Failed to fetch RBAC role',
      error: 'Role is required as query parameter',
    });
  }

  try {
    const roleValidation = roles.safeParse(queryParameters.role);
    console.info(
      `{api: '/get-rbac', message: 'Validated role', data: ${JSON.stringify(roleValidation)}}`
    );
    const roleData = await rbacDAL.fetchByRole(role);
    return FormatResponse(200, {
      roleData,
    });
  } catch (error) {
    console.error(`{api: '/get-rbac', error: ${error}}`);
    if (error instanceof z.ZodError) {
      console.error('Validation error: ', error.errors);
      return FormatResponse(400, {
        message: 'Failed to fetch RBAC role',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to fetch RBAC role',
      error: error,
    });
  }
};
