import React from 'react';
import router from "next/router";
import { useContext, useEffect, useState } from "react";
import Layout from "../../../components/layout";
import NurseHomePage from "../../../components/nurse/nurse-home-page";
import { RoleContext } from "../../../components/role-provider";
import useGetAll from "../../../services/getAll";
import { CLINICAL, GetUsersPath, userRoles } from "../../../utils/constants";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";

// Clinical Nurses list page.
// Mirrors the clinical PCG list page.
const Index = () => {
  const homeId = getHomeIdFromToken();
  const [roleAccess, setRoleAccess] = useState(false);
  const [orderUserData, setOrderUserdata] = useState([]);

  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CLINICAL_NURSE", "EDIT"));
  }, [role]);

  const { data, isLoading } = useGetAll({
    key: userRoles.NURSE,
    params: {
      userType: userRoles.NURSE,
      homeId: homeId,
    },
    path: GetUsersPath,
  });
  if (
    !hasAccess(role as Role, "CLINICAL_NURSE_HOME", "EDIT") &&
    hasAccess(role as Role, "CLINICAL_NURSE", "EDIT")
  ) {
    router.push(`/clinical/nurse/${getUserIdFromToken()}`);
  }

  const userData = data?.users;

  useEffect(() => {
    const reorderedData = userData && [
      ...userData?.filter((item) => !item.isDeleted),
      ...userData?.filter((item) => item.isDeleted),
    ];
    setOrderUserdata(reorderedData);
  }, [data, userData]);

  const filteredData = userData?.filter((nurse) => !nurse?.isDeleted);

  const authorizedModules = useAuthorizedModules();
  const hasClinicalAccess = authorizedModules.includes(CLINICAL.toUpperCase());

  return (
    <div>
      <Layout>
        {isLoading ? (
          <Loader fullScreen={false} />
        ) : roleAccess && hasClinicalAccess ? (
          <div>
            <div>
              <div className="text-heading font-bold font-jakarta">Nurses</div>
              <div className="text-xs text-gray">
                {filteredData?.length} Team members
              </div>
            </div>
            <NurseHomePage data={orderUserData || userData} />
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
