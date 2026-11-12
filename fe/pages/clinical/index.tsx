import React from 'react'; 
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import Toggle from "../../commonComponents/toggle";
import SeniorGrid from "../../components/clinical/homePage/senior-grid";
import SeniorsTable from "../../components/clinical/homePage/senior-table";
import Layout from "../../components/layout";
import { RoleContext } from "../../components/role-provider";
import useGetAll from "../../services/getAll";
import useGetById from "../../services/getById";
import useGetAllShifts from "../../services/hcm-getall-shifts";
import {
  CLINICAL,
  GetUsersPath,
  InHomeCare,
  SHIFT_STATUS_AVAILABLE,
  UserPath,
  milestones,
  userRoles,
} from "../../utils/constants";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import Loader from "../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import RestrictedPage from "../../commonComponents/restricted";
import { useAuthorizedModules } from "../../utils/useAuthorizedModules";
import { useGetHomeType } from "../../utils/gethomeType";
import { Senior } from "../../types/senior-types";

export default function index() {
  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [toggleState, setToggleState] = useState(false);
  const [roleAccess, setRoleAccess] = useState(false);
  const [orderUserData, setOrderUserdata] = useState([]);
  const homeId = getHomeIdFromToken();
  const currentUserId = getUserIdFromToken();

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;

  const [todayShiftRange] = useState(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return [start.toISOString(), end.toISOString()];
  });

  const { data: todayShiftsResp, isLoading: isLoadingTodayShifts } =
    useGetAllShifts({
      key: "pcg-today-shifts",
      params: {
        home_id: homeId,
        user_id: currentUserId,
        shift_status: SHIFT_STATUS_AVAILABLE,
        shift_start_time: todayShiftRange,
      },
    });

  useEffect(() => {
    // Read from cookie only on client
    const cookieRole = getUserRoleFromToken();
    const userId = getUserIdFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);

    if (finalRole === "Senior") {
      router.push(`/clinical/${userId}`);
    }
  }, [contextRole, router]);
  const { data } = useGetAll({
    key: "user",
    params: {
      userType: userRoles?.SENIOR,
      homeId: homeId,
      milestone: milestones?.CONTRACT,
    },
    path: GetUsersPath,
  });

  const { data: loggedInNurseData } = useGetById({
    key: "user",
    payload: {
      id: currentUserId,
      path: UserPath,
      enabled: role === userRoles.NURSE && !!currentUserId,
    },
  });

  const authorizedModules = useAuthorizedModules();
  const hasClinicalAccess = authorizedModules.includes(CLINICAL.toUpperCase());

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CLINICAL_DASHBOARD", "EDIT"));
  }, [role]);
  if (role === userRoles.COMPLIANCE_GUEST) {
    router.push("/compliance/training");
    return;
  }
  const userData = data?.users;
  const isInhomeCarePCGUser = role === userRoles.PCG && isInHomeCare;
  const isNurseUser = role === userRoles.NURSE;

  // Get today's shifts for PCG users in home care
  const todaysShifts = isInhomeCarePCGUser ? todayShiftsResp?.shifts || [] : [];

  useEffect(() => {
    const reorderedData = userData && [
      ...userData?.filter((item) => !item.isDeleted), // keep all non-deleted first
      ...userData?.filter((item) => item.isDeleted), // then all deleted ones
    ];
    setOrderUserdata(reorderedData);
  }, [data, userData]);

  // Get assigned senior IDs for PCG users in home care
  const assignedSeniorIds = new Set<string>(
    isInhomeCarePCGUser
      ? (todaysShifts || [])
          .map((shift: any) => shift?.assigned_to_user_id)
          .filter((id: any) => typeof id === "string" && id.length > 0)
      : [],
  );

  const nurseAssignedSeniorIds = new Set<string>(
    isNurseUser
      ? ((loggedInNurseData as any)?.associatedUserIds || [])
          .map((x: any) => x?.userId || x?.id || (typeof x === "string" ? x : null))
          .filter((id: any) => typeof id === "string" && id.length > 0)
      : [],
  );

  const baseSeniors: any[] =
    (orderUserData && orderUserData.length > 0 ? orderUserData : userData) ||
    [];

  // Filter seniors based on assigned shifts
  const visibleSeniors: any[] = isInhomeCarePCGUser
    ? assignedSeniorIds.size > 0
      ? baseSeniors.filter((senior: any) => {
          const id = senior?.userId || senior?.id || senior?._id;
          return id && assignedSeniorIds.has(String(id));
        })
      : []
    : isNurseUser
      ? nurseAssignedSeniorIds.size > 0
        ? baseSeniors.filter((senior: any) => {
            const id = senior?.userId || senior?.id || senior?._id;
            return id && nurseAssignedSeniorIds.has(String(id));
          })
        : []
      : baseSeniors;

  // Custom message for PCG users in home care with no shifts
  const customEmptyMessage =
    isInhomeCarePCGUser && assignedSeniorIds.size === 0
      ? "No shifts assigned to you today"
      : isNurseUser && nurseAssignedSeniorIds.size === 0
        ? "No seniors assigned to you"
      : "Nothing added yet.";

  const filteredData = visibleSeniors?.filter((senior: Senior) => !senior?.isDeleted);

  return (
    <div>
      <Layout>
        {!data ? (
          <Loader />
        ) : roleAccess && hasClinicalAccess ? (
          <div className="px-[10px]">
            <div className="flex justify-between">
              <div className="">
                <div className="text-heading font-bold font-jakarta">
                  Seniors
                </div>
                <div className="text-xs text-gray">
                  {filteredData?.length || 0} members
                </div>
              </div>
              <div className="flex justify-end">
                <Toggle
                    toggelState={toggleState}
                    setToggleState={setToggleState}/>
              </div>
            </div>
            <div className="py-[25px]">
              <div className="bg-transparent">
                {data && toggleState ? (
                  <SeniorsTable
                    data={visibleSeniors}
                    customEmptyMessage={customEmptyMessage}
                  />
                ) : (
                  <div className="">
                    <SeniorGrid
                      data={visibleSeniors}
                      customEmptyMessage={customEmptyMessage}
                    />
                  </div>
                )}
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
}
