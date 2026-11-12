import React, { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
    BookText,
    Plus,
    Upload,
} from "lucide-react";
import BaseTable from "../../../commonComponents/base-table";
import { TaskFormSchema } from "../../../model/hcm/tasks.model";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import Form from "../../../commonComponents/form";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import SelectComponent from "../../../commonComponents/select-component";
import AiLoader from "../../../commonComponents/ai-loader";
import Loader from "../../../commonComponents/loader";
import { EmptyUploadCard } from "../../../components/documents/documents-card";
import EditIcon from "../../../public/icons/edit-icon";
import DeleteIcon from "../../../public/icons/delete-icon";
import WeekdaySelect from "../schedule/week-select";
import useGetAll from "../../../services/getAll";
import useCreate from "../../../services/create";
import useDelete from "../../../services/delete";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import {
    WEEK_DAYS_SHORT,
    TASK_CATEGORY_OPTIONS,
    TASK_SHIFT_OPTIONS,
    hcmTasksPath,
    hcmTaskPath,
} from "../../../utils/constants";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
    handleOpenAddTaskModal,
    handleCloseAddTaskModal,
} from "../../../redux/slices/modal-slice";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import AddTask from "./add-task";
import TaskFilters from "./task-filters";

const ALL_CATEGORY_OPTION = { option: "All Categories", value: "" };
const ALL_SHIFT_OPTION = { option: "All Shifts", value: "" };

const taskSchema = TaskFormSchema;

interface Task {
    id: string;
    name: string;
    category: string;
    shift: string;
    notes?: string;
    days: string[];
}

const normalizeTask = (task: any): Task => ({
    id: task.id,
    name: task.title,
    category: task.type,
    shift: task.shift?.toLowerCase?.(),
    notes: task.shift_notes || undefined,
    days: task.days_of_week || [],
});

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    defaultValues: Partial<Task>;
    onSubmit: (data: { name: string; category: string; shift: string; notes?: string; days: string[] }) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({
    isOpen,
    onClose,
    title,
    defaultValues,
    onSubmit,
}) => {
    const [selectedDays, setSelectedDays] = useState<string[]>(
        defaultValues?.days || []
    );

    const handleSubmit = (data: any) => {
        onSubmit({ ...data, days: selectedDays });
        onClose();
    };

    return (
        <CommonModal
            title={title}
            modalOpen={isOpen}
            setModalOpen={onClose}
            titleClass="text-[24px] font-semibold"
            crossCTA={true}
            width="550px"
            className="py-4"
        >
            <div className="px-6 py-4 w-full">
                <Form
                    key={isOpen ? defaultValues?.id || "new" : "closed"}
                    onSubmit={handleSubmit}
                    schema={taskSchema}
                    defaultValues={defaultValues}
                >
                    <div className="flex flex-col gap-4">
                        <FormInputFieldComponent
                            name="name"
                            label="Task Name *"
                            placeholder="Enter task name"
                        />
                        <FormSelectComponent
                            name="category"
                            label="Category *"
                            options={TASK_CATEGORY_OPTIONS}
                            placeHolder="Select category"
                        />
                        <FormSelectComponent
                            name="shift"
                            label="Shift *"
                            options={TASK_SHIFT_OPTIONS}
                            placeHolder="Select shift"
                        />
                        <div>
                            <div className="font-poppins text-sm mb-1">
                                Apply to
                            </div>
                            <WeekdaySelect
                                initialSelected={defaultValues?.days || []}
                                onChange={(selected) =>
                                    setSelectedDays(
                                        selected.map((index) => WEEK_DAYS_SHORT[index])
                                    )
                                }
                            />
                        </div>
                        <FormTextareaComponent
                            label="Task Notes"
                            className="pr-[30px]"
                            placeholder="Leave a note for the task"
                            name="notes"
                            onChange={() => { }}
                        />
                        <div className="flex justify-center">
                            <Button name="Save" type="submit" />
                        </div>
                    </div>
                </Form>
            </div>
        </CommonModal>
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

const TaskLibrary = () => {
    const homeId = getHomeIdFromToken();
    const userId = getUserIdFromToken();

    const { data: tasksResponse, isLoading: isTasksLoading } = useGetAll({
        key: "tasks",
        params: homeId ? { home_id: homeId } : undefined,
        enabled: !!homeId,
        path: hcmTasksPath,
    });

    const tasks = useMemo<Task[]>(
        () => (tasksResponse?.tasks || []).map(normalizeTask),
        [tasksResponse]
    );

    const dispatch = useAppDispatch();
    const isAddTaskModal = useAppSelector(
        (state: { modal: { isAddTaskModalOpen: boolean } }) =>
            state.modal.isAddTaskModalOpen
    );

    const createTaskMutation = useCreate();
    const deleteTaskMutation = useDelete();

    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [shiftFilter, setShiftFilter] = useState("");

    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [extractedTasks, setExtractedTasks] = useState<Task[]>([]);
    const [editingReviewIndex, setEditingReviewIndex] = useState<number | null>(
        null
    );
    const [isReviewEditModalOpen, setIsReviewEditModalOpen] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const filteredTasks = useMemo(() => {
        const term = search.toLowerCase();
        return tasks.filter((task) => {
            const matchesSearch = task.name.toLowerCase().includes(term);
            const matchesCategory = categoryFilter
                ? task.category === categoryFilter
                : true;
            const matchesShift = shiftFilter
                ? task.shift === shiftFilter
                : true;
            return matchesSearch && matchesCategory && matchesShift;
        });
    }, [tasks, search, categoryFilter, shiftFilter]);

    const handleOpenAdd = () => {
        setEditingTask(null);
        dispatch(handleOpenAddTaskModal());
    };

    const handleEdit = (task: Task) => {
        setEditingTask(task);
        dispatch(handleOpenAddTaskModal());
    };

    const handleDeleteClick = (task: Task) => {
        setTaskToDelete(task);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!taskToDelete) return;
        deleteTaskMutation.mutate({ id: taskToDelete.id, path: hcmTaskPath }, {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setTaskToDelete(null);
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Task deleted successfully!"));
            },
            onError: () => {
                setIsDeleteModalOpen(false);
                setTaskToDelete(null);
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(handleShowPopoverMessage("Failed to delete task. Please try again."));
            },
        });
    };

    const handleUploadFile = (file: File) => {
        setIsExtracting(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = String(event.target?.result || "");
            const base64 = dataUrl.split(",")[1] || "";
            if (!base64) {
                setIsExtracting(false);
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(handleShowPopoverMessage("Could not read file."));
                return;
            }

            try {
                const res = await fetch("/api/extract-tasks", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        fileData: base64,
                        fileName: file.name,
                        mimeType: file.type,
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setIsExtracting(false);
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(handleShowPopoverMessage(data.error || "Failed to extract tasks."));
                    return;
                }

                const extracted: Task[] = (data.tasks || []).map(
                    (task: any) => ({
                        id: uuidv4(),
                        name: task.name || "Unnamed",
                        category: task.category || "",
                        shift: (task.shift || "morning").toLowerCase(),
                        notes: task.notes || undefined,
                        days: Array.isArray(task.days) ? task.days : [],
                    })
                );
                setExtractedTasks(extracted);
                setIsExtracting(false);
                setIsUploadModalOpen(false);
                setIsReviewModalOpen(true);
            } catch {
                setIsExtracting(false);
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(handleShowPopoverMessage("Failed to extract tasks from file."));
            }
        };
        reader.onerror = () => {
            setIsExtracting(false);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Failed to read file."));
        };
        reader.readAsDataURL(file);
    };

    const handleReviewEdit = (index: number) => {
        setEditingReviewIndex(index);
        setIsReviewEditModalOpen(true);
    };

    const handleReviewDelete = (index: number) => {
        setExtractedTasks((prev) => prev.filter((_, i) => i !== index));
    };

    const handleReviewDaysChange = (
        index: number,
        selected: number[]
    ) => {
        setExtractedTasks((prev) => {
            const current = prev[index];
            const newDays = selected.map((day) => WEEK_DAYS_SHORT[day]);
            const currentSorted = [...(current.days || [])].sort();
            const newDaysSorted = [...newDays].sort();
            const isSame =
                currentSorted.length === newDaysSorted.length &&
                currentSorted.every((day, i) => day === newDaysSorted[i]);
            if (isSame) return prev;

            return prev.map((task, i) =>
                i === index ? { ...task, days: newDays } : task
            );
        });
    };

    const handleReviewEditSubmit = (data: {
        name: string;
        category: string;
        shift: string;
        notes?: string;
        days: string[];
    }) => {
        if (editingReviewIndex === null) return;
        setExtractedTasks((prev) =>
            prev.map((task, i) =>
                i === editingReviewIndex ? { ...task, ...data } : task
            )
        );
    };

    const handleAddMissing = (data: {
        name: string;
        category: string;
        shift: string;
        notes?: string;
        days: string[];
    }) => {
        setExtractedTasks((prev) => [...prev, { id: uuidv4(), ...data }]);
    };

    const handleApproveAll = async () => {
        if (!homeId || !userId || extractedTasks.length === 0) return;
        try {
            await Promise.all(
                extractedTasks.map((task) =>
                    createTaskMutation.mutateAsync({
                        userData: {
                            home_id: homeId,
                            title: task.name,
                            type: task.category,
                            shift: task.shift.toLowerCase(),
                            shift_notes: task.notes || "",
                            days_of_week: task.days,
                            assigned_to_user_id: null,
                            created_by_user_id: userId,
                        },
                        path: hcmTaskPath,
                    })
                )
            );
            setExtractedTasks([]);
            setIsReviewModalOpen(false);
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Tasks created successfully!"));
        } catch (error) {
            console.error("Failed to add tasks:", error);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Some tasks could not be added. Please try again."));
        }
    };

    const actionCellClass =
        "w-9 h-9 rounded-full flex items-center justify-center cursor-pointer";

    const columns = [
        {
            header: "Task Name",
            field: "name" as keyof Task,
            minWidth: "370px",
            headerClassName: "pl-[25px] text-xs font-medium",
            render: (value: string, row: Task) => (
                <div className="flex items-center gap-2 min-w-0">
                    <TaskNotesIcon notes={row.notes} />
                    <span className="!max-w-[280px] truncate" title={value}>{value}</span>
                </div>
            ),
        },
        {
            header: "Category",
            field: "category" as keyof Task,
            minWidth: "150px",
            headerClassName: "text-xs font-medium",
        },
        {
            header: "Shift",
            field: "shift" as keyof Task,
            minWidth: "150px",
            headerClassName: "text-xs font-medium",
        },
        {
            header: "Days",
            field: "days" as keyof Task,
            minWidth: "180px",
            headerClassName: "text-xs font-medium",
            render: (value: string[]) =>
                value?.length ? value.join(", ") : "—",
        },
        {
            header: "",
            field: "actions" as any,
            minWidth: "120px",
            headerClassName: "flex justify-end",
            render: (_value: any, row: Task) => (
                <div className="flex gap-3">
                    <button
                        className={`${actionCellClass} bg-primary bg-opacity-20`}
                        onClick={() => handleEdit(row)}
                    >
                        <EditIcon />
                    </button>
                    <button
                        className={`${actionCellClass} bg-red-100`}
                        onClick={() => handleDeleteClick(row)}
                    >
                        <DeleteIcon color="#EF4444" />
                    </button>
                </div>
            ),
        },
    ];

    const reviewColumns = [
        {
            header: "Task Name",
            field: "name" as keyof Task,
            minWidth: "250px",
            headerClassName: "pl-[25px] text-xs font-medium",
            render: (value: string, row: Task) => (
                <div className="flex items-center gap-2 min-w-0">
                    <TaskNotesIcon notes={row.notes} />
                    <span className="!max-w-[280px] truncate" title={value}>{value}</span>
                </div>
            ),
        },
        {
            header: "Category",
            field: "category" as keyof Task,
            minWidth: "150px",
            headerClassName: "text-xs font-medium",
        },
        {
            header: "Shift",
            field: "shift" as keyof Task,
            minWidth: "150px",
            headerClassName: "text-xs font-medium",
        },
        {
            header: "Days",
            field: "days" as keyof Task,
            minWidth: "350px",
            headerClassName: "text-xs font-medium",
            render: (value: string[], _row: Task, index: number) => (
                <WeekdaySelect
                    initialSelected={value || []}
                    onChange={(selected) =>
                        handleReviewDaysChange(index, selected)
                    }
                    className="!w-10 !h-7 !text-[12px] !my-0"
                />
            ),
        },
        {
            header: "",
            field: "actions" as any,
            minWidth: "120px",
            headerClassName: "flex justify-end",
            render: (_value: any, _row: Task, index: number) => (
                <div className="flex gap-3">
                    <button
                        className={`${actionCellClass} bg-primary bg-opacity-20`}
                        onClick={() => handleReviewEdit(index)}
                    >
                        <EditIcon />
                    </button>
                    <button
                        className={`${actionCellClass} bg-red-100`}
                        onClick={() => handleReviewDelete(index)}
                    >
                        <DeleteIcon color="#EF4444" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>

                    <p className="text-sm font-medium px-4">
                        Manage reusable household tasks for your home
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        name="Add Task"
                        type="button"
                        buttonClick={handleOpenAdd}
                        icon={
                            <Plus
                                size={16}
                                className="text-white"
                            />
                        }
                        iconStart={true}
                    />
                    <Button
                        name="Upload Template"
                        type="button"
                        buttonClick={() =>
                            setIsUploadModalOpen(true)
                        }
                        icon={
                            <Upload
                                size={16}
                                className="text-white"
                            />
                        }
                        iconStart={true}
                    />
                </div>
            </div>

            <TaskFilters
                search={search}
                onSearchChange={setSearch}
            >
                <SelectComponent
                    name="categoryFilter"
                    value={categoryFilter}
                    onChange={(e) =>
                        setCategoryFilter(e.target.value)
                    }
                    options={[
                        ALL_CATEGORY_OPTION,
                        ...TASK_CATEGORY_OPTIONS,
                    ]}
                    placeholder="All Categories"
                    className="w-full md:w-48"
                />
                <SelectComponent
                    name="shiftFilter"
                    value={shiftFilter}
                    onChange={(e) =>
                        setShiftFilter(e.target.value)
                    }
                    options={[
                        ALL_SHIFT_OPTION,
                        ...TASK_SHIFT_OPTIONS,
                    ]}
                    placeholder="All Shifts"
                    className="w-full md:w-48"
                />
            </TaskFilters>

            {isTasksLoading ? (
                <div className="h-64">
                    <Loader fullScreen={false} message="Loading tasks..." />
                </div>
            ) : (
                <BaseTable
                    columns={columns}
                    data={filteredTasks}
                    headerStyles="pt-[5px]"
                    rowStyles={() => "h-[54px]"}
                    cellStyles={(field) => {
                        const f = String(field);
                        if (f === "actions") return "flex justify-end pr-[10px] h-full";
                        if (f === "name") return "pl-[25px] h-full";
                        if (f === "category" || f === "shift") return "h-full capitalize";
                        return "h-full";
                    }}
                    tableContainerClass="rounded-[7px] bg-white"
                    customEmptyMessage="No tasks found."
                />
            )}

            <CommonModal
                title={editingTask ? "Edit Task" : "Add Task"}
                modalOpen={isAddTaskModal}
                setModalOpen={() => {
                    dispatch(handleCloseAddTaskModal());
                    setEditingTask(null);
                }}
                titleClass="text-[24px] font-semibold"
                crossCTA={true}
                width="550px"
                className="py-4"
            >
                <AddTask
                    key={
                        isAddTaskModal ? editingTask?.id || "new" : "closed"
                    }
                    defaultValues={
                        editingTask || { name: "", category: "", shift: "", notes: "", days: [] }
                    }
                />
            </CommonModal>

            <CommonModal
                title="Bulk Task Upload"
                modalOpen={isUploadModalOpen}
                setModalOpen={setIsUploadModalOpen}
                titleClass="text-[24px] font-semibold"
                crossCTA={!isExtracting}
                width="550px"
                className="py-4"
            >
                <div className="px-6 py-4">
                    {isExtracting ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <AiLoader
                                message="Extracting tasks..."
                                subtitle="This may take a few seconds"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <p className="text-sm text-gray-500 text-center mb-2">
                                Upload a PDF, DOCX, CSV, image, or text file with tasks.
                                <br />
                                If shift/timing is not specified, tasks default to Morning.
                            </p>
                            <EmptyUploadCard
                                onUpload={handleUploadFile}
                            />
                        </div>
                    )}
                </div>
            </CommonModal>

            <CommonModal
                title="Review Extracted Tasks"
                modalOpen={isReviewModalOpen}
                setModalOpen={setIsReviewModalOpen}
                titleClass="text-[24px] font-semibold"
                crossCTA={true}
                width="1100px"
                className="py-4"
            >
                <div className="px-6 py-4 w-full">
                    <p className="text-sm text-gray-600 mb-4">
                        {extractedTasks.length} task(s) found. Review and
                        edit as needed, then add them to the library.
                    </p>
                    <BaseTable
                        columns={reviewColumns}
                        data={extractedTasks}
                        headerStyles="pt-[5px]"
                        rowStyles={() => "h-[54px]"}
                        cellStyles={(field) => {
                            const f = String(field);
                            if (f === "actions") return "flex justify-end pr-[10px] h-full";
                            if (f === "name") return "pl-[25px] h-full";
                            if (f === "category" || f === "shift") return "h-full capitalize";
                            return "h-full";
                        }}
                        tableContainerClass="rounded-[7px] bg-white mb-4"
                        customEmptyMessage="No tasks to review."
                    />
                    <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-200">
                        <Button
                            name="Add Missing Task"
                            type="button"
                            buttonClick={() => {
                                setEditingReviewIndex(null);
                                setIsReviewEditModalOpen(true);
                            }}
                            icon={
                                <Plus size={16} className="text-white" />
                            }
                            iconStart={true}
                        />
                        <div className="flex gap-3">
                            <Button
                                name="Cancel"
                                type="button"
                                buttonClick={() =>
                                    setIsReviewModalOpen(false)
                                }
                                classname="!bg-white !border !border-gray-300"
                                titleClass="!text-gray-800"
                            />
                            <Button
                                name="Add All Tasks"
                                type="button"
                                buttonClick={handleApproveAll}
                                disabled={extractedTasks.length === 0}
                            />
                        </div>
                    </div>
                </div>
            </CommonModal>

            <TaskModal
                isOpen={isReviewEditModalOpen}
                onClose={() => setIsReviewEditModalOpen(false)}
                title={
                    editingReviewIndex !== null
                        ? "Edit Extracted Task"
                        : "Add Missing Task"
                }
                defaultValues={
                    editingReviewIndex !== null
                        ? extractedTasks[editingReviewIndex]
                        : { name: "", category: "", shift: "", notes: "", days: [] }
                }
                onSubmit={
                    editingReviewIndex !== null
                        ? handleReviewEditSubmit
                        : handleAddMissing
                }
            />

            <CommonModal
                title="Delete Task"
                modalOpen={isDeleteModalOpen}
                setModalOpen={setIsDeleteModalOpen}
                crossCTA={true}
                width="450px"
            >
                <div className="font-poppins px-6 py-4">
                    <p className="text-sm text-gray-700 mb-6 text-center">
                        Are you sure you want to permanently delete{" "}
                        <span className="font-semibold">{taskToDelete?.name ? `"${taskToDelete.name}"` : "this task"}</span>?
                    </p>
                    {deleteTaskMutation.isPending ? (
                        <div className="flex justify-center items-center py-2">
                            <Loader fullScreen={false} message="Deleting..." size={40} />
                        </div>
                    ) : (
                        <div className="flex justify-center gap-4">
                            <Button
                                name="Confirm"
                                type="button"
                                buttonClick={handleConfirmDelete}
                            />
                            <Button
                                name="Cancel"
                                type="button"
                                buttonClick={() => setIsDeleteModalOpen(false)}

                            />
                        </div>
                    )}
                </div>
            </CommonModal>
        </div>
    );
};

export default TaskLibrary;
