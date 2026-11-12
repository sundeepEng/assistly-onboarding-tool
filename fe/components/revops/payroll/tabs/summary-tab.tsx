"use client";

import { useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../commonComponents/card";
import { Progress } from "../../../../commonComponents/progress";
import { Clock, Users } from "lucide-react";
import type {
  RevopsPayrollPeriod,
  RevopsPayrollStaffMember,
  RevopsPayrollSummary,
} from "../../../../utils/revops/mock-data";
import { formatCurrency } from "../payroll-utils";
import { REVOPS_PAYROLL_PERIOD_STATUS_UI } from "../../../../utils/revops/constants";

function getStatusColor(status: RevopsPayrollPeriod["status"]) {
  if (status === REVOPS_PAYROLL_PERIOD_STATUS_UI.PAID) return "bg-green-500";
  if (status === REVOPS_PAYROLL_PERIOD_STATUS_UI.PROCESSED) return "bg-blue-500";
  return "bg-orange-500";
}

function SummaryMetricCard({
  label,
  value,
  helper,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="border-[1px] border-solid border-[#E5E7EB] rounded-[10px] p-[16px] bg-[white]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-xs font-medium text-[#6B7280]">
            {label}
          </CardTitle>
          <div className="text-[#9CA3AF]">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="mt-2">
        <div className={`text-2xl font-bold text-[#111827] ${valueClassName || ""}`}>
          {value}
        </div>
        <div className="mt-1 text-[11px] text-[#6B7280]">{helper}</div>
      </CardContent>
    </Card>
  );
}

export default function RevopsPayrollSummaryTab({
  periods,
  staff,
  summary,
}: {
  periods: RevopsPayrollPeriod[];
  staff: RevopsPayrollStaffMember[];
  summary: RevopsPayrollSummary;
}) {
  const distribution = useMemo(() => {
    const map = new Map<RevopsPayrollPeriod["status"], number>();
    periods.forEach((p) => {
      map.set(p.status, (map.get(p.status) || 0) + p.amount);
    });

    const items = (Array.from(map.entries()) as [
      RevopsPayrollPeriod["status"],
      number,
    ][]).map(([status, amount]) => ({ status, amount }));

    const max = items.reduce((acc, i) => Math.max(acc, i.amount), 0);
    return {
      items,
      max,
    };
  }, [periods]);

  const summaryHelpers = useMemo(() => {
    const totalPeriods = periods.length;
    return {
      totalPeriods,
    };
  }, [periods, staff]);

  return (
    <div className="p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        <SummaryMetricCard
          label="YTD Paid"
          value={formatCurrency(summary.ytdPaid)}
          helper={`${summaryHelpers.totalPeriods} pay periods`}
          icon={<div className="text-[#9CA3AF]">$</div>}
        />
        <SummaryMetricCard
          label="YTD Due"
          value={formatCurrency(summary.ytdDue)}
          helper="Outstanding pay stubs"
          icon={<Users size={18} />}
          valueClassName="text-orange-600"
        />
        <SummaryMetricCard
          label="Avg Hours"
          value={`${summary.avgHours}h`}
          helper="Across paid stubs"
          icon={<Clock size={18} />}
        />
        <SummaryMetricCard
          label="Caregivers Paid"
          value={`${summary.caregiversPaid}/${summary.caregiversTotal}`}
          helper="Year-to-date"
          icon={<Users size={18} />}
        />
      </div>

      <div className="mt-3">
        <Card className="rounded-[10px] p-[16px] bg-[white]">
          <div className="text-sm font-semibold text-[#111827]">
            Payroll Distribution
          </div>
          <div className="text-xs text-[#6B7280]">Breakdown by status</div>

          <div className="mt-3 flex flex-col gap-3">
            {distribution.items.map((d) => {
              const pct = distribution.max ? (d.amount / distribution.max) * 100 : 0;
              return (
                <div key={d.status} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-[120px]">
                    <div
                      className={`h-[8px] w-[8px] rounded-full ${getStatusColor(
                        d.status,
                      )}`}
                    />
                    <div className="text-xs text-[#111827]">{d.status}</div>
                  </div>
                  <div className="flex-1">
                    <Progress value={pct} className="h-[6px]" />
                  </div>
                  <div className="w-[80px] text-right text-xs text-[#111827]">
                    {formatCurrency(d.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-3">
        <Card className="rounded-[10px] p-[16px] bg-[white]">
          <div className="text-sm font-semibold text-[#111827]">Staff by Role</div>
          <div className="text-xs text-[#6B7280]">
            Payroll cost breakdown by position
          </div>

          <div className="mt-3 rounded-[10px] border border-[#E5E7EB] overflow-hidden">
            {staff.map((s, idx) => (
              <div
                key={s.employeeId}
                className={`flex items-center justify-between px-4 py-3 bg-white ${
                  idx !== staff.length - 1 ? "border-b border-[#E5E7EB]" : ""
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-[#111827]">
                    {s.name}
                  </div>
                  <div className="text-[11px] text-[#6B7280]">{s.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[#111827]">
                    {formatCurrency(s.hourlyRate)}/hr
                  </div>
                  <div className="text-[11px] text-[#6B7280]">{s.employeeId}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
