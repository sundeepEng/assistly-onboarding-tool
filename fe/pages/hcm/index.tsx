import React from 'react'; 
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import EmployeeDashboard from "../../components/hcm/dashboard/employee-dashboard";
import EmployerDashboard from "../../components/hcm/dashboard/employer-dashboard";
import Layout from "../../components/layout";
import { ProtectedComponent } from "../../components/protectedComponent";
import { Role } from "../../utils/roles";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import {
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import RestrictedPage from "../../commonComponents/restricted";
import {
  sidebarMenuItems,
} from "../../utils/constants";
import { useAuthorizedModules } from "../../utils/useAuthorizedModules";

interface Props {}

const Index: NextPage<Props> = ({}) => {
  const router = useRouter();
  const [roleAccess, setRoleAccess] = useState(false);
  const cookieRole = getUserRoleFromToken();
  const userId = getUserIdFromToken();

  const authorizedModules = useAuthorizedModules();
  const hasHCMAccess = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );

  useEffect(() => {
     if (!cookieRole || !userId) {
      router.replace("/login");
      return;
    }
    if (
      !hasAccess(cookieRole as Role, "HCM_EMPLOYER_DASHBOARD", "EDIT") &&
      !hasAccess(cookieRole as Role, "HCM_EMPLOYEE_DASHBOARD", "EDIT")
    ) {
      router.push(getInitialRoute(cookieRole as Role, userId));
    }
    setRoleAccess(
      hasAccess(cookieRole as Role, "HCM_EMPLOYER_DASHBOARD", "EDIT") ||
        hasAccess(cookieRole as Role, "HCM_EMPLOYEE_DASHBOARD", "EDIT"),
    );
  }, [cookieRole, router]);

  return (
    <div>
      <Layout>
        {roleAccess && hasHCMAccess ? (
          <div>
            <ProtectedComponent
              role={cookieRole as Role}
              feature={"HCM_EMPLOYER_DASHBOARD"}
              access={"EDIT"}
            >
              <EmployerDashboard />
            </ProtectedComponent>
            <ProtectedComponent
              role={cookieRole as Role}
              feature={"HCM_EMPLOYEE_DASHBOARD"}
              access={"EDIT"}
            >
              <EmployeeDashboard />
            </ProtectedComponent>
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

export default Index;
