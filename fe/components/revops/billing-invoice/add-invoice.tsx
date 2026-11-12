import { useMemo, useState, useRef, useEffect } from "react";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import DeleteIcon from "../../../public/icons/delete-icon";
import EditIcon from "../../../public/icons/edit-icon";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import Form from "../../../commonComponents/form";

import useGetAll from "../../../services/getAll";
import { userRoles, GetUsersPath, invoicePath, InvoiceStatus, BUDGET_INCOME_CATEGORIES } from "../../../utils/constants";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import { Plus } from "lucide-react";
import { InvoiceFormValidationSchema } from "../../../model/billing/invoice.model";
import useCreate from "../../../services/create";
import useUpdate from "../../../services/update";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { v4 as uuidv4 } from "uuid";
import { getBillingPeriodOptions, getDefaultDueDate, INVOICE_ITEM_CATEGORIES, InvoiceItemCategory } from "../../../utils/billingPeriodUtils";
import { formatCurrency } from "../charts/chart-utils";

interface InvoiceItem {
  item_category: string;
  description: string;
  amount: number;
  invoice_item_id?: string;
}

interface ExistingDraftInvoice {
  id: string;
  invoice_id: string;
  user_id: string;
  billing_period: string;
  due_date: string;
  notes: string;
  items: InvoiceItem[];
}

interface EditInvoiceData {
  id: string;
  invoice_id: string;
  user_id: string;
  billing_period: string;
  due_date: string;
  notes: string;
  items: InvoiceItem[];
}

interface AdjustInvoiceData extends EditInvoiceData {
  parent_invoice_id: number;
}

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResident?: { id: string; name: string } | null;
  editInvoice?: EditInvoiceData | null;
  adjustInvoice?: AdjustInvoiceData | null;
  onAdjustSubmit?: (payload: any) => void; // For adjustments - parent handles create + void
}

export default function AddInvoiceModal({
  isOpen,
  onClose,
  selectedResident,
  editInvoice,
  adjustInvoice,
  onAdjustSubmit,
}: AddInvoiceModalProps) {
  const dispatch = useAppDispatch();
  const homeId = getHomeIdFromToken();
  const { mutate: createInvoice } = useCreate();
  const { mutate: updateInvoice } = useUpdate();
  const { data: invoicesData } = useGetAll({
    key: "invoices",
    params: { home_id: homeId },
    path: invoicePath
  });
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [existingDraft, setExistingDraft] = useState<ExistingDraftInvoice | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const formMethodsRef = useRef<any>(null);

  const pchoUserId = getUserIdFromToken();


  // Check for existing DRAFT invoice when user_id and billing_period change
  const checkForExistingDraft = (userId: string, billingPeriod: string) => {
    if (!userId || !billingPeriod || !invoicesData) {
      return;
    }

    const rawInvoices = invoicesData?.invoices || invoicesData || [];


    const existingInvoice = rawInvoices.find(
      (inv: any) =>
        inv.user_id === userId &&
        inv.billing_period === billingPeriod &&
        inv.status?.toUpperCase() === InvoiceStatus.DRAFT
    );


    if (existingInvoice) {
      const draft: ExistingDraftInvoice = {
        id: existingInvoice.id || existingInvoice.invoice_id,
        invoice_id: existingInvoice.invoice_id,
        user_id: existingInvoice.user_id,
        billing_period: existingInvoice.billing_period,
        due_date: existingInvoice.due_date,
        notes: existingInvoice.notes,
        items: (existingInvoice.items || []).map((item: any) => ({
          invoice_item_id: item.invoice_item_id,
          item_category: item.item_category,
          description: item.description,
          amount: Number(item.amount),
        })),
      };
      setExistingDraft(draft);
      setInvoiceItems(draft.items);

      // Prefill form values
      const methods = formMethodsRef.current;
      if (methods) {
        methods.setValue("due_date", draft.due_date?.split("T")[0] || getDefaultDueDate());
        methods.setValue("notes", draft.notes || "");
      }
    } else {
      setExistingDraft(null);
      setInvoiceItems([]);
    }
  };

  // Reset state when modal closes or load editInvoice/adjustInvoice data
  useEffect(() => {
    if (!isOpen) {
      setExistingDraft(null);
      setInvoiceItems([]);
      setEditingIndex(null); // Cancel any ongoing edits
      setIsLoading(false); // Reset loading when modal closes
    } else if (editInvoice) {
      // Set existingDraft and invoiceItems for edit mode
      const draft: ExistingDraftInvoice = {
        id: editInvoice.id,
        invoice_id: editInvoice.invoice_id,
        user_id: editInvoice.user_id,
        billing_period: editInvoice.billing_period,
        due_date: editInvoice.due_date,
        notes: editInvoice.notes,
        items: editInvoice.items,
      };
      setExistingDraft(draft);
      setInvoiceItems(editInvoice.items);
    } else if (adjustInvoice) {
      // For adjust mode, don't set existingDraft (we're creating new)
      // but pre-fill items from the invoice being adjusted
      setExistingDraft(null);
      setInvoiceItems(adjustInvoice.items);
    }
  }, [isOpen, editInvoice, adjustInvoice]);

  // Compute defaultValues based on editInvoice or adjustInvoice
  const defaultValues = editInvoice
    ? {
      user_id: editInvoice.user_id,
      billing_period: editInvoice.billing_period,
      due_date: editInvoice.due_date?.split("T")[0] || getDefaultDueDate(),
      notes: editInvoice.notes,
    }
    : adjustInvoice
      ? {
        user_id: adjustInvoice.user_id || "",
        billing_period: adjustInvoice.billing_period || "",
        due_date: adjustInvoice.due_date?.split("T")[0] || getDefaultDueDate(),
        notes: adjustInvoice.notes || "",
      }
      : {
        user_id: selectedResident?.id || "",
        billing_period: "",
        due_date: getDefaultDueDate(),
        notes: "",
      };

  // Handle selection changes for resident and billing period
  const handleSelectionChange = (fieldName: string, value: string) => {
    const methods = formMethodsRef.current;
    if (!methods) return;

    // Get current values
    const userId = fieldName === "user_id" ? value : methods.getValues("user_id");
    const billingPeriod = fieldName === "billing_period" ? value : methods.getValues("billing_period");

    checkForExistingDraft(userId, billingPeriod);
  };

  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  // Fetch active seniors data
  const { data: seniorsData } = useGetAll({
    key: userRoles.SENIOR,
    params: {
      userType: userRoles.SENIOR,
      homeId: homeId || "",
    },
    path: GetUsersPath,
  });

  const residentOptions = useMemo(() => {
    const seniorsList = (seniorsData as any)?.users || (seniorsData as any) || [];
    if (!seniorsList.length) return [];
    return seniorsList
      .filter((senior: any) => !senior.isDeleted)
      .map((senior: any) => ({
        option: `${senior.name || `${senior.firstName || ''} ${senior.lastName || ''}`.trim()}${senior.roomNumber ? ` - Room ${senior.roomNumber}` : ''}`,
        value: senior.userId || senior.id,
      }));
  }, [seniorsData]);

  const billingPeriodOptions = getBillingPeriodOptions();

  const today = new Date().toISOString().split("T")[0];

  const handleAddLineItem = () => {
    const methods = formMethodsRef.current;
    if (!methods) return;

    const description = methods.getValues("newItemDescription");
    const amount = parseFloat(methods.getValues("newItemAmount"));
    const category = methods.getValues("newItemCategory");

    if (!description.trim() || !amount || amount <= 0 || !category?.trim()) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please fill in all item fields with valid values"));
      return;
    }

    setInvoiceItems(prev => [
      ...prev,
      {
        item_category: category as InvoiceItemCategory,
        description: description.trim(),
        amount: amount
      }
    ]);

    methods.setValue("newItemDescription", "");
    methods.setValue("newItemAmount", "");
    methods.setValue("newItemCategory", "");
  };

  const handleDeleteLineItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditLineItem = (index: number) => {
    setEditingIndex(index);
    const methods = formMethodsRef.current;
    if (methods) {
      const item = invoiceItems[index];
      methods.setValue("editItemDescription", item.description);
      methods.setValue("editItemAmount", item.amount.toString());
      methods.setValue("editItemCategory", item.item_category);
    }
  };

  const handleSaveEditItem = () => {
    const methods = formMethodsRef.current;
    if (!methods || editingIndex === null) return;

    const description = methods.getValues("editItemDescription");
    const amount = parseFloat(methods.getValues("editItemAmount"));
    const category = methods.getValues("editItemCategory");

    if (!description.trim() || !amount || amount <= 0 || !category?.trim()) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please fill in all item fields with valid values"));
      return;
    }

    setInvoiceItems(prev =>
      prev.map((item, index) =>
        index === editingIndex
          ? {
            ...item,
            item_category: category as InvoiceItemCategory,
            description: description.trim(),
            amount: amount
          }
          : item
      )
    );

    // Clear edit form
    methods.setValue("editItemDescription", "");
    methods.setValue("editItemAmount", "");
    methods.setValue("editItemCategory", "");
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    const methods = formMethodsRef.current;
    if (methods) {
      methods.setValue("editItemDescription", "");
      methods.setValue("editItemAmount", "");
      methods.setValue("editItemCategory", "");
    }
    setEditingIndex(null);
  };

  const onSubmit = (data: any) => {
    if (invoiceItems.length === 0) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please add at least one invoice item"));
      return;
    }

    setIsLoading(true);

    if (existingDraft) {
      // Update existing draft invoice
      const updatePayload = {
        id: existingDraft.id,
        invoice_id: existingDraft.invoice_id,
        home_id: homeId,
        user_id: data.user_id,
        created_by_user_id: pchoUserId,
        billing_period: data.billing_period,
        status: InvoiceStatus.DRAFT,
        total_amount: calculateTotal(),
        due_date: data.due_date,
        notes: data.notes || null,
        items: invoiceItems.map((item) => ({
          invoice_id: existingDraft.id,
          invoice_item_id: item.invoice_item_id || uuidv4(),
          item_category: item.item_category,
          description: item.description,
          amount: item.amount,
        })),
      };


      updateInvoice({
        data: updatePayload,
        path: invoicePath
      }, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Invoice updated successfully!"));
          setInvoiceItems([]);
          setExistingDraft(null);
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
                : "Failed to update invoice."
            )
          );
          setIsLoading(false);
        },
      });
    } else {
      // Create new invoice (or adjusted invoice)
      const isAdjustment = !!adjustInvoice;
      const payload: any = {
        home_id: homeId,
        user_id: data.user_id,
        created_by_user_id: pchoUserId,
        billing_period: data.billing_period,
        status: isAdjustment ? InvoiceStatus.DUE : InvoiceStatus.DRAFT,
        total_amount: calculateTotal(),
        due_date: data.due_date,
        notes: data.notes || null,
        items: invoiceItems.map((item) => ({
          invoice_item_id: uuidv4(),
          item_category: item.item_category,
          description: item.description,
          amount: item.amount,
        })),
      };

      // Add parent_invoice_id for adjustments
      if (isAdjustment && adjustInvoice.parent_invoice_id) {
        payload.parent_invoice_id = adjustInvoice.parent_invoice_id;
      }

      // For adjustments, pass payload to parent - parent handles create + void in one flow
      if (isAdjustment && onAdjustSubmit) {
        onAdjustSubmit(payload);
        return;
      }

      // Normal create flow
      createInvoice({
        userData: payload,
        path: invoicePath
      }, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Invoice created successfully!"));
          setInvoiceItems([]);
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
                : "Failed to create invoice."
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
      className="!w-[800px]"
    >
      <Form
        key={editInvoice?.id || adjustInvoice?.id}
        schema={InvoiceFormValidationSchema}
        onSubmit={onSubmit}
        useFormMethodsRef={formMethodsRef}
        defaultValues={defaultValues}
      >
        <div className="px-6">
          <h2 className="text-xl font-semibold mb-6">
            {adjustInvoice ? "Adjust Invoice" : existingDraft ? "Update Draft Invoice" : "Create Invoice"}
          </h2>
          {existingDraft && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              A draft invoice already exists for this resident and billing period. You can add more items and update it.
            </div>
          )}
        </div>

        <div className="px-[30px]">
          {/* Left Column */}
          <div className="flex gap-28">
            {/* Resident Selection */}
            <div>
              <FormSelectComponent
                label="Resident *"
                options={residentOptions}
                name="user_id"
                placeHolder="Select Resident"
                containerClass="w-32"
                onChange={(e) => handleSelectionChange("user_id", e.target.value)}
              />
            </div>

            <div>
              <FormSelectComponent
                label="Billing Period *"
                options={billingPeriodOptions}
                name="billing_period"
                placeHolder="Select Period"
                containerClass="w-32"
                onChange={(e) => handleSelectionChange("billing_period", e.target.value)}
              />
            </div>
          </div>

          {/* Due Date */}
          <div className="pt-[20px]">
            <FormInputFieldComponent
              label="Due Date:"
              type="date"
              name="due_date"
              className="mt-1"
              placeholder="Due Date"
              containerClass={"!flex-row w-full"}
              titleClass="!flex !self-center !w-[120px]"
              min={today}
              max="9999-12-31"
            />
          </div>

          <div>
            {/* Invoice Items Section */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoice Items</h3>
              </div>

              {/* Add new item section - clean UI */}
              <div className="bg-[#F9FAFB] rounded-lg p-4 border border-[#E5E7EB] mb-4">
                <div className="flex gap-1">
                  <FormInputFieldComponent
                    label="Description"
                    type="text"
                    name="newItemDescription"
                    placeholder="Item description"
                    containerClass="w-full"
                    className="h-9"
                  />

                  <FormInputFieldComponent
                    label="Amount"
                    type="number"
                    name="newItemAmount"
                    placeholder="0.00"
                    containerClass="w-full"
                    className="h-9"
                  />

                  <FormSelectComponent
                    label="Category"
                    name="newItemCategory"
                    options={BUDGET_INCOME_CATEGORIES}
                    containerClass="w-full pt-1"
                    className=""
                  />


                </div>
                <div className="flex items-center justify-center text-primary font-medium">
                  <div
                    className="h-9 w-full rounded-radius-200 border border-primary border-solid shadow-[0_0_0_1px_#E5E7EB] flex items-center justify-center cursor-pointer bg-white hover:bg-primary/20"
                    onClick={handleAddLineItem}
                  >
                    <Plus size={16} className="text-primary" />Add Item
                  </div>
                  {/* <Button
                  name="+ Add Item"
                  classname="flex items-center justify-center"
                  buttonClick={handleAddLineItem}
                  titleClass="font-normal !text-[16px] justify-center"
                  ></Button> */}
                </div>
              </div>

              {invoiceItems.length > 0 && (
                <div className="rounded-[10px] border border-[#E5E7EB] overflow-hidden">
                  {invoiceItems.map((item, index) => (
                    <div
                      key={index}
                      className={`px-4 py-3 bg-white ${index !== invoiceItems.length - 1 ? "border-b border-[#E5E7EB]" : ""
                        }`}
                    >
                      {/* Edit form */}
                      {editingIndex === index ? (
                        // Edit form
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <FormInputFieldComponent
                              label="Description"
                              type="text"
                              name="editItemDescription"
                              placeholder="Item description"
                              containerClass="flex-1"
                              className="h-8"
                            />
                            <FormInputFieldComponent
                              label="Amount"
                              type="number"
                              name="editItemAmount"
                              placeholder="0.00"
                              containerClass="w-34"
                              className="h-8"
                            />
                            <FormSelectComponent
                              label="Category"
                              name="editItemCategory"
                              options={BUDGET_INCOME_CATEGORIES}
                              containerClass="w-32 pt-1"
                              className=""
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <div
                              className="px-3 py-1 text-xs !font-medium border-solid border border-primary rounded cursor-pointer hover:bg-primary/30"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </div>
                            <div
                              className="px-3 py-1 text-xs !font-medium border-solid border border-primary rounded cursor-pointer hover:bg-primary/30"
                              onClick={handleSaveEditItem}
                            >
                              Save
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-[#111827]">
                              {item.description}
                            </div>
                            <div className="text-xs text-[#6B7280] mt-1">
                              {INVOICE_ITEM_CATEGORIES.find(cat => cat.value === item.item_category)?.option || item.item_category}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-[#111827]">
                            {formatCurrency(item.amount)}
                          </div>
                          <div className="flex gap-1">
                            <div
                              className="h-8 w-8 rounded-radius-200 border border-[#E5E7EB] border-solid shadow-[0_0_0_1px_#E5E7EB] flex items-center justify-center cursor-pointer hover:bg-blue-50"
                              onClick={() => handleEditLineItem(index)}
                            >
                              <EditIcon />
                            </div>
                            <div
                              className="h-8 w-8 rounded-radius-200 border border-[#E5E7EB] border-solid shadow-[0_0_0_1px_#E5E7EB] flex items-center justify-center cursor-pointer hover:bg-red-50"
                              onClick={() => handleDeleteLineItem(index)}
                            >
                              <DeleteIcon />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between border-t border-[#E5E7EB] bg-[#EEF2FF]">
                    <div className="text-sm font-semibold text-[#111827]">Total Amount</div>
                    <div className="text-lg font-bold text-[#1D4ED8]">{formatCurrency(calculateTotal())}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-[20px]">
              <FormTextareaComponent
                label="Notes"
                placeholder="Add any additional notes"
                name="notes"
                onChange={() => { }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-8">
            <Button name="Cancel" classname="" buttonClick={onClose} />
            <Button
              name={isLoading
                ? (existingDraft ? "Updating..." : "Creating...")
                : (existingDraft ? "Update Invoice" : "Create Invoice")}
              classname=""
              type="submit"
            />
          </div>
        </div>
      </Form>
    </CommonModal>
  );
}
