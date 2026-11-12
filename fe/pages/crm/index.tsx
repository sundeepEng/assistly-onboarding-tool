import React from 'react';
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import Layout from "../../components/layout";
import LeadsTable from "../../components/leads-table";
import { RoleContext } from "../../components/role-provider";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import useGetById from "../../services/getById";
import Button from "../../commonComponents/button";
import PlusIcon from "../../public/icons/plus-icon";
import { handleOpenAddLeadModal } from "../../redux/slices/modal-slice";
import { setMilestoneFilter } from "../../redux/slices/leads-filter-slice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import useGetAll from "../../services/getAll";
import { GetUsersPath, UserPath, userRoles, milestones } from "../../utils/constants";
import RestrictedPage from '../../commonComponents/restricted';
import { ProtectedComponent } from '../../components/protectedComponent';
import LeadsHomePage from '../../components/leads-home-page';
import SelectComponent from '../../commonComponents/select-component';
// import PlusIcon from "../../public/icons/plus-icon";

export default function index() {
  const [roleAccess, setRoleAccess] = useState(false);
  const router = useRouter();
  const userRole = useContext(RoleContext)?.role || getUserRoleFromToken();
  const [toggle, setToggle] = useState(false)
  const milestoneFilter = useSelector((state: RootState) => state.leadsFilter.milestoneFilter);
  const [role, setRole] = useState<string | undefined>(userRole);
  // Read from cookie only on client

  const userId = getUserIdFromToken();
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_SENIOR_CAMPAIGN", "EDIT"));
    if (!hasAccess(role as Role, "CRM_SENIOR_CAMPAIGN", "EDIT")) {
      const route = getInitialRoute(role as Role, getUserIdFromToken());
      route && router.push(route);
    }
  }, [role, router]);

  const finalRole = getUserRoleFromToken() as Role;
  useEffect(() => {
    setRole(finalRole);
    if (hasAccess(finalRole as Role, "CRM_DASHBOARD", "EDIT")) {
    } else {
      const route = getInitialRoute(finalRole, userId);
      route && router.push(route);
    }
  }, [finalRole, router]);
  const dispatch = useDispatch()
  const homeId = getHomeIdFromToken();

  const isSalesRep = finalRole === userRoles.SALES_REPRESENTATIVE;
  const isSalesDirector = finalRole === userRoles.SALES_DIRECTOR;

  const { data: currentUserData } = useGetById({
    key: "currentUser",
    payload: {
      id: userId || "",
      path: UserPath,
      enabled: isSalesDirector && !!userId,
    },
  });

  const getIsReferredByUserId = (): string | string[] | undefined => {
    if (isSalesRep && userId) return userId;
    if (isSalesDirector && userId) {
      const associatedIds = (currentUserData as any)?.associatedUserIds || [];
      return [userId, ...associatedIds];
    }
    return undefined;
  };

  const { data, isLoading, error } = useGetAll({
    key: userRoles.LEAD,
    params: {
      userType: userRoles.LEAD,
      homeId: homeId,
      ...(getIsReferredByUserId() ? { isReferredByUserId: getIsReferredByUserId() } : {}),
    },
    path: GetUsersPath,
  });

  return (
    <div>
      <Layout>
        {roleAccess ? (
          <div className="px-[10px]">
            <div className="flex justify-between">
              <div className="">
                <div className="text-heading font-bold font-jakarta">Senior Leads</div>
                <div className="text-xs text-gray">
                  {(data?.users || []).filter(
                    (u: any) => !u?.milestone?.includes(milestones.LOST),
                  ).length}{" "}
                  Team members
                </div>
              </div>
              <div></div>
              <div className="flex items-center gap-3">
                <SelectComponent
                  name="milestoneFilter"
                  value={milestoneFilter}
                  onChange={(e) => dispatch(setMilestoneFilter(e.target.value))}
                  placeholder="Sort by Milestone"
                  className="!w-[180px]"
                  options={[
                    { option: "All", value: "" },
                    { option: "Initial Contact", value: milestones.INITIAL_CONTACT },
                    { option: "Home Tour", value: milestones.TOUR },
                    { option: "Onboarding", value: milestones.ON_BOARDING },
                    { option: "Contract", value: milestones.CONTRACT },
                  ]}
                />
                <Button name={"Add New"} icon={<PlusIcon color="white" />} classname="!text-white w-[139px] h-[40px]" iconStart={true} buttonClick={() => { dispatch(handleOpenAddLeadModal()) }} />
              </div>
            </div>
            {/* <div className="py-[25px]">
              <LeadsTable />
            </div> */}
            <LeadsHomePage toggle={toggle} setToggle={setToggle} milestoneFilter={milestoneFilter} />
          </div>
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
}
