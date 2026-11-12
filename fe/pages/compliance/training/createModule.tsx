"use client";

import type React from "react";
import Layout from "../../../components/layout";
import CreateTrainingModule from "../../../components/compliance/create-training-module";
import { useRouter } from "next/router";
import { RoleContext } from "../../../components/role-provider";
import { useContext, useEffect, useState } from "react";
import { Role } from "../../../utils/roles";
import { hasAccess } from "../../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { sidebarMenuItems } from "../../../utils/constants";

export default function CreateModulePage() {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);
  useEffect(() => {
    // Read from cookie only on client
    const cookieRole = getUserRoleFromToken();
    const userId = getUserIdFromToken();

    const finalRole = contextRole || cookieRole;

    if (hasAccess(finalRole as Role, "COMPLIANCE", "VIEW")) {
      setRoleAccess(true);
    } else {
      setRoleAccess(false);
      router.push("/crm");
    }
  }, [contextRole, router]);

  const authorizedModules = useAuthorizedModules();
  const hasComplianceAccess = authorizedModules.includes(
    sidebarMenuItems.COMPLIANCE.toUpperCase(),
  );

  return (
    <div>
      <Layout>
        {roleAccess && hasComplianceAccess ? (
          <CreateTrainingModule />
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
}
