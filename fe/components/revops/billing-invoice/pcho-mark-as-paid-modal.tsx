"use client";

import { useState } from "react";
import CommonModal from "../../../commonComponents/common-modal";
import Button from "../../../commonComponents/button";
import { DollarSign } from "lucide-react";
import Loader from "../../../commonComponents/loader";
import useUpdate from "../../../services/update";
import useCreate from "../../../services/create";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import SelectComponent from "../../../commonComponents/select-component";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import {
  REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS,
  REVOPS_PROCESS_PAYMENT_TEXT,
  REVOPS_PAYMENT_PROVIDER_BACKEND,
  REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND,
  REVOPS_SENIOR_PAYMENT_REDIRECT_URLS,
  revopsManualMethodToBackend,
} from "../../../utils/revops/constants";
import { InvoiceStatus, invoicePath, revopsPaymentPath } from "../../../utils/constants";
import { formatBillingPeriod } from "../../../utils/billingPeriodUtils";
import { formatCurrency } from "../charts/chart-utils";

interface MarkAsPaidInvoice {
  id: string;
  invoiceNumber: string;
  billingPeriod: string;
  dueDate: string;
  amount: number;
  status: string;
  userId: string;
  resident?: string;
  description?: string;
  rawItems?: Array<{
    invoice_item_id?: string;
    item_category: string;
    description: string;
    amount: number;
  }>;
}

export default function PchoMarkAsPaidModal({
  invoice,
  onClose,
}: {
  invoice: MarkAsPaidInvoice | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const { mutate: updateInvoice, isPending: isUpdating } = useUpdate();
  const { mutate: createPayment, isPending: isCreating } = useCreate();
  const isPending = isUpdating || isCreating;
  const today = new Date().toISOString().split("T")[0];

  const [paymentType, setPaymentType] = useState<string>(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
  const [paidDate, setPaidDate] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const handleClose = () => {
    if (isPending) return;
    setPaymentType(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
    setPaidDate("");
    setReferenceId("");
    onClose();
  };

  const handleConfirm = () => {
    if (!invoice) return;

    if (!referenceId.trim()) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please enter a reference ID"));
      return;
    }
    if (!paidDate) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please select the paid date"));
      return;
    }

    const homeId = getHomeIdFromToken();
    const pchoUserId = getUserIdFromToken();

    const invoicePayload = {
      id: invoice.id,
      invoice_id: invoice.invoiceNumber,
      home_id: homeId,
      user_id: invoice.userId,
      created_by_user_id: pchoUserId,
      billing_period: invoice.billingPeriod,
      due_date: invoice.dueDate,
      total_amount: invoice.amount,
      notes: invoice.description || "",
      items: (invoice.rawItems || []).map((item) => ({
        ...item,
        invoice_id: invoice.id,
      })),
      status: InvoiceStatus.PAID,
    };

    const paymentPayload = {
      subject_type: REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND.INVOICE,
      subject_public_id: invoice.invoiceNumber,
      provider: REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL,
      success_url: REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.SUCCESS,
      cancel_url: REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.CANCEL,
      manual_method: revopsManualMethodToBackend(paymentType),
      manual_reference: referenceId || null,
      manual_paid_at: new Date(paidDate).toISOString(),
      payer_user_id: invoice.userId,
      initiated_by_user_id: pchoUserId,
    };

    // Create the payment record first (invoice is still DUE at this point),
    // then mark the invoice as PAID once the payment is recorded.
    createPayment(
      { userData: paymentPayload, path: revopsPaymentPath },
      {
        onSuccess: () => {
          updateInvoice(
            { data: invoicePayload, path: invoicePath },
            {
              onSuccess: () => {
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Invoice marked as paid successfully!"));
                handleClose();
              },
              onError: (error: any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                  handleShowPopoverMessage(
                    !Array?.isArray(error?.response?.data?.error)
                      ? error?.response?.data?.error
                      : "Failed to mark invoice as paid.",
                  ),
                );
              },
            },
          );
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              "Failed to record payment.",
            ),
          );
        },
      },
    );
  };

  return (
    <CommonModal
      title="Mark as Paid"
      modalOpen={invoice != null}
      setModalOpen={(open) => {
        if (!open) handleClose();
      }}
      crossCTA
      width="700px"
    >
      {invoice && isPending ? (
        <div className="px-[20px] w-[680px]">
          <Loader fullScreen={false} message="Marking invoice as paid..." />
        </div>
      ) : invoice ? (
        <div className="font-poppins px-[20px] w-[680px]">
          <div className="text-sm text-[#6B7280]">
            Record a manual payment for invoice #{invoice.invoiceNumber}
            {invoice.resident ? ` – ${invoice.resident}` : ""}
          </div>

          {/* Invoice summary */}
          <div className="mt-4 rounded-[10px] border border-[#E5E7EB] p-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-[#6B7280]">Invoice Number</div>
              <div className="text-right font-semibold text-[#111827]">
                #{invoice.invoiceNumber}
              </div>

              <div className="text-[#6B7280]">Billing Period</div>
              <div className="text-right font-semibold text-[#111827]">
                {formatBillingPeriod(invoice.billingPeriod)}
              </div>

              <div className="text-[#6B7280]">Due Date</div>
              <div className="text-right font-semibold text-[#111827]">
                {invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString()
                  : "-"}
              </div>

              <div className="pt-2 text-[#111827] font-semibold">Total Amount</div>
              <div className="pt-2 text-right font-bold text-[#1D4ED8] text-lg">
                {formatCurrency(invoice.amount)}
              </div>
            </div>
          </div>

          {/* Manual payment fields */}
          <div className="mt-5 text-sm font-semibold text-[#111827]">
            Payment Details
          </div>

          <div className="mt-3 flex gap-4">
            <SelectComponent
              label="Payment Type"
              options={REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS as any}
              name="paymentType"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="max-w-full pb-4"
            />
            <InputFieldComponent
              label="Paid Date"
              name="paidDate"
              value={paidDate}
              max={today}
              type="date"
              onChange={(e) => setPaidDate(e.target.value)}
              className="!w-[200px] pb-4"
            />
          </div>

          <div className="mt-1">
            <InputFieldComponent
              label={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_LABEL}
              name="referenceId"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_PLACEHOLDER}
              className="w-full"
            />
          </div>

          <div className="mt-4">
            <InputFieldComponent
              label={REVOPS_PROCESS_PAYMENT_TEXT.AMOUNT_LABEL}
              name="amount"
              value={formatCurrency(invoice.amount)}
              disabled
              className="opacity-60 w-full"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              name="Cancel"
              type="button"
              buttonClick={handleClose}
              classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50"
              titleClass="!text-[#111827] !text-[12px]"
            />
            <Button
              name={REVOPS_PROCESS_PAYMENT_TEXT.CTA_MANUAL}
              type="button"
              buttonClick={handleConfirm}
              icon={<DollarSign size={16} color="white" />}
              classname="bg-secondarymirage"
              titleClass="!text-[12px]"
              iconStart={true}
            />
          </div>
        </div>
      ) : null}
    </CommonModal>
  );
}
