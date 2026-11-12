"use client";

import { useMemo, useState } from "react";
import CommonModal from "../../../commonComponents/common-modal";
import Button from "../../../commonComponents/button";
import { CreditCard, DollarSign } from "lucide-react";
import Loader from "../../../commonComponents/loader";
import useCreate from "../../../services/create";
import { useQueryClient } from "@tanstack/react-query";
import { revopsPaymentPath } from "../../../utils/constants";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import SelectComponent from "../../../commonComponents/select-component";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getUserIdFromToken } from "../../../utils/auth";
import {
  REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS,
  REVOPS_PAY_STUB_PAYMENT_METHOD_UI,
  REVOPS_PAYMENT_ERROR_MESSAGES,
  REVOPS_PAYMENT_LOADER_TEXT,
  REVOPS_PAYMENT_PROVIDER_BACKEND,
  REVOPS_PAYMENT_REDIRECT_URLS,
  REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND,
  REVOPS_PROCESS_PAYMENT_TEXT,
  REVOPS_SENIOR_PAYMENT_REDIRECT_URLS,
  revopsManualMethodToBackend,
} from "../../../utils/revops/constants";
import { InvoiceStatus } from "../../../utils/constants";
import { formatBillingPeriod } from "../../../utils/billingPeriodUtils";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import { formatCurrency } from "../charts/chart-utils";

interface SeniorInvoice {
  id: string;
  invoiceNumber: string;
  billingPeriod: string;
  dueDate: string;
  amount: number;
  status: string;
  createdAt: string;
  description: string;
  createdByUserId: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

/**
 * Modal for processing payments for senior invoices
 * Self-contained with internal state management
 */
export default function SeniorInvoicePaymentModal({
  invoiceToPay,
  onClose,
  onPaymentProcessed,
}: {
  invoiceToPay: SeniorInvoice | null;
  onClose: () => void;
  onPaymentProcessed?: (args: {
    invoice: SeniorInvoice;
    paymentMethod: string;
    referenceId?: string;
  }) => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { mutate: createMutate, isPending: isCreatingPayment } = useCreate();
  const today = new Date().toISOString().split("T")[0];

  // Internal state for payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(REVOPS_PAYMENT_PROVIDER_BACKEND.STRIPE);
  const [manualPaymentType, setManualPaymentType] = useState<string>(
    REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  );
  const [manualReferenceId, setManualReferenceId] = useState("");
  const [manualPaidDate, setManualPaidDate] = useState("");

  const loaderMessage = useMemo(() => {
    return selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
      ? REVOPS_PAYMENT_LOADER_TEXT.STRIPE_REDIRECT
      : REVOPS_PAYMENT_LOADER_TEXT.PROCESSING;
  }, [selectedPaymentMethod]);

  /**
   * Reset modal state when closing
   */
  const handleClose = () => {
    if (isCreatingPayment) return;
    setSelectedPaymentMethod(REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE);
    setManualPaymentType(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
    setManualReferenceId("");
    setManualPaidDate("");
    onClose();
  };

  /**
   * Handle payment confirmation
   */
  const handleConfirm = () => {
    if (!invoiceToPay) return;

    const invoiceId = invoiceToPay.id;

    const seniorUserId = getUserIdFromToken(); // Senior who is paying

    if (!invoiceId || !seniorUserId) return;

    // Validate manual payment fields
    if (selectedPaymentMethod === REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL) {
      if (!manualReferenceId.trim()) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Please fill in the reference ID for manual payment"));
        return;
      }
      if (!manualPaidDate) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Please select the paid date"));
        return;
      }
    }

    const provider = selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
      ? REVOPS_PAYMENT_PROVIDER_BACKEND.STRIPE
      : REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL;

    const isManual = provider === REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL;

    const payload = {
      subject_type: REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND.INVOICE,
      subject_public_id: invoiceToPay?.invoiceNumber,
      provider,
      success_url: REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.SUCCESS,
      cancel_url: REVOPS_SENIOR_PAYMENT_REDIRECT_URLS.CANCEL,
      manual_method: isManual
        ? revopsManualMethodToBackend(manualPaymentType)
        : undefined,
      manual_reference: isManual ? (manualReferenceId ? manualReferenceId : null) : undefined,
      manual_paid_at: isManual ? new Date(manualPaidDate).toISOString() : undefined,
      payer_user_id: seniorUserId,
      initiated_by_user_id: invoiceToPay?.createdByUserId
    };

    createMutate(
      { userData: payload, path: revopsPaymentPath },
      {
        onSuccess: (response: any) => {
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
          queryClient.invalidateQueries({ queryKey: ["seniorInvoices"] });

          const checkoutUrl = response?.data?.checkout_url;
          if (checkoutUrl) {
            window.open(checkoutUrl, "_blank", "noopener,noreferrer");
          }

          onPaymentProcessed?.({
            invoice: invoiceToPay,
            paymentMethod: selectedPaymentMethod,
            referenceId:
              selectedPaymentMethod === REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL
                ? manualReferenceId || undefined
                : undefined,
          });

          handleClose();
        },
        onError: (error: any) => {
          const errMsg =
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            REVOPS_PAYMENT_ERROR_MESSAGES.CREATE_FAILED;
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage(errMsg));
        },
      },
    );
  };

  return (
    <CommonModal
      title="Process Payment"
      modalOpen={invoiceToPay != null}
      setModalOpen={(open) => {
        if (!open) handleClose();
      }}
      crossCTA
      width="700px"
    >
      {invoiceToPay && isCreatingPayment ? (
        <div className="px-[20px] w-[680px]">
          <Loader fullScreen={false} message={loaderMessage} />
        </div>
      ) : invoiceToPay ? (
        <div className="font-poppins px-[20px] w-[680px]">
          <div className="text-sm text-[#6B7280]">
            Pay invoice #{invoiceToPay.invoiceNumber} for {formatBillingPeriod(invoiceToPay.billingPeriod)}
          </div>

          <div className="mt-4 rounded-[10px] border border-[#E5E7EB] p-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-[#6B7280]">Invoice Number</div>
              <div className="text-right font-semibold text-[#111827]">
                #{invoiceToPay.invoiceNumber}
              </div>

              <div className="text-[#6B7280]">Billing Period</div>
              <div className="text-right font-semibold text-[#111827]">
                {formatBillingPeriod(invoiceToPay.billingPeriod)}
              </div>

              <div className="text-[#6B7280]">Due Date</div>
              <div className="text-right font-semibold text-[#111827]">
                {invoiceToPay.dueDate ? new Date(invoiceToPay.dueDate).toLocaleDateString() : "-"}
              </div>

              <div className="text-[#6B7280]">Status</div>
              <div className="text-right font-semibold text-[#111827]">
                {invoiceToPay.status}
              </div>

              <div className="pt-2 text-[#111827] font-semibold">Total Amount</div>
              <div className="pt-2 text-right font-bold text-[#1D4ED8] text-lg">
                {formatCurrency(invoiceToPay.amount)}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm font-semibold text-[#111827]">Payment Method</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`rounded-[10px] border p-4 text-left ${selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
                ? "border-secondarymirage bg-[#EEF2FF]"
                : "border-[#E5E7EB] bg-white"
                }`}
              onClick={() => {
                setSelectedPaymentMethod(REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE);
                setManualPaymentType(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
                setManualReferenceId("");
              }}
            >
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-secondarymirage" />
                <div className="text-sm font-semibold text-[#111827]">
                  {REVOPS_PROCESS_PAYMENT_TEXT.STRIPE_TITLE}
                </div>
              </div>
              <div className="mt-1 text-xs text-[#6B7280]">
                {REVOPS_PROCESS_PAYMENT_TEXT.STRIPE_HELPER}
              </div>
            </button>

            <button
              type="button"
              className={`rounded-[10px] border p-4 text-left ${selectedPaymentMethod === REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL
                ? "border-secondarymirage bg-[#EEF2FF]"
                : "border-[#E5E7EB] bg-white"
                }`}
              onClick={() => {
                setSelectedPaymentMethod(REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL);
                setManualPaymentType(REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE);
              }}
            >
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-secondarymirage" />
                <div className="text-sm font-semibold text-[#111827]">
                  {REVOPS_PROCESS_PAYMENT_TEXT.MANUAL_TITLE}
                </div>
              </div>
              <div className="mt-1 text-xs text-[#6B7280]">
                {REVOPS_PROCESS_PAYMENT_TEXT.MANUAL_HELPER}
              </div>
            </button>
          </div>

          {selectedPaymentMethod === REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL && (
            <div className="mt-4">
              <div className="flex gap-4">
                <SelectComponent
                  label="Payment Type"
                  options={REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS}
                  name="manualPaymentType"
                  value={manualPaymentType}
                  onChange={(e) => setManualPaymentType(e.target.value)}
                  className="max-w-full pb-4"
                />
                <InputFieldComponent
                  label="Paid Date"
                  name="manualPaidDate"
                  value={manualPaidDate}
                  max={today}
                  type="date"
                  onChange={(e) => setManualPaidDate(e.target.value)}
                  className="!w-[200px] pb-4"
                />
              </div>

              <div className="mt-4">
                <InputFieldComponent
                  label={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_LABEL}
                  name="manualReferenceId"
                  value={manualReferenceId}
                  onChange={(e) => setManualReferenceId(e.target.value)}
                  placeholder={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_PLACEHOLDER}
                  className="w-full"
                />
              </div>

              <div className="mt-4">
                <InputFieldComponent
                  label={REVOPS_PROCESS_PAYMENT_TEXT.AMOUNT_LABEL}
                  name="amount"
                  value={formatCurrency(invoiceToPay.amount)}
                  disabled
                  className="opacity-60 w-full"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              name="Cancel"
              type="button"
              buttonClick={handleClose}
              classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50"
              titleClass="!text-[#111827] !text-[12px]"
            />
            <Button
              name={
                selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
                  ? REVOPS_PROCESS_PAYMENT_TEXT.CTA_STRIPE
                  : REVOPS_PROCESS_PAYMENT_TEXT.CTA_MANUAL
              }
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
