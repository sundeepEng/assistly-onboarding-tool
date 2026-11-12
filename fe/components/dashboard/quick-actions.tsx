import React, { useContext, useEffect, useState, useMemo } from "react";
import { Card, CardDescription } from "../../commonComponents/card";
import {
  accessAllModules,
  CARE_LEAD,
  CARE_TEAM,
  CLINICAL,
  documentRequiredForPCG,
  documentRequiredForSenior,
  HOMEDOCUMENTS,
  homePath,
  InHomeCare,
  InHomeCareDocuments,
  leadActiveTabConstants,
  PCHODOCUMENTS,
  SHIFT_STATUS_AVAILABLE,
  SHIFT_STATUS_TIMEOFF,
  sidebarMenuItems,
  UserPath,
  userRoles,
} from "../../utils/constants";
import { useGetHomeType } from "../../utils/gethomeType";
import useGetAllShifts from "../../services/hcm-getall-shifts";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import Button from "../../commonComponents/button";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
import { useRouter } from "next/router";
import { useAppDispatch } from "../../redux/hooks";
import { setScheduleDate } from "../../redux/slices/schedule-date-slice";
import { processMissingSchedulesByDay } from "../hcm/utils/timeUtils";
import { RoleContext } from "../role-provider";
import { ProtectedComponent } from "../protectedComponent";
import { Role } from "../../utils/roles";

import AccordainComponent from "../../commonComponents/accordian-component";

import {
  handleSetLeadActiveTab,
  handleSetProfileActiveTab,
} from "../../redux/slices/tab-slice";
import {
  getPcgByUserId,
  processExpiringDocuments,
  summarizeDocsBrief,
  summarizePCHORequiredDocs,
  summarizeUsersExpiringDocs,
  summarizeUsersRequiredDocs,
  calculatePendingDocsForUser,
} from "../../utils/dashboardUtils";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import useGetById from "../../services/getById";
import { handleOpenProfileModal } from "../../redux/slices/modal-slice";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import Loader from "../../commonComponents/loader";
import WarningIcon from "../../public/icons/warning-icon";

dayjs.extend(isSameOrAfter);

function QuickActions({ usersData }: { usersData: any }) {
  // --- Declare all variables only once ---
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [leadPendingDocuments, setLeadPendingDocuments] = useState<any[]>([]);
  const [seniorPendingDocuments, setSeniorPendingDocuments] = useState<any[]>([]);
  const [pcgLeadPendingDocuments, setPcgLeadPendingDocuments] = useState<any[]>([]);
  const [pcgPendingDocuments, setPcgPendingDocuments] = useState<any[]>([]);

  const today = new Date();

  // get NEXT week
  const nextWeekStart = startOfWeek(addDays(today, 7), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addDays(today, 7), { weekStartsOn: 1 });
  const nextWeekStartISO = nextWeekStart.toISOString();
  const nextWeekEndISO = nextWeekEnd.toISOString();

  const loggedInUserHomeId = getHomeIdFromToken();
  const loggedInUserId = getUserIdFromToken();
  const PCGids = usersData?.PCGs?.users?.map((user: any) => user.userId) || [];

  const { data: timeOffShifts = [] } = useGetAllShifts({
    key: "shifts",
    params: {
      home_id: loggedInUserHomeId,
      shift_status: SHIFT_STATUS_TIMEOFF,
      user_id: PCGids,
    },
  });

  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: loggedInUserHomeId, path: homePath, enabled: !!loggedInUserHomeId },
  });
  const authorizedModules =
    HomeData?.home?.authorizedModules || accessAllModules;

  const hasStaffManagement = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );

  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  const hasComplianceAccess = authorizedModules.includes(
    sidebarMenuItems.COMPLIANCE.toUpperCase(),
  );
  const { expiredDocs: homeExpiredDocs, expiringDocs: homeExpiringDocs } =
    processExpiringDocuments(HomeData?.home?.documents, HOMEDOCUMENTS);

  const { data: PchoData } = useGetById({
    key: "user",
    payload: { id: loggedInUserId, path: UserPath, enabled: !!loggedInUserId },
  });

  const { expiredDocs: pchoExpiredDocs, expiringDocs: pchoExpiringDocs } =
    processExpiringDocuments(PchoData?.documents, PCHODOCUMENTS);

  // PCG (Care Team) expired / expiring documents
  const pcgExpiredExpiringDocs = summarizeUsersExpiringDocs(
    usersData?.PCGs?.users,
    documentRequiredForPCG,
  );

  // If you also want PCG Leads separately:
  const pcgLeadExpiredExpiringDocs = summarizeUsersExpiringDocs(
    usersData?.PCGLeads?.users,
    documentRequiredForPCG,
  );

  // Get AVAILABLE shifts for next week using the exact Mon 00:00:00 → Sun 23:59:59 range
  const { data: userShifts } = useGetAllShifts({
    key: "shifts",
    params: {
      home_id: loggedInUserHomeId,
      shift_start_time: [nextWeekStartISO, nextWeekEndISO],
      shift_status: SHIFT_STATUS_AVAILABLE,
    },
  });

  const loadingMissingSchedules = !userShifts?.shifts;
  const loadingTimeOffRequests = !timeOffShifts?.shifts;

  const { missingDates, missingByDate, weeklyMissingDisplay } =
    userShifts?.shifts && Array.isArray(userShifts.shifts)
      ? processMissingSchedulesByDay(nextWeekStartISO, userShifts.shifts)
      : { missingDates: [], missingByDate: [], weeklyMissingDisplay: "0m" };

  const startOfToday = dayjs().startOf("day");
  const upcomingTimeOffShifts = timeOffShifts?.shifts?.filter((shift: any) => {
    const shiftStart = dayjs(shift.shift_start_time);
    return (
      shiftStart.isSameOrAfter(startOfToday) &&
      shift.is_unavailability_approved === null
    );
  });

  const [expanded, setExpanded] = useState<string | false>(false);
  const handleAccordionChange = (panel: string) => {
    setExpanded(expanded === panel ? false : panel);
  };

  const cookiesUserId = getUserIdFromToken();

  const particularPcgData = getPcgByUserId(usersData, cookiesUserId);

  // Role
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole, router]);

  //HOME DOCUMENTS
  const homeType = useGetHomeType()
  const isInhomeCare = homeType === InHomeCare;

  const homeDocumentsToUse = isInhomeCare ? InHomeCareDocuments : HOMEDOCUMENTS;
  const homeDocumentsTitle = isInhomeCare
  ? "Business Documents"
  : "Home Documents";

  const HomePendingDocuments = summarizeDocsBrief(
    HomeData?.home?.documents,
    homeDocumentsToUse,
  );

  //PCHO DOCUMENTS
  const PchoDocuments = summarizePCHORequiredDocs(
    PchoData?.documents,
    PCHODOCUMENTS,
  );

  // Memoize filtered data to prevent infinite re-renders
  const activeSeniorsData = useMemo(() =>
    usersData?.seniors?.users?.filter((senior: any) => !senior.isDeleted),
    [usersData?.seniors?.users]
  );

  const activePcgData = useMemo(() =>
    usersData?.PCGs?.users?.filter((pcg: any) => !pcg.isDeleted),
    [usersData?.PCGs?.users]
  );

  //LEADS & SENIORS
  useEffect(() => {
    const loadLeadsPendingDocuments = async () => {
      try {
        const users = Array.isArray(usersData?.leads?.users)
          ? usersData?.leads?.users
          : [];
        const required = Array.isArray(documentRequiredForSenior)
          ? documentRequiredForSenior
          : [];

        const results = await Promise.all(
          users.map((u: any) => calculatePendingDocsForUser(u, required))
        );

        const incomplete = results
          .filter((r) => !r.isComplete)
          .sort((a, b) => b.missingCount - a.missingCount);

        setLeadPendingDocuments(incomplete);
      } catch (e) {
        console.error("Failed to calculate lead pending documents", e);
        setLeadPendingDocuments([]);
      }
    };

    loadLeadsPendingDocuments();
  }, [usersData?.leads?.users, documentRequiredForSenior]);

  useEffect(() => {
    const loadSeniorsPendingDocuments = async () => {
      try {
        const users = Array.isArray(activeSeniorsData)
          ? activeSeniorsData
          : [];
        const required = Array.isArray(documentRequiredForSenior)
          ? documentRequiredForSenior
          : [];

        const results = await Promise.all(
          users.map((u: any) => calculatePendingDocsForUser(u, required))
        );

        const incomplete = results
          .filter((r) => !r.isComplete)
          .sort((a, b) => b.missingCount - a.missingCount);

        setSeniorPendingDocuments(incomplete);
      } catch (e) {
        console.error("Failed to calculate senior pending documents", e);
        setSeniorPendingDocuments([]);
      }
    };

    loadSeniorsPendingDocuments();
  }, [activeSeniorsData, documentRequiredForSenior]);

  useEffect(() => {
    const loadPcgLeadPendingDocuments = async () => {
      try {
        const users = Array.isArray(usersData?.PCGLeads?.users)
          ? usersData?.PCGLeads?.users
          : [];
        const required = Array.isArray(documentRequiredForPCG)
          ? documentRequiredForPCG
          : [];

        const results = await Promise.all(
          users.map((u: any) => calculatePendingDocsForUser(u, required))
        );

        const incomplete = results
          .filter((r) => !r.isComplete)
          .sort((a, b) => b.missingCount - a.missingCount);

        setPcgLeadPendingDocuments(incomplete);
      } catch (e) {
        console.error("Failed to calculate care lead pending documents", e);
        setPcgLeadPendingDocuments([]);
      }
    };

    loadPcgLeadPendingDocuments();
  }, [usersData?.PCGLeads?.users, documentRequiredForPCG]);

  useEffect(() => {
    const loadPcgPendingDocuments = async () => {
      try {
        const users = Array.isArray(activePcgData)
          ? activePcgData
          : [];
        const required = Array.isArray(documentRequiredForPCG)
          ? documentRequiredForPCG
          : [];

        const results = await Promise.all(
          users.map((u: any) => calculatePendingDocsForUser(u, required))
        );

        const incomplete = results
          .filter((r) => !r.isComplete)
          .sort((a, b) => b.missingCount - a.missingCount);

        setPcgPendingDocuments(incomplete);
      } catch (e) {
        console.error("Failed to calculate care team pending documents", e);
        setPcgPendingDocuments([]);
      }
    };

    loadPcgPendingDocuments();
  }, [activePcgData, documentRequiredForPCG]);

  //PCG Documents
  const pcgData = summarizeUsersRequiredDocs(
    particularPcgData,
    documentRequiredForPCG,
  );
  const showHomePending =
    hasComplianceAccess &&
    !HomePendingDocuments?.isComplete;

  const showMyPending =
    !PchoDocuments?.isComplete;

  // These are for future use.
  // We'll leave them here but won't use them yet.
  const showLeadPending =
    leadPendingDocuments.length > 0;

  const showSeniorPending =
    seniorPendingDocuments.length > 0;

  const showCareLeadPending =
    pcgLeadPendingDocuments.length > 0;

  const showCareTeamPending =
    pcgPendingDocuments.length > 0;

  const hasPendingDocuments =
    showHomePending ||
    showMyPending;

  const hasExpiredDocuments =
    (hasComplianceAccess &&
      (homeExpiredDocs.length > 0 ||
        homeExpiringDocs.length > 0)) ||

    pchoExpiredDocs.length > 0 ||
    pchoExpiringDocs.length > 0 ||

    pcgLeadExpiredExpiringDocs.length > 0 ||

    (hasClinical &&
      pcgExpiredExpiringDocs.length > 0);

  const hasQuickActions =
    loadingTimeOffRequests ||
    loadingMissingSchedules ||
    hasPendingDocuments ||
    hasExpiredDocuments ||
    (pcgData?.length ?? 0) > 0 ||
    upcomingTimeOffShifts?.length > 0 ||
    missingDates?.length > 0 ||
    role === userRoles.PCG;

  if (!hasQuickActions) {
    return null;
  }

  return (


    <div className="!font-jakarta w-[334px]">


      <Card className="">
        <CardDescription className="">
          <h3 className="text-heading font-semibold">Quick Actions</h3>
          <div className=" ">
            {/* Pending Documents */}
            {hasPendingDocuments && (
              <div className="w-full mb-[20px] bg-[white] rounded-[10px]">
                <ProtectedComponent
                  role={role as Role}
                  feature={"DASHBOARD_QUICK_ACTIONS"}
                  access={"EDIT"}
                >
                  <Card className="">
                    <CardDescription>
                      <div className="flex bg-[#FAD1C0] rounded-tl-lg rounded-tr-lg px-[10px] py-[15px]">
                        <div className="text-secondarymirage text-lg font-semibold ">
                          Pending Documents
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {/* Home Documents Section */}
                        {hasComplianceAccess &&
                          !HomePendingDocuments?.isComplete && (
                            <div className="">
                              <AccordainComponent
                                header={
                                  <div className="flex gap-2 items-center">
                                    <WarningIcon
                                      fill="red"
                                      height={30}
                                      width={30}
                                    />
                                    <p className="m-0">{ isInhomeCare ? "Business Documents" : "Home Documents" }</p>
                                  </div>
                                }
                                headerClass={`!font-[500] !text-[14px] font-jakarta ${expanded === "home" ? "!text-primary" : ""
                                  }`}
                                className=" !shadow-none border-b border-secondarylightgrayish border-solid"
                                isOpen={expanded === "home"}
                                onClick={() => handleAccordionChange("home")}
                              >
                                <div
                                  className="flex justify-between items-center h-full gap-0 text-[12px] text-red-600 underline cursor-pointer"
                                  onClick={() => {
                                    router.push(`/compliance`);
                                  }}
                                >
                                  Missing Documents ({HomePendingDocuments?.label}
                                  )
                                </div>
                              </AccordainComponent>
                            </div>
                          )}

                        {/* PCHO Documents Section */}
                        {!PchoDocuments?.isComplete && (
                          <div className="">
                            <AccordainComponent
                              header={
                                <div className="flex gap-2 items-center">
                                  <WarningIcon
                                    fill="red"
                                    height={30}
                                    width={30}
                                  />
                                  <p className="m-0">My Documents</p>
                                </div>
                              }
                              headerClass={`!font-[500] !text-[14px] font-jakarta ${expanded === "pcgLead" ? "!text-primary" : ""
                                }`}
                              className=" !shadow-none border-b border-secondarylightgrayish border-solid"
                              isOpen={expanded === "pcgLead"}
                              onClick={() => handleAccordionChange("pcgLead")}
                            >
                              <div
                                className="flex justify-between items-center h-full gap-0 text-[12px] text-red-600 underline cursor-pointer"
                                onClick={() => {
                                  dispatch(handleOpenProfileModal());
                                  dispatch(
                                    handleSetProfileActiveTab("Documents"),
                                  );
                                }}
                              >
                                Missing Documents ({PchoDocuments?.label})
                              </div>
                            </AccordainComponent>
                          </div>
                        )}

                        {/* Lead/Senior Documents Section */}
                        {/* {(leadPendingDocuments?.length != 0 ||
                        seniorPendingDocuments?.length != 0) && (
                        <div className="">
                          <AccordainComponent
                            header={
                              <div className="flex gap-2 items-center">
                                <WarningIcon
                                  fill="red"
                                  height={30}
                                  width={30}
                                />
                                <p className="m-0">
                                  {hasClinical
                                    ? "Senior Lead/Senior Documents"
                                    : "Senior Leads"}
                                </p>
                              </div>
                            }
                            headerClass={`!font-[500] !text-[14px] font-jakarta ${
                              expanded === "leadSenior" ? "!text-primary" : ""
                            }`}
                            className="!shadow-none border-b border-secondarylightgrayish border-solid"
                            isOpen={expanded === "leadSenior"}
                            onClick={() => handleAccordionChange("leadSenior")}
                          >
                            <div>
                              {leadPendingDocuments?.length != 0 && (
                                <div>
                                  <div className="font-jakarta text-[12px] font-[600]">
                                    Senior Leads
                                  </div>
                                  {leadPendingDocuments?.map(
                                    ({ userId, fullName, missingCount, completed, total }, idx) => (
                                      <div
                                        key={userId ?? idx}
                                        className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish ${
                                          idx ===
                                            leadPendingDocuments?.length - 1 &&
                                          "border-none"
                                        }`}
                                      >
                                        <div
                                          className="text-[12px] text-red-600 underline cursor-pointer"
                                          onClick={() => {
                                            dispatch(
                                              handleSetLeadActiveTab(
                                                leadActiveTabConstants.ACTIONS_TAB,
                                              ),
                                            );
                                            userId &&
                                              router.push(
                                                `/crm/${encodeURIComponent(
                                                  userId,
                                                )}`,
                                              );
                                          }}
                                        >{`${
                                          fullName || "Unnamed"
                                        } - ${Number(completed) || 0}/${Number(total) || 0}`}</div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                              {seniorPendingDocuments?.length != 0 &&
                                hasClinical && (
                                  <div>
                                    <div className="font-jakarta text-[12px] font-[600]">
                                      Seniors
                                    </div>
                                    {seniorPendingDocuments?.map(
                                      ({ userId, fullName, label }, idx) => (
                                        <div
                                          key={userId ?? idx}
                                          className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish  ${
                                            idx ===
                                              seniorPendingDocuments?.length -
                                                1 && "border-none"
                                          }`}
                                        >
                                          <div
                                            className="text-[12px] text-red-600 underline cursor-pointer"
                                            onClick={() => {
                                              dispatch(
                                                handleSetLeadActiveTab(
                                                  leadActiveTabConstants.ACTIONS_TAB,
                                                ),
                                              );
                                              userId &&
                                                router.push(
                                                  `/crm/${encodeURIComponent(
                                                    userId,
                                                  )}`,
                                                );
                                            }}
                                          >{`${
                                            fullName || "Unnamed"
                                          } - ${label}`}</div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          </AccordainComponent>
                        </div>
                      )} */}

                        {/* PCG Documents Section */}
                        {/* {(pcgLeadPendingDocuments?.length != 0 ||
                        pcgPendingDocuments?.length != 0) && (
                        <div className="">
                          <AccordainComponent
                            header={
                              <div className="flex gap-2 items-center">
                                <WarningIcon
                                  fill="red"
                                  height={30}
                                  width={30}
                                />
                                <p className="m-0">
                                  {hasClinical
                                    ? "Care Lead/Care Team Documents"
                                    : "Care Leads"}
                                </p>
                              </div>
                            }
                            headerClass={`!font-[500] !text-[14px] font-jakarta ${
                              expanded === "pcg" ? "!text-primary" : ""
                            }`}
                            className=" !shadow-none border-b border-secondarylightgrayish border-solid"
                            isOpen={expanded === "pcg"}
                            onClick={() => handleAccordionChange("pcg")}
                          >
                            <div>
                              {pcgLeadPendingDocuments?.length != 0 && (
                                <div>
                                  <div className="font-jakarta text-[12px] font-[600]">
                                    {CARE_LEAD}
                                  </div>
                                  {pcgLeadPendingDocuments?.map(
                                    ({ userId, fullName, label }, idx) => (
                                      <div
                                        key={userId ?? idx}
                                        className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish  ${
                                          idx ===
                                            pcgLeadPendingDocuments?.length -
                                              1 && "border-none"
                                        }`}
                                      >
                                        <div
                                          className="text-[12px] text-red-600 cursor-pointer underline"
                                          onClick={() => {
                                            userId &&
                                              router.push({
                                                pathname: `/crm/pcg/${encodeURIComponent(
                                                  userId,
                                                )}`,
                                              });
                                          }}
                                        >{`${
                                          fullName || "Unnamed"
                                        } - ${label}`}</div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                              {pcgPendingDocuments?.length != 0 &&
                                hasClinical && (
                                  <div>
                                    <div className="font-jakarta text-[12px] font-[600]">
                                      {CARE_TEAM}
                                    </div>
                                    {pcgPendingDocuments?.map(
                                      ({ userId, fullName, label }, idx) => (
                                        <div
                                          key={userId ?? idx}
                                          className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish  ${
                                            idx ===
                                              pcgPendingDocuments?.length - 1 &&
                                            "border-none"
                                          }`}
                                        >
                                          <div
                                            className="text-[12px] text-red-600 cursor-pointer underline"
                                            onClick={() => {
                                              userId &&
                                                router.push({
                                                  pathname: `/clinical/pcg/${encodeURIComponent(
                                                    userId,
                                                  )}`,
                                                });
                                            }}
                                          >{`${
                                            fullName || "Unnamed"
                                          } - ${label}`}</div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          </AccordainComponent>
                        </div>
                      )} */}
                      </div>
                    </CardDescription>
                  </Card>

                </ProtectedComponent>
              </div>
            )}

            {/* PCG Pending Documents */}

            <ProtectedComponent
              role={role as Role}
              feature={"PCG_QUICK_ACTIONS"}
              access={"EDIT"}
            >
              {!pcgData ? (
                <div className="w-full mb-[20px]">
                  <Card className="mt-[20px] p-6 bg-white shadow-md">
                    <CardDescription>
                      <div className="flex justify-center items-center h-full gap-0">
                        <div className="text-gray-400 animate-pulse">
                          Loading pending documents...
                        </div>
                      </div>
                    </CardDescription>
                  </Card>
                </div>
              ) : (
                pcgData?.length != 0 && (
                  <Card className="mt-[20px] p-6 bg-white shadow-md">
                    <div className="flex flex-row ">
                      {pcgData?.map(({ userId, label }, idx) => (
                        <div
                          key={userId ?? idx}
                          className="flex flex-row items-center justify-between w-full"
                        >
                          <div className="text-red-500 flex">
                            Pending Documents! ({`${label}`})
                          </div>
                          <div className="flex-shrink-0">
                            <Button
                              name="+ Add"
                              buttonClick={() =>
                                userId &&
                                router.push({
                                  pathname: `/clinical/pcg/${encodeURIComponent(
                                    userId,
                                  )}`,
                                })
                              }
                              classname="!bg-secondarylightgrayishblue !border-none mt-auto !h-[22px] !w-[56px] !p-0 !rounded-[3px]"
                              titleClass="!text-[10px] !font-jakarta !text-primary !font-[400]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              )}
            </ProtectedComponent>

            {/* Expired / Expiring Documents */}
            {hasExpiredDocuments && (
              <div className="w-full mb-[20px] bg-[white] rounded-[10px]">
                <ProtectedComponent
                  role={role as Role}
                  feature={"DASHBOARD_QUICK_ACTIONS"}
                  access={"EDIT"}
                >
                  <Card className="">
                    <CardDescription>
                      <div className="flex bg-[#FAD1C0] rounded-tl-lg rounded-tr-lg px-[10px] py-[15px]">
                        <div className="text-secondarymirage text-lg font-semibold ">
                          Expired / Expiring Documents
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {/* Home Documents Section */}
                        {hasComplianceAccess &&
                          (homeExpiredDocs?.length > 0 ||
                            homeExpiringDocs?.length > 0) && (
                            <div className="">
                              <AccordainComponent
                                header={
                                  <div className="flex items-center gap-2">
                                    <WarningIcon
                                      fill="red"
                                      height={30}
                                      width={30}
                                    />
                                    <p className="m-0">{ isInhomeCare ? "Business Documents" : "Home Documents" }</p>
                                  </div>
                                }
                                headerClass={`!font-[500] !text-[14px] font-jakarta ${expanded === "homeExpiryDocs"
                                  ? "!text-primary"
                                  : ""
                                  }`}
                                className=" !shadow-none border-b border-secondarylightgrayish border-solid"
                                isOpen={expanded === "homeExpiryDocs"}
                                onClick={() =>
                                  handleAccordionChange("homeExpiryDocs")
                                }
                              >
                                <div
                                  className="m-0"
                                  onClick={() => {
                                    router.push(`/compliance`);
                                  }}
                                >
                                  {homeExpiredDocs?.length > 0 && (
                                    <div className="text-[12px] text-red-500 mb-2 underline cursor-pointer">
                                      Expired Documents
                                    </div>
                                  )}
                                  {homeExpiringDocs?.length > 0 && (
                                    <div className="text-[12px] text-yellow-500 underline cursor-pointer">
                                      Expiring Documents
                                    </div>
                                  )}
                                </div>
                              </AccordainComponent>
                            </div>
                          )}

                        {/* PCHO Documents Section */}
                        {(pchoExpiredDocs?.length > 0 ||
                          pchoExpiringDocs?.length > 0) && (
                            <div className="">
                              <AccordainComponent
                                header={
                                  <div className="flex items-center gap-2">
                                    <WarningIcon
                                      fill="red"
                                      height={30}
                                      width={30}
                                    />
                                    <p className="m-0">My Documents</p>
                                  </div>
                                }
                                headerClass={`!font-[500] !text-[14px] font-jakarta ${expanded === "pchoExpiryDocs"
                                  ? "!text-primary"
                                  : ""
                                  }`}
                                className="!shadow-none border-b border-secondarylightgrayish border-solid"
                                isOpen={expanded === "pchoExpiryDocs"}
                                onClick={() =>
                                  handleAccordionChange("pchoExpiryDocs")
                                }
                              >
                                <div
                                  className="m-0"
                                  onClick={() => {
                                    dispatch(handleOpenProfileModal());
                                    dispatch(
                                      handleSetProfileActiveTab("Documents"),
                                    );
                                  }}
                                >
                                  {pchoExpiredDocs?.length > 0 && (
                                    <div className="text-[12px] text-red-500 mb-2 underline cursor-pointer">
                                      Expired Documents
                                    </div>
                                  )}
                                  {pchoExpiringDocs?.length > 0 && (
                                    <div className="text-[12px] text-yellow-500 underline cursor-pointer">
                                      Expiring Documents
                                    </div>
                                  )}
                                </div>
                              </AccordainComponent>
                            </div>
                          )}



                        {/* PCG Documents Section */}
                        {/* PCG (Care Team) Expired / Expiring Documents */}
                        {(pcgLeadExpiredExpiringDocs?.length > 0 ||
                          (hasClinical &&
                            pcgExpiredExpiringDocs?.length > 0)) && (
                            <div className="">
                              <AccordainComponent
                                header={
                                  <div className="flex items-center gap-2">
                                    <WarningIcon
                                      fill="red"
                                      height={30}
                                      width={30}
                                    />
                                    <p className="m-0">
                                      {hasClinical
                                        ? "Care Lead/Care Team Documents"
                                        : "Care Lead Documents"}
                                    </p>
                                  </div>
                                }
                                headerClass={`!font-[500] !text-[14px] font-jakarta ${expanded === "pcgExpiryDocs"
                                  ? "!text-primary"
                                  : ""
                                  }`}
                                className=" !shadow-none border-b border-secondarylightgrayish border-solid"
                                isOpen={expanded === "pcgExpiryDocs"}
                                onClick={() =>
                                  handleAccordionChange("pcgExpiryDocs")
                                }
                              >
                                <div>
                                  {/* Care Leads */}
                                  {pcgLeadExpiredExpiringDocs?.length > 0 && (
                                    <div>
                                      <div className="font-jakarta text-[12px] font-[600]">
                                        {CARE_LEAD}
                                      </div>
                                      {pcgLeadExpiredExpiringDocs.map(
                                        ({ userId, fullName, label }, idx) => (
                                          <div
                                            key={userId ?? idx}
                                            className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish cursor-pointer ${idx ===
                                              pcgLeadExpiredExpiringDocs.length -
                                              1 && "border-none"
                                              }`}
                                            onClick={() => {
                                              router.push(
                                                `/crm/pcg/${encodeURIComponent(
                                                  userId,
                                                )} `,
                                              );
                                            }}
                                          >
                                            <div className="text-[12px] text-red-600 underline">
                                              {fullName || "Unnamed"}
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}

                                  {/* Care Team */}
                                  {pcgExpiredExpiringDocs?.length > 0 &&
                                    hasClinical && (
                                      <div className="mt-2">
                                        <div className="font-jakarta text-[12px] font-[600]">
                                          {CARE_TEAM}
                                        </div>
                                        {pcgExpiredExpiringDocs.map(
                                          ({ userId, fullName, label }, idx) => (
                                            <div
                                              key={userId ?? idx}
                                              className={`flex flex-row justify-between items-center py-2 border-b border-solid border-secondarylightgrayish cursor-pointer ${idx ===
                                                pcgExpiredExpiringDocs.length -
                                                1 && "border-none"
                                                }`}
                                              onClick={() => {
                                                router.push(
                                                  `/clinical/pcg/${encodeURIComponent(
                                                    userId,
                                                  )} `,
                                                );
                                              }}
                                            >
                                              <div className="text-[12px] text-red-600 underline">
                                                {fullName || "Unnamed"}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </div>
                              </AccordainComponent>
                            </div>
                          )}


                      </div>
                    </CardDescription>
                  </Card>
                </ProtectedComponent>
              </div>
            )}
            {/* Time off requests */}
            {hasStaffManagement && (
              <ProtectedComponent
                role={role as Role}
                feature={"HCM_SCHEDULING"}
                access={"EDIT"}
              >
                {loadingTimeOffRequests ? (
                  <div className="w-full mb-[20px]">
                    <Card className="mt-[20px] bg-white shadow-md">
                      <CardDescription>
                        <Loader
                          spinner={false}
                          message="Loading time off requests..."
                          fullScreen={false}
                        />
                      </CardDescription>
                    </Card>
                  </div>
                ) : (
                  upcomingTimeOffShifts?.length > 0 && (
                    <div className="w-full font-jakarta ">
                      <Card className="flex justify-center align-center items-center p-4 bg-[#FAD1C0] rounded-[10px]">
                        <CardDescription>
                          <div className="flex flex-col items-center h-full gap-4">
                            <div className="flex text-secondarymirage font-semibold text-lg">
                              Total Time Off Requests (
                              {upcomingTimeOffShifts?.length})
                            </div>
                            <div className="flex">
                              <Button
                                classname="!max-w-[279px] bg-white !border-solid border-2 !border-secondarymirage  mt-auto "
                                titleClass="!text-secondarymirage font-medium text-base"
                                name="Review Now"
                                buttonClick={() => {
                                  router.push(`/hcm`);
                                }}
                              />
                            </div>
                          </div>
                        </CardDescription>
                      </Card>
                    </div>
                  )
                )}

                {/* Missing Schedules for next week */}
                {loadingMissingSchedules ? (
                  <div className="w-full font-jakarta mt-[5px]">
                    <Card className="mt-[20px] bg-white shadow-md">
                      <CardDescription>
                        <Loader
                          spinner={false}
                          message="Loading missing schedules..."
                          fullScreen={false}
                        />
                      </CardDescription>
                    </Card>
                  </div>
                ) : (
                  missingDates?.length > 0 && (
                    <div className="w-full font-jakarta">
                      <Card className="flex p-4 bg-[#FAD1C0] rounded-[10px] mt-[17px] justify-center align-center items-center">
                        <CardDescription>
                          <div className="flex flex-col items-center h-full gap-4">
                            <div className="flex text-secondarymirage font-semibold text-lg text-center">
                              Missing Schedules for next week!
                            </div>
                            <div className="flex">
                              <Button
                                name="Assign Now"
                                buttonClick={() => {
                                  // Navigate the scheduler to the start of next week
                                  dispatch(setScheduleDate(nextWeekStartISO));
                                  router.push(`/hcm/scheduling`);
                                }}
                                classname="!max-w-[279px] bg-white !border-solid border-2 !border-secondarymirage  mt-auto "
                                titleClass="!text-secondarymirage font-medium text-base"
                              />
                            </div>
                          </div>
                        </CardDescription>
                      </Card>
                    </div>
                  )
                )}
              </ProtectedComponent>
            )}

            {/* Time off requests for PCG*/}
            {hasStaffManagement && (
              <ProtectedComponent
                role={role as Role}
                feature={"HCM_EMPLOYEE_DASHBOARD"}
                access={"EDIT"}
              >
                <div className="w-full mb-[20px]">
                  <Card className="mt-[20px] p-6 bg-[#FAD1C0] shadow-md">
                    <CardDescription>
                      <div className="flex flex-col items-center h-full gap-4">
                        <div className="flex text-secondarymirage font-semibold text-lg text-center">
                          Time-off request !
                        </div>
                        <div className="flex">
                          <Button
                            name="Request Now"
                            buttonClick={() => {
                              router.push(`/hcm`);
                            }}
                            classname="!max-w-[279px] bg-white !border-solid border-2 !border-secondarymirage  mt-auto "
                            titleClass="!text-secondarymirage font-medium text-base"
                          />
                        </div>
                      </div>
                    </CardDescription>
                  </Card>
                </div>
              </ProtectedComponent>
            )}
          </div>
        </CardDescription>
      </Card>

    </div>
  );
}

export default QuickActions;
