import React from 'react'; 
import { NextPage } from "next";
import Layout from "../../../components/layout";
import TimeSheetHeader from "../../../components/hcm/timesheet/time-sheet-header";
import { ProtectedComponent } from "../../../components/protectedComponent";
import { Role } from "../../../utils/roles";
import { useContext, useEffect, useState } from "react";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { sidebarMenuItems } from "../../../utils/constants";

interface Props {}

const Index: NextPage<Props> = ({}) => {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "HCM_TIMESHEETS", "EDIT"));
  }, [role]);

  const authorizedModules = useAuthorizedModules();
  const hasHCMAccess = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );
  return (
    <Layout>
      <div>
        {roleAccess && hasHCMAccess ? (
          <TimeSheetHeader />
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
