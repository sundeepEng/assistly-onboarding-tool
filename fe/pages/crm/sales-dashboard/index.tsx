import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/layout";
import { RoleContext } from "../../../components/role-provider";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import { userRoles } from "../../../utils/constants";
import RestrictedPage from "../../../commonComponents/restricted";
import SalesRepsDashboard from "../salesdasboard/sales-reps-dasboard";
import SalesDirectorDashboard from "../salesdasboard/sales-director-dashboard";

/**
 * Sales Dashboard page
 * Renders SalesRepsDashboard for SalesRepresentative role,
 * and SalesDirectorDashboard for SalesDirector / PCHO / HomeAdmin.
 * Route: /crm/sales-dashboard
 */
const SalesDashboardPage = () => {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const finalRole = (contextRole || getUserRoleFromToken()) as Role;
  const userId = getUserIdFromToken();
  const [roleAccess, setRoleAccess] = useState(false);

  useEffect(() => {
    const allowed = hasAccess(finalRole, "CRM_SALES_DASHBOARD", "EDIT");
    setRoleAccess(allowed);
    if (!allowed) {
      const route = getInitialRoute(finalRole, userId);
      route && router.push(route);
    }
  }, [finalRole, router]);

  const isSalesRep = finalRole === userRoles.SALES_REPRESENTATIVE;

  return (
    <div>
      <Layout>
        {roleAccess ? (
          isSalesRep ? <SalesRepsDashboard /> : <SalesDirectorDashboard />
        ) : (
          <RestrictedPage />
        )}
      </Layout>
    </div>
  );
};

export default SalesDashboardPage;
