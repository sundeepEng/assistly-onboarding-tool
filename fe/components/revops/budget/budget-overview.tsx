import PieChart from "../../../commonComponents/pie-chart";
import BarChart from "../../../commonComponents/bar-chart";
import BudgetCategoryCard from "../../../commonComponents/budget-category-card";
import { homePath, HOME_PATH_OMIT_FIELDS, PAYROLL } from "../../../utils/constants";
import { omit } from "../../../utils/dateUtils";
import { getHomeIdFromToken } from "../../../utils/auth";
import useGetById from "../../../services/getById";
import { getCategoryColor, getMonthYear, snakeToCamel, MONTH_ABBR, formatCategoryName, ALL_INCOME_CATEGORY_KEYS, ALL_EXPENSE_CATEGORY_KEYS } from "../../../utils/budget-utils";
import useUpsert from "../../../services/upsert";
import { useQueryClient } from "@tanstack/react-query";
import { handleOpenPopover, handleShowCloseOptions, handleShowPopoverMessage } from "../../../redux/slices/exception-popover-slice";
import { useDispatch } from "react-redux";


interface BudgetOverviewProps {
    dateRange?: { startDate: string; endDate: string };
    periodType?: 'monthly' | 'quarterly';
    dashboardMetricsData?: any;
    payrollAmount?: number;
}


export const BudgetOverview = ({ dateRange, periodType = 'monthly', dashboardMetricsData, payrollAmount }: BudgetOverviewProps) => {
    const homeId = getHomeIdFromToken();
    const queryClient = useQueryClient();
    const dispatch = useDispatch();
    const { mutate: upsertHome } = useUpsert();
    const { data: homeData } = useGetById({
        key: "home-data",
        payload: { id: homeId, path: homePath, enabled: !!homeId },
    });


    // Get budget forecasts from homeData for the current period
    const getBudgetForecasts = () => {
        const homeBudget = homeData?.home?.budget || homeData?.budget;
        if (!homeBudget || !dateRange?.startDate) return { income: {} as Record<string, number>, expense: {} as Record<string, number> };
        const year = dateRange.startDate.split('-')[0];
        const monthIndex = parseInt(dateRange.startDate.split('-')[1]) - 1;
        const month = MONTH_ABBR[monthIndex];
        const yearBudget = homeBudget[year];
        if (!yearBudget) return { income: {} as Record<string, number>, expense: {} as Record<string, number> };
        const monthBudget = yearBudget[month];
        if (!monthBudget) return { income: {} as Record<string, number>, expense: {} as Record<string, number> };
        return {
            income: (monthBudget.income || {}) as Record<string, number>,
            expense: (monthBudget.expense || {}) as Record<string, number>
        };
    };

    // Parse budget categories — show ALL known categories, not just those with API data
    const parseBudgetCategories = (data: any) => {
        const forecasts = getBudgetForecasts();
        const incomeCategories: any[] = [];
        const expenseCategories: any[] = [];

        // Build all income categories from known keys
        ALL_INCOME_CATEGORY_KEYS.forEach(categoryName => {
            const formattedName = formatCategoryName(categoryName);
            const camelKey = snakeToCamel(categoryName);
            const budgetKey = `budget_income_${categoryName}`;
            const invoiceKey = `invoice_income_${categoryName}`;
            const forecastedValue = forecasts.income[camelKey] || 0;
            const actualValue = data ? ((data[budgetKey] || 0) + (data[invoiceKey] || 0)) / 100 : 0;
            const utilization = forecastedValue > 0
                ? Math.round((actualValue / forecastedValue) * 100 * 10) / 10
                : 'NA';

            incomeCategories.push({
                title: formattedName,
                categoryType: 'income',
                primaryValue: forecastedValue,
                actualValue,
                utilization,
                budgetKey: camelKey,
            });
        });

        // Build all expense categories from known keys
        ALL_EXPENSE_CATEGORY_KEYS.forEach(categoryName => {
            const formattedName = formatCategoryName(categoryName);
            const camelKey = snakeToCamel(categoryName);
            const metricKey = `budget_expense_${categoryName}`;
            const forecastedValue = forecasts.expense[camelKey] || 0;
            const actualValue = categoryName === PAYROLL
                ? (payrollAmount || 0)
                : data ? (data[metricKey] || 0) / 100 : 0;
            const utilization = forecastedValue > 0
                ? Math.round((actualValue / forecastedValue) * 100 * 10) / 10
                : 'NA';

            expenseCategories.push({
                title: formattedName,
                categoryType: 'expense',
                primaryValue: forecastedValue,
                actualValue,
                utilization,
                containerClassName: 'bg-red-100',
                budgetKey: camelKey,
            });
        });

        return { incomeCategories, expenseCategories };
    };

    const { incomeCategories, expenseCategories } = parseBudgetCategories(dashboardMetricsData);

    // Create dynamic pie chart data — only include categories with actual values (0-value slices are meaningless in pie charts)
    const incomeData = incomeCategories
        .filter((category) => category.actualValue > 0)
        .map((category) => ({
            label: category.title,
            value: category.actualValue,
            color: getCategoryColor(category.title, 'income')
        }));

    const expenseData = expenseCategories
        .filter((category) => category.actualValue > 0)
        .map((category) => ({
            label: category.title,
            value: category.actualValue,
            color: getCategoryColor(category.title, 'expense')
        }));

    // Bar graph data — only include categories that have actual data or forecast/budget > 0
    const activeBargraphIncome = incomeCategories.filter(c => c.actualValue > 0 || c.primaryValue > 0);
    const hasAnyIncomeForecast = activeBargraphIncome.some(c => c.primaryValue > 0);
    const incomeDataBargraph = activeBargraphIncome.map((category) => hasAnyIncomeForecast
        ? {
            label: category.title,
            values: category.primaryValue > 0
                ? [category.actualValue, category.primaryValue]
                : [category.actualValue],
            colors: category.primaryValue > 0
                ? [getCategoryColor(category.title, 'income'), getCategoryColor(category.title, 'income') + '80']
                : [getCategoryColor(category.title, 'income')],
            legendLabels: ['Actual', 'Forecast'],
        }
        : {
            label: category.title,
            value: category.actualValue,
            color: getCategoryColor(category.title, 'income'),
        }
    );

    const activeBargraphExpense = expenseCategories.filter(c => c.actualValue > 0 || c.primaryValue > 0);
    const hasAnyExpenseForecast = activeBargraphExpense.some(c => c.primaryValue > 0);
    const expenseDataBargraph = activeBargraphExpense.map((category) => hasAnyExpenseForecast
        ? {
            label: category.title,
            values: category.primaryValue > 0
                ? [category.actualValue, category.primaryValue]
                : [category.actualValue],
            colors: category.primaryValue > 0
                ? [getCategoryColor(category.title, 'expense'), getCategoryColor(category.title, 'expense') + '80']
                : [getCategoryColor(category.title, 'expense')],
            legendLabels: ['Actual', 'Budgeted'],
        }
        : {
            label: category.title,
            value: category.actualValue,
            color: getCategoryColor(category.title, 'expense'),
        }
    );

    // Save forecasted amount to homeData budget
    const handleCategoryEdit = (categoryType: 'income' | 'expense', budgetKey: string) =>
        (updatedData: { title: string; primaryValue: number; actualValue: number }) => {
            if (!dateRange?.startDate || !homeId) return;
            const year = dateRange.startDate.split('-')[0];
            const monthIndex = parseInt(dateRange.startDate.split('-')[1]) - 1;
            const month = MONTH_ABBR[monthIndex];

            // Build updated budget structure
            const homeObj = homeData?.home || homeData || {};
            const existingBudget = homeObj?.budget || {};
            const yearBudget = existingBudget[year] || {};
            const monthBudget = yearBudget[month] || {};
            const typeBudget = monthBudget[categoryType] || {};

            const updatedBudget = {
                ...existingBudget,
                [year]: {
                    ...yearBudget,
                    [month]: {
                        ...monthBudget,
                        [categoryType]: {
                            ...typeBudget,
                            [budgetKey]: updatedData.primaryValue,
                        }
                    }
                }
            };

            const cleanedData = omit(
                { ...homeObj, homeId: homeId, budget: updatedBudget },
                HOME_PATH_OMIT_FIELDS
            );

            upsertHome(
                { data: cleanedData, path: homePath },
                {
                    onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ["home-data"] });
                    },
                    onError: (error: any) => {
                        dispatch(handleOpenPopover());
                        dispatch(handleShowCloseOptions());
                        dispatch(
                            handleShowPopoverMessage(
                                error?.response?.data?.message ||
                                "Error in updating budget"
                            )
                        );
                    },
                }
            );
        };

    return (
        <div className="p-6">
            {/* Header with Download PDF */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Budget Overview</h1>
                {/* <Button
                    name="Download PDF"
                    type="button"
                    icon={<DownloadIcon className="w-4 h-4 text-white" />}
                    buttonClick={() => { }}
                    classname="bg-secondarymirage"
                    titleClass="!text-[12px]"
                /> */}
            </div>

            {/* Piecharts */}
            <div className="flex justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Distribution</h2>
                    {incomeData.length > 0 ? (
                        <PieChart
                            data={incomeData}
                            width={600}
                            height={350}
                            showLabels={true}
                            showLegend={true}
                            legendPosition="bottom"
                            innerRadius={60}
                            tooltipFormat={(d) => `${d.label}: $${d.value.toLocaleString()}`}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-[350px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-400 text-sm">No income data available</p>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense Distribution</h2>
                    {expenseData.length > 0 ? (
                        <PieChart
                            data={expenseData}
                            width={600}
                            height={350}
                            showLabels={true}
                            showLegend={true}
                            legendPosition="bottom"
                            innerRadius={60}
                            tooltipFormat={(d) => `${d.label}: $${d.value.toLocaleString()}`}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-[350px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-400 text-sm">No expense data available</p>
                        </div>
                    )}
                </div>
            </div>

            <>
                {/* Bar Chart */}
                <div className="flex justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Income - Forecast vs Actual {periodType === 'monthly' ? `(${getMonthYear(dateRange?.startDate + 1)})` : ''}</h2>
                        {incomeDataBargraph.length > 0 ? (
                            <BarChart
                                data={incomeDataBargraph}
                                width={600}
                                height={350}
                                orientation="horizontal"
                                showGrid={false}
                                showValues={true}
                                tooltipFormat={(d) => `${d.label}: $${d.value?.toLocaleString() || 'N/A'}`}
                                xAxisLabel="Amount ($)"
                                animated={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-[350px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-400 text-sm">No income data available</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense - Budgeted vs Actual {periodType === 'monthly' ? `(${getMonthYear(dateRange?.startDate + 1)})` : ''}</h2>
                        {expenseDataBargraph.length > 0 ? (
                            <BarChart
                                data={expenseDataBargraph}
                                width={600}
                                height={350}
                                orientation="horizontal"
                                showGrid={false}
                                showValues={true}
                                tooltipFormat={(d) => `${d.label}: $${d.value?.toLocaleString() || 'N/A'}`}
                                xAxisLabel="Amount ($)"
                                animated={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-[350px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-400 text-sm">No expense data available</p>
                            </div>
                        )}
                    </div>
                </div>


                {/* Income and Expense Categories */}
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Categories</h2>
                        {incomeCategories.length > 0 ? (
                            incomeCategories.map((category, index) => (
                                <BudgetCategoryCard
                                    key={`income-${index}`}
                                    title={category.title}
                                    categoryType="income"
                                    primaryValue={category.primaryValue}
                                    actualValue={category.actualValue}
                                    utilization={category.utilization}
                                    className={index > 0 ? "mt-4" : ""}
                                    onEdit={periodType === 'monthly' ? handleCategoryEdit('income', category.budgetKey) : undefined}
                                />
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-[300px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-400 text-sm">No Income Categories available</p>
                            </div>)}
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 ">Expense Categories</h2>
                        {expenseCategories.length > 0 ? (
                            expenseCategories.map((category, index) => (
                                <BudgetCategoryCard
                                    key={`expense-${index}`}
                                    title={category.title}
                                    categoryType="expense"
                                    primaryValue={category.primaryValue}
                                    actualValue={category.actualValue}
                                    utilization={category.utilization}
                                    containerClassName="bg-red-100"
                                    className={index > 0 ? "mt-4" : ""}
                                    onEdit={periodType === 'monthly' ? handleCategoryEdit('expense', category.budgetKey) : undefined}
                                />
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-[300px] w-[600px] border border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-400 text-sm">No Expense Categories available</p>
                            </div>
                        )}
                    </div>
                </div>
            </>


        </div>
    );
};

export default BudgetOverview;