import React, { useContext, useEffect, useState, useMemo } from "react";
import { format, isSameDay, isSameMonth } from "date-fns";
import useGetShifts from "../../../services/hcm-getall-shifts";
import { handleOpenAddShiftModal } from "../../../redux/slices/modal-slice";
import { useAppDispatch } from "../../../redux/hooks";
import {
  GetUsersPath,
  InHomeCare,
  SENIOR,
  SHIFT_STATUS_AVAILABLE,
  userRoles,
  WEEK_DAYS_SHORT,
} from "../../../utils/constants";
import { RoleContext } from "../../role-provider";
import { ProtectedComponent } from "../../protectedComponent";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserRoleFromToken,
  getUserIdFromToken,
} from "../../../utils/auth";
import { useGetHomeType } from "../../../utils/gethomeType";
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
import useUpdateShift from "../../../services/hcm-update-shift";

import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { useDispatch } from "react-redux";
import useGetAll from "../../../services/getAll";
import { generatePDFForMonth } from "./generate-month-pdf";
import Button from "../../../commonComponents/button";
import { downloadPdf } from "../../../utils/documentUtils";
import { Shift } from "../../../types/hcm-types";
import { isOvernightShift } from "../utils/timeUtils";
import MoonIcon from "../../../public/icons/moon-icon";
import { OctagonAlert } from "lucide-react";

interface MonthViewProps {
  daysInMonth: Date[];
  currentDate: Date;
  teamMembers: any[]; // PCGs
  openModal: (member: any, date: Date, shift?: any, index?: number) => void;

  selectedShiftToCopy?: any | null;
  isCopyingShift?: boolean;
  onCopyCellClick?: (member: any, dateKey: string) => void;
  seniorOptions?: any[];

  // ✅ new: right-click actions (copy / delete)
  onRightClickShift?: (args: {
    shift: Shift;
    member: any;
    date: Date;
    index: number;
    clientX: number;
    clientY: number;
  }) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  daysInMonth,
  currentDate,
  teamMembers,
  openModal,
  selectedShiftToCopy = null,
  isCopyingShift = false,
  onCopyCellClick,
  onRightClickShift,
  seniorOptions,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get start and end of month as ISO strings
  const startOfMonth = new Date(daysInMonth[0]);
  startOfMonth?.setHours(0, 0, 0, 0);

  const contextRole = useContext(RoleContext)?.role||getUserRoleFromToken();
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const endOfMonth = new Date(daysInMonth[daysInMonth?.length - 1]);
  endOfMonth?.setHours(23, 59, 59, 999);

  const shift_start_time = [
    startOfMonth?.toISOString(),
    endOfMonth?.toISOString(),
  ];
  const userHomeId = getHomeIdFromToken();
  const createdByUserId = getUserIdFromToken();
  const LoggedInUserId = getUserIdFromToken();
  const isInhomeCare = useGetHomeType() === InHomeCare;

  const isSeniorInhomeCare = isInhomeCare && role === SENIOR;

  // Only PCHO and HomeAdmin should see shift overlap/conflict indicators
  const canSeeOverlap = hasAccess(role as Role, "HCM_SCHEDULING_OVERLAP", "EDIT");

  // Check access for deleted care team members
  const accessDeletedCareTeam = hasAccess(
    role as Role,
    "VIEW_DELETED_CARETEAM",
    "EDIT",
  );

  // Filter team members based on access: show all PCGs if has access, otherwise show only non-deleted
  const filteredTeamMembers = accessDeletedCareTeam
    ? teamMembers // Show all PCGs (both deleted and active)
    : teamMembers?.filter((member) => !member?.isDeleted); // Show only non-deleted PCGs
  const { data: AllPCGs } = useGetAll({
    key: "userId",
    params: { homeId: userHomeId || "", userType: userRoles.PCG },
    path: GetUsersPath,
  });
  const deletedPCG = AllPCGs?.users?.filter((u) => u.isDeleted === true);

  const deletedPCGIds = deletedPCG?.map((user) => user.userId) || [];

  // Fetch shifts for the month
  const { data: fetchedUserShifts, isLoading } = useGetShifts({
    key: "shifts",
    params: {
      shift_start_time: shift_start_time,
      home_id: userHomeId,
    },
  });

  // Filter shifts for senior in home care
  const allShifts = useMemo(() => {
    let shifts = fetchedUserShifts?.shifts || [];
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
  }, [fetchedUserShifts, isSeniorInhomeCare, LoggedInUserId, canSeeOverlap]);
  const dispatch = useAppDispatch();

  // DnD helpers
  const makeContainerId = (userId: string, dateKey: string) =>
    `${userId}::${dateKey}`;
  const parseContainerId = (id: string) => {
    const [userId, dateKey] = id.split("::");
    return { userId, dateKey };
  };

  // Draggable shift card
  const DraggableShiftCard: React.FC<{
    shift: any;
    member: any;
    dateKey: string;
    canDrag: boolean;
    children: React.ReactNode;
    onContextMenu?: (e: React.MouseEvent) => void;
  }> = ({ shift, member, dateKey, canDrag, children, onContextMenu }) => {
    const dispatch = useDispatch();
    const isPCHO = role === userRoles.PCHO;

    // Check if the shift has clock-in or clock-out timestamps
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
        // disable drag if editing not allowed, not available, or already clocked
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
        onContextMenu={(e) => {
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
    onCellClick?: () => void;
  }> = ({ id, children, onCellClick }) => {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
      <div
        ref={setNodeRef}
        className={`p-2 hover:bg-blue-50 relative group cursor-pointer min-h-[120px] border border-solid border-[#bed5df2b] rounded-sm m-0.5 ${isOver ? "ring-2 ring-blue-400" : ""
          }`}
        onClick={onCellClick}
      >
        {children}
      </div>
    );
  };

  const [shifts, setShifts] = useState<any[]>([]);
  useEffect(() => {
    setShifts(allShifts);
  }, [allShifts]);

  const canEdit = hasAccess(role as Role, "HCM_SCHEDULING", "EDIT");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const { mutate: updateShift } = useUpdateShift();

  const onDragStart = (event: any) => {
    const s: any = event.active?.data?.current?.shift;
    if (s) setActiveShift(s);
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveShift(null);
    if (!over || !active?.data?.current) return;

    const fromContainerId: string = active.data.current.fromContainerId;
    const { dateKey: fromDateKey } = parseContainerId(fromContainerId);

    // Over id might be "all::<dateKey>" — only date matters
    const overIdStr = String(over.id);
    const toDateKey = overIdStr.includes("::")
      ? overIdStr.split("::")[1]
      : overIdStr;

    const shift: any = active.data.current.shift;

    // Same day? nothing to do
    if (fromDateKey === toDateKey) return;

    // Month view drop changes only the date; keep the same assigned user
    const toUserId = String(shift.user_id);

    // Compute new start/end by keeping time-of-day, changing date
    const oldStart = new Date(shift.shift_start_time);
    const oldEnd = new Date(shift.shift_end_time);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const [y, m, d] = toDateKey.split("-").map((n: string) => parseInt(n, 10));
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

    // normalize pay_per_hour to a number
    const payRaw = shift?.pay_rate;
    const pay_rate =
      typeof payRaw === "number"
        ? payRaw
        : typeof payRaw === "string"
          ? parseFloat(payRaw || "0")
          : 0;

    // Optimistic UI update
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shift.id
          ? {
            ...s,
            user_id: toUserId,
            shift_start_time: newStart.toISOString(),
            shift_end_time: newEnd.toISOString(),
            pay_rate, // keep numeric locally too
          }
          : s,
      ),
    );

    // Build update payload (include created_by_user_id)
    const updatePayload = {
      id: shift.id,
      user_id: toUserId,
      home_id: userHomeId,
      created_by_user_id: createdByUserId,
      shift_status: shift.shift_status,
      shift_color: shift.shift_color,
      notes: shift.notes,
      pay_rate,
      shift_start_time: newStart.toISOString(),
      shift_end_time: newEnd.toISOString(),
    };

    updateShift(updatePayload, {
      onError: (error: any) => {
        setShifts((prev) => prev.map((s) => (s.id === shift.id ? shift : s)));
        const backendMsg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Shift overlaps with existing shifts";
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(backendMsg));
      },
    });
  };

  // Handle click on today's date
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
  };

  const handlePrint = async () => {
    if (!allShifts) return;

    // Filter out deleted PCGs and their shifts
    const remainingPCGs = filteredTeamMembers.filter(
      (member) => !deletedPCGIds.includes(member.userId),
    );
    const shiftsForDownload = allShifts.filter((shift) =>
      remainingPCGs.some((member) => member.userId === shift.user_id),
    );

    // Generate PDF with filtered data
    const adjustedStartOfMonth = new Date(startOfMonth);
    adjustedStartOfMonth.setDate(adjustedStartOfMonth.getDate() + 8);

    const pdfBytes = await generatePDFForMonth(
      daysInMonth,
      remainingPCGs,
      { shifts: shiftsForDownload },
      format(adjustedStartOfMonth, "MMMM yyyy"),
      seniorOptions,
      isInhomeCare,
    );

    downloadPdf(pdfBytes, "monthly_schedule", currentDate);
  };

  if (isLoading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <>
      {/* Add the Print button at the top of the MonthView */}
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
        <div className="grid grid-cols-7 text-sm font-medium text-center text-gray-700">
          {WEEK_DAYS_SHORT?.map((day) => (
            <div key={day} className="p-2 border-b">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-sm">
          {daysInMonth?.map((date, i) => {
            const dateKey = format(date, "yyyy-MM-dd");

            const isToday = isSameDay(date, new Date());

            // Highlight today or the selected day with a blue border
            const isSelected = dateKey === selectedDate || isToday;

            const handleCellClick = () => {
              if (!hasAccess(role as Role, "HCM_SCHEDULING", "EDIT")) return;

              // If copying: paste for the SAME PCG (selectedShiftToCopy.user_id); only change date
              if (isCopyingShift && selectedShiftToCopy && onCopyCellClick) {
                const originalUserId = String(selectedShiftToCopy.user_id);
                const member = filteredTeamMembers.find(
                  (m: any) => String(m.userId) === originalUserId,
                );
                if (member) {
                  onCopyCellClick(member, dateKey);
                }
                return;
              }

              // Normal flow: open modal to add
              openModal("", date);
              dispatch(handleOpenAddShiftModal());
            };

            return (
              <DroppableCell
                key={i}
                id={makeContainerId("all", dateKey)}
                onCellClick={handleCellClick}
              >
                <div
                  className={`text-xs font-medium flex justify-between items-center ${isSelected
                    ? "border-solid border-2 rounded-xl border-blue-500"
                    : ""
                    }`}
                >
                  {format(date, "dd")}
                  <ProtectedComponent
                    role={role as Role}
                    feature="HCM_SCHEDULING"
                    access="EDIT"
                  >
                    <span className="text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition">
                      {isCopyingShift ? "Paste Shift" : "+ Add"}
                    </span>
                  </ProtectedComponent>
                </div>

                {filteredTeamMembers?.flatMap((member: any) =>
                  shifts
                    ?.filter(
                      (shift: any) =>
                        shift?.user_id === member?.userId &&
                        format(
                          new Date(shift?.shift_start_time),
                          "yyyy-MM-dd",
                        ) === dateKey,
                    )
                    .map((shift: any, idx: number) => {
                      const shiftDeleted = deletedPCGIds?.includes(
                        shift?.user_id,
                      );
                      if (shift?.shift_status === "timeoff") {
                        return (
                          <div
                            key={`timeoff-${shift.id}-${idx}`}
                            className={`${shiftDeleted
                              ? "opacity-50 my-[2px] cursor-not-allowed"
                              : ""
                              } shift-card`}
                            onContextMenu={(e) => {
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
                              className={`relative px-2 py-1 mt-1 rounded text-xs border-2 cursor-pointer group ${shiftDeleted
                                ? "pointer-events-none"
                                : "cursor-pointer "
                                }`}
                              style={{
                                borderColor: "#808080",
                                backgroundColor: "#ffffff",
                              }}
                              onClick={(e) => {
                                if (
                                  hasAccess(
                                    role as Role,
                                    "HCM_SCHEDULING",
                                    "EDIT",
                                  )
                                ) {
                                  e.stopPropagation();
                                  if (!isCopyingShift) {
                                    const member = filteredTeamMembers.find(
                                      (m: any) =>
                                        String(m.userId) ===
                                        String(shift?.user_id),
                                    );
                                    if (
                                      !member?.isDeleted ||
                                      accessDeletedCareTeam
                                    ) {
                                      openModal(
                                        shift?.user_id,
                                        date,
                                        shift,
                                        idx,
                                      );
                                      dispatch(handleOpenAddShiftModal());
                                    }
                                  }
                                }
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
                              <div className="!text-[13px] w-[135px] truncate">
                                {format(
                                  new Date(shift?.shift_start_time),
                                  "hh:mm a",
                                )}{" "}
                                –{" "}
                                {format(
                                  new Date(shift?.shift_end_time),
                                  "hh:mm a",
                                )}
                              </div>
                              <div
                                className="w-[130px] truncate"
                                title={member?.name}
                              >
                                {member?.name}
                              </div>
                              <div className="w-[130px] font-medium">
                                ✖ TimeOff
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // AVAILABLE SHIFT (DRAGGABLE)
                      return (
                        <DraggableShiftCard
                          key={shift.id}
                          shift={shift}
                          member={member}
                          dateKey={dateKey}
                          canDrag={canEdit && !isCopyingShift}
                          onContextMenu={(e) => {
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
                            className={`relative group/shift ${shiftDeleted
                              ? "opacity-50 my-[2px] cursor-not-allowed"
                              : ""
                              }`}
                          >
                            {/* Conflict tooltip - shown on hover of entire shift */}
                            {canSeeOverlap && (shift as any)?.isOverlap && (
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 hidden group-hover/shift:block bg-[#1f0a3a] text-white text-[11px] leading-snug rounded-md px-3 py-2 w-[220px] shadow-lg whitespace-normal">
                                {`Conflict: ${(shift as any)?.user_name || "User"
                                  } has another shift this day`}
                              </span>
                            )}
                            <div
                              className={`relative px-2 py-1 mt-1 rounded text-xs border-2 cursor-pointer bg-blue-100 border-dotted hover:bg-blue-200 ${shiftDeleted
                                ? "pointer-events-none"
                                : "cursor-pointer "
                                }`}
                              style={{
                                borderColor: shift?.shift_color,
                                backgroundColor: shift?.shift_color
                                  ? `${shift?.shift_color}33`
                                  : undefined,
                              }}
                              onClick={(e) => {
                                if (
                                  hasAccess(
                                    role as Role,
                                    "HCM_SCHEDULING",
                                    "EDIT",
                                  )
                                ) {
                                  e.stopPropagation();
                                  if (!isCopyingShift) {
                                    const member = filteredTeamMembers.find(
                                      (m: any) =>
                                        String(m.userId) ===
                                        String(shift?.user_id),
                                    );
                                    if (
                                      !member?.isDeleted
                                    ) {
                                      openModal(
                                        shift?.user_id,
                                        date,
                                        shift,
                                        idx,
                                      );
                                      dispatch(handleOpenAddShiftModal());
                                    }
                                  }
                                }
                              }}
                            >
                              <div className="!text-[13px] flex items-center">
                                {canSeeOverlap && (shift as any)?.isOverlap && (
                                  <OctagonAlert
                                    size={12}
                                    className="flex-shrink-0 mr-1 text-red-600 fill-red-600 [&>path]:stroke-white"
                                  />
                                )}
                                {isOvernightShift(shift) && (
                                  <MoonIcon className="flex items-center pr-1" />
                                )}
                                {format(
                                  new Date(shift?.shift_start_time),
                                  "hh:mm a",
                                )}{" "}
                                –{" "}
                                {format(
                                  new Date(shift?.shift_end_time),
                                  "hh:mm a",
                                )}
                              </div>
                              <div
                                className="w-[130px] truncate"
                                title={member?.name}
                              >
                                {member?.name}
                              </div>
                              <div className="w-[130px] text-gray-500">
                                {(() => {
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
                    }),
                )}
              </DroppableCell>
            );
          })}
        </div>
        <DragOverlay>
          {activeShift && (
            <div
              className={
                activeShift.shift_status === "timeoff"
                  ? "relative px-2 py-1 mt-1 rounded text-xs border-solid border-2"
                  : "relative bg-blue-100 px-2 py-1 mt-1 rounded text-xs border-dotted border-2"
              }
              style={{
                borderColor:
                  activeShift.shift_status === "timeoff"
                    ? "#808080"
                    : activeShift.shift_color,
                backgroundColor:
                  activeShift.shift_status === "timeoff"
                    ? "#ffffff33"
                    : activeShift.shift_color
                      ? `${activeShift.shift_color}33`
                      : undefined,
              }}
            >
              <div className="!text-[13px] w-[135px] truncate">
                {format(new Date(activeShift.shift_start_time), "hh:mm a")} –{" "}
                {format(new Date(activeShift.shift_end_time), "hh:mm a")}
              </div>
              <div className="w-[130px] truncate">
                {activeShift.shift_status === "timeoff"
                  ? "✖ TimeOff"
                  : (() => {
                    const assignedId = (activeShift as any)
                      ?.assigned_to_user_id;
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
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default MonthView;
