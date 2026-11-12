import { BudgetDAL } from '../../../dal/budget.dal';
import { FormatResponse } from '../../../utils/response-formatter';

const budgetDAL: BudgetDAL = new BudgetDAL();

export const getAllBudgetsHandler = async (queryParams?: any) => {
  try {
    const budgets =
      queryParams && Object.keys(queryParams).length > 0
        ? await budgetDAL.getAllBudgets(queryParams)
        : await budgetDAL.getAllBudgets();

    const homeId = queryParams?.home_id;
    const startDate = queryParams?.start_date;
    const endDate = queryParams?.end_date;

    const hasMetricsFilters =
      typeof homeId === 'string' && typeof startDate === 'string' && typeof endDate === 'string';

    const incomeInvoice = hasMetricsFilters
      ? await budgetDAL.getPaidInvoiceIncomeCents({
          home_id: homeId,
          start_date: startDate,
          end_date: endDate,
        })
      : 0;

    const expensePayroll = hasMetricsFilters
      ? await budgetDAL.getPaidPayrollExpenseCents({
          home_id: homeId,
          start_date: startDate,
          end_date: endDate,
        })
      : 0;

    return FormatResponse(200, {
      message: 'Fetched budgets successfully',
      budgets,
      income_invoice: incomeInvoice,
      expense_payroll: expensePayroll,
    });
  } catch (error) {
    console.error(`{api: '/get-all-budgets', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to fetch budgets',
      error: error as Error,
    });
  }
};
