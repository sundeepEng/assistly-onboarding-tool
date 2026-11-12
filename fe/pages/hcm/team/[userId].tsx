import React from "react";
import { useRouter } from "next/router";
import TeamDetailView from "../../../components/hcm/team";
import Layout from "../../../components/layout";
import useGetById from "../../../services/getById";
import { sidebarMenuItems, UserPath } from "../../../utils/constants";
import Avatar from "../../../commonComponents/avatar";
import { useContext, useEffect, useState } from "react";
import { RoleContext } from "../../../components/role-provider";
import { Role } from "../../../utils/roles";
import { hasAccess } from "../../../utils/roleAccess";
import { getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";

const ViewTeamMember = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { data } = useGetById({
    key: "team member",
    payload: { id: userId as string, path: UserPath, enabled: !!userId },
  });
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "HCM_TEAM_DETAILED_VIEW", ["VIEW", "EDIT"]),
    );
  }, [role]);

  const authorizedModules = useAuthorizedModules();
  const hasHCMAccess = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );
  return (
    <Layout>
      {roleAccess && hasHCMAccess ? (
        <div className="p-[40px]">
          <div
            className="flex gap-6 items-center font-jakarta pl-[40px] py-[20px]
          "
          >
            <Avatar src={data?.profileImageUrl} name={data?.name} size={120} />
            <div className="p-[20px]">
              <div className="text-[30px] font-medium">{data?.name}</div>
              <div className="flex-row">
                <div className="text-[18px] font-normal">
                  {data?.mobile || "-"}
                </div>
                <div className="text-[18px] font-normal">
                  {data?.email || "-"}
                </div>
              </div>
            </div>
          </div>
          <div>
            <TeamDetailView />
          </div>
        </div>
      ) : (
        <div>
          <RestrictedPage />
        </div>
      )}
    </Layout>
  );
};

export default ViewTeamMember;
