import { z } from 'zod';
import { BudgetDashboardMetricsSchema } from '../../../models/Payments/budget.model';
import { FormatResponse } from '../../../utils/response-formatter';
import { BudgetDAL } from '../../../dal/budget.dal';

const budgetDAL: BudgetDAL = new BudgetDAL();

export const getBudgetDashboardMetricsHandler = async (
  queryParams: z.infer<typeof BudgetDashboardMetricsSchema>
) => {
  if (!queryParams) {
    return FormatResponse(404, {
      message: 'Failed to fetch budget dashboard metrics',
      error: 'No query params provided',
    });
  }

  try {
    const validated = BudgetDashboardMetricsSchema.parse(queryParams);

    const aggregates = await budgetDAL.getBudgetDashboardAggregates({
      home_id: validated.home_id,
      start_date: validated.start_date,
      end_date: validated.end_date,
    });

    const invoiceByCategory = await budgetDAL.getPaidInvoiceItemSumsByCategory({
      home_id: validated.home_id,
      start_date: validated.start_date,
      end_date: validated.end_date,
    });

    const budgetIncomeByCategory = await budgetDAL.getBudgetSumsByTransactionTypeAndCategory({
      home_id: validated.home_id,
      start_date: validated.start_date,
      end_date: validated.end_date,
      transaction_type: 'income',
    });

    const budgetExpenseByCategory = await budgetDAL.getBudgetSumsByTransactionTypeAndCategory({
      home_id: validated.home_id,
      start_date: validated.start_date,
      end_date: validated.end_date,
      transaction_type: 'expense',
    });

    const incomeInvoice = aggregates.invoice_income_cents;
    const incomeBudget = aggregates.budget_income_cents;
    const expensePayroll = aggregates.payroll_expense_cents;
    const expenseBudget = aggregates.budget_expense_cents;

    const totalIncome = incomeInvoice + incomeBudget;
    const totalExpense = expensePayroll + expenseBudget;
    const netBalance = totalIncome - totalExpense;

    const utilization =
      totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100 * 100) / 100 : 0;

    const invoiceIncomeByCategoryMetrics = Object.fromEntries(
      Object.entries(invoiceByCategory).map(([k, v]) => [
        `invoice_income_${String(k).toLowerCase()}`,
        v,
      ])
    );

    const budgetIncomeByCategoryMetrics = Object.fromEntries(
      Object.entries(budgetIncomeByCategory).map(([k, v]) => [
        `budget_income_${String(k).toLowerCase()}`,
        v,
      ])
    );

    const budgetExpenseByCategoryMetrics = Object.fromEntries(
      Object.entries(budgetExpenseByCategory).map(([k, v]) => [
        `budget_expense_${String(k).toLowerCase()}`,
        v,
      ])
    );

    return FormatResponse(200, {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_balance: netBalance,
      utilization,
      invoice_income: incomeInvoice,
      payroll_expense: expensePayroll,
      budget_income: incomeBudget,
      budget_expense: expenseBudget,
      ...invoiceIncomeByCategoryMetrics,
      ...budgetIncomeByCategoryMetrics,
      ...budgetExpenseByCategoryMetrics,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request query validation failed',
        error: error.errors,
      });
    }

    console.error(`{api: '/budget/dashboard/metrics', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to fetch budget dashboard metrics',
      error: error as Error,
    });
  }
};
