import React, { useContext, useEffect, useMemo, useState } from "react";
import { format, differenceInMinutes, setMinutes, setHours } from "date-fns";
import Avatar from "../../../commonComponents/avatar";
import {
  InHomeCare,
  MIN_HOURS_DISPLAY_TEXT,
  SENIOR,
  SHIFT_STATUS_AVAILABLE,
  userRoles,
} from "../../../utils/constants";
import { useAppDispatch } from "../../../redux/hooks";
import { handleOpenAddShiftModal } from "../../../redux/slices/modal-slice";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import useUpdateShift from "../../../services/hcm-update-shift";
import { RoleContext } from "../../role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import { useGetHomeType } from "../../../utils/gethomeType";
import { Shift } from "../../../types/hcm-types";
import { generatePDFForDay } from "./generate-day-pdf";

import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import Button from "../../../commonComponents/button";
import { downloadPdf } from "../../../utils/documentUtils";
import { isOvernightShift } from "../utils/timeUtils";
import MoonIcon from "../../../public/icons/moon-icon";
import { OctagonAlert } from "lucide-react";
import { ProtectedComponent } from "../../protectedComponent";

const getTimeLabel = (h: number, m: number = 0) => {
  const date = setMinutes(setHours(new Date(), h), m);
  return format(date, m === 0 ? "ha" : "h:mma");
};

const getMinutesSinceMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes();

const isTimeOff = (s: Shift) => s.shift_status !== SHIFT_STATUS_AVAILABLE;

const hasClock = (shift: any) =>
  Boolean(shift?.clock_in_timestamp) || Boolean(shift?.clock_out_timestamp);

function getMemberPayRate(member?: any): number | undefined {
  if (!member?.roaster?.length) return undefined;
  const found = member.roaster.find((r: any) => r?.pay_rate != null);
  if (!found) return undefined;
  const raw = found.pay_rate;
  return typeof raw === "number"
    ? raw
    : typeof raw === "string"
      ? parseFloat(raw)
      : undefined;
}

const makeContainerId = (userId: string) => userId;
const parseContainerId = (id: string) => ({ userId: String(id) });

// Type used for context-menu calls back to ScheduleBoard
export type ShiftContextMenuArgs = {
  shift: Shift;
  member: any;
  date: Date;
  index: number;
  clientX: number;
  clientY: number;
};

const MemberRowHeader: React.FC<{
  member: any;
  canEdit: boolean;
}> = ({ member, canEdit }) => {
  return (
    <div className="flex w-[200px] items-center justify-center p-2 border bg-gray-50 gap-2 relative">
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
            if (canEdit) {
              const payRates =
                member?.roaster
                  ?.map((e: any) => {
                    const rate = e?.pay_rate;
                    const frequency =
                      e?.pay_frequency === "Monthly" ? "m" : "hr"; // Convert 'Monthly' to 'm' and default to 'hr'
                    return rate != null ? `${rate}/${frequency}` : null;
                  })
                  ?.filter(
                    (rate: any) => rate !== undefined && rate !== null,
                  ) ?? [];
              return payRates.length ? payRates.join(", ") : "--";
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};

const DraggableShift: React.FC<{
  shift: Shift;
  style: React.CSSProperties;
  canDrag: boolean;
  children: React.ReactNode;
  fromUserId: string;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void; // allow click on whole cell
}> = ({
  shift,
  style,
  canDrag,
  children,
  fromUserId,
  onContextMenu,
  onClick,
}) => {
    const dispatch = useAppDispatch();
    const role = useContext(RoleContext)?.role || getUserRoleFromToken();
    const isPCHO = role === userRoles.PCHO;

    const clocked = hasClock(shift);

    const id = shift.id || `${fromUserId}-${shift.shift_start_time}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id,
        data: {
          type: "shift",
          shift,
          fromContainerId: makeContainerId(fromUserId),
        },
        disabled: !canDrag || isTimeOff(shift) || clocked,
      });

    const mergedStyle: React.CSSProperties = {
      ...style,
      transform: transform ? CSS.Translate.toString(transform) : undefined,
      opacity: isDragging ? 0.6 : (style.opacity ?? 1),
      cursor:
        !canDrag || isTimeOff(shift) || (clocked && !isPCHO)
          ? "not-allowed"
          : "grab",
      zIndex: isDragging ? 5 : (style.zIndex ?? 3),
    };

    const handleBlockedAttempt = () => {
      if (clocked && !isPCHO) {
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
        style={mergedStyle}
        {...attributes}
        {...listeners}
        onMouseDown={handleBlockedAttempt}
        className="shift-card"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e); // click anywhere on the card
        }}
      >
        {children}
      </div>
    );
  };

const DroppableMemberRow: React.FC<{
  member: any;
  canEditRow: boolean;
  stacked: { shift: Shift; row: number }[];
  rowHeight: number;
  hourLabels: string[];
  totalColumns: number;
  currentDate: Date;
  openModal: any;
  dispatch: any;
  baseBlockStyle: (shift: Shift, row: number) => React.CSSProperties;
  shouldShowText: (shift: Shift) => boolean;
  onRightClickShift?: (args: ShiftContextMenuArgs) => void;
  seniorOptions?: any[];
  accessDeletedCareTeam?: boolean;
  hasMemberPayRate?: (member: any) => boolean;
  onNoPayRate?: () => void;
  canSeeOverlap?: boolean;
}> = ({
  member,
  canEditRow,
  stacked,
  rowHeight,
  hourLabels,
  totalColumns,
  currentDate,
  openModal,
  dispatch,
  baseBlockStyle,
  shouldShowText,
  onRightClickShift,
  seniorOptions,
  accessDeletedCareTeam,
  hasMemberPayRate,
  onNoPayRate,
  canSeeOverlap,
}) => {
    const role = useContext(RoleContext)?.role || getUserRoleFromToken();
    const { isOver, setNodeRef } = useDroppable({
      id: makeContainerId(member.userId),
    });
    return (
      <div
        className={`${member?.isDeleted ? "opacity-50 coursor-not-allowed" : ""}`}
      >
        <div
          key={member.userId}
          ref={setNodeRef}
          className={`relative group ${isOver ? "ring-2 ring-blue-400" : ""} ${member?.isDeleted ? "pointer-events-none" : ""
            }`}
          style={{ minHeight: rowHeight }}
        >
          {/* Left fixed column */}
          <MemberRowHeader member={member} canEdit={canEditRow} />
          {/* Transparent grid background */}
          <div
            className="grid !min-w-full"
            style={{
              gridTemplateColumns: `repeat(${totalColumns}, 1fr)`,
              pointerEvents: "none",
            }}
          >
            <div />
            {hourLabels.map((_, i) => (
              <div key={i} style={{ background: "transparent" }} />
            ))}
          </div>
          {/* + Add button like week view */}
          {canEditRow && (
            <div
              className="absolute -top-3 left-[650px] text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition cursor-pointer select-none bg-white rounded px-1"
              onClick={(e) => {
                e.stopPropagation();
                if (!member?.isDeleted || accessDeletedCareTeam) {
                  // Check if member has a valid pay_rate before allowing shift creation
                  if (hasMemberPayRate && !hasMemberPayRate(member)) {
                    onNoPayRate?.();
                    return;
                  }
                  openModal(member, currentDate);
                  dispatch(handleOpenAddShiftModal());
                }
              }}
              style={{ zIndex: 2 }}
            >
              + Add
            </div>
          )}
          {/* Shifts */}
          {stacked.map(({ shift, row }, sidx) => {
            const style = baseBlockStyle(shift, row);
            const timeText = `${format(
              new Date(shift.shift_start_time),
              "h:mm a",
            )} - ${format(new Date(shift.shift_end_time), "h:mm a")}`;

            // Get senior name if assigned
            const assignedId = (shift as any)?.assigned_to_user_id;
            const seniorName =
              assignedId && seniorOptions
                ? seniorOptions.find((option: any) => option.value === assignedId)
                  ?.option
                : null;

            const isOverlap = canSeeOverlap && (shift as any)?.isOverlap;
            const conflictText = isOverlap
              ? `Conflict: ${(shift as any)?.user_name || "User"} has another shift this day`
              : "";
            // Tooltip text: always include time, optionally senior name and conflict
            const title = [timeText, seniorName, conflictText]
              .filter(Boolean)
              .join("\n");

            if (isTimeOff(shift)) {
              // Time off – NOT draggable, click anywhere on cell to open
              return (
                <div
                  key={sidx}
                  style={style}
                  title={timeText}
                  onClick={(e) => {
                    if (!canEditRow) return;
                    e.stopPropagation();
                    dispatch(handleOpenAddShiftModal());
                    openModal(member, currentDate, shift, sidx);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRightClickShift?.({
                      shift,
                      member,
                      date: currentDate,
                      index: sidx,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    });
                  }}
                >
                  {shouldShowText(shift) && (
                    <div className="flex items-center gap-1">
                      {isOvernightShift(shift) && (
                        <MoonIcon className="inline-block -mt-0.5 text-gray-500" />
                      )}
                      <span>⊘ TimeOff {timeText}</span>
                    </div>
                  )}
                </div>
              );
            }

            // Available shift – draggable, click anywhere on card to open
            const clocked = hasClock(shift);
            const onClickShift = (e: React.MouseEvent<HTMLDivElement>) => {
              if (!canEditRow) return;
              e.stopPropagation();
              if (clocked && role !== "PCHO") {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                  handleShowPopoverMessage(
                    "Care Team has already logged time for this shift and cannot be edited or moved.",
                  ),
                );
                return;
              }
              dispatch(handleOpenAddShiftModal());
              openModal(member, currentDate, shift, sidx);
            };

            return (
              <DraggableShift
                key={sidx}
                shift={shift}
                fromUserId={String(shift.user_id)}
                style={style}
                canDrag={canEditRow}
                onClick={onClickShift} //  click anywhere on the shift cell
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRightClickShift?.({
                    shift,
                    member,
                    date: currentDate,
                    index: sidx,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                }}
              >
                <div
                  title={title}
                  className="flex flex-col items-start gap-0.5 truncate"
                >
                  <div className="flex items-center gap-1">
                    {isOverlap && (
                      <OctagonAlert
                        size={12}
                        className="flex-shrink-0 text-red-600 fill-red-600 [&>path]:stroke-white"
                      />
                    )}
                    {isOvernightShift(shift) && (
                      <MoonIcon className="inline-block -mt-0.5 text-gray-500" />
                    )}
                    {shouldShowText(shift) && <span>{timeText}</span>}
                  </div>
                  {seniorName && (
                    <div className="text-[10px] leading-tight truncate">
                      {seniorName}
                    </div>
                  )}
                </div>
              </DraggableShift>
            );
          })}
        </div>
      </div>
    );
  };

const DayView = ({
  currentDate,
  teamMembers,
  openModal,
  onRightClickShift,
  seniorOptions,
  hasMemberPayRate,
  onNoPayRate,
}: {
  currentDate: Date;
  teamMembers: Array<{
    userId: string;
    name: string;
    profileImageUrl?: string;
    roaster?: any[];
    isDeleted?: boolean;
  }>;
  openModal: (
    member: any,
    date: Date,
    shift?: Shift,
    idxInRow?: number,
  ) => void;
  onRightClickShift?: (args: ShiftContextMenuArgs) => void;
  seniorOptions?: any[];
  hasMemberPayRate?: (member: any) => boolean;
  onNoPayRate?: () => void;
}) => {
  const userHomeId = getHomeIdFromToken();
  const createdByUserId = getUserIdFromToken();
  const LoggedInUserId = getUserIdFromToken();
  const isInhomeCare = useGetHomeType() === InHomeCare;

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(
    () => contextRole || getUserRoleFromToken(),
  );
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const isSeniorInhomeCare = isInhomeCare && role === SENIOR;

  // Only PCHO and HomeAdmin should see shift overlap/conflict indicators
  const canSeeOverlap = hasAccess(role as Role, "HCM_SCHEDULING_OVERLAP", "EDIT");

  const canEdit = hasAccess(role as Role, "HCM_SCHEDULING", "EDIT");

  // Check access for deleted care team members
  const accessDeletedCareTeam = hasAccess(
    role as Role,
    "VIEW_DELETED_CARETEAM",
    "EDIT",
  );

  // Fetch shifts for the current day
  const startOfDayIso = new Date(currentDate);
  startOfDayIso.setHours(0, 0, 0, 0);

  const endOfDayIso = new Date(currentDate);
  endOfDayIso.setHours(23, 59, 59, 999);

  const shift_start_time = [
    startOfDayIso.toISOString(),
    endOfDayIso.toISOString(),
  ];

  const { data: userShiftsResp, isLoading } = useGetAllShifts({
    key: "shifts",
    params: {
      shift_start_time,
      home_id: userHomeId,
    },
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
          .map((shift: any) => shift.user_id)
      );

      members = members?.filter((member) =>
        seniorAssignedPCGIds.has(member.userId)
      );
    }

    return members;
  }, [teamMembers, accessDeletedCareTeam, isSeniorInhomeCare, userShiftsResp, LoggedInUserId]);

  // Filter shifts for senior in home care
  const filteredShifts = useMemo(() => {
    let shifts = userShiftsResp?.shifts || [];
    if (isSeniorInhomeCare) {
      shifts = shifts.filter(
        (shift: any) => shift.assigned_to_user_id === LoggedInUserId,
      );
    }
    // Hide overlapping shifts from everyone except PCHO and HomeAdmin
    if (!canSeeOverlap) {
      shifts = shifts.filter((shift: any) => !shift?.isOverlap);
    }
    return shifts;
  }, [userShiftsResp, isSeniorInhomeCare, LoggedInUserId, canSeeOverlap]);

  // local optimistic state
  const [shifts, setShifts] = useState<Shift[]>([]);
  useEffect(() => {
    setShifts(filteredShifts as Shift[]);
  }, [filteredShifts]);

  // time boundaries
  let minMinute = 8 * 60;
  let maxMinute = 18 * 60;
  if (shifts?.length > 0) {
    const mins = shifts.flatMap((s) => [
      getMinutesSinceMidnight(new Date(s.shift_start_time)),
      getMinutesSinceMidnight(new Date(s.shift_end_time)),
    ]);
    minMinute = Math.min(...mins);
    maxMinute = Math.max(...mins);
    minMinute = Math.max(minMinute - 60, 0);
    maxMinute = Math.min(maxMinute + 60, 24 * 60);
  }
  minMinute = Math.floor(minMinute / 60) * 60;
  maxMinute = Math.ceil(maxMinute / 60) * 60;

  const hourLabels: string[] = [];
  for (let min = minMinute; min < maxMinute; min += 60) {
    hourLabels?.push(getTimeLabel(Math.floor(min / 60)));
  }
  const totalColumns = hourLabels.length;

  const getMemberShifts = (memberId: string) =>
    shifts.filter((s) => String(s.user_id) === String(memberId));

  const getStackedShifts = (memberId: string) =>
    getMemberShifts(memberId).map((shift, i) => ({ shift, row: i }));

  const hourSpan = maxMinute - minMinute;
  const baseBlockStyle = (shift: Shift, row: number): React.CSSProperties => {
    const start = new Date(shift.shift_start_time);
    const end = new Date(shift.shift_end_time);
    const shiftStartMinute = getMinutesSinceMidnight(start);
    const shiftEndMinute = getMinutesSinceMidnight(end);

    const leftPct = ((shiftStartMinute - minMinute) / hourSpan) * 100;
    const widthPct = ((shiftEndMinute - shiftStartMinute) / hourSpan) * 100;

    return {
      position: "absolute",
      left: `calc(${leftPct}% + 200px)`,
      width: `calc(${widthPct}% - 4px)`,
      top: 8 + row * 38,
      height: 32,
      backgroundColor: isTimeOff(shift)
        ? "#80808033"
        : shift?.shift_color
          ? `${shift.shift_color as string}33`
          : "#b8e0fa99",
      border: `2px solid ${isTimeOff(shift)
        ? "#808080"
        : (shift?.shift_color as string) || "#3089AB"
        }`,
      borderRadius: "6px",
      cursor: "pointer",
      padding: "0 8px",
      display: "flex",
      alignItems: "center",
      zIndex: 3,
      fontSize: "13px",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    };
  };

  const shouldShowText = (shift: Shift) => {
    const start = new Date(shift?.shift_start_time);
    const end = new Date(shift?.shift_end_time);
    const durationMinutes = differenceInMinutes(end, start);
    return durationMinutes >= MIN_HOURS_DISPLAY_TEXT * 60;
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const s: Shift | undefined = e.active?.data?.current?.shift;
    if (s) setActiveShift(s);
  };

  const dispatch = useAppDispatch();
  const { mutate: updateShift } = useUpdateShift();

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveShift(null);
    if (!over || !active?.data?.current) return;

    const fromContainerId: string = active.data.current.fromContainerId;
    const { userId: fromUserId } = parseContainerId(fromContainerId);
    const { userId: toUserId } = parseContainerId(String(over.id));
    if (fromUserId === toUserId) return;

    const shift: Shift = active.data.current.shift;

    // Check if target member has a valid pay_rate before allowing shift move
    const targetMember = filteredTeamMembers.find(
      (m) => String(m.userId) === String(toUserId),
    );
    if (targetMember && hasMemberPayRate && !hasMemberPayRate(targetMember)) {
      // show no pay rate modal
      onNoPayRate?.();
      return;
    }

    // derive pay rate from target member
    const newMember = filteredTeamMembers.find(
      (m) => String(m.userId) === String(toUserId),
    );
    const rawPay =
      newMember?.roaster?.find?.((r: any) => r?.pay_rate != null)?.pay_rate ??
      0;
    const nextPayPerHour =
      typeof rawPay === "number" ? rawPay : parseFloat(String(rawPay) || "0");

    const payload = {
      id: shift.id,
      user_id: String(toUserId),
      home_id: userHomeId,
      created_by_user_id: createdByUserId,
      shift_status: shift.shift_status,
      shift_color: shift.shift_color,
      notes: shift.notes,
      pay_rate: nextPayPerHour, // number
      shift_start_time: new Date(shift.shift_start_time).toISOString(),
      shift_end_time: new Date(shift.shift_end_time).toISOString(),
    };

    updateShift(payload, {
      onSuccess: () => {
        setShifts((prev) =>
          prev.map((s) =>
            s.id === shift.id
              ? {
                ...s,
                user_id: String(toUserId),
                pay_rate: nextPayPerHour,
              }
              : s,
          ),
        );
      },
      onError: (error: any) => {
        let apiErr = error?.response?.data?.error;
        if (error?.status === 403) {
          apiErr = error?.response?.data?.message;
        }
        const message =
          (Array.isArray(apiErr) && apiErr[0]?.message) ||
          (typeof apiErr === "string" && apiErr) ||
          error?.response?.data?.message ||
          "Shift overlaps with existing shifts";
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(message));
      },
    });
  };

  // Overlay node
  const overlayNode = useMemo(() => {
    if (!activeShift) return null;
    const start = new Date(activeShift.shift_start_time);
    const end = new Date(activeShift.shift_end_time);
    const timeText = `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
    const tOff = isTimeOff(activeShift);
    return (
      <div
        className={
          tOff
            ? "relative px-2 py-1 mt-1 rounded text-xs border-solid border-2"
            : "relative bg-blue-100 px-2 py-1 mt-1 rounded text-xs border-dotted border-2"
        }
        style={{
          borderColor: tOff ? "#808080" : (activeShift.shift_color as string),
          backgroundColor: tOff
            ? "#ffffff33"
            : activeShift.shift_color
              ? `${String(activeShift.shift_color)}33`
              : undefined,
        }}
      >
        <div className="text-[10.5px] w-[140px]">{timeText}</div>
      </div>
    );
  }, [activeShift]);

  const handlePrint = async () => {
    if (!shifts) return;

    // Filter out deleted PCGs and their shifts
    const remainingPCGs = filteredTeamMembers.filter(
      (member) => !member?.isDeleted,
    );
    const shiftsForDownload = shifts.filter((shift) =>
      remainingPCGs.some((member) => member.userId === shift.user_id),
    );

    // Generate PDF with filtered data
    const pdfBytes = await generatePDFForDay(
      remainingPCGs,
      currentDate,
      {
        shifts: shiftsForDownload,
      },
      seniorOptions,
      isInhomeCare,
    );

    downloadPdf(pdfBytes, "daily_schedule", currentDate);
  };

  if (isLoading) return <Loader fullScreen={false} />;

  // Check if there are no shifts assigned for in-home care seniors
  if (isSeniorInhomeCare && filteredTeamMembers?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-lg font-medium">No shifts assigned today</div>
        <div className="text-sm mt-2">You don't have any care team shifts scheduled for today.</div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <ProtectedComponent
          role={role as Role}
          feature={"HCM_SCHEDULING"}
          access={"EDIT"}
        >
          <div className="flex justify-end mb-4">
            <Button
              name="Print"
              buttonClick={handlePrint}
              classname="bg-blue-500 text-white"
            />
          </div>
        </ProtectedComponent>
        <div className="space-y-2">
          {/* Top time label row */}
          <div
            className="grid min-w-fit"
            style={{ gridTemplateColumns: `200px repeat(${totalColumns}, 1fr)` }}
          >
            <div />
            {hourLabels?.map((label, i) => (
              <div
                key={i}
                className="text-xs text-center text-gray-700 font-medium"
                style={{ minWidth: 60, background: "#f8fafc" }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}

          {filteredTeamMembers?.map((member) => {
            const canEditRow = canEdit;
            const stacked = getStackedShifts(member?.userId);
            const rowHeight = stacked?.length > 0 ? stacked.length * 38 + 12 : 48;
            return (
              <DroppableMemberRow
                key={member.userId}
                member={member}
                canEditRow={canEditRow}
                stacked={stacked}
                rowHeight={rowHeight}
                hourLabels={hourLabels}
                totalColumns={totalColumns}
                currentDate={currentDate}
                openModal={openModal}
                dispatch={dispatch}
                baseBlockStyle={baseBlockStyle}
                shouldShowText={shouldShowText}
                onRightClickShift={onRightClickShift}
                seniorOptions={seniorOptions}
                canSeeOverlap={canSeeOverlap}
                accessDeletedCareTeam={accessDeletedCareTeam}
                hasMemberPayRate={hasMemberPayRate}
                onNoPayRate={onNoPayRate}
              />
            );
          })}
        </div>
        <DragOverlay>{overlayNode}</DragOverlay>
      </DndContext>
    </>
  );
};

export default DayView;
