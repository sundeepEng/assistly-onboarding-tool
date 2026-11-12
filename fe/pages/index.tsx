import React from 'react'; 
import type { NextPage } from "next";
import Dashboard from "../components/dashboard/dashboard";
import Layout from "../components/layout";
import { getInitialRoute, hasAccess } from "../utils/roleAccess";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import { RoleContext } from "../components/role-provider";
import { Role } from "../utils/roles";
import { getUserIdFromToken, getUserRoleFromToken } from "../utils/auth";
import RestrictedPage from "../commonComponents/restricted";
export type RootType = {
  className?: string;
};
const Root: NextPage<RootType> = () => {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);
    // Read from cookie only on client
    const cookieRole = getUserRoleFromToken();
    const finalRole = (contextRole || cookieRole)as Role;
  useEffect(() => {
    const userId = getUserIdFromToken();
    if (hasAccess(finalRole as Role, "DASHBOARD", "EDIT")) {
      setRoleAccess(true);
    } else {
      setRoleAccess(false);
      finalRole&&router.push(getInitialRoute(finalRole,userId));
    }
  }, [finalRole, router]);
  return (
    <div>
      {roleAccess ? (
        <div>
          <Dashboard />
        </div>
      ) : (
        <Layout>
          <div><RestrictedPage/></div>
        </Layout>
      )}
    </div>
  );
};

export default Root;
