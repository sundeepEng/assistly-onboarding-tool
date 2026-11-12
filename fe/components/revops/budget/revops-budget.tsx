import React, { useMemo, useState, useEffect } from "react";
import Toggle from "../../../commonComponents/toggle";
import Tabs from "../../../commonComponents/tabs";
import StatsCard from "../../../commonComponents/stats-card";
import SelectComponent from "../../../commonComponents/select-component";
import { DollarSign, Percent, TrendingDown, TrendingUp } from "lucide-react";
import Loader from "../../../commonComponents/loader";
import Threshold from "./threshold";
import BudgetAlerts from "./budget-alerts";
import Expenses from "./expenses";
import BudgetOverview from "./budget-overview";
import Income from "./income";
import {
  getDateRange,
  getLast6MonthsOptions,
  getQuarterlyOptions,
  getCurrentPeriod
} from "../../../utils/budget-utils";
import { getHomeIdFromToken } from "../../../utils/auth";
import useGetAll from "../../../services/getAll";
import { budgetPath, dashboardMetricsPath } from "../../../utils/constants";
import { formatCurrency } from "../charts/chart-utils";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import { formatDateRange } from "../../../utils/dateUtils";

export default function RevopsBudget() {
  const [periodType, setPeriodType] = useState(false); // false = monthly, true = quarterly
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [isMounted, setIsMounted] = useState(false);

  // Initialize with current month/quarter after mount
  useEffect(() => {
    setSelectedPeriod(getCurrentPeriod(false)); // Start with monthly
    setIsMounted(true);
  }, []);

  // Reset selected period when toggling between monthly/quarterly
  useEffect(() => {
    if (isMounted) {
      setSelectedPeriod(getCurrentPeriod(periodType));
    }
  }, [periodType, isMounted]);

  const monthlyOptions = useMemo(() => getLast6MonthsOptions(), []);
  const quarterlyOptions = useMemo(() => getQuarterlyOptions(), []);
  const periodOptions = periodType ? quarterlyOptions : monthlyOptions;

  // Get date range for current selection
  const dateRange = useMemo(() => getDateRange(periodType, selectedPeriod), [periodType, selectedPeriod]);

  const homeId = getHomeIdFromToken();
  const { data: dashboardMetricsData, isLoading: isMetricsLoading } = useGetAll({
    key: "dashboard-metrics",
    path: dashboardMetricsPath,
    params: {
      home_id: homeId,
      start_date: dateRange?.startDate || "",
      end_date: dateRange?.endDate || ""
    },
  })

  const formattedDateRange = React.useMemo(() => {
    const result = formatDateRange(dateRange?.startDate, dateRange?.endDate);
    return result;
  }, [dateRange]);

  const { data: expensesData } = useGetAllShifts({
    key: "budget",
    params: {
      home_id: homeId,
      transaction_date: formattedDateRange,
      transaction_type: "expense",
      start_date: dateRange?.startDate,
      end_date: dateRange?.endDate,
    },
    path: budgetPath,
  });

  const payrollAmount = expensesData?.expense_payroll / 100;

  // Safe value extraction to prevent NaN
  const safeTotalIncome = dashboardMetricsData?.total_income ? dashboardMetricsData.total_income / 100 : 0;
  const safeTotalExpenses = dashboardMetricsData?.total_expense ? dashboardMetricsData.total_expense / 100 : 0;
  const safeNetBalance = dashboardMetricsData?.net_balance ? dashboardMetricsData.net_balance / 100 : 0;
  const safeUtilization = dashboardMetricsData?.utilization || 0;

  return (
    <div className="px-[10px]">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <div className="text-[32px] font-bold font-jakarta">
            Budget Management
          </div>
          <div className="text-[18px] ">
            Track income, expenses, and budget utilization for your care home
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Toggle
            toggelState={periodType}
            setToggleState={setPeriodType}
            state1="Monthly"
            state2="Quarterly"
            className="rounded-lg"
          />
          <SelectComponent
            name="period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={periodOptions}
            placeholder={`Select ${periodType ? "Quarter" : "Month"}`}
            className="!w-[250px]"
          />
        </div>
        {selectedPeriod && (
          <div className="font-poppins font-medium text-[18px]">
            Viewing: <span className="font-medium">{periodOptions.find(opt => opt.value === selectedPeriod)?.option || selectedPeriod}</span>
          </div>
        )}
      </div>

      {isMetricsLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader fullScreen={false} message="" size={30} />
        </div>
      ) : (<>
        {/* Stats Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Income"
            value={formatCurrency(safeTotalIncome)}
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <StatsCard
            title="Total Expenses"
            value={formatCurrency(safeTotalExpenses)}
            icon={<TrendingDown className="h-5 w-5" />}
            iconColor="text-red-600"
            iconBgColor="bg-red-100"
          />
          <StatsCard
            title="Net Balance"
            value={formatCurrency(safeNetBalance)}
            icon={<DollarSign className="h-5 w-5" />}
            iconColor={safeNetBalance >= 0 ? "text-green-600" : "text-red-600"}
            iconBgColor={safeNetBalance >= 0 ? "bg-green-100" : "bg-red-100"}
          />
          <StatsCard
            title="Budget Utilization"
            value={`${Math.round(safeUtilization * 100) / 100}%`}
            icon={<Percent className="h-5 w-5" />}
            iconColor={safeUtilization > 100 ? "text-red-600" : "text-blue-600"}
            iconBgColor={safeUtilization > 100 ? "bg-red-100" : "bg-blue-100"}
          />
        </div>

        {/* Tabs Section */}
        <div className="mt-6">
          <Tabs
            key={selectedPeriod}
            tabs={[
              {
                label: "Overview",
                content: (
                  <BudgetOverview dateRange={dateRange} periodType={periodType ? 'quarterly' : 'monthly'} dashboardMetricsData={dashboardMetricsData} payrollAmount={payrollAmount} />
                ),
              },
              {
                label: "Income",
                content: (
                  <Income
                    dateRange={dateRange}
                    periodType={periodType ? 'quarterly' : 'monthly'}
                  />
                ),
              },
              {
                label: "Expenses",
                content: (
                  <Expenses
                    dateRange={dateRange}
                    periodType={periodType ? 'quarterly' : 'monthly'}
                    expensesData={expensesData}
                    payrollAmount={payrollAmount}
                  />
                ),
              },
              {
                label: "Thresholds",
                content: (
                  <Threshold dateRange={dateRange} periodType={periodType ? 'quarterly' : 'monthly'} />
                ),
              },
              {
                label: "Alerts",
                content: (
                  <BudgetAlerts dateRange={dateRange} periodType={periodType ? 'quarterly' : 'monthly'} dashboardMetricsData={dashboardMetricsData} />
                ),
              },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            containerClassName="rounded-lg"
            contentClassName="min-h-[400px]"
          />
        </div>
      </>)}
    </div >
  );
}




