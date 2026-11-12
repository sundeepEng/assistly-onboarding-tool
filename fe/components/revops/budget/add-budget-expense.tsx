import {useState, useRef, useEffect } from "react";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import Form from "../../../commonComponents/form";
import {
    BudgetSchema,
    Budget
} from "../../../model/revops/budget-model";
import {
    BUDGET_EXPENSE_CATEGORIES,
    ENTRY_MODE_OPTIONS,
    RECEIPT_STATUS,
} from "../../../utils/constants";
import useCreate from "../../../services/create";
import useUpdate from "../../../services/update";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getHomeIdFromToken, getUserIdFromToken, isTokenExpired } from "../../../utils/auth";
import { budgetPath } from "../../../utils/constants";
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { UploadRow } from "../../../commonComponents/inline-form-fields";
import { uploadToS3, deleteFromS3 } from "../../../utils/uploadToS3";
import fetchPreSignedUrl from "../../../services/get-presigned-url";

interface AddBudgetExpenseProps {
    isOpen: boolean;
    onClose: () => void;
    editExpense?: Budget | null;
}

export default function AddBudgetExpense({
    isOpen,
    onClose,
    editExpense,
}: AddBudgetExpenseProps) {
    const dispatch = useAppDispatch();
    const homeId = getHomeIdFromToken();
    const { mutate: createExpense } = useCreate();
    const { mutate: updateExpense } = useUpdate();
    const [isLoading, setIsLoading] = useState(false);
    const [receiptDoc, setReceiptDoc] = useState<any>({ status: RECEIPT_STATUS.EMPTY });
    const formMethodsRef = useRef<any>(null);

    const userId = getUserIdFromToken();
    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    // Reset state when modal closes or load editExpense data
    useEffect(() => {
        if (!isOpen) {
            setIsLoading(false);
            setReceiptDoc({ status: RECEIPT_STATUS.EMPTY });
        } else if (editExpense?.receipt_url) {
            // Load existing receipt
            setReceiptDoc({
                status: RECEIPT_STATUS.EXISTING,
                fileUrl: editExpense.receipt_url,
            });
        } else {
            setReceiptDoc({ status: RECEIPT_STATUS.EMPTY });
        }
    }, [isOpen, editExpense]);

    // Compute defaultValues based on editExpense
    const defaultValues = editExpense
        ? {
            transaction_type: editExpense.transaction_type || "expense",
            category_type: editExpense.category_type,
            home_id: editExpense.home_id,
            amount_cents: (editExpense.amount_cents || 0) / 100,
            transaction_date: editExpense.transaction_date,
            created_by_user_id: editExpense.created_by_user_id,
            description: editExpense.description,
            entry_mode: editExpense.entry_mode,
            notes: editExpense.notes || "",
        }
        : {
            transaction_type: "expense",
            category_type: "",
            home_id: homeId || "",
            amount_cents: 0,
            transaction_date: new Date().toISOString().split("T")[0],
            created_by_user_id: userId || "",
            description: "",
            entry_mode: "one_time",
            notes: "",
        };

    // Stage document upload
    const stageReceiptUpload = (file: File) => {
        setReceiptDoc({
            ...receiptDoc,
            file,
            status: RECEIPT_STATUS.NEW,
        });
    };

    // Stage document remove
    const stageReceiptRemove = () => {
        if (receiptDoc?.status === RECEIPT_STATUS.NEW) {
            setReceiptDoc({ status: RECEIPT_STATUS.EMPTY });
            return;
        }
        if (receiptDoc?.fileUrl) {
            setReceiptDoc({
                ...receiptDoc,
                status: RECEIPT_STATUS.REMOVE,
            });
            return;
        }
        setReceiptDoc({ status: RECEIPT_STATUS.EMPTY });
    };

    // Undo remove
    const stageUndoRemove = () => {
        if (receiptDoc?.fileUrl) {
            setReceiptDoc({ ...receiptDoc, status: RECEIPT_STATUS.EXISTING });
        } else {
            setReceiptDoc({ status: RECEIPT_STATUS.EMPTY });
        }
    };

    // Handle view receipt
    const handleViewReceipt = async () => {
        try {
            const url = await fetchPreSignedUrl(receiptDoc?.fileUrl);
            if (url) {
                window.open(url, "_blank");
            }
        } catch (error) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Unable to load receipt. Please try again."));
        }
    };

    // Handle file size error
    const handleFileSizeError = (errorMessage: string) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errorMessage));
    };

    // Apply document side effects (upload/delete)
    const applyReceiptSideEffects = async () => {
        let receiptUrl = editExpense?.receipt_url || null;

        // Upload new file
        if (receiptDoc?.status === RECEIPT_STATUS.NEW && receiptDoc?.file) {
            const timestamp = Date.now();
            const fileExtension = receiptDoc.file.name.split('.').pop();
            const fileName = `budget/receipts/${homeId}/${timestamp}_${userId}.${fileExtension}`;
            const uploadedUrl = await uploadToS3(receiptDoc.file, fileName, bucketName!, false);

            if (uploadedUrl) {
                receiptUrl = uploadedUrl;
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Receipt uploaded successfully!"));
            } else {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(handleShowPopoverMessage("Failed to upload receipt."));
            }
        }

        // Remove file
        if (receiptDoc?.status === RECEIPT_STATUS.REMOVE && receiptDoc?.fileUrl) {
            const fileName = receiptDoc.fileUrl.split('/').pop();
            const bucketPath = `budget/receipts/${homeId}/${fileName}`;
            await deleteFromS3(fileName, bucketPath, bucketName!);
            receiptUrl = null;
        }

        return receiptUrl;
    };

    const onSubmit = async (data: any) => {

        // Check if user is authenticated and token is not expired
        if (!userId || !homeId || isTokenExpired()) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Authentication required. Please log in again."));
            return;
        }

        setIsLoading(true);

        // Handle receipt upload/delete
        const finalReceiptUrl = await applyReceiptSideEffects();

        const payload = {
            transaction_type: "expense", // Always set to expense since this is expense-only
            ...data,
            amount_cents: data.amount_cents * 100,
            receipt_url: finalReceiptUrl,
        };

        if (editExpense?.id) {
            // Update existing expense
            updateExpense({
                data: { ...payload, id: editExpense.id },
                path: budgetPath
            }, {
                onSuccess: () => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowPopoverMessage("Expense updated successfully!"));
                    setIsLoading(false);
                    onClose();
                },
                onError: (error: any) => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(
                        handleShowPopoverMessage(
                            !Array?.isArray(error?.response?.data?.error)
                                ? error?.response?.data?.error
                                : "Failed to update expense."
                        )
                    );
                    setIsLoading(false);
                },
            });
        } else {
            // Create new expense
            createExpense({
                userData: payload,
                path: budgetPath
            }, {
                onSuccess: () => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowPopoverMessage("Expense created successfully!"));
                    setIsLoading(false);
                    onClose();
                },
                onError: (error: any) => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(
                        handleShowPopoverMessage(
                            !Array?.isArray(error?.response?.data?.error)
                                ? error?.response?.data?.error
                                : "Failed to create expense."
                        )
                    );
                    setIsLoading(false);
                },
            });
        }
    };

    return (
        <CommonModal
            modalOpen={isOpen}
            setModalOpen={onClose}
            crossCTA
            className="!w-[600px]"
        >
            <Form
                key={editExpense?.home_id || "new-expense"}
                schema={BudgetSchema}
                onSubmit={onSubmit}
                useFormMethodsRef={formMethodsRef}
                defaultValues={defaultValues}
            >
                <div className="px-6">
                    <h2 className="text-xl font-semibold mb-6">
                        {editExpense ? "Edit Expense" : "Add Budget Expense"}
                    </h2>
                </div>

                <div className="px-[30px]">
                    <div>
                        <FormInputFieldComponent
                            label="Description"
                            type="text"
                            name="description"
                            placeholder="Enter expense description"
                            containerClass="w-full"
                        />
                    </div>
                    <div className="flex gap-6">
                        <div className="flex-1">
                            <div className="pt-[20px] flex flex-row gap-4">
                                <FormSelectComponent
                                    label="Category"
                                    options={BUDGET_EXPENSE_CATEGORIES}
                                    name="category_type"
                                    placeHolder="Select Category"
                                    containerClass="w-full"
                                    className="pt-2"
                                />
                                <FormInputFieldComponent
                                    label="Amount ($)"
                                    type="number"
                                    name="amount_cents"
                                    placeholder="0.00"
                                    containerClass="w-full"
                                    className="mt-1"
                                    min="0"
                                    step="any"
                                />
                            </div>

                        </div>

                    </div>
                    <p className="font-poppins">Payment Type </p>
                    <div className="flex flex-row">
                        <FormSingleRadioSelect
                            name="entry_mode"
                            options={ENTRY_MODE_OPTIONS}
                        />

                    </div>

                    {/* Paid Date */}
                    <div className="pt-[20px]">
                        <FormInputFieldComponent
                            label="Paid Date *"
                            type="date"
                            name="transaction_date"
                            className="mt-1"
                            placeholder="Paid Date"
                            containerClass="w-full"
                            max={new Date().toISOString().split("T")[0]}
                        />
                    </div>

                    {/* Upload Receipt */}
                    <div className="pt-[20px]">
                        <UploadRow
                            label="Upload Receipt (Optional)"
                            disabled={isLoading}
                            doc={receiptDoc}
                            onView={handleViewReceipt}
                            onPickFile={stageReceiptUpload}
                            onRemove={stageReceiptRemove}
                            onUndo={stageUndoRemove}
                            onFileSizeError={handleFileSizeError}
                        />
                    </div>


                    {/* Notes */}
                    <div className="pt-[20px]">
                        <FormTextareaComponent
                            label="Notes"
                            placeholder="Add any additional notes"
                            name="notes"
                            onChange={() => { }}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-8">
                        <Button name="Cancel" classname="" buttonClick={onClose} />
                        <Button
                            name={isLoading ? (editExpense ? "Updating..." : "Creating...") : (editExpense ? "Update Expense" : "Create Expense")}
                            classname=""
                            type="submit"
                        />
                    </div>
                </div>
            </Form>
        </CommonModal>
    );
}
