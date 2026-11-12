"use client";

import CommonModal from "../../../../commonComponents/common-modal";
import { formatCurrency } from "../payroll-utils";
import { formatToShortDateRangeForPayStub, formatIsoToDate } from "../../../../utils/dateUtils";
import {
  REVOPS_PAY_STUB_STATUS_UI,
  revopsPayStubPeriodTypeFromBackend,
  revopsPayStubStatusFromBackend,
} from "../../../../utils/revops/constants";

/**
 * Modal for viewing pay stub details including items/expenses
 */
export default function ViewPayStubModal({
  payStub,
  onClose,
}: {
  payStub: any | null;
  onClose: () => void;
}) {
  if (!payStub) return null;

  const caregiverName = payStub?.pcg_user_name ?? payStub?.pcg_user_id;

  // Convert backend values to display format
  const hourlyRate = (payStub.hourly_rate_cents || 0) / 100;
  const baseAmount = (payStub.base_amount_cents || 0) / 100;
  const totalAmount = (payStub.total_amount_cents || 0) / 100;
  const hours = ((payStub.hours_worked_minutes || 0) / 60).toFixed(2);
  const dateRange = formatToShortDateRangeForPayStub(
    payStub.period_start_date,
    payStub.period_end_date,
  );
  const periodType = revopsPayStubPeriodTypeFromBackend(payStub.period_type);
  const status = revopsPayStubStatusFromBackend(payStub.status);
  const createdDate = formatIsoToDate(payStub.created_at);
  const updatedDate = formatIsoToDate(payStub.updated_at);

  // Calculate total expenses from items
  const items = payStub.items || [];
  const totalExpenses = items.reduce((sum: number, item: any) => {
    return sum + (item.amount_cents || 0);
  }, 0) / 100;

  return (
    <CommonModal
      title="Pay Stub Details"
      modalOpen={true}
      setModalOpen={(open) => {
        if (!open) onClose();
      }}
      crossCTA
      width="700px"
    >
      <div className="font-poppins px-[20px] w-[680px]">
        {/* Header Info */}
        <div className="mb-4">
          <div className="text-sm text-[#6B7280]">
            Pay stub for {caregiverName}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">
            ID: {payStub.payroll_payout_id}
          </div>
        </div>

        {/* Main Details Card */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-4 mb-4">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div className="text-[#6B7280]">Period Type</div>
            <div className="text-right font-semibold text-[#111827]">
              {periodType}
            </div>

            <div className="text-[#6B7280]">Date Range</div>
            <div className="text-right font-semibold text-[#111827]">
              {dateRange}
            </div>

            <div className="text-[#6B7280]">Hours Worked</div>
            <div className="text-right font-semibold text-[#111827]">
              {hours}h @ {formatCurrency(hourlyRate)}/hr
            </div>

            <div className="text-[#6B7280]">Base Amount</div>
            <div className="text-right font-semibold text-[#111827]">
              {formatCurrency(baseAmount)}
            </div>

            <div className="text-[#6B7280]">Status</div>
            <div className="text-right">
              <span
                className={`inline-flex items-center px-2 py-[4px] rounded-[6px] text-[10px] font-semibold ${
                  status === REVOPS_PAY_STUB_STATUS_UI.PAID
                    ? "bg-[#E8F1FF] text-[#1D4ED8]"
                    : "bg-[#FEE2E2] text-[#B91C1C]"
                }`}
              >
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Expenses/Items */}
        {items.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#111827] mb-2">
              Additional Items
            </div>
            <div className="rounded-[10px] border border-[#E5E7EB] overflow-hidden">
              {items.map((item: any, idx: number) => (
                <div
                  key={item.payout_item_id || idx}
                  className={`px-4 py-3 bg-white flex items-center justify-between ${
                    idx !== items.length - 1 ? "border-b border-[#E5E7EB]" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm text-[#111827]">
                      {item.description}
                    </div>
                    {item.created_at && (
                      <div className="text-xs text-[#6B7280] mt-1">
                        Added: {formatIsoToDate(item.created_at)}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      (item.amount_cents || 0) < 0
                        ? "text-red-600"
                        : "text-[#111827]"
                    }`}
                  >
                    {formatCurrency((item.amount_cents || 0) / 100)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total Summary */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-4 mb-4 bg-[#F9FAFB]">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-[#6B7280]">Base Pay</div>
            <div className="text-right font-semibold text-[#111827]">
              {formatCurrency(baseAmount)}
            </div>

            {items.length > 0 && (
              <>
                <div className="text-[#6B7280]">Additional Items</div>
                <div className="text-right font-semibold text-[#111827]">
                  {formatCurrency(totalExpenses)}
                </div>
              </>
            )}

            <div className="pt-2 border-t border-[#E5E7EB] text-[#111827] font-semibold">
              Total Amount
            </div>
            <div className="pt-2 border-t border-[#E5E7EB] text-right font-bold text-[#1D4ED8] text-lg">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        {/* Notes */}
        {payStub.notes && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#111827] mb-2">Notes</div>
            <div className="rounded-[10px] border border-[#E5E7EB] p-3 bg-white">
              <div className="text-sm text-[#6B7280]">{payStub.notes}</div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <div>Created: {createdDate}</div>
          <div>Last Updated: {updatedDate}</div>
        </div>
      </div>
    </CommonModal>
  );
}
