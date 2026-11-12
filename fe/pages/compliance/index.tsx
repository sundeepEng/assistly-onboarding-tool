import React, { useContext, useEffect, useState } from "react";
import Layout from "../../components/layout";
import { useRouter } from "next/router";
import { RoleContext } from "../../components/role-provider";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import HomeDocuments from "../../components/compliance/home-documents";
import { getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import RestrictedPage from "../../commonComponents/restricted";
import { sidebarMenuItems, userRoles } from "../../utils/constants";
import { useAuthorizedModules } from "../../utils/useAuthorizedModules";

const Compliance = () => {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);

  const authorizedModules = useAuthorizedModules();
  const hasComplianceAccess = authorizedModules.includes(
    sidebarMenuItems.COMPLIANCE.toUpperCase(),
  );

  useEffect(() => {
    // Read from cookie only on client
    const cookieRole = getUserRoleFromToken();
    const userId = getUserIdFromToken();

    const finalRole = contextRole || cookieRole;

    if (hasAccess(finalRole as Role, "COMPLIANCE_DOCUMENTS", "EDIT")) {
      setRoleAccess(true);
      return;
    } else {
      setRoleAccess(false);
      if (
        finalRole === userRoles.PCGLEAD ||
        finalRole === userRoles.PCG ||
        finalRole === userRoles.COMPLIANCE_GUEST
      ) {
        router.push("/compliance/training");
        return;
      }
      router.push("/crm");
    }
  }, [contextRole, router]);
  return (
    <div>
      <Layout sidebar={true}>
        {roleAccess && hasComplianceAccess ? (
          <div className="px-4">
            <HomeDocuments />
          </div>
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
};

export default Compliance;
