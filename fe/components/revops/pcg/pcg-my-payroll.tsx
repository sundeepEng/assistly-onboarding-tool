"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, ReceiptText, DollarSign, Clock, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../commonComponents/card";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import Loader from "../../../commonComponents/loader";
import useGetAll from "../../../services/getAll";
import { payStubPath } from "../../../utils/constants";
import { getUserIdFromToken } from "../../../utils/auth";
import { formatCurrency, formatShortDate } from "../payroll/payroll-utils";
import {
  formatIsoToDate,
  formatToShortDateRangeForPayStub,
} from "../../../utils/dateUtils";
import ViewPayStubModal from "../payroll/modals/view-pay-stub-modal";
import { downloadPayStubPdf } from "../payroll/pay-stub-pdf";

type PayrollMetric = {
  label: string;
  value: string;
  helper?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
};

type PaymentHistoryRow = {
  payPeriod: string;
  regularHours: number;
  overtime: string;
  grossPay: string;
  deductions: string;
  netPay: string;
  status: string;
};

type TaxInfoRow = {
  label: string;
  value: string;
};

function MetricCard({ metric }: { metric: PayrollMetric }) {
  return (
    <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-medium text-[#6B7280]">
            {metric.label}
          </CardTitle>
          <div className="text-[#9CA3AF]">{metric.icon}</div>
        </div>
      </CardHeader>
      <CardContent className="mt-2">
        <div
          className={`text-2xl font-bold text-[#111827] ${
            metric.valueClassName || ""
          }`}
        >
          {metric.value}
        </div>
        {metric.helper && (
          <div className="mt-1 text-[11px] text-[#6B7280]">{metric.helper}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PCGMyPayroll() {
  const [viewingStub, setViewingStub] = useState<any | null>(null);

  /**
   * Logged-in caregiver id (stored in cookies in this codebase).
   * We pass this as a query param so the backend returns only this caregiver's payouts.
   */
  const pcgUserId = getUserIdFromToken() ?? "";

  /**
   * Fetch pay stubs for the logged-in caregiver.
   * This mirrors the PCHO pay stubs tab API usage, but with an extra filter param.
   */
  const {
    data: allPayStubs,
    isLoading: isLoadingPayStubs,
    error: errorPayStubs,
  } = useGetAll({
    key: "pay-stubs",
    params: pcgUserId ? { pcg_user_id: pcgUserId } : {},
    path: payStubPath,
  });

  const payoutsData = allPayStubs?.payouts || [];

  const _metrics: PayrollMetric[] = [
    { label: "YTD Gross", value: "$5,460", icon: <DollarSign size={16} /> },
    {
      label: "YTD Net",
      value: "$4,368",
      icon: <ReceiptText size={16} />,
      valueClassName: "text-green-600",
    },
    { label: "YTD Hours", value: "156", icon: <Clock size={16} /> },
    { label: "Hourly Rate", value: "$35.00", icon: <TrendingUp size={16} /> },
  ];

  const _paymentHistory: PaymentHistoryRow[] = [];

  const _taxInfo: TaxInfoRow[] = [
    { label: "Federal Tax YTD", value: "$655.20" },
    { label: "State Tax YTD", value: "$218.40" },
    { label: "FICA YTD", value: "$218.40" },
  ];

  const downloadPayStub = useCallback(async (row: any) => {
    await downloadPayStubPdf(row);
  }, []);

  /**
   * Columns are kept intentionally similar to the PCHO pay stubs table for consistency,
   * but without Pay/Edit actions.
   */
  const columns = useMemo(
    () => [
      {
        header: "Period Type",
        field: "period_type" as const,
        minWidth: "120px",
        headerClassName: "font-medium",
        render: (value: string) => (
          <div className="inline-flex items-center rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-[3px] text-[13px] text-[#111827]">
            {value === "BIWEEKLY" ? "Bi-Weekly" : "Monthly"}
          </div>
        ),
      },
      {
        header: "Date Range",
        field: "period_start_date" as const,
        minWidth: "180px",
        headerClassName: "font-medium",
        render: (_value: string, row: any) =>
          formatToShortDateRangeForPayStub(row?.period_start_date, row?.period_end_date),
      },
      {
        header: "Hours",
        field: "hours_worked_minutes" as const,
        minWidth: "90px",
        headerClassName: "font-medium justify-end",
        render: (value: number) => {
          const hours = ((value || 0) / 60).toFixed(2);
          return <div className="w-full text-right">{hours}h</div>;
        },
      },
      {
        header: "Amount & ",
        field: "total_amount_cents" as const,
        minWidth: "130px",
        headerClassName: "font-medium justify-end",
        render: (value: number) => (
          <div className="w-full text-right font-semibold text-[#111827]">
            {formatCurrency((value || 0) / 100)}
          </div>
        ),
      },
      {
        header: "Status",
        field: "status" as const,
        minWidth: "100px",
        headerClassName: "font-medium",
        render: (value: string) => {
          const displayStatus = value === "PAID" ? "Paid" : "Due";
          const cls =
            displayStatus === "Paid"
              ? "bg-[#E8F1FF] text-[#1D4ED8]"
              : "bg-[#FEE2E2] text-[#B91C1C]";

          return (
            <div className="w-full flex">
              <div
                className={`inline-flex items-center px-2 py-[4px] rounded-[6px] text-[10px] font-semibold ${cls}`}
              >
                {displayStatus}
              </div>
            </div>
          );
        },
      },
      {
        header: "Actions",
        field: "id" as const,
        minWidth: "120px",
        headerClassName: "font-medium",
        render: (_value: string, row: any) => (
          <div className="w-full flex items-center gap-2">
            <button
              type="button"
              className="p-1"
              onClick={() => setViewingStub(row)}
              title="View pay stub"
            >
              <Eye size={16} className="text-[#111827]" />
            </button>

            <button
              type="button"
              className="p-1"
              onClick={() => downloadPayStub(row)}
              title="Download pay stub"
            >
              <Download size={16} className="text-[#111827]" />
            </button>

            {row?.status === "PAID" && row?.updated_at && (
              <div className="text-[11px] text-[#6B7280]">
                Paid {formatShortDate(formatIsoToDate(row.updated_at))}
              </div>
            )}
          </div>
        ),
      },
    ],
    [downloadPayStub],
  );

  return (
    <div className="px-[10px]">
      <div className="flex flex-col gap-1">
        <div className="text-heading font-bold font-jakarta">My Payment</div>
        <div className="text-xs text-gray">
          View your earnings and download pay stubs
        </div>
      </div>

     {/* Dont Remove this i need in future */}
      {/* <div className="mt-4 grid grid-cols-4 gap-3 mq900:grid-cols-2 mq761:grid-cols-1">
        {metrics.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div> */}

      <div className="mt-4">
        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-[#111827] flex items-center gap-2">
                  <ReceiptText size={16} />
                  Payment History
                </div>
                <div className="text-xs text-[#6B7280]">
                  Your past pay periods and earnings
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-3">
            {isLoadingPayStubs ? (
              <div className="py-8 flex items-center justify-center">
                <Loader fullScreen={false} spinner={true} />
              </div>
            ) : errorPayStubs ? (
              <div className="py-8 flex items-center justify-center">
                <div className="text-sm text-red-600">Failed to load pay stubs.</div>
              </div>
            ) : (
              <BaseTable
                columns={columns}
                data={payoutsData}
                headerStyles="pt-[5px]"
                rowStyles={() => "text-base p-2"}
                tableContainerClass="bg-white"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ViewPayStubModal payStub={viewingStub} onClose={() => setViewingStub(null)} />

     {/* Dont Remove this i need in future */}
      {/* <div className="mt-4">
        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB]">
          <CardHeader>
            <div>
              <div className="text-sm font-semibold text-[#111827]">Tax Information</div>
              <div className="text-xs text-[#6B7280]">Your withholding summary</div>
            </div>
          </CardHeader>
          <CardContent className="mt-3">
            <div className="grid grid-cols-3 gap-3 mq900:grid-cols-1">
              {taxInfo.map((t) => (
                <div
                  key={t.label}
                  className="rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-4"
                >
                  <div className="text-[11px] text-[#6B7280]">{t.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[#111827]">
                    {t.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          </Card>
      </div> */}
    </div>
  );
}
