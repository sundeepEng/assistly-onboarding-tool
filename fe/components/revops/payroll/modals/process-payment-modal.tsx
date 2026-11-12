"use client";

import { useMemo, useState } from "react";
import CommonModal from "../../../../commonComponents/common-modal";
import Button from "../../../../commonComponents/button";
import type {
  RevopsPayStub,
  RevopsPayStubPaymentMethod,
} from "../../../../utils/revops/mock-data";
import { CreditCard, DollarSign } from "lucide-react";
import { formatCurrency } from "../payroll-utils";
import Loader from "../../../../commonComponents/loader";
import useCreate from "../../../../services/create";
import { useQueryClient } from "@tanstack/react-query";
import { revopsPaymentPath } from "../../../../utils/constants";
import InputFieldComponent from "../../../../commonComponents/input-field-component";
import SelectComponent from "../../../../commonComponents/select-component";
import { useAppDispatch } from "../../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../../redux/slices/exception-popover-slice";
import { getUserIdFromToken } from "../../../../utils/auth";
import {
  REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS,
  REVOPS_PAYMENT_ERROR_MESSAGES,
  REVOPS_PAYMENT_LOADER_TEXT,
  REVOPS_PAYMENT_PROVIDER_BACKEND,
  REVOPS_PAYMENT_REDIRECT_URLS,
  REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND,
  REVOPS_PAY_STUB_PAYMENT_METHOD_UI,
  REVOPS_PROCESS_PAYMENT_TEXT,
  revopsManualMethodToBackend,
} from "../../../../utils/revops/constants";

/**
 * Modal for processing payments for pay stubs
 * Self-contained with internal state management
 */
export default function RevopsPayrollProcessPaymentModal({
  stubToProcess,
  onClose,
  onPaymentProcessed,
}: {
  stubToProcess: RevopsPayStub | null;
  onClose: () => void;
  onPaymentProcessed?: (args: {
    stub: RevopsPayStub;
    paymentMethod: RevopsPayStubPaymentMethod;
    referenceId?: string;
  }) => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { mutate: createMutate, isPending: isCreatingPayment } = useCreate();

  // Internal state for payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<RevopsPayStubPaymentMethod>(REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE);
  const [manualPaymentType, setManualPaymentType] = useState<string>(
    REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE,
  );
  const [manualReferenceId, setManualReferenceId] = useState("");

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
    onClose();
  };

  /**
   * Handle payment confirmation
   */
  const handleConfirm = () => {
    if (!stubToProcess) return;

    const payrollPayoutId = stubToProcess.payrollPayoutId;
    const pchoUserId = stubToProcess.pchoUserId;
    const initiatedByUserId = getUserIdFromToken();

    if (!payrollPayoutId || !pchoUserId || !initiatedByUserId) return;

    const provider =
      selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
        ? REVOPS_PAYMENT_PROVIDER_BACKEND.STRIPE
        : REVOPS_PAYMENT_PROVIDER_BACKEND.MANUAL;

    const isManual = provider === "MANUAL";

    const paymentRequest = {
      subject_type: REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND.PAYROLL_PAYOUT,
      subject_public_id: payrollPayoutId,
      provider,
      success_url: REVOPS_PAYMENT_REDIRECT_URLS.SUCCESS,
      cancel_url: REVOPS_PAYMENT_REDIRECT_URLS.CANCEL,
      manual_method: isManual
        ? revopsManualMethodToBackend(manualPaymentType)
        : undefined,
      manual_reference: isManual ? (manualReferenceId ? manualReferenceId : null) : undefined,
      manual_notes: undefined,
      manual_paid_at: undefined,
      payer_user_id: pchoUserId,
      initiated_by_user_id: initiatedByUserId,
    };

    createMutate(
      { userData: paymentRequest, path: revopsPaymentPath },
      {
        onSuccess: (response: any) => {
          queryClient.invalidateQueries({ queryKey: ["pay-stubs"] });

          const checkoutUrl = response?.data?.checkout_url;
          if (checkoutUrl) {
            window.open(checkoutUrl, "_blank", "noopener,noreferrer");
          }

          onPaymentProcessed?.({
            stub: stubToProcess,
            paymentMethod: selectedPaymentMethod,
            referenceId:
              selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.MANUAL
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
      modalOpen={stubToProcess != null}
      setModalOpen={(open) => {
        if (!open) handleClose();
      }}
      crossCTA
      width="700px"
    >
      {stubToProcess && isCreatingPayment ? (
        <div className="px-[20px] w-[680px]">
          <Loader fullScreen={false} message={loaderMessage} />
        </div>
      ) : stubToProcess ? (
        <div className="font-poppins px-[20px] w-[680px]">
          <div className="text-sm text-[#6B7280]">
            Pay {stubToProcess.caregiverName} for the period {stubToProcess.dateRange}
          </div>

          <div className="mt-4 rounded-[10px] border border-[#E5E7EB] p-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-[#6B7280]">Caregiver</div>
              <div className="text-right font-semibold text-[#111827]">
                {stubToProcess.caregiverName}
              </div>

              <div className="text-[#6B7280]">Hours Worked</div>
              <div className="text-right font-semibold text-[#111827]">
                {stubToProcess.hours}h @ ${stubToProcess.hourlyRate}/h
              </div>

              <div className="text-[#6B7280]">Base Amount</div>
              <div className="text-right font-semibold text-[#111827]">
                {formatCurrency(stubToProcess.baseAmount)}
              </div>

              <div className="text-[#6B7280]">Expenses</div>
              <div className="text-right font-semibold text-[#111827]">
                {formatCurrency(stubToProcess.expenses)}
              </div>

              <div className="pt-2 text-[#111827] font-semibold">Total to Pay</div>
              <div className="pt-2 text-right font-bold text-[#1D4ED8] text-lg">
                {formatCurrency(stubToProcess.totalAmount)}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm font-semibold text-[#111827]">Payment Method</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`rounded-[10px] border p-4 text-left ${
                selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.STRIPE
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
              className={`rounded-[10px] border p-4 text-left ${
                selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.MANUAL
                  ? "border-secondarymirage bg-[#EEF2FF]"
                  : "border-[#E5E7EB] bg-white"
              }`}
              onClick={() => {
                setSelectedPaymentMethod(REVOPS_PAY_STUB_PAYMENT_METHOD_UI.MANUAL);
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

          {selectedPaymentMethod === REVOPS_PAY_STUB_PAYMENT_METHOD_UI.MANUAL && (
            <div className="mt-4">
              <SelectComponent
                label="Payment Method"
                options={REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS}
                name="manualPaymentType"
                value={manualPaymentType}
                onChange={(e) => setManualPaymentType(e.target.value)}
                className="max-w-full"
              />

              <div className="mt-4">
                <InputFieldComponent
                  label={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_LABEL}
                  name="manualReferenceId"
                  value={manualReferenceId}
                  onChange={(e) => setManualReferenceId(e.target.value)}
                  placeholder={REVOPS_PROCESS_PAYMENT_TEXT.REFERENCE_PLACEHOLDER}
                />
              </div>

              <div className="mt-4">
                <InputFieldComponent
                  label={REVOPS_PROCESS_PAYMENT_TEXT.AMOUNT_LABEL}
                  name="amount"
                  value={formatCurrency(stubToProcess.totalAmount)}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
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
