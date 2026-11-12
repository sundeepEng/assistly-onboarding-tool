import { useMemo } from "react";
import { useRouter } from "next/router";
import { startOfWeek, endOfWeek } from "date-fns";
import { CalendarDays, Users, Clock, ReceiptText, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../commonComponents/card";
import Button from "../../../commonComponents/button";
import useGetAll from "../../../services/getAll";
import { payStubPath } from "../../../utils/constants";
import { getUserIdFromToken } from "../../../utils/auth";
import { formatToShortDateRangeForPayStub } from "../../../utils/dateUtils";
import { formatCurrency } from "../payroll/payroll-utils";

type PayrollItem = {
  payPeriod: string;
  amount: string;
  status: string;
};

export default function PCGPortalDashboard() {
  const router = useRouter();

  const pcgUserId = getUserIdFromToken() ?? "";

  const today = new Date();
  const weekBounds = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    return { start, end };
  }, [today]);

  const {
    data: allPayStubs,
    isLoading: isLoadingPayStubs,
    error: errorPayStubs,
  } = useGetAll({
    key: "pay-stubs",
    params: pcgUserId ? { pcg_user_id: pcgUserId } : {},
    path: payStubPath,
  });

  const pcgName = allPayStubs?.payouts?.[0]?.pcg_user_name || " ";

  const recentPayroll = useMemo(
    () => buildRecentPayrollItems({ allPayStubs }),
    [allPayStubs],
  );

  const metrics = useMemo(
    () => buildDashboardMetrics({ allPayStubs, weekBounds }),
    [allPayStubs, weekBounds],
  );

  return (
    <div className="px-[10px]">
      <div className="flex flex-col gap-1">
        <div className="text-heading font-bold font-jakarta">Welcome, {pcgName}</div>
        <div className="text-xs text-gray">Here’s your work overview</div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mq900:grid-cols-2 mq761:grid-cols-1">
        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xs font-medium text-[#6B7280]">Hours This Week</CardTitle>
              <div className="text-primary">
                <Clock size={18} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="text-2xl font-bold text-[#111827]">{metrics.hoursThisWeekValue}</div>
            <div className="mt-1 text-[11px] text-[#6B7280]">{metrics.hoursThisWeekHelper}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xs font-medium text-[#6B7280]">Current Pay Period</CardTitle>
              <div className="text-primary">
                <DollarSign size={18} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="text-2xl font-bold text-[#111827]">{metrics.currentPayPeriodValue}</div>
            <div className="mt-1 text-[11px] text-[#6B7280]">{metrics.currentPayPeriodHelper}</div>
          </CardContent>
        </Card>

        {/* Dont Remove This */}
        {/* <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xs font-medium text-[#6B7280]">Assigned Residents</CardTitle>
              <div className="text-primary">
                <Users size={18} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="text-2xl font-bold text-[#111827]">4</div>
            <div className="mt-1 text-[11px] text-[#6B7280]">In your care</div>
          </CardContent>
        </Card> */}

        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xs font-medium text-[#6B7280]">YTD Earnings</CardTitle>
              <div className="text-primary">
                <DollarSign size={18} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="text-2xl font-bold text-[#111827]">{metrics.ytdEarningsValue}</div>
            <div className="mt-1 text-[11px] text-[#6B7280]">{metrics.ytdEarningsHelper}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <Card className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                  <ReceiptText size={16} className="text-primary" />
                  Recent Payment
                </div>
                <div className="text-xs text-[#6B7280]">Your payment history</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="!mt-[16px] flex-1 flex flex-col gap-3">
            {isLoadingPayStubs ? (
              <div className="text-xs text-[#6B7280]">Loading payroll...</div>
            ) : errorPayStubs ? (
              <div className="text-xs text-[#6B7280]">Failed to load payroll.</div>
            ) : recentPayroll.length === 0 ? (
              <div className="text-xs text-[#6B7280]">No payroll history yet.</div>
            ) : (
              recentPayroll.map((p) => (
                <div
                  key={p.payPeriod}
                  className="rounded-[10px] border border-solid border-[#E5E7EB] bg-white px-4 py-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#111827]">{p.payPeriod}</div>
                    <div className="mt-2 inline-flex px-2 py-[2px] rounded-[6px] bg-green-100 text-green-700 text-[10px] font-semibold">
                      {p.status}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-[#111827]">{p.amount}</div>
                </div>
              ))
            )}

            <div className="pt-1">
              <Button
                name="View All Payments"
                type="button"
                buttonClick={() => router.push("/revops/payments")}
                classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50 !h-[36px] !w-full"
                titleClass="!text-[#111827] !text-[12px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 mq900:grid-cols-2 mq761:grid-cols-1">
        <Card
          className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => router.push("/hcm")}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-secondarylightgrayishblue flex items-center justify-center text-primary">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#111827]">Log Hours</div>
              <div className="text-xs text-[#6B7280]">Submit timesheet</div>
            </div>
          </div>
        </Card>

        <Card
          className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => router.push("/revops/payments")}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-secondarylightgrayishblue flex items-center justify-center text-primary">
              <ReceiptText size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#111827]">View Payment</div>
              <div className="text-xs text-[#6B7280]">Earnings history</div>
            </div>
          </div>
        </Card>

        <Card
          className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => router.push("/hcm/scheduling")}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-secondarylightgrayishblue flex items-center justify-center text-primary">
              <CalendarDays size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#111827]">My Schedule</div>
              <div className="text-xs text-[#6B7280]">View shifts</div>
            </div>
          </div>
        </Card>

        <Card
          className="rounded-[10px] p-[16px] bg-[white] border border-[#E5E7EB] h-full cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => router.push("/clinical")}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-secondarylightgrayishblue flex items-center justify-center text-primary">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#111827]">My Residents</div>
              <div className="text-xs text-[#6B7280]">Care assignments</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildRecentPayrollItems({ allPayStubs }: { allPayStubs: any }): PayrollItem[] {
  const payouts = (allPayStubs?.payouts || []) as any[];
  if (!Array.isArray(payouts) || payouts.length === 0) return [];

  const sorted = [...payouts].sort((a, b) => {
    const at = new Date(a?.period_end_date || 0).getTime();
    const bt = new Date(b?.period_end_date || 0).getTime();
    return bt - at;
  });

  return sorted.slice(0, 2).map((p) => {
    const payPeriod = formatToShortDateRangeForPayStub(
      p?.period_start_date,
      p?.period_end_date,
    );

    const amount = formatCurrency((Number(p?.total_amount_cents) || 0) / 100);
    const status = p?.status === "PAID" ? "Paid" : "Due";
    return { payPeriod, amount, status };
  });
}

function buildDashboardMetrics({
  allPayStubs,
  weekBounds,
}: {
  allPayStubs: any;
  weekBounds: { start: Date; end: Date };
}): {
  hoursThisWeekValue: string;
  hoursThisWeekHelper: string;
  currentPayPeriodValue: string;
  currentPayPeriodHelper: string;
  ytdEarningsValue: string;
  ytdEarningsHelper: string;
} {
  const payouts = (allPayStubs?.payouts || []) as any[];

  const weekMinutes = Array.isArray(payouts)
    ? payouts.reduce((acc, p) => {
        const start = p?.period_start_date ? new Date(p.period_start_date) : null;
        const end = p?.period_end_date ? new Date(p.period_end_date) : null;
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return acc;
        }

        const overlaps = end >= weekBounds.start && start <= weekBounds.end;
        if (!overlaps) return acc;

        return acc + (Number(p?.hours_worked_minutes) || 0);
      }, 0)
    : 0;

  const weekHours = weekMinutes / 60;
  const hoursThisWeekValue = weekMinutes ? weekHours.toFixed(1) : "--";
  const hoursThisWeekHelper = weekMinutes ? "" : "";

  const latestPayout = Array.isArray(payouts)
    ? payouts
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(b?.period_end_date || 0).getTime() -
            new Date(a?.period_end_date || 0).getTime(),
        )[0]
    : null;

  const currentPayPeriodValue = latestPayout
    ? formatCurrency((Number(latestPayout?.total_amount_cents) || 0) / 100)
    : "--";
  const currentPayPeriodHelper = "Estimated earnings";

  const nowYear = new Date().getFullYear();
  const ytd = Array.isArray(payouts)
    ? payouts.filter((p) => {
        const d = p?.period_end_date ? new Date(p.period_end_date) : null;
        return d && !Number.isNaN(d.getTime()) && d.getFullYear() === nowYear;
      })
    : [];

  const ytdTotal = ytd.reduce((acc, p) => acc + (Number(p?.total_amount_cents) || 0), 0) / 100;
  const ytdEarningsValue = ytd.length ? formatCurrency(ytdTotal) : "--";
  const ytdEarningsHelper = ytd.length ? `${ytd.length} pay periods` : "";

  return {
    hoursThisWeekValue,
    hoursThisWeekHelper,
    currentPayPeriodValue,
    currentPayPeriodHelper,
    ytdEarningsValue,
    ytdEarningsHelper,
  };
}
