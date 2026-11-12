import { DollarSign, ReceiptText, WalletMinimal, HandCoins } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../commonComponents/card";
import BaseTable from "../../../commonComponents/base-table";
import CashFlowChart from "../charts/cash-flow-chart";
import BudgetBurndownChart from "../charts/budget-burndown-chart";
import {
  revopsDashboardMock,
  type RecentActivityItem,
} from "../../../utils/revops/mock-data";

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function MetricIcon({ label }: { label: string }) {
  if (label === "Total Revenue") return <DollarSign size={18} />;
  if (label === "Net Income") return <WalletMinimal size={18} />;
  if (label === "Outstanding Receivables") return <ReceiptText size={18} />;
  return <HandCoins size={18} />;
}

export default function RevopsDashboard() {
  const { metrics, cashFlow, budget, recentActivity } = revopsDashboardMock;

  const recentActivityColumns = [
    {
      header: "Activity",
      field: "title" as const,
      minWidth: "260px",
      render: (_: unknown, row: RecentActivityItem) => (
        <div>
          <div className="text-sm font-medium text-[#111827]">{row.title}</div>
          {row.subtitle && <div className="text-xs text-[#6B7280]">{row.subtitle}</div>}
        </div>
      ),
    },
    {
      header: "Amount",
      field: "amount" as const,
      minWidth: "140px",
      headerClassName: "justify-end",
      render: (value: RecentActivityItem["amount"]) => {
        if (typeof value !== "number") return <div className="w-full text-right">-</div>;
        return (
          <div
            className={`w-full text-right text-sm font-semibold ${
              value >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {value >= 0 ? "+" : ""}
            {formatCurrency(value)}
          </div>
        );
      },
    },
    {
      header: "Date",
      field: "date" as const,
      minWidth: "120px",
      headerClassName: "justify-end",
      render: (value: RecentActivityItem["date"]) => (
        <div className="w-full text-right text-xs text-[#6B7280]">{String(value)}</div>
      ),
    },
  ];

  return (
    <div className="px-[10px]">
      <div className="text-heading font-bold font-jakarta">Financial Dashboard</div>
      <div className="text-xs text-gray">Overview of your care home’s financial health</div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-[10px] p-[16px] bg-[white]">
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="text-sm font-medium text-[#111827]">
                  {m.label}
                </CardTitle>
                <div className="h-[28px] w-[28px] rounded-md bg-primary bg-opacity-10 text-primary flex items-center justify-center">
                  <MetricIcon label={m.label} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-3">
              <div className="text-2xl font-bold text-[#111827]">
                {m.unit === "currency" ? formatCurrency(m.value) : m.value}
              </div>
              <div className="mt-1 text-xs">
                {typeof m.changePct === "number" ? (
                  <span
                    className={`font-medium ${
                      m.changePct >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {m.changePct >= 0 ? "+" : ""}
                    {m.changePct}% {m.changeLabel}
                  </span>
                ) : (
                  <span className="text-[#6B7280] font-medium">{m.changeLabel}</span>
                )}
              </div>
              {m.helperText && (
                <div className="mt-1 text-xs text-[#6B7280]">{m.helperText}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 mq900:grid-cols-2 gap-3">
        <Card className="rounded-[10px] p-[16px] bg-[white]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Cash Flow Analysis
            </CardTitle>
            <div className="text-xs text-[#6B7280]">Income vs. expenses over time</div>
          </CardHeader>
          <CardContent className="mt-2">
            <CashFlowChart data={cashFlow} />
          </CardContent>
        </Card>

        <Card className="rounded-[10px] p-[16px] bg-[white]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Budget Burn-Down
            </CardTitle>
            <div className="text-xs text-[#6B7280]">
              Track spending against planned budget
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <BudgetBurndownChart data={budget} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card className="rounded-[10px] p-[16px] bg-[white]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Recent Activity
            </CardTitle>
            <div className="text-xs text-[#6B7280]">Latest financial transactions</div>
          </CardHeader>
          <CardContent className="mt-3">
            <BaseTable
              columns={recentActivityColumns}
              data={recentActivity}
              headerStyles="rounded-md"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
