import {
  addDays,
  startOfWeek,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek as startOfWeekMonth,
  endOfWeek as endOfWeekMonth,
  addMonths,
  startOfDay,
  isBefore,
  subDays,
} from "date-fns";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import {
  defaultPayRate,
  GetUsersPath,
  InHomeCare,
  PCG,
  userRoles,
} from "../../../utils/constants";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import Avatar from "../../../commonComponents/avatar";
import WeekView from "./week-view";
import MonthView from "./month-view";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import Form from "../../../commonComponents/form";
import AddShift from "./add-shift";
import Tabs from "../../../commonComponents/tabs";
import TimeOff from "./time-off";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import SelectComponent from "../../../commonComponents/select-component";
import { MonthTeamShiftSchema } from "../../../model/hcm/user-shifts.model";
import DayView from "./day-view";
import DeleteIcon from "../../../public/icons/delete-icon";
import useDeleteShift from "../../../services/hcm-delete-shift";
import useGetAll from "../../../services/getAll";
import { handleCloseAddShiftModal } from "../../../redux/slices/modal-slice";
import { RoleContext } from "../../role-provider";
import { ProtectedComponent } from "../../protectedComponent";
import { Role } from "../../../utils/roles";
import { hasAccess } from "../../../utils/roleAccess";
import { setScheduleDate } from "../../../redux/slices/schedule-date-slice";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import { Copy } from "lucide-react";
import useCreateShift from "../../../services/hcm-create-shift";
import { Shift } from "../../../types/hcm-types";
import RightArrowIcon from "../../../public/icons/right-arrow-icon";
import router from "next/router";
import LeftArrowIcon from "../../../public/icons/left-arrow-icon";
import { useGetHomeType } from "../../../utils/gethomeType";

export interface ScheduleItem {
  userId: any;
  shift_end_time: string;
  shift_start_time: string;
  shift_status: string;
  notes: string;
}

// Define the form data structure based on your schema
const initialFormData = {
  userId: "",
  date: "",
  scheduleStartTime: "",
  scheduleEndTime: "",
  notes: "",
  shift_status: "",
  shift_color: "",
  isTimeoffApproved: false,
  pay_rate: defaultPayRate,
  totalHours: "",
};

export default function ScheduleBoard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  // ✅ 1. Only get string from selector
  const currentDateString = useAppSelector(
    (state) => state.scheduleDate?.currentDate,
  );

  // ✅ 2. Then convert to Date
  const currentDateFromStore = useMemo(() => {
    return currentDateString ? new Date(currentDateString) : new Date();
  }, [currentDateString]);

  const isInhomeCare = useGetHomeType() === InHomeCare;

  const currentUserId = getUserIdFromToken();

  const [view, setView] = useState<"week" | "month" | "day">("week");
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("Add shift");
  const [selectedCell, setSelectedCell] = useState<{
    member: any;
    date: string;
  } | null>(null);
  const isAddShiftModal = useAppSelector(
    (state: { modal: { isAddShiftModalOpen: boolean } }) =>
      state.modal.isAddShiftModalOpen,
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [showNoPayRateModal, setShowNoPayRateModal] = useState(false);

  // Helper to check if member has a valid pay_rate
  const hasMemberPayRate = (member: any): boolean => {
    const payRates = member?.roaster
      ?.map((entry: any) => entry?.pay_rate)
      ?.filter(
        (pay_rate: any) =>
          pay_rate !== undefined && pay_rate !== null && pay_rate !== 0,
      );
    return payRates?.length > 0;
  };

  const [editIndex, setEditIndex] = useState<number | null>(null); // Track index for editing

  const weekDays = useMemo(() => {
    return [...Array(7)].map((_, i) =>
      addDays(startOfWeek(currentDateFromStore, { weekStartsOn: 1 }), i),
    );
  }, [currentDateFromStore]);

  const monthStart = startOfMonth(currentDateFromStore);
  const monthEnd = endOfMonth(currentDateFromStore);
  const startDate = startOfWeekMonth(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeekMonth(monthEnd, { weekStartsOn: 1 });
  const dispatch = useAppDispatch();

  const daysInMonth = [];
  let day = startDate;
  while (day <= endDate) {
    daysInMonth.push(day);
    day = addDays(day, 1);
  }

  const userHomeId = getHomeIdFromToken();

  const today = startOfDay(subDays(new Date(), 1));
  const selected = selectedCell?.date
    ? startOfDay(new Date(selectedCell.date))
    : today;

  const { data: pcgUsersData, isLoading: isLoadingPcgUsers } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles.PCG,
      homeId: userHomeId,
    },
    path: GetUsersPath,
  });

  const { data: homeAdminUsersData, isLoading: isLoadingHomeAdminUsers } =
    useGetAll({
      key: userRoles.HOME_ADMIN,
      params: {
        userType: userRoles.HOME_ADMIN,
        homeId: userHomeId,
      },
      path: GetUsersPath,
    });

  const isLoading = isLoadingPcgUsers || isLoadingHomeAdminUsers;
  const allTeamMembers = [
    ...((pcgUsersData as any)?.users || []),
    ...((homeAdminUsersData as any)?.users || []),
  ];

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  // Filter team members based on home type
  const teamMembers = useMemo(() => {
    if (role === PCG && isInhomeCare && currentUserId) {
      // For In Home Care, only show the logged-in PCG
      return allTeamMembers.filter(
        (member: any) => String(member?.userId) === String(currentUserId),
      );
    }
    // For other home types, show all PCGs
    return allTeamMembers;
  }, [allTeamMembers, isInhomeCare, currentUserId, role]);

  const getDeletedDate = (member: any): Date | null => {
    const raw = member?.deletedOn;

    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  const scheduleRangeStart = useMemo(() => {
    if (view === "day") return startOfDay(currentDateFromStore);
    if (view === "month") return startOfDay(startOfMonth(currentDateFromStore));
    return startOfDay(weekDays[0]);
  }, [currentDateFromStore, view, weekDays]);

  const teamMembersForSchedule = useMemo(() => {
    const members = (teamMembers || []).filter((member: any) => {
      if (!member?.isDeleted) return true;
      const deletedDate = getDeletedDate(member);
      if (!deletedDate) return true;
      return !isBefore(startOfDay(deletedDate), scheduleRangeStart);
    });

    return members.sort((a: any, b: any) => {
      const aDeleted = Boolean(a?.isDeleted);
      const bDeleted = Boolean(b?.isDeleted);
      if (aDeleted !== bDeleted) return aDeleted ? 1 : -1;
      const aName = (a?.name || "").toString();
      const bName = (b?.name || "").toString();
      return aName.localeCompare(bName);
    });
  }, [teamMembers, scheduleRangeStart]);

  const teamMembersOptions = teamMembersForSchedule;

  // Seniors data fetching (for Senior dropdowns and labels)
  const { data: seniorsData } = useGetAll({
    key: userRoles.SENIOR,
    params: {
      userType: userRoles.SENIOR,
      homeId: userHomeId || "",
    },
    path: GetUsersPath,
  });

  const seniorOptions = useMemo(() => {
    const seniorsList =
      (seniorsData as any)?.users || (seniorsData as any) || [];

    const activeSeniors = seniorsList.filter(
      (senior: any) => senior?.isDeleted !== true,
    );

    const dropdownOptions = activeSeniors.map((senior: any) => {
      const seniorId = senior?.id || senior?._id || senior?.userId;

      const fullName =
        senior?.name ||
        [senior?.firstName, senior?.lastName].filter(Boolean).join(" ") ||
        [senior?.first_name, senior?.last_name].filter(Boolean).join(" ") ||
        "Senior";

      return {
        option: fullName,
        value: seniorId,
      };
    });

    const validOptions = dropdownOptions.filter(
      (option: any) => !!option?.value,
    );
    return validOptions;
  }, [seniorsData]);

  const { mutate: deleteShift } = useDeleteShift();

  const [selectedShift, setSelectedShift] = useState(null);

  const [copyFromWeekStart, setCopyFromWeekStart] = useState<string | null>(
    null,
  );

  // Copy shift states
  const [selectedShiftToCopy, setSelectedShiftToCopy] = useState(null); // shift object
  const [isCopyingShift, setIsCopyingShift] = useState(false);

  const { mutate: createShift } = useCreateShift();

  // When opening modal, prefill formData
  // Accept both ScheduleItem and Shift types for entry/shift
  const openModal = (
    member: any,
    date: Date,
    entry?: ScheduleItem | Shift,
    index?: number,
  ) => {
    // Check if user has permission to add/edit shifts
    if (!hasAccess(role as Role, "HCM_SCHEDULING", "EDIT")) {
      return; // Prevent modal from opening
    }

    const clickedDay = startOfDay(date);
    // Use optional chaining for shift_status
    if (
      (entry as any)?.shift_status === "timeoff" &&
      isBefore(clickedDay, today)
    ) {
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Past time off cannot be edited."));
      dispatch(handleShowCloseOptions());
      return;
    }

    setSelectedCell({ member, date: format(date, "yyyy-MM-dd") });
    setSelectedShift(entry);

    setFormData({
      ...initialFormData,
      userId: member?.userId ?? member?.user_id ?? member,
      date: format(date, "yyyy-MM-dd"),
      scheduleStartTime: (entry as any)?.shift_start_time,
      scheduleEndTime: (entry as any)?.shift_end_time,
      notes: (entry as any)?.notes || "",
      shift_status: (entry as any)?.shift_status,
    });

    // Set active tab based on shift_status
    if ((entry as any)?.shift_status === "timeoff") {
      setActiveTab("Time off");
    } else {
      setActiveTab("Add shift");
    }
    setEditIndex(index !== undefined ? index : null);
  };

  // Generic handler for form fields
  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  function handleDelete() {
    dispatch(handleCloseAddShiftModal());
    deleteShift(selectedShift.id, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Shift deleted!"));
        setSelectedCell(null);
        setFormData(initialFormData);
        setEditIndex(null);
        setSelectedShift(null);
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            !Array?.isArray(error?.response?.data?.error)
              ? error?.response?.data?.error
              : "Failed to delete shift. Please try again.",
          ),
        );
      },
    });
  }

  function handleCopyShift() {
    dispatch(handleCloseAddShiftModal());
    setSelectedShiftToCopy(selectedShift); // store the shift to copy
    setIsCopyingShift(true);
    setSelectedCell(null); // close modal
  }

  // Handler for when a cell is clicked in WeekView during copy mode
  function handleCopyCellClick(member, date) {
    if (!selectedShiftToCopy) return;
    // Build new shift payload
    const original = selectedShiftToCopy;
    const start = new Date(original.shift_start_time);
    const end = new Date(original.shift_end_time);
    // Set new date but keep time
    const [y, m, d] = date.split("-").map(Number);
    const newStart = new Date(
      y,
      m - 1,
      d,
      start.getHours(),
      start.getMinutes(),
      0,
      0,
    );
    const durationMs = end.getTime() - start.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    // Find pay rate for new user
    let payPerHour = original.pay_rate;
    if (member && Array.isArray(member.roaster) && member.roaster.length > 0) {
      const found = member.roaster.find((r) => r.pay_rate != null);
      if (found) payPerHour = found.pay_rate;
    }
    const payload = {
      user_id: member.userId,
      home_id: userHomeId,
      created_by_user_id: member.userId, // or use getUserIdFromToken() if needed
      shift_status: original.shift_status,
      shift_color: original.shift_color,
      notes: original.notes || "",
      pay_rate:
        typeof payPerHour === "string" ? parseFloat(payPerHour) : payPerHour,
      shift_start_time: newStart.toISOString(),
      shift_end_time: newEnd.toISOString(),
      ...(isInhomeCare && {
        assigned_to_user_id: original.assigned_to_user_id,
      }),
    };
    createShift(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Shift copied successfully!"));
        // Do NOT reset copy mode here; allow multiple pastes
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            !Array?.isArray(error?.response?.data?.error)
              ? error?.response?.data?.error
              : "Failed to copy shift. Please try again.",
          ),
        );
      },
    });
  }

  // Handler to complete copying and exit copy mode
  function handleCompleteCopying() {
    setSelectedShiftToCopy(null);
    setIsCopyingShift(false);
  }

  const MonthteamUserId = formData?.userId;

  function cleanShift(shift) {
    if (!shift) return shift;
    const { member, index, ...rest } = shift;
    return rest;
  }

  const defaultValuesForTeamName = { user_id: selectedShift?.user_id };

  const tabData = [
    {
      label: "Add shift",
      content: (
        <AddShift
          defaultValues={cleanShift(selectedShift)}
          selectedCell={selectedCell}
          selectedWeekdays={selectedWeekdays}
          setSelectedWeekdays={setSelectedWeekdays}
          view={view}
          userId={
            view === "month"
              ? MonthteamUserId || selectedCell?.member?.userId
              : selectedCell?.member?.userId || MonthteamUserId
          }
        />
      ),
    },
    !isBefore(selected, today) && {
      label: "Time off",
      content: (
        <TimeOff
          defaultValues={selectedShift}
          selectedCell={selectedCell}
          userId={
            view === "month"
              ? MonthteamUserId ||
                selectedCell?.member?.userId ||
                selectedShift?.user_id
              : selectedCell?.member?.userId ||
                selectedShift?.user_id ||
                MonthteamUserId
          }
        />
      ),
    },
  ].filter(Boolean);

  type ContextMenuState = {
    visible: boolean;
    x: number;
    y: number;
    shift?: any;
    member?: any;
    date?: Date;
  } | null;

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openShiftActionMenu = ({
    shift,
    member,
    date,
    clientX,
    clientY,
  }: {
    shift: any;
    member: any;
    date: Date;
    clientX: number;
    clientY: number;
  }) => {
    dispatch(handleCloseAddShiftModal());
    setSelectedShift(shift);
    setSelectedCell({ member, date: format(date, "yyyy-MM-dd") });

    const padding = 8;
    let x = clientX;
    let y = clientY;

    if (typeof window !== "undefined") {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = 160;
      const menuH = 88;
      if (x + menuW + padding > vw) x = vw - menuW - padding;
      if (y + menuH + padding > vh) y = vh - menuH - padding;
    }

    setContextMenu({
      visible: true,
      x,
      y,
      shift,
      member,
      date,
    });
  };

  useEffect(() => {
    if (!contextMenu?.visible) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("contextmenu", onDown, true);
    document.addEventListener("keydown", onEsc, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("contextmenu", onDown, true);
      document.removeEventListener("keydown", onEsc, true);
    };
  }, [contextMenu?.visible]);

  // Disable scroll when context menu is visible
  useEffect(() => {
    if (contextMenu?.visible) {
      // Disable scroll when context menu is visible
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable scroll when context menu is hidden
      document.body.style.overflow = "";
    }

    return () => {
      // Ensure scroll is re-enabled on cleanup
      document.body.style.overflow = "";
    };
  }, [contextMenu?.visible]);

  const doCopyFromMenu = () => {
    handleCopyShift();
    setContextMenu(null);
  };

  const doDeleteFromMenu = () => {
    handleDelete();
    setContextMenu(null);
  };

  if (isLoading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <div className="p-4 space-y-4 font-poppins">
      {/* Copy mode banner/button */}
      {isCopyingShift && (
        <div className="flex items-center justify-between bg-blue-100 border border-blue-400 rounded px-4 py-2 mb-4">
          <div className="font-medium">
            Shift copied Successfully! Paste this shift as many times as you
            need.
          </div>
          <Button
            name="Finish Pasting"
            classname=" text-white ml-4"
            buttonClick={handleCompleteCopying}
            titleClass="!text-[14px]"
          />
        </div>
      )}

      {/* Top Controls */}
      <div className="flex justify-between items-center">
        {/* Left/center controls */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => dispatch(setScheduleDate(new Date().toISOString()))}
            className="bg-white border-[1px] border-solid border-primary rounded w-[102px] h-[42px] flex items-center justify-center cursor-pointer font-medium font-jakarta text-primary"
          >
            Today
          </div>
          <div className="font-medium font-poppins w-[200px] text-center border-[1px] border-[#C8C8CC] border-solid rounded-md py-2 bg-[#FFFFFF] mr-2">
            {view === "week"
              ? `${format(weekDays[0], "MMM d")} – ${format(
                  weekDays[6],
                  "MMM d , yyyy",
                )}`
              : view === "month"
                ? format(currentDateFromStore, "MMMM yyyy")
                : format(currentDateFromStore, "EEEE, MMMM d, yyyy")}
          </div>
          <div
            className="cursor-pointer pr-2"
            onClick={() =>
              view === "week"
                ? dispatch(
                    setScheduleDate(
                      addDays(currentDateFromStore, -7).toISOString(),
                    ),
                  )
                : view === "month"
                  ? dispatch(
                      setScheduleDate(
                        addMonths(currentDateFromStore, -1).toISOString(),
                      ),
                    )
                  : dispatch(
                      setScheduleDate(
                        addDays(currentDateFromStore, -1).toISOString(),
                      ),
                    )
            }
          >
            <LeftArrowIcon />
          </div>
          <div
            className="cursor-pointer"
            onClick={() =>
              view === "week"
                ? dispatch(
                    setScheduleDate(
                      addDays(currentDateFromStore, 7).toISOString(),
                    ),
                  )
                : view === "month"
                  ? dispatch(
                      setScheduleDate(
                        addMonths(currentDateFromStore, 1).toISOString(),
                      ),
                    )
                  : dispatch(
                      setScheduleDate(
                        addDays(currentDateFromStore, 1).toISOString(),
                      ),
                    )
            }
          >
            <RightArrowIcon />
          </div>
        </div>
        {/* Right side select */}
        <div className="flex items-center">
          {view === "week" && (
            <ProtectedComponent
              role={role as Role}
              feature="HCM_SCHEDULING"
              access="EDIT"
            >
              <SelectComponent
                label=""
                name="copyWeek"
                onChange={(e) => setCopyFromWeekStart(e.target.value)}
                options={[...Array(6)].map((_, i) => {
                  const start = addDays(weekDays[0], -(i + 1) * 7);
                  const end = addDays(start, 6);
                  return {
                    value: format(start, "yyyy-MM-dd"),
                    option: `${format(start, "MMM d")} – ${format(
                      end,
                      "MMM d, yyyy",
                    )}`,
                  };
                })}
                placeholder="⧉ Copy week"
                note={`Copy from:`}
                className="-mt-8 pr-2"
              />
            </ProtectedComponent>
          )}
          <SelectComponent
            options={[
              { value: "month", option: "Month View" },
              { value: "week", option: "Week View" },
              { value: "day", option: "Day View" },
            ]}
            value={view} // "month", "week", or "day"
            onChange={(e) =>
              setView(e.target.value as "week" | "month" | "day")
            }
            name="view"
            className="-mt-8"
          />
        </div>
      </div>
      {/* month/week/day */}
      {view === "week" ? (
        <WeekView
          weekDays={weekDays}
          teamMembers={teamMembersForSchedule}
          openModal={openModal}
          copyFromWeek={copyFromWeekStart}
          onClearCopyWeek={() => setCopyFromWeekStart(null)}
          selectedShiftToCopy={selectedShiftToCopy}
          isCopyingShift={isCopyingShift}
          onCopyCellClick={handleCopyCellClick}
          onRightClickShift={openShiftActionMenu}
          seniorOptions={seniorOptions}
          hasMemberPayRate={hasMemberPayRate}
          onNoPayRate={() => setShowNoPayRateModal(true)}
        />
      ) : view === "month" ? (
        <MonthView
          daysInMonth={daysInMonth}
          currentDate={currentDate}
          teamMembers={teamMembersForSchedule}
          openModal={openModal}
          selectedShiftToCopy={selectedShiftToCopy}
          isCopyingShift={isCopyingShift}
          onCopyCellClick={handleCopyCellClick}
          onRightClickShift={openShiftActionMenu}
          seniorOptions={seniorOptions}
        />
      ) : (
        <DayView
          currentDate={currentDateFromStore}
          teamMembers={teamMembersForSchedule}
          openModal={openModal}
          onRightClickShift={openShiftActionMenu}
          seniorOptions={seniorOptions}
          hasMemberPayRate={hasMemberPayRate}
          onNoPayRate={() => setShowNoPayRateModal(true)}
        />
      )}

      {/* Modal */}
      {selectedCell && (
        <CommonModal
          modalOpen={isAddShiftModal}
          setModalOpen={() => {
            setSelectedCell(null);
            setFormData(initialFormData);
            setEditIndex(null);
          }}
          title={
            (editIndex !== null
              ? "Edit Schedule"
              : formData?.shift_status === "timeoff"
                ? "Time Off"
                : "Add Schedule") +
            ` ${format(
              new Date(
                Number(selectedCell.date.split("-")[0]),
                Number(selectedCell.date.split("-")[1]) - 1,
                Number(selectedCell.date.split("-")[2]),
              ),
              " - MMMM d, yyyy",
            )}`
          }
          width="600px"
          crossCTA
          childContainerClass="!w-full"
        >
          <div className="px-[20px]">
            {editIndex !== null && selectedShift && selectedShift.id && (
              <div className="absolute top-6 cursor-pointer right-16 flex items-center gap-3">
                <div onClick={handleDelete}>
                  <DeleteIcon />
                </div>

                {view != "day" && (
                  <div onClick={handleCopyShift}>
                    <Copy />
                  </div>
                )}
              </div>
            )}
            <div>
              {/* Month view user select */}
              {view === "month" && teamMembersOptions.length > 0 && (
                <div>
                  <Form
                    onSubmit={(e) => e.preventDefault()}
                    schema={MonthTeamShiftSchema}
                    defaultValues={defaultValuesForTeamName}
                  >
                    <FormSelectComponent
                      label="Team Member"
                      options={teamMembersOptions.map((member) => ({
                        value: member?.userId,
                        option: member?.name,
                      }))}
                      value={formData?.userId}
                      onChange={(e) => {
                        const selectedUserId = e.target.value;
                        const selectedMember = teamMembersOptions.find(
                          (member) => member?.userId === selectedUserId,
                        );
                        // Check if selected member has a valid pay_rate
                        if (
                          selectedMember &&
                          !hasMemberPayRate(selectedMember)
                        ) {
                          setShowNoPayRateModal(true);
                          return;
                        }
                        handleFormChange("userId", selectedUserId);
                      }}
                      name="user_id"
                    />
                  </Form>
                </div>
              )}

              {["week", "day"].includes(view) &&
                selectedCell?.member?.userId &&
                (() => {
                  const selectedUser = allTeamMembers?.find(
                    (user: any) =>
                      user?.userId === selectedCell?.member?.userId,
                  );

                  if (!selectedUser) return null;

                  return (
                    <div className="flex-col w-full items-center border gap-2 font-poppins text-[20px]">
                      {/* Main tab content */}
                      <div className="!flex flex-row gap-2 items-center">
                        <Avatar
                          src={selectedUser?.profileImageUrl}
                          name={selectedUser?.name}
                          size={48}
                          variant="bordered"
                        />
                        <div>{selectedUser?.name}</div>
                      </div>
                    </div>
                  );
                })()}
              <div>
                <Tabs
                  tabs={tabData}
                  containerClassName="bg-transparent"
                  activeTabClassName=""
                  activeTab={activeTab}
                  onTabChange={(label) => setActiveTab(label)}
                  tabTextClassName="font-medium"
                />
              </div>
            </div>
          </div>
        </CommonModal>
      )}

      {/* ===== NEW: Context (right-click) modal with Copy / Delete ===== */}
      {contextMenu?.visible && (
        <ProtectedComponent
          role={role as Role}
          feature="HCM_SCHEDULING"
          access="EDIT"
        >
          <div
            ref={menuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[9999] min-w-[160px] rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <div className="py-1">
              {view !== "day" && (
                <div
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 font-poppins text-sm"
                  onClick={doCopyFromMenu}
                >
                  Copy
                </div>
              )}
              <div
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 font-poppins text-sm text-red-600"
                onClick={doDeleteFromMenu}
              >
                Delete
              </div>
            </div>
          </div>
        </ProtectedComponent>
      )}

      {/* No Pay Rate Modal */}

      {showNoPayRateModal &&
        hasAccess(role as Role, "HCM_SCHEDULING", "EDIT") && (
          <CommonModal
            modalOpen={true}
            setModalOpen={() => {
              setShowNoPayRateModal(false);
              // Reset team member dropdown in month view
              if (view === "month") {
                handleFormChange("userId", "");
              }
            }}
            crossCTA={false}
            title="Cannot create shift for this team member"
            width="575px"
          >
            <div className="px-[20px]">
              <div className="font-poppins text-sm text-gray-700 mb-4">
                There is no wage rate set. So please add a wage on the Team page
                and try again.
              </div>
              <div className="flex gap-4 justify-center">
                <Button
                  name="Navigate to Team"
                  classname="bg-primary text-white"
                  buttonClick={() => router.push("/hcm/team")}
                  titleClass="!text-[14px]"
                />
                <Button
                  name="Cancel"
                  classname="bg-primary text-white"
                  buttonClick={() => {
                    dispatch(handleCloseAddShiftModal());
                    setShowNoPayRateModal(false);
                  }}
                  titleClass="!text-[14px]"
                />
              </div>
            </div>
          </CommonModal>
        )}
    </div>
  );
}
