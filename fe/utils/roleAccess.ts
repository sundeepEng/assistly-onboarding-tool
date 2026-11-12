import { Access, Permissions, Role } from "./roles";
import { salesDashboardPath } from "./constants";

export const hasAccess = (
  role: Role | undefined,
  feature: string,
  access: Access | Access[]
) => {
  if (!role) return false;

  const accesses = Array.isArray(access) ? access : [access];

  return accesses.some((a) => {
    const allowed = Permissions[role]?.[a] as string[] | undefined;
    return allowed?.includes(feature) ?? false;
  });
};

export const getInitialRoute = (role: Role | undefined, id?: string, isSalesRequired?: boolean): string => {
  if (!role) return "";
  
  // For PCHO and HomeAdmin, check isSalesRequired to determine initial route
  if ((role === "PCHO" || role === "HomeAdmin") && isSalesRequired !== undefined) {
    if (isSalesRequired) {
      return salesDashboardPath;
    } else {
      return "/crm"; // senior leads
    }
  }
  
  return Permissions[role]?.INITIAL_ROUTE?.(id) ?? "";
};
