import { useRouter } from "next/router";
import { useContext, useEffect, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import BaseTable from "../../../commonComponents/base-table";
import PopoverComponent from "../../../commonComponents/popover-component";
import MenuIcon from "../../../public/icons/menu-icon";
import { handleSetTeamMemberActiveTab } from "../../../redux/slices/team-tab-slices";
import useGetAll from "../../../services/getAll";
import {
  CARE_TEAM,
  GetUsersPath,
  InHomeCare,
  SENIOR,
  sidebarMenuItems,
  userRoles,
} from "../../../utils/constants";
import { hasAccess } from "../../../utils/roleAccess";
import { RoleContext } from "../../role-provider";
import { Role } from "../../../utils/roles";
import TeamCommunicationPopup from "../../communication/team-communication/team-communication-popup";
import { BroadcastList } from "../../communication/bulletin-board/bulletin-board";
import Loader from "../../../commonComponents/loader";
import Avatar from "../../../commonComponents/avatar";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { ProtectedComponent } from "../../protectedComponent";
import { useGetHomeType } from "../../../utils/gethomeType";
import useGetShifts from "../../../services/hcm-getall-shifts";
import { format, startOfWeek, endOfWeek } from "date-fns";
import PlusIcon from "../../../public/icons/plus-icon";
import { handleOpenAddPCGModal } from "../../../redux/slices/modal-slice";
import Button from "../../../commonComponents/button";

const TeamRosterTable = () => {
  const authorizedModules = useAuthorizedModules();
  const hasHCMAccess = authorizedModules.includes(
    sidebarMenuItems.STAFF_MANAGEMENT.toUpperCase(),
  );

  // Temporarily disabled
  // const [terminated, setTerminated] = useState(false);
  // const [showFilter, setShowFilter] = useState(false);
  // const [formValues, setFormValues] = useState({
  //     access: "",
  //     classification: "",
  //     role: "",
  //     information: "",
  // });
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const [roleAccess, setRoleAccess] = useState(false);
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "HCM_TEAM_ROASTER", "EDIT") ||
      hasAccess(role as Role, "HCM_TEAM_ROASTER", "VIEW"),
    );
  }, [role]);
  const dispatch = useDispatch();
  // const handleChange = (name: string, value: string) => {
  //     setFormValues((prev) => ({ ...prev, [name]: value }));
  //     // TODO: Add api query here
  //     setFilteredData((prev) => prev?.filter((pcg) => pcg[name] === value));
  // };
  const user = getUserIdFromToken();
  const homeId = getHomeIdFromToken();
  const loggedInUserId = getUserIdFromToken();

  // In-home care and role detection
  const isInhomeCare = useGetHomeType() === InHomeCare;
  const contextRole = useContext(RoleContext)?.role;
  const [currentRole, setCurrentRole] = useState<string | undefined>(
    contextRole,
  );

  useEffect(() => {
    const finalRole = contextRole || getUserRoleFromToken();
    setCurrentRole(finalRole);
  }, [contextRole]);

  const isSeniorInhomeCare = isInhomeCare && currentRole === SENIOR;

  // Get shift data for filtering
  // Get shift data for filtering - generate current week
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday

  const shift_start_time = [
    currentWeekStart.toISOString(),
    currentWeekEnd.toISOString(),
  ];

  const { data: userShiftsResp } = useGetShifts({
    key: "shifts",
    params: {
      home_id: homeId,
      shift_start_time,
    },
  });

  const { data: pcgUsersData, isLoading: isLoadingPcgUsers } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles?.PCG,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const { data: homeAdminUsersData, isLoading: isLoadingHomeAdminUsers } =
    useGetAll({
      key: userRoles.HOME_ADMIN,
      params: {
        userType: userRoles.HOME_ADMIN,
        homeId: homeId,
      },
      path: GetUsersPath,
    });

  const isLoading = isLoadingPcgUsers || isLoadingHomeAdminUsers;
  const users = useMemo(
    () => [
      ...(((pcgUsersData as any)?.users as any[]) || []),
      ...(((homeAdminUsersData as any)?.users as any[]) || []),
    ],
    [pcgUsersData, homeAdminUsersData],
  );
  const hasEditAccess = hasAccess(role as Role, "HCM_TEAM_ROASTER", "EDIT");
  const router = useRouter();

  const navigateToTeamMember = (userId: string, tab: string) => {
    if (!userId) return;
    router.push({
      pathname: "/hcm/team/[userId]",
      query: { userId: String(userId) },
    });
    dispatch(handleSetTeamMemberActiveTab(tab));
  };

  const defaultTabForRole =
    role === userRoles.HOME_ADMIN ? "Personal Information" : "Job Details";
  const columns = [
    {
      header: "Team Member",
      field: "name",
      minWidth: "350px",
      render: (_value, data) => {
        return (
          <div
            className="flex items-center gap-3 pl-[20px] font-jakarta cursor-pointer"
            onClick={() => {
              navigateToTeamMember(data?.userId, defaultTabForRole);
            }}
          >
            <Avatar src={data?.profileImageUrl} name={_value} size={40} />
            <div>
              <div className={`${hasEditAccess && "cursor-pointer"}`}>
                {_value?.length > 25 ? `${_value.substring(0, 25)}...` : _value}
              </div>
              <div>
                {data?.employee?.length > 25
                  ? `${data?.employee?.substring(0, 25)}...`
                  : data?.employee}
              </div>
            </div>
          </div>
        );
      },
      headerClassName: "",
    },
    {
      header: "Contact Information",
      field: "email",
      minWidth: "300px",
      render: (_value, data) => {
        return (
          <div>
            <div className="m-0 truncate max-w-[250px] overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer">
              {_value?.length > 0
                ? `${_value}`
                : _value || (
                  <div
                    className="text-primary underline cursor-pointer"
                    onClick={() => {
                      navigateToTeamMember(
                        data?.userId,
                        "Personal Information",
                      );
                    }}
                  >
                    Add Email
                  </div>
                )}
            </div>
            <div>
              {data?.mobile ? (
                data?.mobile
              ) : (
                <div
                  className="text-primary underline cursor-pointer"
                  onClick={() => {
                    navigateToTeamMember(data?.userId, "Personal Information");
                  }}
                >
                  Add Phone
                </div>
              )}
            </div>
          </div>
        );
      },
      headerClassName: "",
    },
    {
      header: "Role",
      field: "role",
      minWidth: "50px",
      render: (_value, data) => {
        return (
          <div>
            {_value ? (
              _value === userRoles.PCG ? CARE_TEAM : _value
            ) : (
              <div
                className="text-steelblue underline cursor-pointer"
                onClick={() => {
                  navigateToTeamMember(data?.userId, "Personal Information");
                }}
              >
                Add Role
              </div>
            )}
          </div>
        );
      },
      headerClassName: "",
    },
    {
      header: "Wage",
      field: "wage",
      minWidth: "50px",
      render: (_value, data) => {
        return (
          <div>
            {data?.roaster[0]?.pay_rate ? (
              <div>
                {" "}
                ${Number(data?.roaster[0]?.pay_rate)}/
                {data?.roaster[0]?.pay_frequency == "Hourly" ? "hr" : "m"}
              </div>
            ) : (
              <div
                className="text-primary underline cursor-pointer"
                onClick={() => {
                  navigateToTeamMember(data?.userId, defaultTabForRole);
                }}
              >
                Add Wage
              </div>
            )}
          </div>
        );
      },
      headerClassName: "",
    },
    // Not implementing for this MVP
    // {
    //     header: "Status",
    //     field: "status",
    //     minWidth: "400px",
    //     render: (_value, data) => {
    //         return (
    //             <div className="flex items-center justify-between w-full">
    //                 <div className="flex w-[200px]">
    //                     <StatusColorCode status={_value} />
    //                 </div>
    //                 <div className="flex items-center justify-center align-center text-start w-[200px]">
    //                     {_value ===
    //                         TEAM_STATUS_DETAILS?.Needsinvite.label ||
    //                     _value === TEAM_STATUS_DETAILS?.Pending.label ? (
    //                         <div
    //                             className="flex hover:bg-[lightgray] rounded-lg px-[10px] cursor-pointer items-center"
    //                             onClick={() => {}}
    //                         >
    //                             <div>
    //                                 <InitialContactIcon />
    //                             </div>
    //                             <div>Resend invite</div>
    //                         </div>
    //                     ) : (
    //                         _value ===
    //                             TEAM_STATUS_DETAILS?.Terminated?.label && (
    //                             <div className="flex hover:bg-[lightgray] rounded-lg px-[10px] cursor-pointer items-center">
    //                                 Rehire
    //                             </div>
    //                         )
    //                     )}
    //                 </div>
    //             </div>
    //         );
    //     },
    //     headerClassName: "",
    // },
    {
      header: "",
      field: "menu",
      minWidth: "50px",
      render: (_value, data) => {
        return (
          <div
            className={`${data?.isDeleted ? "!cursor-not-allowed opacity-50" : ""}`}
          >
            <TeamRoasterMenu
              userId={data?.userId as string}
              classname={`${data?.isDeleted && "pointer-events-none "}`}
              onSelect={(tab) => navigateToTeamMember(data?.userId, tab)}
            />
          </div>
        );
      },
      headerClassName: "",
    },
  ];

  const [filteredData, setFilteredData] = useState(users);
  // Terminated filter temporarily disabled
  useEffect(() => {
    // if (terminated) {
    //     setFilteredData(() =>
    //         data1?.filter((pcg) => pcg?.status === "Terminated")
    //     );
    // } else {
    //     setFilteredData(() =>
    //         data1?.filter((pcg) => pcg?.status!= "Terminated")
    //     );
    // }
    setFilteredData(users);
  }, [users]);
  const userData = users;

  // Check access for deleted care team members
  const accessDeletedCareTeam = hasAccess(
    role as Role,
    "VIEW_DELETED_CARETEAM",
    "EDIT",
  );

  useEffect(() => {
    if (!userData) return;

    // Filter data based on access: show all team members if has access, otherwise show only non-deleted
    let baseFilteredData = accessDeletedCareTeam
      ? userData // Show all team members (both deleted and active)
      : userData?.filter((item: { isDeleted: any }) => !item.isDeleted); // Show only non-deleted team members

    // Filter for in-home care: only show PCGs who have shifts assigned to current senior
    if (isSeniorInhomeCare && userShiftsResp?.shifts) {
      const seniorAssignedPCGIds = new Set(
        userShiftsResp.shifts
          .filter((shift: any) => shift.assigned_to_user_id === loggedInUserId)
          .map((shift: any) => shift.user_id),
      );

      baseFilteredData = baseFilteredData?.filter((member: any) =>
        seniorAssignedPCGIds.has(member.userId),
      );
    }

    // Reorder: non-deleted first, then deleted (only if they have access to see deleted)
    const reorderedData = [
      ...baseFilteredData?.filter(
        (item: { isDeleted: any }) => !item.isDeleted,
      ), // keep all non-deleted first
      ...baseFilteredData?.filter((item: { isDeleted: any }) => item.isDeleted), // then all deleted ones
    ];
    setFilteredData(reorderedData);
  }, [
    userData,
    accessDeletedCareTeam,
    isSeniorInhomeCare,
    userShiftsResp,
    loggedInUserId,
  ]);
  // const filter = (
  //     <div className="flex gap-6">
  //         <SelectComponent
  //             label={"Access Level"}
  //             options={accessOptions}
  //             onChange={(e) => handleChange("access_level", e.target.value)}
  //             name={"access"}
  //         />
  //         <SelectComponent
  //             label={"Employee"}
  //             options={classificationOptions}
  //             onChange={(e) => handleChange("classification", e.target.value)}
  //             name={"classification"}
  //         />
  //         <SelectComponent
  //             label={"Role"}
  //             options={roleOptions}
  //             onChange={(e) => handleChange("role", e.target.value)}
  //             name={"role"}
  //         />
  //         <SelectComponent
  //             label={"Missing Information"}
  //             options={missingInformation}
  //             onChange={(e) => handleChange("information", e.target.value)}
  //             name={"information"}
  //         />
  //     </div>
  // );
  if (isLoading) return <Loader fullScreen={false} />;
  const filteredTabs = columns?.filter((tab) => {
    return tab?.field != "wage" && tab?.field != "menu";
  });
  const tabData = hasAccess(role as Role, "HCM_TEAM_ROASTER", "EDIT")
    ? columns
    : hasAccess(role as Role, "HCM_TEAM_ROASTER", "VIEW")
      ? filteredTabs
      : [];

  return (
    <div className="w-full">
      {roleAccess && hasHCMAccess ? (
        <div className="px-[30px]">
          <div className="flex items-center justify-between">
            <div className="pb-3">
              <div className="font-semibold text-[30px] py-[1px]">
                Care Team
              </div>
              <div>
                {filteredData?.filter((item: any) => !item.isDeleted)?.length}{" "}
                members
              </div>
            </div>
            {/* Temporarily disabled */}
            {hasAccess(role as Role, "HCM_SCHEDULING", "EDIT") && (
              <div>
                <Button
                  name={"Add Team Member"}
                  buttonClick={() => dispatch(handleOpenAddPCGModal())}
                  icon={<PlusIcon color="white" />}
                />
              </div>
            )}
          </div>
          {/*Temporarily removed  */}
          {/* <div className="flex gap-4 justify-end py-[5px]">
                <ToggleSwitch
                    onToggle={setTerminated}
                    label="Show terminated"
                />
                <Button
                    name={"Filter"}
                    buttonClick={() => setShowFilter((prev) => !prev)}
                />
            </div> 
            {showFilter && filter}*/}
          {/* <div className="flex justify-center my-[30px] rounded-lg"> */}
          <div className="bg-[#FAFAFA] pt-2 rounded-lg">
            {/* Show no shifts message for in-home care seniors */}
            {isSeniorInhomeCare && filteredData?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <div className="text-lg font-medium">
                  No shifts assigned in this week
                </div>
                <div className="text-sm mt-2">
                  You don't have any care team members scheduled for this week.
                </div>
              </div>
            ) : (
              <BaseTable
                columns={tabData}
                data={filteredData}
                headerStyles="p-1 px-3 border-b-[1px] border-solid border-[#C8C8CC]"
                rowStyles={(row, index) =>
                  `p-1 ${accessDeletedCareTeam && row?.isDeleted ? "bg-[#bcb9b9] opacity-50 " : ""}`
                }
                cellStyles={(field) =>
                  field === "name" ? "h-full" : "px-[10px] h-full"
                }
              />
            )}
            <BroadcastList />
          </div>
          {/* </div> */}
        </div>
      ) : (
        <div>
          <RestrictedPage />
        </div>
      )}
      <ProtectedComponent
        role={role as Role}
        feature="HCM_TEAM_BROADCAST"
        access="EDIT"
      >
        <div>
          <TeamCommunicationPopup />
        </div>
      </ProtectedComponent>
    </div>
  );
};

export default TeamRosterTable;

const TeamRoasterMenu = ({
  userId,
  classname,
  onSelect,
}: {
  userId: string;
  classname?: string;
  onSelect: (tab: string) => void;
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <div className={`font-poppins ${classname || ""}`.trim()}>
      <PopoverComponent
        body={
          <div>
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
              onClick={() => onSelect("Job Details")}
            >
              View job details
            </div>
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
              onClick={() => onSelect("Documents")}
            >
              View documents
            </div>
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
              onClick={() => onSelect("Personal Information")}
            >
              View personal information
            </div>
          </div>
        }
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
      >
        <MenuIcon />
      </PopoverComponent>
    </div>
  );
};
