import React from "react";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import Layout from "../../../components/layout";
import SalesTeamHomePage from "../../../components/sales/sales-team-home-page";
import { RoleContext } from "../../../components/role-provider";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, userRoles } from "../../../utils/constants";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import { useDispatch } from "react-redux";
import { handleOpenAddSalesMemberModal } from "../../../redux/slices/modal-slice";

/**
 * Sales Team Index Page
 * Displays list of all sales team members (SalesRepresentative + SalesDirector)
 * Fetches data from the users API with userType filter
 * Follows same pattern as /crm/pcg page
 * Route: /hcm/sales-team
 */
const Index = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();

  // Check if user has permission to view sales team page
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "HCM_SALES_TEAM", "EDIT"));
  }, [role]);

  // Redirect if no access
  useEffect(() => {
    if (!hasAccess(role as Role, "HCM_SALES_TEAM", "EDIT")) {
      const route = getInitialRoute(role as Role, userId);
      route && router.push(route);
    }
  }, [role, router]);

  // Fetch Sales Representatives from the users API
  const { data: salesRepData, isLoading: isLoadingReps } = useGetAll({
    key: userRoles.SALES_REPRESENTATIVE,
    params: {
      userType: userRoles.SALES_REPRESENTATIVE,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  // Fetch Sales Directors from the users API
  const { data: salesDirData, isLoading: isLoadingDirs } = useGetAll({
    key: userRoles.SALES_DIRECTOR,
    params: {
      userType: userRoles.SALES_DIRECTOR,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  // Combine both Sales Representatives and Sales Directors into one list
  const isLoading = isLoadingReps || isLoadingDirs;
  const allSalesUsers = [
    ...(salesRepData?.users || []),
    ...(salesDirData?.users || []),
  ];

  return (
    <div>
      <Layout>
        {isLoading ? (
          <Loader />
        ) : roleAccess ? (
          <div>
            <div className="px-[10px]">
              {/* Header: Title + Add New Button */}
              <div className="flex justify-between">
                <div className="">
                  <div className="text-heading font-bold font-jakarta">
                    Sales Team
                  </div>
                  <div className="text-xs text-gray">
                    {allSalesUsers?.length || 0} Team members
                  </div>
                </div>
                <div></div>
                <Button
                  name={"Add New"}
                  icon={<PlusIcon color="white" />}
                  classname="!text-white w-[139px] h-[40px]"
                  iconStart={true}
                  buttonClick={() => {
                    dispatch(handleOpenAddSalesMemberModal());
                  }}
                />
              </div>

              {/* Sales Team Table - receives users array from API response */}
              <div className="py-[25px]">
                <SalesTeamHomePage data={allSalesUsers} />
              </div>
            </div>
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
