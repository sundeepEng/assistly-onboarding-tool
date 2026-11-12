import React from 'react'; 
import { NextPage } from "next";
import Layout from "../../../components/layout";
import ScheduleBoard from "../../../components/hcm/schedule/schedule-board";
import { useContext, useEffect, useState } from "react";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { getUserRoleFromToken } from "../../../utils/auth";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { sidebarMenuItems } from "../../../utils/constants";
import RestrictedPage from "../../../commonComponents/restricted";

interface Props {}

const Index: NextPage<Props> = ({}) => {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "HCM_TIMESHEETS", "EDIT") &&
        hasAccess(role as Role, "HCM", "VIEW"),
    );
  }, [role]);

  const authorizedModules = useAuthorizedModules();
  const hasHCMAccess = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );

  return (
    <div>
      <Layout>
        {roleAccess && hasHCMAccess ? <ScheduleBoard /> : <RestrictedPage />}
      </Layout>
    </div>
  );
};

export default Index;
