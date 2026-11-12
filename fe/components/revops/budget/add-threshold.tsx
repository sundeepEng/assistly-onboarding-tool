import { useState, useRef, useCallback } from "react";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import Form from "../../../commonComponents/form";
import { AddThresholdFormSchema } from "../../../model/home/home-model";
import { BUDGET_EXPENSE_CATEGORIES, homePath, HOME_PATH_OMIT_FIELDS } from "../../../utils/constants";
import ToggleSwitch from "../../../commonComponents/toggle-switch";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getHomeIdFromToken, isTokenExpired } from "../../../utils/auth";
import useUpsert from "../../../services/upsert";
import { useQueryClient } from "@tanstack/react-query";
import { omit } from "../../../utils/dateUtils";
import { MONTH_ABBR } from "../../../utils/budget-utils";

interface AddThresholdProps {
    isOpen: boolean;
    onClose: () => void;
    editThreshold?: any | null;
    dateRange?: any | null;
    homeData?: any | null;
}

export default function AddThreshold({
    isOpen,
    onClose,
    editThreshold,
    dateRange,
    homeData,
}: AddThresholdProps) {
    const dispatch = useAppDispatch();
    const homeId = getHomeIdFromToken();
    const queryClient = useQueryClient();
    const { mutate: upsertThreshold } = useUpsert();
    const [isLoading, setIsLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(editThreshold?.isEnabled ?? editThreshold?.enabled ?? true);
    const [existingThreshold, setExistingThreshold] = useState<any>(null);
    const formMethodsRef = useRef<any>(null);

    const checkForExistingThreshold = useCallback((category: string, month: string) => {
        if (!category || !month || !homeData) {
            setExistingThreshold(null);
            return;
        }

        const [year, monthNum] = month.split('-');
        const monthKey = MONTH_ABBR[parseInt(monthNum) - 1];
        const categoryKey = category.toLowerCase();

        const homeObj = homeData?.home || homeData || {};
        const thresholds = homeObj?.thresholds || {};
        const yearData = thresholds[year];
        const monthData = yearData?.[monthKey];
        const existing = monthData?.[categoryKey];

        if (existing && typeof existing === 'object') {
            setExistingThreshold(existing);
            // Prefill form fields
            const methods = formMethodsRef.current;
            if (methods) {
                methods.setValue('thresholdName', existing.thresholdName || '');
                methods.setValue('fixedAmount', existing.fixedAmount ?? 0);
            }
            setIsEnabled(existing.isEnabled ?? true);
        } else {
            setExistingThreshold(null);
        }
    }, [homeData]);

    const handleFieldChange = (fieldName: string, value: string) => {
        const methods = formMethodsRef.current;
        if (!methods) return;

        const category = fieldName === 'category' ? value : methods.getValues('category');
        const month = fieldName === 'month' ? value : methods.getValues('month');

        checkForExistingThreshold(category, month);
    };

    const defaultValues = editThreshold
        ? {
            thresholdName: editThreshold.thresholdName || editThreshold.name || "",
            category: editThreshold.category?.toLowerCase() || "",
            fixedAmount: editThreshold.fixedAmount ?? editThreshold.thresholdAmount ?? 0,
            isEnabled: editThreshold.isEnabled ?? editThreshold.enabled ?? true,
            month: dateRange?.dateRange?.startDate ? dateRange.dateRange.startDate.slice(0, 7) : "",
        }
        : {
            thresholdName: "",
            category: "",
            fixedAmount: 0,
            isEnabled: true,
            month: dateRange?.dateRange?.startDate ? dateRange.dateRange.startDate.slice(0, 7) : "",
        };

    const onSubmit = async (data: any) => {
        if (!homeId || isTokenExpired()) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Authentication required. Please log in again."));
            return;
        }

        setIsLoading(true);

        const [year, monthNum] = data.month.split('-');
        const month = MONTH_ABBR[parseInt(monthNum) - 1];
        const category = data.category.toLowerCase();

        const homeObj = homeData?.home || homeData || {};
        const existingThresholds = homeObj?.thresholds || {};
        const yearThresholds = existingThresholds[year] || {};
        const monthThresholds = yearThresholds[month] || {};

        const updatedThresholds = {
            ...existingThresholds,
            [year]: {
                ...yearThresholds,
                [month]: {
                    ...monthThresholds,
                    [category]: {
                        thresholdName: data.thresholdName,
                        fixedAmount: parseFloat(data.fixedAmount),
                        isEnabled: isEnabled,
                    },
                },
            },
        };

        const cleanedData = omit(
            { ...homeObj, homeId: homeId, thresholds: updatedThresholds },
            HOME_PATH_OMIT_FIELDS
        );

        upsertThreshold(
            {
                data: cleanedData,
                path: homePath,
            },
            {
                onSuccess: (response) => {
                    queryClient.invalidateQueries({ queryKey: ["home-data"] });
                    dispatch(handleOpenPopover());
                    dispatch(
                        handleShowPopoverMessage(
                            editThreshold
                                ? "Threshold updated successfully!"
                                : "Threshold created successfully!"
                        )
                    );
                    setIsLoading(false);
                    onClose();
                },
                onError: (error: any) => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(
                        handleShowPopoverMessage(
                            error?.response?.data?.error ||
                            error?.response?.data?.message ||
                            (editThreshold
                                ? "Failed to update threshold."
                                : "Failed to create threshold.")
                        )
                    );
                    setIsLoading(false);
                },
            }
        );
    };

    return (
        <CommonModal
            modalOpen={isOpen}
            setModalOpen={onClose}
            crossCTA
            className="!w-[550px]"
        >
            <Form
                key={editThreshold?.id || "new-threshold"}
                schema={AddThresholdFormSchema}
                onSubmit={onSubmit}
                useFormMethodsRef={formMethodsRef}
                defaultValues={defaultValues}
            >
                <div className="px-6">
                    <h2 className="text-xl font-semibold mb-6">
                        {editThreshold ? "Edit Expense Threshold" : existingThreshold ? "Update Expense Threshold" : "Add Expense Threshold"}
                    </h2>
                </div>

                <div className="px-[30px]">
                    {/* Threshold Name */}
                    <div>
                        <FormInputFieldComponent
                            label="Threshold Name"
                            type="text"
                            name="thresholdName"
                            placeholder="Enter threshold name"
                            containerClass="w-full"
                        />
                    </div>

                    {/* Category */}
                    <div className="pt-[20px]">
                        <FormSelectComponent
                            label="Category"
                            options={BUDGET_EXPENSE_CATEGORIES}
                            name="category"
                            placeHolder="Select Category"
                            containerClass="w-full"
                            onChange={(e) => handleFieldChange('category', e.target.value)}
                        />
                    </div>

                    {/* Month */}
                    <div className="pt-[20px]">
                        <FormInputFieldComponent
                            label="Month"
                            type="month"
                            name="month"
                            placeholder="Select month"
                            containerClass="w-full"
                            onChange={(e: any) => handleFieldChange('month', e.target.value)}
                        />
                    </div>

                    {existingThreshold && !editThreshold && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            A threshold already exists for this category and month. You can update the values below.
                        </div>
                    )}

                    {/* Threshold Value */}
                    <div className="pt-[20px]">
                        <FormInputFieldComponent
                            label="Fixed Amount"
                            type="number"
                            name="fixedAmount"
                            placeholder="Enter fixed amount"
                            containerClass="w-full"
                            min="0"
                            step="any"
                        />
                    </div>

                    {/* Enable Threshold Toggle */}
                    <div className="pt-[20px]">
                        <ToggleSwitch
                            label="Enable Threshold"
                            defaultEnabled={isEnabled}
                            onToggle={(enabled) => setIsEnabled(enabled)}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-8">
                        <Button name="Cancel" classname="" buttonClick={onClose} />
                        <Button
                            name={
                                isLoading
                                    ? (editThreshold || existingThreshold)
                                        ? "Updating..."
                                        : "Creating..."
                                    : (editThreshold || existingThreshold)
                                        ? "Update Threshold"
                                        : "Create Threshold"
                            }
                            classname=""
                            type="submit"

                        />
                    </div>
                </div>
            </Form>
        </CommonModal>
    );
}
