import React, { useEffect, useState, useContext } from "react";
import Layout from "../../../components/layout";
import { useRouter } from "next/router";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, userRoles } from "../../../utils/constants";
import Loader from "../../../commonComponents/loader";
import ComplinaceGuestHome from "../../../components/compliance/compliance-guest-home";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import { useDispatch } from "react-redux";
import { handleOpenAddGuestModal } from "../../../redux/slices/modal-slice";
import { RoleContext } from "../../../components/role-provider";
import useGetById from "../../../services/getById";
import { UserPath } from "../../../utils/constants";

const index = () => {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);
  const [complianceAccess, setComplianceAccess] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  const role = getUserRoleFromToken();
  const finalRole = (contextRole || role) as Role;
  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();

  // Fetch PCHO data to check isCompliancePartner
  const { data: pchoData, isLoading: pchoLoading } = useGetById({
    key: "compliance-pcho-data",
    payload: {
      id: userId,
      path: UserPath,
      enabled: finalRole === userRoles.PCHO,
    },
  });

  useEffect(() => {
    // If we're not a PCHO, we don't need to check compliance partner status
    if (finalRole !== userRoles.PCHO) {
      setIsCheckingAccess(false);
      return;
    }

    // If PCHO data is still loading, keep checking
    if (pchoLoading) {
      return;
    }

    // Check standard role access
    const hasRoleAccess = hasAccess(finalRole, "CRM_COMPLIANCE_HOME", "EDIT");

    // Check compliance access (only for PCHO)
    const isCompliancePartner =
      finalRole === userRoles.PCHO
        ? (pchoData?.isCompliancePartner ?? false)
        : false;

    setRoleAccess(hasRoleAccess);
    setComplianceAccess(isCompliancePartner);
    setIsCheckingAccess(false);

    if (!hasRoleAccess) {
      const route = getInitialRoute(finalRole, getUserIdFromToken());
      route && router.push(route);
    }
  }, [finalRole, router, pchoData, pchoLoading]);

  const { data, isLoading } = useGetAll({
    key: userRoles.COMPLIANCE_GUEST,
    params: {
      userType: "ComplianceGuest",
      homeId: homeId,
    },
    path: GetUsersPath,
  });
  const dispatch = useDispatch();

  return (
    <div>
      <Layout>
        {isLoading || isCheckingAccess ? (
          <Loader />
        ) : roleAccess && complianceAccess ? (
          <div className="px-[10px]">
            <div className="flex justify-between">
              <div className="">
                <div className="text-heading font-bold font-jakarta">
                  Compliance Guests
                </div>
                <div className="text-xs text-gray">
                  {data?.users?.length} Team members
                </div>
              </div>
              <div></div>
              <Button
                name={"Add New"}
                icon={<PlusIcon color="white" />}
                classname="!text-white w-[139px] h-[40px]"
                iconStart={true}
                buttonClick={() => {
                  dispatch(handleOpenAddGuestModal());
                }}
              />
            </div>
            <div className="py-[25px]">
              <ComplinaceGuestHome data={data} />
            </div>
          </div>
        ) : (
          // <div>
          //     <ComplinaceGuestHome data={data} />
          // </div>
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
};

export default index;
