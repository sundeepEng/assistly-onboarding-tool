"use client";

import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import CommonModal from "../../../../commonComponents/common-modal";
import Button from "../../../../commonComponents/button";
import useDelete from "../../../../services/delete";
import { payStubPath } from "../../../../utils/constants";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../../redux/slices/exception-popover-slice";

const DeletePayStubModal = ({
  payStub,
  onClose,
  onSuccess,
}: {
  payStub: any | null;
  onClose: () => void;
  onSuccess?: () => void;
}) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const { mutate: deletePayStub, isPending: isDeleting } = useDelete();

  if (!payStub) return null;

  const handleDelete = () => {
    if (!payStub?.id) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Pay stub ID is missing."));
      return;
    }

    deletePayStub(
      {
        path: payStubPath,
        id: payStub.id,
      },
      {
        onSuccess: () => {
          // Refresh pay stub list
          queryClient.invalidateQueries({
            queryKey: ["pay-stubs"],
          });

          // Close modal / notify parent
          onSuccess?.();

          // Success notification
          dispatch(handleOpenPopover());
          dispatch(
            handleShowPopoverMessage("Pay stub deleted successfully!"),
          );
        },

        onError: (error: any) => {
          console.error("Failed to delete pay stub:", error);

          const errorMessage =
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            "Failed to delete pay stub. Please try again.";

          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage(errorMessage));
        },
      },
    );
  };

  return (
    <CommonModal
      title="Delete Pay Stub"
      modalOpen={!!payStub}
      setModalOpen={(open) => {
        if (!open && !isDeleting) {
          onClose();
        }
      }}
      crossCTA={!isDeleting}
      width="450px"
    >
      <div className="font-poppins px-[20px] pb-5">
        {/* Delete Icon */}
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <Trash2
              size={22}
              className="text-red-500"
            />
          </div>
        </div>

        {/* Confirmation Message */}
        <div className="mt-4 text-center">
          <h3 className="text-base font-semibold text-[#111827]">
            Are you sure you want to delete this pay stub?
          </h3>

          <p className="mt-2 text-sm leading-5 text-[#6B7280]">
            This action cannot be undone. The pay stub and its associated
            information will be permanently deleted.
          </p>
        </div>

        {/* Pay Stub Information */}
        <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          {/* Pay Stub ID */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#6B7280]">
              Pay Stub
            </span>

            <span className="text-right text-sm font-medium text-[#111827]">
              {payStub?.payroll_payout_id ||
                payStub?.id ||
                "-"}
            </span>
          </div>

          {/* Caregiver */}
          {payStub?.pcg_user_name && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-[#6B7280]">
                Caregiver
              </span>

              <span className="text-right text-sm text-[#111827]">
                {payStub.pcg_user_name}
              </span>
            </div>
          )}

          {/* Period */}
          {payStub?.period_label && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-[#6B7280]">
                Period
              </span>

              <span className="text-right text-sm text-[#111827]">
                {payStub.period_label}
              </span>
            </div>
          )}

          {/* Date Range */}
          {payStub?.period_start_date &&
            payStub?.period_end_date && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-xs text-[#6B7280]">
                  Date Range
                </span>

                <span className="text-right text-sm text-[#111827]">
                  {String(payStub.period_start_date).slice(0, 10)}
                  {" - "}
                  {String(payStub.period_end_date).slice(0, 10)}
                </span>
              </div>
            )}

          {/* Amount */}
          {payStub?.total_amount_cents != null && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-[#6B7280]">
                Amount
              </span>

              <span className="text-right text-sm font-semibold text-[#111827]">
                $
                {(
                  Number(payStub.total_amount_cents) / 100
                ).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <p className="text-xs leading-5 text-red-700">
            Deleting this pay stub is permanent. You will not be able
            to recover it after deletion.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            name="Cancel"
            type="button"
            buttonClick={onClose}
            classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50"
            titleClass="!text-[#111827] !text-[12px]"
            disabled={isDeleting}
          />

          <Button
            name="Delete Pay Stub"
            type="button"
            buttonClick={handleDelete}
            classname="!bg-red-500 hover:!bg-red-600"
            titleClass="!text-white !text-[12px]"
            disabled={isDeleting}
            isLoading={isDeleting}
          />
        </div>
      </div>
    </CommonModal>
  );
};

export default DeletePayStubModal;