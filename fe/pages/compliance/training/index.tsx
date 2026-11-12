import React, { useContext, useEffect, useState } from "react";
import { ComplianceTraining } from "../../../components/compliance/compliance-training";
import Layout from "../../../components/layout";
import { Role } from "../../../utils/roles";
import { hasAccess } from "../../../utils/roleAccess";
import { RoleContext } from "../../../components/role-provider";
import { useRouter } from "next/router";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { sidebarMenuItems } from "../../../utils/constants";

const index = () => {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);
  useEffect(() => {
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
          <ComplianceTraining />
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
};

export default index;
