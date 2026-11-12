"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "../../../../commonComponents/card";
import BaseTable from "../../../../commonComponents/base-table";
import Button from "../../../../commonComponents/button";
import { Eye, DollarSign, Pencil, Download, Trash2 } from "lucide-react";
import type { RevopsPayStub } from "../../../../utils/revops/mock-data";
import { formatCurrency, formatShortDate } from "../payroll-utils";
import useGetAll from "../../../../services/getAll";
import { payStubPath } from "../../../../utils/constants";
import Loader from "../../../../commonComponents/loader";
import { formatToShortDateRangeForPayStub, formatIsoToDate } from "../../../../utils/dateUtils";
import ViewPayStubModal from "../modals/view-pay-stub-modal";
import { downloadPayStubPdf } from "../pay-stub-pdf";
import RevopsPayrollNewPayStubModal from "../modals/new-pay-stub-modal";
import {
  REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND,
  REVOPS_PAY_STUB_STATUS_BACKEND,
  REVOPS_PAY_STUB_ACTION_TITLES,
  REVOPS_PAY_STUB_STATUS_UI,
  revopsPayStubPeriodTypeFromBackend,
  revopsPayStubStatusFromBackend,
} from "../../../../utils/revops/constants";
import { getHomeIdFromToken } from "../../../../utils/auth";
import useGetAllShifts from "../../../../services/hcm-getall-shifts";
import DeletePayStubModal from "../modals/delete-pay-stub-modal";


function PayStubStatusPill({ status }: { status: RevopsPayStub["status"] }) {
  const cls =
    status === REVOPS_PAY_STUB_STATUS_UI.PAID
      ? "bg-[#E8F1FF] text-[#1D4ED8]"
      : "bg-[#FEE2E2] text-[#B91C1C]";

  return (
    <div
      className={`inline-flex items-center px-4 py-[8px] rounded-[6px] text-[12px] font-semibold ${cls}`}
    >
      {status}
    </div>
  );
}

/**
 * Convert the backend payout row shape into the UI stub shape used by Process Payment modal.
 * This keeps the table rendering fast (no pre-transform of the entire dataset) while
 * ensuring downstream modals still receive the data shape they expect.
 */
function transformPayoutRowToPayStub(row: any): RevopsPayStub {
  const items = Array.isArray(row?.items) ? row.items : [];
  const expensesFromItems =
    items.reduce((sum: number, it: any) => sum + (it?.amount_cents || 0), 0) / 100;

  return {
    id: String(row?.id ?? row?.payroll_payout_id ?? ""),
    caregiverId: row?.pcg_user_id ?? "",
    caregiverName: row?.pcg_user_name ?? row?.pcg_user_id ?? "",
    payrollPayoutId: row?.payroll_payout_id ?? undefined,
    pchoUserId: row?.pcho_user_id ?? undefined,
    pcgUserId: row?.pcg_user_id ?? undefined,
    hourlyRate: (row?.hourly_rate_cents || 0) / 100,
    periodType: revopsPayStubPeriodTypeFromBackend(row?.period_type),
    dateRange: formatToShortDateRangeForPayStub(row?.period_start_date, row?.period_end_date),
    hours: Number(((row?.hours_worked_minutes || 0) / 60).toFixed(2)),
    baseAmount: (row?.base_amount_cents || 0) / 100,
    expenses: Number(expensesFromItems.toFixed(2)),
    totalAmount: (row?.total_amount_cents || 0) / 100,
    status: revopsPayStubStatusFromBackend(row?.status),
    paidOn:
      row?.status === REVOPS_PAY_STUB_STATUS_BACKEND.PAID
        ? formatIsoToDate(row?.updated_at)
        : undefined,
    paymentMethod: undefined,
    referenceId: undefined,
  };
}

function PayStubPeriodTypePill({
  periodType,
}: {
  periodType: RevopsPayStub["periodType"];
}) {
  return (
    <div className="inline-flex items-center rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-[3px] text-[13px] text-[#111827]">
      {periodType}
    </div>
  );
}

export default function RevopsPayrollPayStubsTab({
  payStubs: _payStubs,
  filterMonth,
  onPay,
}: {
  payStubs: RevopsPayStub[];
  filterMonth: string;
  onPay: (stub: RevopsPayStub) => void;
}) {
  const [viewingStub, setViewingStub] = useState<any | null>(null);
  const [editingStub, setEditingStub] = useState<any | null>(null);
  const [payStubToDelete, setPayStubToDelete] = useState<any | null>(null);


  const filterMonthStartDate = filterMonth ? `${filterMonth}-01` : "";
  const filterMonthEndDate = (() => {
    if (!filterMonth) return "";
    const [yyyy, mm] = filterMonth.split("-").map(Number);
    if (!yyyy || !mm) return "";
    const lastDay = new Date(yyyy, mm, 0).getDate();
    return `${filterMonth}-${String(lastDay).padStart(2, "0")}`;
  })();

  const loggedInUserHomeId = getHomeIdFromToken();

  const payStubsParams = useMemo(() => {
    if (!loggedInUserHomeId) return undefined;
    if (!filterMonthStartDate || !filterMonthEndDate) return undefined;

    return {
      home_id: loggedInUserHomeId,
      period_start_date: [filterMonthStartDate, filterMonthEndDate],
    } as Record<string, string | string[]>;
  }, [filterMonthEndDate, filterMonthStartDate, loggedInUserHomeId]);

  const { data: AllPayStubs, isLoading: isLoadingPayStubs, error: errorPayStubs } = useGetAllShifts({
    key: "pay-stubs",
    params: payStubsParams,
    path: payStubPath,
    enabled: Boolean(payStubsParams),
  });

  const payoutsData = AllPayStubs?.payouts || [];



  const payStubColumns = [
    {
      header: "Caregiver",
      field: "pcg_user_id" as const,
      minWidth: "200px",
      render: (_value: string, row: any) => renderCaregiverCell(row),
    },
    {
      header: "Period Type",
      field: "period_type" as const,
      minWidth: "120px",
      render: (value: string) => renderPeriodTypeCell(value),
    },
    {
      header: "Date Range",
      field: "period_start_date" as const,
      minWidth: "180px",
      render: (_value: string, row: any) => renderDateRangeCell(row),
    },
    {
      header: "Hours",
      field: "hours_worked_minutes" as const,
      minWidth: "90px",
      headerClassName: "",
      render: (value: number) => renderHoursCell(value),
    },
    {
      header: "Amount",
      field: "total_amount_cents" as const,
      minWidth: "130px",
      headerClassName: "",
      render: (value: number) => renderAmountCell(value),
    },
    {
      header: "Status",
      field: "status" as const,
      minWidth: "100px",
      headerClassName: "",
      render: (value: string) => renderStatusCell(value),
    },
    {
      header: "Actions",
      field: "id" as const,
      minWidth: "240px",
      headerClassName: "pr-12",
      render: (_value: string, row: any) =>
        renderActionsCell(row, onPay, setViewingStub, setEditingStub, setPayStubToDelete),
    },
  ];

  if (isLoadingPayStubs) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader fullScreen={false} spinner={true} />
      </div>
    );
  }

  if (errorPayStubs) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-600">Failed to load pay stubs. Please try again.</div>
      </div>
    );
  }

  return (
    <div>
      <Card className="rounded-[12px] border border-[#E5E7EB] bg-white">
        <CardContent>
          <BaseTable
            columns={payStubColumns}
            data={payoutsData}
            headerStyles="border-b-[1px] border-solid border-[#818183] p-2 pl-6"
            rowStyles={() =>
              "pr-2 pl-6 py-1"}
            tableContainerClass="bg-white"
            cellStyles={(field) =>
              field === "actions" ? "justify-end h-full pr-[10px]" : "flex h-full"
            }
          />
        </CardContent>
      </Card>

      <ViewPayStubModal
        payStub={viewingStub}
        onClose={() => setViewingStub(null)}
      />

        <DeletePayStubModal
          payStub={payStubToDelete}
          onClose={() => setPayStubToDelete(null)}
          onSuccess={() => {
            setPayStubToDelete(null);
          }}
        />



      <RevopsPayrollNewPayStubModal
        isOpen={Boolean(editingStub)}
        onClose={() => setEditingStub(null)}
        onCreated={() => {
          // Intentionally keep this lightweight here.
          // The modal itself is responsible for saving + any refetch/invalidation.
          setEditingStub(null);
        }}
        mode="edit"
        initialPayStub={editingStub}
      />
    </div>
  );
}

// Render functions for table cells

/**
 * Render caregiver name and hourly rate
 * Converts hourly_rate_cents to dollars
 */
function renderCaregiverCell(row: any) {
  const hourlyRate = (row.hourly_rate_cents || 0) / 100;
  const caregiverName = row?.pcg_user_name || "--";
  const isMixedRate =
    Number(row?.hourly_rate_cents || 0) === 0 && Number(row?.hours_worked_minutes || 0) > 0;
  return (
    <div className="flex flex-col">
      <div className="text-sm font-semibold text-[#111827]">
        {caregiverName}
      </div>
      <div className="text-[11px] text-[#6B7280]">
        {/* {isMixedRate ? "Mixed" : `$${hourlyRate.toFixed(2)}/hr`} */}
      </div>
    </div>
  );
}

/**
 * Render period type pill
 * Maps BIWEEKLY -> Bi-Weekly, MONTHLY -> Monthly
 */
function renderPeriodTypeCell(periodType: string) {
  const displayType =
    periodType === REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY
      ? revopsPayStubPeriodTypeFromBackend(REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY)
      : revopsPayStubPeriodTypeFromBackend(REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.MONTHLY);
  return <PayStubPeriodTypePill periodType={displayType as any} />;
}

/**
 * Render formatted date range
 */
function renderDateRangeCell(row: any) {
  return formatToShortDateRangeForPayStub(
    row.period_start_date,
    row.period_end_date,
  );
}

/**
 * Render hours worked
 * Converts minutes to hours
 */
function renderHoursCell(minutes: number) {
  const hours = ((minutes || 0) / 60).toFixed(2);
  return <div className="w-full">{hours}h</div>;
}

/**
 * Render total amount
 * Converts cents to dollars
 */
function renderAmountCell(cents: number) {
  const amount = (cents || 0) / 100;
  return (
    <div className="w-full font-semibold text-[#111827]">
      {formatCurrency(amount)}
    </div>
  );
}

/**
 * Render status pill
 * Maps PAID -> Paid, everything else -> Due
 */
function renderStatusCell(status: string) {
  const displayStatus = revopsPayStubStatusFromBackend(status);
  return <PayStubStatusPill status={displayStatus as any} />;
}

/**
 * Render action buttons
 */
function renderActionsCell(
  row: any,
  onPay: (stub: any) => void,
  onView: (stub: any) => void,
  onEdit: (stub: any) => void,
  onDelete: (stub: any) => void,
) {
  const isPaid = row.status === REVOPS_PAY_STUB_STATUS_BACKEND.PAID;
  const paidDate = isPaid ? formatIsoToDate(row.updated_at) : undefined;
  const isEditDisabled = isPaid;

  const handleDownload = async () => {
    await downloadPayStubPdf(row);
  };

  return (
    <div className="w-full flex items-center gap-2 p-2">
      <button
        type="button"
        className="p-2 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] hover:border-[#D1D5DB] cursor-pointer"
        onClick={() => onView(row)}
        title="View details"
      >
        <Eye 
          size={16} 
          className="text-[#6B7280] group-hover:text-[#1D4ED8]" 
        />
      </button>

      <button
        type="button"
        disabled={isEditDisabled}
        className={`p-2 rounded-lg border border-[#E5E7EB] bg-white ${
          isEditDisabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[#F9FAFB] cursor-pointer"
        }`}
        onClick={() => {
          if (isEditDisabled) return;
          onEdit(row);
        }}
        title={
          isEditDisabled
            ? REVOPS_PAY_STUB_ACTION_TITLES.EDIT_DISABLED_PAID
            : REVOPS_PAY_STUB_ACTION_TITLES.EDIT
        }
      >
        <Pencil 
          size={16} 
          className="text-[#6B7280] group-hover:text-[#059669]" 
        />
      </button>
      {row.status !== REVOPS_PAY_STUB_STATUS_BACKEND.PAID && (
        <button
          type="button"
          className="p-2 rounded-lg border border-[#E5E7EB] bg-red-100 hover:bg-red-200 hover:border-red-300 cursor-pointer"
          onClick={() => {onDelete(row)}}
          title="delete pay stub"
        >
          <Trash2
            size={16}
            className="text-red-700"
          />
        </button>
      )}


      <button
        type="button"
        className="p-2 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] hover:border-[#D1D5DB] cursor-pointer"
        onClick={handleDownload}
        title="Download pay stub"
      >
        <Download 
          size={16} 
          className="text-[#6B7280] group-hover:text-[#1D4ED8]" 
        />
      </button>

      {!isPaid ? (
        <Button
          name="Pay"
          type="button"
          buttonClick={() => onPay(transformPayoutRowToPayStub(row))}
          icon={<DollarSign size={16} color="white" />}
          classname="bg-secondarymirage"
          titleClass="!text-[12px]"
          iconStart={true}
        />
      ) : (
        <div className="text-[11px] text-[#6B7280]">
          {paidDate
            ? `${REVOPS_PAY_STUB_STATUS_UI.PAID} ${formatShortDate(paidDate)}`
            : REVOPS_PAY_STUB_STATUS_UI.PAID}
        </div>
      )}
    </div>
  );
}
