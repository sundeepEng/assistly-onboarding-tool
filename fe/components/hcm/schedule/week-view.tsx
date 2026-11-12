import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  format,
  isSameDay,
  addDays,
  parseISO,
  differenceInDays,
} from "date-fns";
import Button from "../../../commonComponents/button";
import Avatar from "../../../commonComponents/avatar";
import useGetShifts from "../../../services/hcm-getall-shifts";
import {
  handleOpenAddPCGModal,
  handleOpenAddShiftModal,
} from "../../../redux/slices/modal-slice";
import { useDispatch } from "react-redux";
import ProfileIcon from "../../../public/icons/profile-icon";
import { ProtectedComponent } from "../../protectedComponent";
import { RoleContext } from "../../role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import CommonModal from "../../../commonComponents/common-modal";
import useCreateShift from "../../../services/hcm-create-shift";
import useUpdateShift from "../../../services/hcm-update-shift";
import {
  GetUsersPath,
  InHomeCare,
  SENIOR,
  SHIFT_STATUS_AVAILABLE,
  userRoles,
} from "../../../utils/constants";
import { getCopyWeekRange } from "../../../utils/dateUtils";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import {
  DndContext,
  useDroppable,
  useDraggable,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Shift } from "../../../types/hcm-types";
import MoonIcon from "../../../public/icons/moon-icon";
import { OctagonAlertIcon } from "lucide-react";
import { generatePDFForWeek } from "./generate-week-pdf";
import { downloadPdf } from "../../../utils/documentUtils";
import { isOvernightShift } from "../utils/timeUtils";
import { useGetHomeType } from "../../../utils/gethomeType";

interface User {
  userId: string;
  name: string;
  profileImageUrl?: string;
  [key: string]: any;
}

interface WeekViewProps {
  weekDays: Date[];
  teamMembers: User[];
  openModal: any;
  copyFromWeek?: string | null;
  onClearCopyWeek?: () => any;
  copiedShift?: any;
  selectedShiftToCopy?: any;
  isCopyingShift?: boolean;
  onCopyCellClick?: (member: User, date: string) => void;
  seniorOptions?: any;

  // Fired when user right-clicks a shift card
  onRightClickShift?: (args: {
    shift: Shift;
    member: User;
    date: Date;
    index: number;
    clientX: number;
    clientY: number;
  }) => void;
  hasMemberPayRate?: (member: User) => boolean;
  onNoPayRate?: () => void;
}

// DnD helpers
const makeContainerId = (userId: string, dateKey: string) =>
  `${userId}::${dateKey}`;
const parseContainerId = (id: string) => {
  const [userId, dateKey] = id.split("::");
  return { userId, dateKey };
};

// Draggable shift card
const DraggableShiftCard: React.FC<{
  shift: Shift;
  member: User;
  dateKey: string;
  canDrag: boolean;
  children: React.ReactNode;
  // NEW: ensure right-click works anywhere on the card
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ shift, member, dateKey, canDrag, children, onContextMenu }) => {
  const dispatch = useDispatch();
  const role = useContext(RoleContext)?.role||getUserRoleFromToken();
  const isPCHO = role === userRoles.PCHO;

  const hasClock =
    Boolean((shift as any)?.clock_in_timestamp) ||
    Boolean((shift as any)?.clock_out_timestamp);

  const id = shift.id || `${member.userId}-${shift.shift_start_time}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: {
        type: "shift",
        shift,
        fromContainerId: makeContainerId(member.userId, dateKey),
      },
      disabled:
        !canDrag || shift.shift_status !== SHIFT_STATUS_AVAILABLE || hasClock,
    });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor:
      hasClock && !isPCHO
        ? "not-allowed"
        : canDrag && shift.shift_status === SHIFT_STATUS_AVAILABLE
          ? "grab"
          : "default",
  } as React.CSSProperties;

  const handleBlockedAttempt = () => {
    if (hasClock && !isPCHO) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "Care Team has already logged time for this shift and cannot be edited or moved.",
        ),
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseDown={handleBlockedAttempt}
      className="shift-card"
      // IMPORTANT: attach context menu to the OUTER wrapper so any right-click inside works
      onContextMenu={(e) => {
        // prevent cell click / other handlers
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {children}
    </div>
  );
};

// Droppable cell
const DroppableCell: React.FC<{
  id: string;
  children: React.ReactNode;
  onCellClick?: (e?: React.MouseEvent) => void;
}> = ({ id, children, onCellClick }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`p-2 hover:bg-blue-50 relative group cursor-pointer min-h-[60px] border border-solid border-[#bed5df2b] rounded-sm m-0.5 ${
        isOver ? "ring-2 ring-blue-400" : ""
      }`}
      onClick={onCellClick}
    >
      {children}
    </div>
  );
};

const WeekView: React.FC<WeekViewProps> = ({
  weekDays,
  teamMembers,
  openModal,
  copyFromWeek,
  onClearCopyWeek,
  isCopyingShift,
  onCopyCellClick,
  onRightClickShift,
  seniorOptions,
  hasMemberPayRate,
  onNoPayRate,
}) => {
  const userHomeId = getHomeIdFromToken();
  const isInhomeCare = useGetHomeType() === InHomeCare;
  const createdByUserId = getUserIdFromToken();
  const LoggedInUserId = getUserIdFromToken();

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const isSeniorInhomeCare = isInhomeCare && role === SENIOR;

  // Only PCHO and HomeAdmin should see shift overlap/conflict indicators
  const canSeeOverlap = hasAccess(
    role as Role,
    "HCM_SCHEDULING_OVERLAP",
    "EDIT",
  );

  // Check access for deleted care team members
  const accessDeletedCareTeam = hasAccess(
    role as Role,
    "VIEW_DELETED_CARETEAM",
    "EDIT",
  );

  const startOfWeek = new Date(weekDays[0]);
  startOfWeek?.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(weekDays[6]);
  endOfWeek?.setHours(23, 59, 59, 999);

  const shift_start_time = [
    startOfWeek?.toISOString(),
    endOfWeek?.toISOString(),
  ];

  const { data: userShiftsResp, isLoading } = useGetShifts({
    key: "shifts",
    params: {
      home_id: userHomeId,
      shift_start_time,
    },
  });

  // Calculate date range for the selected past week (for copying)
  const copyWeekStartDate = copyFromWeek ? parseISO(copyFromWeek) : null;
  const copyWeekEndDate = copyWeekStartDate
    ? addDays(copyWeekStartDate, 6)
    : null;
  if (copyWeekEndDate) copyWeekEndDate.setHours(23, 59, 59, 999);

  // Fetch shifts from the selected past week for copying
  const { data: copyWeekShiftsResp, isLoading: isCopyWeekLoading } =
    useGetShifts({
      key: `copy-shifts-${copyFromWeek || "none"}`,
      params:
        copyFromWeek && copyWeekStartDate && copyWeekEndDate
          ? {
              home_id: userHomeId,
              shift_start_time: [
                copyWeekStartDate.toISOString(),
                copyWeekEndDate.toISOString(),
              ],
            }
          : { home_id: "" },
    });

  // Filter team members based on access and in-home care
  const filteredTeamMembers = useMemo(() => {
    let members = teamMembers;

    // Filter deleted members based on access
    if (!accessDeletedCareTeam) {
      members = members?.filter((member) => !member?.isDeleted);
    }

    // Filter for in-home care: only show PCGs who have shifts assigned to current senior
    if (isSeniorInhomeCare && userShiftsResp?.shifts) {
      const seniorAssignedPCGIds = new Set(
        userShiftsResp.shifts
          .filter((shift: any) => shift.assigned_to_user_id === LoggedInUserId)
          .map((shift: any) => shift.user_id),
      );

      members = members?.filter((member) =>
        seniorAssignedPCGIds.has(member.userId),
      );
    }

    return members;
  }, [
    teamMembers,
    accessDeletedCareTeam,
    isSeniorInhomeCare,
    userShiftsResp,
    LoggedInUserId,
  ]);

  // Filter shifts for senior in home care
  const filteredShifts = useMemo(() => {
    let result = userShiftsResp?.shifts || [];
    if (isSeniorInhomeCare) {
      result = result.filter(
        (shift: any) => shift.assigned_to_user_id === LoggedInUserId,
      );
    }
    // Hide overlapping/conflicting shifts from everyone except PCHO and HomeAdmin
    if (!canSeeOverlap) {
      result = result.filter((shift: any) => !shift?.isOverlap);
    }
    return result;
  }, [isSeniorInhomeCare, userShiftsResp, LoggedInUserId, canSeeOverlap]);

  // Local, optimistic state for shifts (so we can move them instantly)
  const [shifts, setShifts] = useState<Shift[]>([]);
  useEffect(() => {
    setShifts(filteredShifts as Shift[]);
  }, [filteredShifts]);

  const canEdit = hasAccess(role as Role, "HCM_SCHEDULING", "EDIT");

  // DND sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);

  const onDragStart = (event: any) => {
    const s: Shift | undefined = event.active?.data?.current?.shift;
    if (s) setActiveShift(s);
  };

  const dispatch = useDispatch();
  const { mutate: updateShift } = useUpdateShift();

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveShift(null);

    if (!over || !active?.data?.current) return;

    const fromContainerId: string = active.data.current.fromContainerId;
    const { userId: fromUserId, dateKey: fromDateKey } =
      parseContainerId(fromContainerId);
    const { id: overId } = over;
    const { userId: toUserId, dateKey: toDateKey } = parseContainerId(overId);

    // Same cell → nothing to do
    if (fromUserId === toUserId && fromDateKey === toDateKey) return;

    const shift: Shift = active.data.current.shift;

    // Check if target member has a valid pay_rate before allowing shift move
    const targetMember = filteredTeamMembers.find(
      (member) => member.userId === toUserId,
    );
    if (targetMember && hasMemberPayRate && !hasMemberPayRate(targetMember)) {
      onNoPayRate?.();
      return;
    }

    // Compute new start/end by keeping time-of-day, changing date
    const oldStart = new Date(shift.shift_start_time);
    const oldEnd = new Date(shift.shift_end_time);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const [y, m, d] = toDateKey.split("-").map((n) => parseInt(n, 10));
    const newStart = new Date(
      y,
      m - 1,
      d,
      oldStart.getHours(),
      oldStart.getMinutes(),
      0,
      0,
    );
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Find new user's pay rate
    const newMember = filteredTeamMembers.find((m) => m.userId === toUserId);
    let newPayPerHour = shift.pay_rate;
    if (
      newMember &&
      Array.isArray(newMember.roaster) &&
      newMember.roaster.length > 0
    ) {
      // Use the first pay_per_hour found in the new member's roaster
      const found = newMember.roaster.find((r: any) => r.pay_rate != null);
      if (found) newPayPerHour = found.pay_rate;
    }
    // Optimistic UI update
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shift.id
          ? {
              ...s,
              user_id: toUserId,
              shift_start_time: newStart.toISOString(),
              shift_end_time: newEnd.toISOString(),
              pay_rate: newPayPerHour,
              pay_frequency: newMember?.roaster?.[0]?.pay_frequency,
            }
          : s,
      ),
    );

    // Build update payload like add-shift.tsx
    const payPerHourRaw = newPayPerHour;
    const payPerHour =
      typeof payPerHourRaw === "string"
        ? parseFloat(payPerHourRaw)
        : typeof payPerHourRaw === "number"
          ? payPerHourRaw
          : 0;
    const updatePayload = {
      id: shift.id,
      user_id: toUserId,
      home_id: userHomeId,
      created_by_user_id: createdByUserId,
      shift_status: shift.shift_status,
      shift_color: shift.shift_color,
      notes: shift.notes,
      pay_rate: payPerHour,
      shift_start_time: newStart.toISOString(),
      shift_end_time: newEnd.toISOString(),
      // pay_frequency: newMember?.roaster?.[0]?.pay_frequency,
    };

    updateShift(updatePayload, {
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        let errorMsg = "Shift overlaps with existing shifts";
        if (error?.status === 403) {
          errorMsg = error?.response?.data?.message;
        }
        dispatch(handleShowPopoverMessage(errorMsg));
        // Rollback UI
        setShifts((prev) => prev.map((s) => (s.id === shift.id ? shift : s)));
      },
    });
  };

  // Drag overlay renderer
  const overlayNode = useMemo(() => {
    if (!activeShift) return null;
    const isTimeOff = activeShift.shift_status !== SHIFT_STATUS_AVAILABLE;
    return (
      <div
        className={
          isTimeOff
            ? "relative px-2 py-1 mt-1 rounded text-xs border-solid border-2"
            : "relative bg-blue-100 px-2 py-1 mt-1 rounded text-xs border-dotted border-2"
        }
        style={{
          borderColor: isTimeOff ? "#808080" : activeShift.shift_color,
          backgroundColor: isTimeOff
            ? "#ffffff33"
            : activeShift.shift_color
              ? `${activeShift.shift_color}33`
              : undefined,
        }}
      >
        <div className="text-[10.5px] w-[112px]">
          {format(activeShift.shift_start_time, "hh:mm a")} -{" "}
          {format(activeShift.shift_end_time, "hh:mm a")}
        </div>
        <div className="w-[100px] truncate">
          {(() => {
            if (isTimeOff) return "⊘ TimeOff";

            const assignedId = (activeShift as any)?.assigned_to_user_id;
            if (assignedId && seniorOptions) {
              const senior = seniorOptions.find(
                (option: any) => option.value === assignedId,
              );
              return senior?.option || "Care Team";
            }

            return "Care Team";
          })()}
        </div>
      </div>
    );
  }, [activeShift]);

  let copyWeekstart = null;

  if (copyFromWeek) {
    const rawDateforWeek = parseISO(copyFromWeek);
    copyWeekstart = getCopyWeekRange(format(rawDateforWeek, "yyyy-MM-dd"));
  }

  // Use shifts from the selected past week for copying
  const availableShiftsToCopy = {
    shifts: (copyWeekShiftsResp?.shifts || []).filter(
      (shift: Shift) => shift?.shift_status === SHIFT_STATUS_AVAILABLE,
    ),
  };

  const { mutate: createShift } = useCreateShift();

  // Calculate days to move shifts forward (from past week to current week)
  const difference = differenceInDays(
    format(startOfWeek, "yyyy-MM-dd"),
    copyFromWeek,
  );

  const copyShiftsToNewWeek = () => {
    const bulkpayload: any[] = [];
    availableShiftsToCopy?.shifts?.forEach((shift: any) => {
      const memberExists = filteredTeamMembers?.some(
        (member) => !member?.isDeleted && member?.userId === shift?.user_id,
      );
      if (!memberExists) return;

      const originalStart = new Date(shift?.shift_start_time);
      const originalEnd = new Date(shift?.shift_end_time);

      const newStart = addDays(originalStart, difference).toISOString();
      const newEnd = addDays(originalEnd, difference).toISOString();

      bulkpayload.push({
        user_id: shift.user_id,
        home_id: shift.home_id,
        created_by_user_id: createdByUserId,
        shift_status: SHIFT_STATUS_AVAILABLE,
        shift_color: shift?.shift_color,
        notes: shift.notes || "",
        pay_rate: parseFloat(shift?.pay_rate ?? 0),
        shift_start_time: newStart,
        shift_end_time: newEnd,
        ...(isInhomeCare && { assigned_to_user_id: shift.assigned_to_user_id }),
      });
    });

    if (bulkpayload.length > 0) {
      setIsCopyingWeek(true);
      createShift(bulkpayload, {
        onSuccess: () => {
          setIsCopyingWeek(false);
          onClearCopyWeek?.();
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Shifts copied successfully!"));
        },
        onError: (error: any) => {
          setIsCopyingWeek(false);
          onClearCopyWeek?.();
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              !Array?.isArray(error?.response?.data?.error)
                ? error?.response?.data?.error
                : "Failed to copy shifts. Please try again.",
            ),
          );
        },
      });
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("No shifts to copy."));
      onClearCopyWeek?.();
    }
  };

  const handlePrint = async () => {
    if (!userShiftsResp?.shifts) return;

    // Filter out deleted PCGs and their shifts
    const remainingPCGs = filteredTeamMembers.filter(
      (member) => !member?.isDeleted,
    );
    const shiftsForDownload = userShiftsResp.shifts.filter((shift) =>
      remainingPCGs.some((member) => member.userId === shift.user_id),
    );

    // Generate PDF with filtered data
    const pdfBytes = await generatePDFForWeek(
      remainingPCGs,
      weekDays,
      {
        ...userShiftsResp,
        shifts: shiftsForDownload,
      },
      seniorOptions,
      isInhomeCare,
    );

    downloadPdf(pdfBytes, "weekly_schedule", weekDays[0]);
  };

  if (isLoading) {
    return <Loader fullScreen={false} />;
  }

  // Check if there are no shifts assigned for in-home care seniors
  if (isSeniorInhomeCare && filteredTeamMembers?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-lg font-medium">
          No shifts assigned in this week
        </div>
        <div className="text-sm mt-2">
          You don't have any care team shifts scheduled for this week.
        </div>
      </div>
    );
  }

  return (
    <div>
      {copyFromWeek && (
        <CommonModal
          modalOpen={true}
          setModalOpen={() => onClearCopyWeek?.()}
          crossCTA={true}
          title="Confirm Copy Week"
          width="575px"
        >
          <div className="px-[20px]">
            {isCopyWeekLoading || isCopyingWeek ? (
              <div className="font-poppins text-sm text-gray-700 mb-4 text-center py-4 flex flex-col items-center gap-2">
                <Loader
                  fullScreen={false}
                  message={
                    isCopyingWeek ? "Copying shifts..." : "Loading shifts..."
                  }
                />
              </div>
            ) : availableShiftsToCopy?.shifts?.length > 0 ? (
              <div className="flex flex-col">
                <div className="font-poppins text-sm text-gray-700 mb-4">
                  Are you sure you want to copy the schedule from the{" "}
                  <strong>
                    {format(new Date(addDays(copyFromWeek, 1)), "MMM d, yyyy")}
                  </strong>{" "}
                  week to the current week?
                  <hr />
                  <div className="mt-2">
                    <strong>Note:</strong>
                    <ol className="list-decimal ml-5 mt-1">
                      Only available shifts will be copied and time offs are
                      excluded.
                    </ol>
                  </div>
                </div>
                <div className="flex gap-4 justify-center">
                  <Button
                    name="Cancel"
                    classname="bg-gray-300 text-black"
                    buttonClick={() => onClearCopyWeek?.()}
                    titleClass="!text-[14px]"
                  />
                  <Button
                    name="Confirm"
                    classname="bg-green-500 text-white"
                    buttonClick={copyShiftsToNewWeek}
                    titleClass="!text-[14px]"
                  />
                </div>
              </div>
            ) : (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                There are no available shifts to copy!
              </div>
            )}
          </div>
        </CommonModal>
      )}

      <ProtectedComponent
        role={role as Role}
        feature={"HCM_SCHEDULING"}
        access={"EDIT"}
      >
        <div className="flex justify-end mb-4">
          <Button
            name="Print"
            classname="bg-blue-500 text-white"
            buttonClick={handlePrint}
            titleClass="!text-[14px]"
          />
        </div>
      </ProtectedComponent>

      <DndContext
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        sensors={sensors}
        collisionDetection={closestCenter}
      >
        <div className="grid grid-cols-[200px_repeat(7,minmax(120px,1fr))] border-t text-sm">
          <div className="bg-gray-100 p-2 font-medium flex justify-center">
            Team
          </div>
          {weekDays?.map((date, i) => {
            const isToday = isSameDay(date, new Date());
            return (
              <div
                key={i}
                className={`p-2 text-center font-medium border mb-2 ${
                  isToday
                    ? "border-2 border-blue-500 border-solid rounded-xl"
                    : ""
                }`}
              >
                {format(date, "EEE dd")}
              </div>
            );
          })}

          {filteredTeamMembers?.map((member, i) => (
            <div key={i} className="contents">
              <div
                className={`flex items-start relative ${
                  member?.isDeleted
                    ? "opacity-50 my-[2px] cursor-not-allowed"
                    : ""
                }`}
              >
                {/* will implement later */}
                {/* {shift.clock_in_timestamp && (
                  <div className="absolute z-0 top-4 right-2 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                )} */}

                <div className="flex w-[200px] items-center justify-center p-2 border bg-gray-50 gap-2">
                  <Avatar
                    src={member?.profileImageUrl}
                    name={member?.name}
                    size={40}
                    variant="bordered"
                  />
                  <div>
                    <div
                      className="text-xs font-medium text-gray-700 w-[126px] truncate"
                      title={member?.name}
                    >
                      {member?.name}
                    </div>
                    <div className="text-[14px] font-poppins text-gray-700 w-[135px] truncate">
                      {(() => {
                        if (
                          role === userRoles.PCHO &&
                          hasAccess(role as Role, "HCM_SCHEDULING", "EDIT")
                        ) {
                          const payRates = member?.roaster
                            ?.map((entry: any) => entry?.pay_rate)
                            ?.filter(
                              (rate: any) =>
                                rate !== undefined && rate !== null,
                            );
                          const payFrequency =
                            member?.roaster?.[0]?.pay_frequency;
                          return payRates?.length
                            ? `${payRates.join(", ")}/${
                                payFrequency === "Monthly" ? "m" : "hr"
                              }`
                            : "--";
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {weekDays?.map((date, j) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const containerId = makeContainerId(member.userId, dateKey);
                const entries = shifts?.filter(
                  (shift: any) =>
                    shift?.user_id === member?.userId &&
                    format(new Date(shift?.shift_start_time), "yyyy-MM-dd") ===
                      dateKey,
                );
                // Handler for cell click (add/copy)
                const handleCellClick = (e?: React.MouseEvent) => {
                  // Prevent if clicking on a shift card
                  if (e && (e.target as HTMLElement).closest(".shift-card"))
                    return;
                  if (isCopyingShift) {
                    // Check if member has a valid pay_rate before allowing shift copy
                    if (!hasMemberPayRate(member)) {
                      onNoPayRate?.();
                      return;
                    }
                    onCopyCellClick?.(member, dateKey);
                  } else {
                    if (!member?.isDeleted) {
                      // Check if member has a valid pay_rate before allowing shift creation
                      if (hasMemberPayRate && !hasMemberPayRate(member)) {
                        onNoPayRate?.();
                        return;
                      }
                      dispatch(handleOpenAddShiftModal());
                      openModal(member, date, undefined, undefined);
                    }
                  }
                };
                return (
                  <DroppableCell
                    key={j}
                    id={containerId}
                    onCellClick={handleCellClick}
                  >
                    <ProtectedComponent
                      role={role as Role}
                      feature="HCM_SCHEDULING"
                      access="EDIT"
                    >
                      {!member?.isDeleted && (
                        <div
                          className={`absolute -top-3 right-0 text-blue-500 text-xs transition border cursor-pointer opacity-0 group-hover:opacity-100`}
                          style={{ pointerEvents: "auto" }}
                        >
                          {isCopyingShift ? "Paste Shift" : "+ Add"}
                        </div>
                      )}
                    </ProtectedComponent>
                    {entries?.map((shift, idx) => {
                      const isTimeOff = shift?.shift_status === "timeoff";
                      if (isTimeOff) {
                        return (
                          <div
                            key={idx}
                            className={
                              "shift-card relative px-2 py-1 mt-1 rounded text-xs border-solid border-2 hover:cursor-pointer group"
                            }
                            style={{
                              borderColor: "#808080",
                              backgroundColor: "#ffffff33",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                hasAccess(
                                  role as Role,
                                  "HCM_SCHEDULING",
                                  "EDIT",
                                )
                              ) {
                                dispatch(handleOpenAddShiftModal());
                                openModal(member, date, shift, idx);
                              }
                            }}
                            onContextMenu={(e) => {
                              // right-click opens Shift Actions (no edit modal)
                              e.preventDefault();
                              e.stopPropagation();
                              onRightClickShift?.({
                                shift,
                                member,
                                date,
                                index: idx,
                                clientX: e.clientX,
                                clientY: e.clientY,
                              });
                            }}
                            title={
                              shift?.is_unavailability_approved === null
                                ? "Pending"
                                : shift?.is_unavailability_approved === true
                                  ? "Approved"
                                  : "Rejected"
                            }
                          >
                            {/* Colored status dot - only for timeoff */}
                            {isTimeOff && (
                              <div
                                className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white"
                                style={{
                                  backgroundColor:
                                    shift?.is_unavailability_approved === null
                                      ? "#9ca3af" // gray (pending)
                                      : shift?.is_unavailability_approved ===
                                          true
                                        ? "#22c55e" // green (approved)
                                        : "#ef4444", // red (rejected)
                                }}
                              ></div>
                            )}

                            {/* Time Display */}
                            <div className="text-[10.5px] w-[112px]">
                              {(() => {
                                const isAllDay =
                                  shift?.shift_start_time === "00:00:00" &&
                                  shift?.shift_end_time === "23:59:59";
                                return isAllDay
                                  ? "All day time off"
                                  : `${format(
                                      shift?.shift_start_time,
                                      "hh:mm a",
                                    )} - ${format(
                                      shift?.shift_end_time,
                                      "hh:mm a",
                                    )}`;
                              })()}
                            </div>

                            {/* Shift Role Label */}
                            <div className="w-[100px] truncate">
                              {(() => {
                                if (isTimeOff) return "⊘ TimeOff";

                                const assignedId = (shift as any)
                                  ?.assigned_to_user_id;
                                if (assignedId && seniorOptions) {
                                  const senior = seniorOptions.find(
                                    (option: any) =>
                                      option.value === assignedId,
                                  );
                                  return senior?.option || "Care Team";
                                }

                                return "Care Team";
                              })()}
                            </div>
                          </div>
                        );
                      }
                      // Draggable for available shift
                      return (
                        <DraggableShiftCard
                          key={idx}
                          shift={shift}
                          member={member}
                          dateKey={dateKey}
                          canDrag={canEdit}
                          onContextMenu={(e) => {
                            // right-click anywhere on the draggable card
                            e.preventDefault();
                            e.stopPropagation();
                            onRightClickShift?.({
                              shift,
                              member,
                              date,
                              index: idx,
                              clientX: e.clientX,
                              clientY: e.clientY,
                            });
                          }}
                        >
                          <div
                            className={`flex items-start relative group/shift ${
                              member?.isDeleted
                                ? "opacity-50 my-[2px] cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {/* Conflict tooltip - shown on hover of entire shift */}
                            {canSeeOverlap && (shift as any)?.isOverlap && (
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 hidden group-hover/shift:block bg-primary/90 text-white text-[11px] leading-snug rounded-md px-3 py-2 w-[220px] shadow-lg whitespace-normal">
                                {`Conflict: ${
                                  (shift as any)?.user_name || "User"
                                } has another shift this day`}
                              </span>
                            )}
                            <div
                              className={`shift-card relative bg-blue-100 px-2 py-1 mt-1 rounded text-xs border-dotted border-2 hover:bg-blue-200 cursor-pointer group w-[132px] truncate`}
                              style={{
                                borderColor: shift?.shift_color,
                                backgroundColor: shift?.shift_color
                                  ? `${shift?.shift_color}33`
                                  : undefined,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  hasAccess(
                                    role as Role,
                                    "HCM_SCHEDULING",
                                    "EDIT",
                                  )
                                ) {
                                  dispatch(handleOpenAddShiftModal());
                                  openModal(member, date, shift, idx);
                                }
                              }}
                              title={
                                isTimeOff
                                  ? shift?.is_unavailability_approved === null
                                    ? "Pending"
                                    : shift?.is_unavailability_approved === true
                                      ? "Approved"
                                      : "Rejected"
                                  : undefined
                              }
                            >
                              {/* Colored status dot - only for timeoff */}
                              {isTimeOff && (
                                <div
                                  className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white"
                                  style={{
                                    backgroundColor:
                                      shift?.is_unavailability_approved === null
                                        ? "#9ca3af" // gray (pending)
                                        : shift?.is_unavailability_approved ===
                                            true
                                          ? "#22c55e" // green (approved)
                                          : "#ef4444", // red (rejected)
                                  }}
                                ></div>
                              )}

                              {/* Time Display */}
                              <div className="flex items-center text-[10.5px] truncate">
                                {canSeeOverlap && (shift as any)?.isOverlap && (
                                  <OctagonAlertIcon
                                    size={12}
                                    className="flex-shrink-0 text-red-500 mr-1 fill-red-500"
                                  />
                                )}
                                {isOvernightShift(shift) && (
                                  <MoonIcon className="flex items-center pr-1" />
                                )}
                                {(() => {
                                  const isAllDay =
                                    shift?.shift_start_time === "00:00:00" &&
                                    shift?.shift_end_time === "23:59:59";
                                  return isAllDay
                                    ? "All day time off"
                                    : `${format(
                                        shift?.shift_start_time,
                                        "hh:mm a",
                                      )} - ${format(
                                        shift?.shift_end_time,
                                        "hh:mm a",
                                      )}`;
                                })()}
                              </div>

                              {/* Shift Role Label */}
                              <div className="truncate">
                                {(() => {
                                  if (isTimeOff) return "⊘ TimeOff";

                                  const assignedId = (shift as any)
                                    ?.assigned_to_user_id;
                                  if (assignedId && seniorOptions) {
                                    const senior = seniorOptions.find(
                                      (option: any) =>
                                        option.value === assignedId,
                                    );
                                    return senior?.option || "Care Team";
                                  }

                                  return "Care Team";
                                })()}
                              </div>
                            </div>
                          </div>
                        </DraggableShiftCard>
                      );
                    })}
                  </DroppableCell>
                );
              })}
            </div>
          ))}

          <div>
            <ProtectedComponent
              role={role as Role}
              feature="HCM_SCHEDULING"
              access="EDIT"
            >
              <Button
                name="Add Team Member"
                buttonClick={() => dispatch(handleOpenAddPCGModal())}
                type="button"
                classname="text-white !text-medium w-[200px]"
                titleClass="!text-[16px]"
              />
            </ProtectedComponent>
          </div>
        </div>

        <ProtectedComponent
          role={role as Role}
          feature="HCM_SCHEDULING"
          access="EDIT"
        >
          <div className="grid grid-cols-[200px_repeat(7,minmax(120px,1fr))] border-t text-sm">
            <div className="bg-gray-100 p-2 font-medium m-auto">
              {role === userRoles.PCHO && (
                <div className="text-sm text-gray-600">Wages</div>
              )}
              <div className="text-sm text-gray-600">Hours</div>
            </div>

            {weekDays?.map((date, i) => {
              const dateKey = format(date, "yyyy-MM-dd");
              const shiftsForDay = (userShiftsResp?.shifts || []).filter(
                (shift: any) =>
                  format(new Date(shift?.shift_start_time), "yyyy-MM-dd") ===
                  dateKey,
              );
              const uniqueUserIds = Array.from(
                new Set(
                  shiftsForDay
                    ?.filter(
                      (shift: any) =>
                        shift?.shift_status === "available" &&
                        !filteredTeamMembers?.find(
                          (member) =>
                            member?.userId === shift?.user_id &&
                            member?.isDeleted,
                        ),
                    )
                    ?.map((shift: any) => shift?.user_id),
                ),
              );
              let totalHours = 0;
              let totalWages = 0;
              shiftsForDay
                ?.filter(
                  (shift: any) =>
                    shift?.shift_status === "available" &&
                    !filteredTeamMembers?.find(
                      (member) =>
                        member?.userId === shift?.user_id && member?.isDeleted,
                    ),
                )
                ?.forEach((shift: any) => {
                  const start = new Date(shift?.shift_start_time);
                  const end = new Date(shift?.shift_end_time);
                  const hours =
                    (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  totalHours += hours;
                  const member = filteredTeamMembers?.find(
                    (member) => member?.userId === shift?.user_id,
                  );
                  if (
                    role === userRoles.PCHO &&
                    shift?.pay_rate &&
                    member?.roaster?.[0]?.pay_frequency !== "Monthly"
                  ) {
                    totalWages += hours * shift?.pay_rate;
                  }
                });
              totalHours = Math.round(totalHours * 100) / 100;
              totalWages = Math.round(totalWages * 100) / 100;
              return (
                <div
                  key={i}
                  className="p-2 text-start font-medium border bg-gray-50 flex gap-4"
                >
                  <div className="text-sm text-gray-600 flex gap-1 items-center">
                    {uniqueUserIds?.length}
                    <ProfileIcon />
                  </div>
                  <div>
                    {role === userRoles.PCHO && (
                      <div className="text-sm text-gray-600">${totalWages}</div>
                    )}
                    <div className="text-sm text-gray-600">{totalHours}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ProtectedComponent>

        <DragOverlay>{overlayNode}</DragOverlay>
      </DndContext>
    </div>
  );
};

export default WeekView;
