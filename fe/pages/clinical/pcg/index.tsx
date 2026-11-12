import React, { useContext, useEffect, useMemo, useState } from "react";
import router from "next/router";
import Layout from "../../../components/layout";
import PCGHomePage from "../../../components/pcg/pcg-home-page";
import { RoleContext } from "../../../components/role-provider";
import useGetAll from "../../../services/getAll";
import { CLINICAL, GetUsersPath, userRoles } from "../../../utils/constants";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";

const Index = () => {
  const homeId = getHomeIdFromToken();
  const [roleAccess, setRoleAccess] = useState(false);

  const role =
    useContext(RoleContext)?.role || getUserRoleFromToken();

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_PCG_HOME", "EDIT"));
  }, [role]);

  const { data, isLoading } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles.PCG,
      homeId,
    },
    path: GetUsersPath,
  });

  const {
    data: HomeAdmin,
    isLoading: isLoadingHomeAdmin,
  } = useGetAll({
    key: userRoles.HOME_ADMIN,
    params: {
      userType: userRoles.HOME_ADMIN,
      homeId,
    },
    path: GetUsersPath,
  });
  useEffect(() => {
    if (
      !hasAccess(
        role as Role,
        "CLINICAL_PCG_HOME",
        "EDIT",
      ) &&
      hasAccess(
        role as Role,
        "CLINICAL_PCG",
        "EDIT",
      )
    ) {
      router.push(
        `/clinical/pcg/${getUserIdFromToken()}`,
      );
    }
  }, [role]);

  const userData = useMemo(
    () => [
      ...(data?.users || []),
      ...(HomeAdmin?.users || []),
    ],
    [data?.users, HomeAdmin?.users],
  );

  const orderUserData = useMemo(
    () => [
      ...userData.filter(
        (item) => !item.isDeleted,
      ),
      ...userData.filter(
        (item) => item.isDeleted,
      ),
    ],
    [userData],
  );

  const filteredData = useMemo(
    () =>
      userData.filter(
        (user) => !user?.isDeleted,
      ),
    [userData],
  );

  const authorizedModules = useAuthorizedModules();
  const hasClinicalAccess = authorizedModules.includes(CLINICAL.toUpperCase());
  return (
    <div>
      <Layout>
        {isLoading || isLoadingHomeAdmin ? (
          <Loader fullScreen={false} />
        ) : roleAccess &&
          hasClinicalAccess ? (
          <div>
            <div>
              <div className="text-heading font-bold font-jakarta">
                Care Team
              </div>
              <div className="text-xs text-gray">
                {filteredData?.length} Team members
              </div>
            </div>
            <PCGHomePage
              data={orderUserData}
            />
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
