import React, { useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parse, parseISO } from "date-fns";
import { RoleContext } from "../../../components/role-provider";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import { Role } from "../../../utils/roles";
import { ProtectedComponent } from "../../../components/protectedComponent";
import {
    BarChart3,
    BookText,
    CheckCircle2,
    Clock,
    Download,
} from "lucide-react";
import MenuIcon from "../../../public/icons/menu-icon";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import Loader from "../../../commonComponents/loader";
import PopoverComponent from "../../../commonComponents/popover-component";
import SelectComponent from "../../../commonComponents/select-component";
import StatsCard from "../../../commonComponents/stats-card";
import ToggleButton from "../../../commonComponents/toggle-button";
import useGetAll from "../../../services/getAll";
import useUpsert from "../../../services/upsert";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import {
    TASK_TRACKING_SHIFT_OPTIONS,
    TASK_TRACKING_STATUS_OPTIONS,
    TASK_TRACKING_STATUS_BADGE_STYLES,
    hcmTaskDailyTrackingPath,
    userRoles,
} from "../../../utils/constants";
import { getTaskTimeBoundaries } from "../../../utils/dateUtils";
import TaskChat from "./task-chat";
import TaskFilters from "./task-filters";

type TrackingStatus = "Completed" | "Pending";

interface TrackingTask {
    id: string;
    tracking_id?: string;
    task_id: string;
    task: string;
    type: string;
    caregiver: string;
    shift: string;
    notes?: string;
    comment?: string;
    comments: {
        user_id: string;
        comment: string;
        created_at?: string;
        username?: string;
        userprofileimage?: string;
    }[];
    completed: string | null;
    status: TrackingStatus;
    date: string;
    updated_at?: string;
    updated_by_user_id?: string;
    assigned_to_user_id?: string | null;
}

const normalizeMerged = (item: any, date: string): TrackingTask => {
    const comments = item?.comments || [];
    const lastComment = comments[comments.length - 1]?.comment;
    const isCompleted = item?.status === "completed";
    const status = isCompleted ? "Completed" : "Pending";
    const completed =
        isCompleted && item?.tracking_updated_at
            ? format(parseISO(item.tracking_updated_at), "h:mm a")
            : null;
    const shift = item.shift
        ? item.shift.charAt(0).toUpperCase() + item.shift.slice(1)
        : "Morning";
    return {
        id: item?.tracking_id || item.id,
        tracking_id: item?.tracking_id,
        task_id: item.id,
        task: item.title,
        type: item.type || "Other",
        caregiver: item.assigned_to?.name || item.updated_by_user_name || item.created_by_user_name || "—",
        shift,
        notes: item.shift_notes,
        comment: lastComment,
        comments,
        completed,
        status,
        date,
        updated_at: item.tracking_updated_at,
        updated_by_user_id: item.updated_by_user_id,
        assigned_to_user_id: item.assigned_to_user_id,
    };
};



const StatusBadge = ({ status }: { status: TrackingStatus }) => (
    <span
        className={`flex rounded-full px-3 py-1 text-xs font-medium ${TASK_TRACKING_STATUS_BADGE_STYLES[status]} w-[100px]`}
    >
        {status}
    </span>
);

interface TaskActionMenuProps {
    task: TrackingTask;
    onMarkDone: (task: TrackingTask) => void;
    onMarkPending: (task: TrackingTask) => void;
    onEdit: (task: TrackingTask) => void;
}

const TaskActionMenu = ({ task, onMarkDone, onMarkPending, onEdit }: TaskActionMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <PopoverComponent
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            body={
                <div className="w-[140px]">
                    <div
                        className={`p-[5px] font-poppins ${task.status === "Completed"
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-lightgray hover:rounded-md"
                            }`}
                        onClick={() => {
                            if (task.status === "Completed") return;
                            setIsOpen(false);
                            onMarkDone(task);
                        }}
                    >
                        Mark as done
                    </div>
                    <div
                        className={`p-[5px] font-poppins ${task.status === "Pending"
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-lightgray hover:rounded-md"
                            }`}
                        onClick={() => {
                            if (task.status === "Pending") return;
                            setIsOpen(false);
                            onMarkPending(task);
                        }}
                    >
                        Mark as pending
                    </div>
                    {/* <div
                        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                        onClick={() => {
                            setIsOpen(false);
                            onEdit(task);
                        }}
                    >
                        Edit
                    </div> */}
                </div>
            }
        >
            <MenuIcon />
        </PopoverComponent>
    );
};

const TaskNotesIcon = ({ notes }: { notes?: string }) => {
    const [isVisible, setIsVisible] = useState(false);

    if (!notes) return null;

    return (
        <div
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <BookText
                size={16}
                className="text-primary cursor-pointer"
            />
            {isVisible && (
                <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-[200px] p-2 bg-white border border-gray-200 rounded-md shadow-lg">
                    <p className="text-xs text-gray-700 font-poppins break-words">
                        {notes}
                    </p>
                </div>
            )}
        </div>
    );
};

const TaskStatus = () => {
    const role = useContext(RoleContext)?.role || getUserRoleFromToken();
    const homeId = getHomeIdFromToken();
    const userId = getUserIdFromToken();
    const dispatch = useAppDispatch();

    const [search, setSearch] = useState("");
    const [caregiverFilter, setCaregiverFilter] = useState("");
    const [shiftFilter, setShiftFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const dateInputRef = useRef<HTMLInputElement>(null);
    const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

    const [editingTask, setEditingTask] = useState<TrackingTask | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<TrackingTask>>({});

    const selectedDateString = useMemo(
        () => format(selectedDate, "yyyy-MM-dd"),
        [selectedDate]
    );

    const { data: trackingResponse, isLoading: isTrackingLoading } = useGetAll({
        key: "task-daily-tracking",
        path: hcmTaskDailyTrackingPath,
        params: homeId
            ? {
                home_id: homeId,
                date: selectedDateString,
                ...(userId ? { user_id: userId } : {}),
                ...(role === userRoles.PCG ? getTaskTimeBoundaries(selectedDateString) : {}),
            } : undefined,
        enabled: !!homeId && !!userId,
    });

    const queryClient = useQueryClient();
    const { mutate: upsertTaskDailyTracking } = useUpsert();

    const tasks = trackingResponse?.tasks || [];

    const data = useMemo<TrackingTask[]>(() => {
        return tasks.map((task: any) =>
            normalizeMerged(task, selectedDateString)
        );
    }, [tasks, selectedDateString]);

    const caregiverOptions = useMemo(
        () => [
            { option: "All Caregivers", value: "" },
            ...Array.from(new Set(data.map((item) => item.caregiver)))
                .filter(Boolean)
                .map((caregiver) => ({ option: caregiver, value: caregiver })),
        ],
        [data]
    );

    const filteredData = useMemo(() => {
        const term = search.toLowerCase();
        return data.filter((item) => {
            const matchesDate = item.date === selectedDateString;
            const matchesSearch =
                item.task.toLowerCase().includes(term) ||
                item.caregiver.toLowerCase().includes(term);
            const matchesCaregiver = caregiverFilter
                ? item.caregiver === caregiverFilter
                : true;
            const matchesShift = shiftFilter ? item.shift === shiftFilter : true;
            const matchesStatus = statusFilter
                ? item.status === statusFilter
                : true;
            return (
                matchesDate &&
                matchesSearch &&
                matchesCaregiver &&
                matchesShift &&
                matchesStatus
            );
        });
    }, [
        data,
        selectedDateString,
        search,
        caregiverFilter,
        shiftFilter,
        statusFilter,
    ]);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const completed = filteredData.filter(
            (item) => item.status === "Completed"
        ).length;
        const pending = filteredData.filter(
            (item) => item.status === "Pending"
        ).length;
        const completion = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completion, completed, pending };
    }, [filteredData]);

    const buildTrackingPayload = (task: TrackingTask) => ({
        task_id: task.task_id,
        updated_by_user_id: userId,
        status: task.status === "Completed" ? "completed" : "pending",
        comments: [] as { user_id: string; comment: string; created_at?: string }[],
        date: task.date,
    });

    const upsertTracking = (task: TrackingTask, payload: any, message: string) => {
        upsertTaskDailyTracking({ data: payload, path: hcmTaskDailyTrackingPath }, {
            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: ["task-daily-tracking"],
                    refetchType: "all",
                });
                await queryClient.invalidateQueries({
                    queryKey: ["tasks"],
                    refetchType: "all",
                });
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage(message));
            },
        });
    };

    const canPcgUpdate = (task: TrackingTask) =>
        !!userId &&
        (task.status !== "Completed" || task.updated_by_user_id === userId);

    const handleMarkDone = (task: TrackingTask) => {
        if (!userId) return;
        upsertTracking(task, {
            ...buildTrackingPayload(task),
            status: "completed",
        }, "Task marked as completed");
    };

    const handleMarkPending = (task: TrackingTask) => {
        if (!userId) return;
        upsertTracking(task, {
            ...buildTrackingPayload(task),
            status: "pending",
        }, "Task marked as pending");
    };

    const handleToggleStatus = (task: TrackingTask, state: string) => {
        if (!userId || !canPcgUpdate(task)) return;
        const isCompleted = state === "Completed";
        upsertTracking(task, {
            ...buildTrackingPayload(task),
            status: isCompleted ? "completed" : "pending",
        }, isCompleted ? "Task marked as completed" : "Task marked as pending");
    };

    const handleSaveComment = (taskId: string, comment: string) => {
        if (!userId) return;
        const task = data.find((item) => item.id === taskId);
        if (!task) return;
        const payload: any = buildTrackingPayload(task);
        delete payload.updated_by_user_id;
        upsertTracking(task, {
            ...payload,
            comments: [
                { user_id: userId, comment, created_at: new Date().toISOString() },
            ],
        }, "Comment added");
    };

    const handleOpenEdit = (task: TrackingTask) => {
        setEditingTask(task);
        setEditForm({ ...task });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = () => {
        if (!editingTask || !userId) return;
        const isCompleted = editForm.status === "Completed";
        upsertTracking(editingTask, {
            ...buildTrackingPayload(editingTask),
            status: isCompleted ? "completed" : "pending",
        }, "Task updated successfully");
        setIsEditModalOpen(false);
        setEditingTask(null);
        setEditForm({});
    };

    const columns = [
        {
            header: "Task",
            field: "task" as keyof TrackingTask,
            minWidth: "250px",
            headerClassName: "pl-[25px] text-xs font-medium",
            render: (value: string, row: TrackingTask) => (
                <div className="flex items-center gap-2">
                    <TaskNotesIcon notes={row.notes} />
                    <span>{value}</span>
                </div>
            ),
        },
        {
            header: "Caregiver",
            field: "caregiver" as keyof TrackingTask,
            minWidth: "180px",
            headerClassName: "text-xs font-medium",
            render: (value: string, row: TrackingTask) =>
                row.status === "Pending" ? "—" : value,
        },
        {
            header: "Shift",
            field: "shift" as keyof TrackingTask,
            minWidth: "120px",
            headerClassName: "text-xs font-medium",
        },
        {
            header: "Completed",
            field: "completed" as keyof TrackingTask,
            minWidth: "120px",
            headerClassName: "text-xs font-medium",
            render: (value: string | null) => value || "—",
        },
        {
            header: "Status",
            field: "status" as keyof TrackingTask,
            minWidth: "130px",
            headerClassName: "text-xs font-medium",
            render: (value: TrackingStatus, row: TrackingTask) => (
                <div className="flex items-center gap-2">
                    <ProtectedComponent
                        role={role as Role}
                        feature="HCM_TASKS_PCG"
                        access="EDIT"
                    >
                        <ToggleButton
                            passName="Completed"
                            refuseName="Pending"
                            initialState={value}
                            onChange={(state) => handleToggleStatus(row, state)}
                            disabled={!canPcgUpdate(row)}
                            className="scale-75 origin-left"
                        />
                    </ProtectedComponent>
                    <ProtectedComponent
                        role={role as Role}
                        feature="HCM_TASKS_ADMIN"
                        access="VIEW"
                    >
                        <StatusBadge status={value} />
                    </ProtectedComponent>
                    <ProtectedComponent
                        role={role as Role}
                        feature="HCM_TASKS_PCG"
                        access="EDIT"
                    >
                        <TaskChat
                            messages={row.comments}
                            currentUserId={userId}
                            onSend={(text) => handleSaveComment(row.id, text)}
                        />
                    </ProtectedComponent>
                    <ProtectedComponent
                        role={role as Role}
                        feature="HCM_TASKS_ADMIN"
                        access="VIEW"
                    >
                        <TaskChat
                            messages={row.comments}
                            currentUserId={userId}
                            onSend={(text) => handleSaveComment(row.id, text)}
                        />
                    </ProtectedComponent>
                </div>
            ),
        },
        {
            header: "",
            field: "actions" as any,
            minWidth: "80px",
            headerClassName: "flex justify-end",
            render: (_value: any, row: TrackingTask) => (
                <ProtectedComponent
                    role={role as Role}
                    feature="HCM_TASKS_ADMIN"
                    access="EDIT"
                >
                    <TaskActionMenu
                        task={row}
                        onMarkDone={handleMarkDone}
                        onMarkPending={handleMarkPending}
                        onEdit={handleOpenEdit}
                    />
                </ProtectedComponent>


            ),
        },
    ];

    return (
        <div className="font-jakarta">
            <ProtectedComponent
                role={role as Role}
                feature="HCM_TASKS_ADMIN"
                access="VIEW"
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <p className="text-sm font-medium px-4">
                            Monitor task completion across shifts and caregivers
                        </p>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                        <div
                            className="relative border-[1px] border-solid border-primary rounded-lg font-poppins"
                            onClick={() =>
                                (
                                    dateInputRef.current as HTMLInputElement & {
                                        showPicker?: () => void;
                                    }
                                )?.showPicker?.()
                            }
                        >
                            <input
                                type="date"
                                ref={dateInputRef}
                                value={format(selectedDate, "yyyy-MM-dd")}
                                max={today}
                                onChange={(e) =>
                                    setSelectedDate(
                                        parse(e.target.value, "yyyy-MM-dd", new Date())
                                    )
                                }
                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                            />
                            <div className="flex items-center border border-[#DADADA] bg-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer relative z-0 w-full h-full text-primary">
                                {format(selectedDate, "EEEE, MMM d, yyyy")}
                            </div>
                        </div>
                        {/* <Button
                        name="Export"
                        type="button"
                        buttonClick={() => { }}
                        icon={<Download size={16} className="text-gray-700" />}
                        iconStart={true}
                        classname="!bg-white !border !border-gray-300"
                        titleClass="!text-gray-800"
                    /> */}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 shadow-sm !bg-gray/10 p-4">
                    <StatsCard
                        title="Completion"
                        value={`${stats.completion}%`}
                        icon={<BarChart3 size={22} />}
                        iconColor="text-primary"
                        iconBgColor="bg-primary/10"
                    />
                    <StatsCard
                        title="Completed"
                        value={stats.completed}
                        icon={<CheckCircle2 size={22} />}
                        iconColor="text-green-600"
                        iconBgColor="bg-green-100"
                    />
                    <StatsCard
                        title="Pending"
                        value={stats.pending}
                        icon={<Clock size={22} />}
                        iconColor="text-red-600"
                        iconBgColor="bg-red-100"
                    />
                </div>

                <TaskFilters
                    search={search}
                    onSearchChange={setSearch}
                    inputClassName="w-full h-9 pl-10 pr-4 rounded-md border border-gray-300 focus:outline-none focus:border-[#3089AB] text-sm"
                >
                    <SelectComponent
                        name="caregiverFilter"
                        label=""
                        value={caregiverFilter}
                        onChange={(e) => setCaregiverFilter(e.target.value)}
                        options={caregiverOptions}
                        placeholder="All Caregivers"
                        className="w-full md:w-44 !max-w-none [&>label]:hidden [&>select]:w-full"
                    />
                    <SelectComponent
                        name="shiftFilter"
                        label=""
                        value={shiftFilter}
                        onChange={(e) => setShiftFilter(e.target.value)}
                        options={TASK_TRACKING_SHIFT_OPTIONS}
                        placeholder="All Shifts"
                        className="w-full md:w-44 !max-w-none [&>label]:hidden [&>select]:w-full"
                    />
                    <SelectComponent
                        name="statusFilter"
                        label=""
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={TASK_TRACKING_STATUS_OPTIONS}
                        placeholder="All Statuses"
                        className="w-full md:w-44 !max-w-none [&>label]:hidden [&>select]:w-full"
                    />
                </TaskFilters>
            </ProtectedComponent>

            {isTrackingLoading ? (
                <div className="h-64">
                    <Loader fullScreen={false} message="Loading tasks..." />
                </div>
            ) : (
                <BaseTable
                    columns={columns}
                    data={filteredData}
                    headerStyles="pt-[5px]"
                    rowStyles={() => "h-[54px]"}
                    cellStyles={(field) => {
                        const f = String(field);
                        if (f === "actions")
                            return "flex justify-end pr-[10px] h-full";
                        if (f === "task") return "pl-[25px] h-full";
                        return "h-full";
                    }}
                    tableContainerClass="rounded-[7px] bg-white"
                    customEmptyMessage="No tasks found."
                />
            )}

            <ProtectedComponent
                role={role as Role}
                feature="HCM_TASKS_ADMIN"
                access="EDIT"
            >
                <CommonModal
                    title="Edit Task"
                    modalOpen={isEditModalOpen}
                    setModalOpen={setIsEditModalOpen}
                    crossCTA={true}
                    width="450px"
                >
                    <div className="px-6 py-4 w-full flex flex-col gap-4">
                        <InputFieldComponent
                            name="task"
                            label="Task"
                            value={editForm.task || ""}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    task: e.target.value,
                                }))
                            }
                        />
                        <InputFieldComponent
                            name="caregiver"
                            label="Caregiver"
                            value={editForm.caregiver || ""}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    caregiver: e.target.value,
                                }))
                            }
                        />
                        <SelectComponent
                            name="shift"
                            label="Shift"
                            value={editForm.shift || ""}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    shift: e.target.value,
                                }))
                            }
                            options={TASK_TRACKING_SHIFT_OPTIONS.slice(1)}
                            placeholder="Select shift"
                            className="w-full !max-w-none [&>select]:w-full"
                        />
                        <SelectComponent
                            name="status"
                            label="Status"
                            value={editForm.status || ""}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    status: e.target.value as TrackingStatus,
                                }))
                            }
                            options={TASK_TRACKING_STATUS_OPTIONS.slice(1)}
                            placeholder="Select status"
                            className="w-full !max-w-none [&>select]:w-full"
                        />
                        <InputFieldComponent
                            name="completed"
                            label="Completed Time"
                            value={editForm.completed || ""}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    completed: e.target.value,
                                }))
                            }
                        />
                        <div className="flex justify-end items-center gap-3 mt-2 pt-4 border-t border-gray-200">
                            <Button
                                name="Cancel"
                                type="button"
                                buttonClick={() => setIsEditModalOpen(false)}
                                classname="!bg-white !border !border-gray-300"
                                titleClass="!text-gray-800"
                            />
                            <Button
                                name="Save"
                                type="button"
                                buttonClick={handleSaveEdit}
                            />
                        </div>
                    </div>
                </CommonModal>
            </ProtectedComponent>
        </div>
    );
};

export default TaskStatus;
