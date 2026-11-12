import React, { useState } from "react";
import Form from "../../../commonComponents/form";
import { TaskFormSchema } from "../../../model/hcm/tasks.model";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import Button from "../../../commonComponents/button";
import WeekdaySelect from "../schedule/week-select";
import { useAppDispatch } from "../../../redux/hooks";
import { handleCloseAddTaskModal } from "../../../redux/slices/modal-slice";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import useCreate from "../../../services/create";
import useUpdate from "../../../services/update";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import {
    WEEK_DAYS_SHORT,
    TASK_CATEGORY_OPTIONS,
    TASK_SHIFT_OPTIONS,
    hcmTaskPath,
} from "../../../utils/constants";

const taskSchema = TaskFormSchema;

type AddTaskProps = {
    defaultValues?: {
        id?: string;
        name?: string;
        category?: string;
        shift?: string;
        notes?: string;
        days?: string[];
    };
};

const AddTask = ({ defaultValues = { name: "", category: "", shift: "", notes: "", days: [] } }: AddTaskProps) => {
    const dispatch = useAppDispatch();
    const { mutate: createTask } = useCreate();
    const { mutate: updateTask } = useUpdate();
    const homeId = getHomeIdFromToken();
    const userId = getUserIdFromToken();
    const [selectedDays, setSelectedDays] = useState<string[]>(defaultValues?.days || []);

    const handleSubmit = (data: any) => {
        if (!homeId) {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Home ID not found. Please log in again."));
            return;
        }

        if (!userId) {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("User ID not found. Please log in again."));
            return;
        }

        const payload = {
            ...(defaultValues?.id ? { id: defaultValues.id } : {}),
            home_id: homeId,
            title: data.name,
            type: data.category,
            shift: data.shift.toLowerCase(),
            shift_notes: data.notes || "",
            days_of_week: selectedDays,
            assigned_to_user_id: null,
            created_by_user_id: userId,
        };

        const onSuccess = () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage(defaultValues?.id ? "Task updated successfully!" : "Task created successfully!"));
            dispatch(handleCloseAddTaskModal());
        };

        const onError = (error: any) => {
            console.error("Failed to save task:", error);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage(error?.response?.data?.message || "Failed to save task. Please try again."));
        };

        if (defaultValues?.id) {
            updateTask({ data: payload, path: hcmTaskPath }, { onSuccess, onError });
        } else {
            createTask({ userData: payload, path: hcmTaskPath }, { onSuccess, onError });
        }
    };

    return (
        <div className="px-6 py-4 w-full">
            <Form
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
                    <div className="pt-3">
                        <div className="font-poppins">Apply to</div>
                        <WeekdaySelect
                            initialSelected={defaultValues?.days || []}
                            className=""
                            onChange={(selected) =>
                                setSelectedDays(selected.map((index) => WEEK_DAYS_SHORT[index]))
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
    );
};

export default AddTask;
