import { FormatResponse } from "../../utils/response-formatter";
import { RBACDAL } from "../../dal/rbac.dal";
import { z } from "zod";
import { rbacSchema } from "../../models/RBA/rbac.model";

const rbacDAL: RBACDAL = new RBACDAL();

export const upsertRBACRoleHandler = async (
  newRoleData: z.infer<typeof rbacSchema>
) => {
  if (!newRoleData) {
    console.error(`{api: '/upsert-rbac', error: No body provided}`);

    return FormatResponse(400, {
      message: "Failed to upsert RBAC role",
      error: "No body provided",
    });
  }

  try {
    const validatedData = rbacSchema.parse(newRoleData);
    console.info(
      `{api: '/upsert-rbac', message: 'Validated data', data: ${JSON.stringify(
        validatedData
      )}}`
    );
    newRoleData = { ...newRoleData, modifiedAt: new Date().toISOString() };
    await rbacDAL.upsertByRole(newRoleData);
    return FormatResponse(200, {
      message: "RBAC role upserted successfully",
    });
  } catch (error) {
    console.error(`{api: '/upsert-rbac', error: ${error}}`);

    if (error instanceof z.ZodError) {
      console.error("Validation error: ", error.errors);
      return FormatResponse(400, {
        message: "Failed to upsert RBAC role",
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: "Failed to upsert RBAC role",
      error: error,
    });
  }
};
