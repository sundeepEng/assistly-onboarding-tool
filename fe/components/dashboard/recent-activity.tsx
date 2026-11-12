import React, { useContext, useEffect, useState } from "react";
import { Card, CardDescription } from "../../commonComponents/card";
import PendingContracts from "./pending-contracts";
import { ProtectedComponent } from "../protectedComponent";
import { RoleContext } from "../role-provider";
import { getUserRoleFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";

function RecentActivity({ usersData }: { usersData: any }) {
  // Role
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  return (
    <div>
      <ProtectedComponent
        role={role as Role}
        feature={"DASHBOARD_QUICK_ACTIONS"}
        access={"EDIT"}
      >
        <Card className="">
          <CardDescription>
            <div className="text-secondarymirage text-heading font-bold py-[19px]">
              Recent Activity
            </div>
            {/* <div className="">
              <PendingContracts usersData={usersData} />
            </div> */}
            <div className="">Coming Soon..</div>
          </CardDescription>
        </Card>
      </ProtectedComponent>
    </div>
  );
}

export default RecentActivity;
