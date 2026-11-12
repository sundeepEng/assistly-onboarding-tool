import React, { useContext, useEffect, useState } from "react";
import useGetAll from "../../services/getAll";
import {
  GetUsersPath,
  homePath,
  milestones,
  REFERRAL_AGENT,
  userRoles,
} from "../../utils/constants";
import { RoleContext } from "../role-provider";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import Layout from "../layout";
import { TopBarMetrics } from "./top-bar-metrics";
import { ManagementCards } from "./management-cards";
import QuickActions from "./quick-actions";
import RecentActivity from "./recent-activity";
import Loader from "../../commonComponents/loader";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import RestrictedPage from "../../commonComponents/restricted";
import useGetById from "../../services/getById";
import _ from "lodash";



export default function Dashboard() {
  const loggedInUserHomeId = getHomeIdFromToken();
  

  // Configuration for all user types
  const userConfigs = [
    { key: "leads", userType: userRoles.LEAD },
    {
      key: "seniors",
      userType: userRoles.SENIOR,
      milestone: milestones.CONTRACT,
    },
    { key: "referrals", userType: userRoles.REFERRAL },
    { key: "PCGLeads", userType: userRoles.PCGLEAD },
    { key: "PCGs", userType: userRoles.PCG },
    { key: "nurseLeads", userType: userRoles.NURSELEAD },
    { key: "nurses", userType: userRoles.NURSE },
  ];

  // Define the type for user data
  type UserData = { users?: any[] };

  // Get all user data
  const usersData: Record<string, UserData> = userConfigs.reduce(
    (acc, config) => {
      const { key, ...queryParams } = config;
      acc[config.key] = useGetAll({
        key: config.key,
        path: GetUsersPath,
        params: { homeId: loggedInUserHomeId, ...queryParams },
      }).data as UserData;
      return acc;
    },
    {} as Record<string, UserData>,
  );

  const filteredUsersData = {
    ...usersData,
    leads: {
      ...usersData.leads,
      users: usersData.leads?.users?.filter(
        (user) => !user.isDeleted && !user.milestone?.includes(milestones.LOST),
      ),
    },
    seniors: {
      ...usersData.seniors,
      users: usersData.seniors?.users?.filter((user) => !user.isDeleted),
    },
    PCGs: {
      ...usersData.PCGs,
      users: usersData.PCGs?.users?.filter((user) => !user.isDeleted),
    },
    nurseLeads: {
      ...usersData.nurseLeads,
      users: usersData.nurseLeads?.users?.filter((user) => !user.isDeleted),
    },
    nurses: {
      ...usersData.nurses,
      users: usersData.nurses?.users?.filter((user) => !user.isDeleted),
    },
  };

  const isLoading = userConfigs.some((config) => !usersData[config.key]);

  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "DASHBOARD", "EDIT") ||
      hasAccess(role as Role, "DASHBOARD", "EDIT"),
    );
  }, [role]);

  const homeId = getHomeIdFromToken();
  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      id: homeId,
      path: homePath,
      enabled: !!homeId
    },
  });

  return (
    <Layout sidebar={false}>
      <div className="p-[20px] mq1024:!p-0 min-h-screen text-black">
        {isLoading ? (
          <Loader />
        ) : roleAccess ? (
          <div className="space-y-6">
         
            <div className="text-secondarymirage text-heading font-bold font-jakarta">
              {`Welcome to ${_.startCase(_.toLower(homeData?.home?.homeName))}`}
            </div>
            <TopBarMetrics usersData={filteredUsersData} />
            <div className="flex gap-4 justify-between flex-row ">
              <div className="flex flex-col w-4/5 mq1024:w-1/2">
                <ManagementCards />
                <RecentActivity usersData={filteredUsersData} />
              </div>

              <div className="flex">
                <QuickActions usersData={filteredUsersData} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </div>
    </Layout>
  );
}
