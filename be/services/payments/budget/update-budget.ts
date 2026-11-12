import { z } from 'zod';
import { UpdateBudgetSchema } from '../../../models/Payments/budget.model';
import { BudgetDAL } from '../../../dal/budget.dal';
import { FormatResponse } from '../../../utils/response-formatter';

const budgetDAL: BudgetDAL = new BudgetDAL();

export const updateBudgetHandler = async (
  id: any,
  updatedBudgetData: z.infer<typeof UpdateBudgetSchema>
) => {
  if (!id || !updatedBudgetData) {
    console.error(`{api: '/update-budget', error: No body provided}`);

    return FormatResponse(404, {
      message: 'Failed to update budget',
      error: 'id and body are required',
    });
  }

  id = Number(id);

  try {
    if (updatedBudgetData.id && Number(updatedBudgetData.id) !== id) {
      return FormatResponse(409, {
        message: 'Failed to update budget',
        error: 'Budget ID mismatch - id in the body does not match with the path parameter',
      });
    }

    const existingBudgetRows = await budgetDAL.getAllBudgets({ id } as any);
    const existing = existingBudgetRows?.[0];

    if (!existing) {
      return FormatResponse(404, {
        message: 'Failed to update budget',
        error: `Budget with id ${id} not found`,
      });
    }

    const updatedBudget = {
      ...existing,
      ...updatedBudgetData,
      id,
      updated_at: new Date().toISOString(),
    };

    const validated = UpdateBudgetSchema.parse(updatedBudget);

    const saved = await budgetDAL.updateBudgetById(id, validated);

    return FormatResponse(200, {
      message: 'Budget updated successfully',
      budget: saved ?? validated,
    });
  } catch (error) {
    console.error(`{api: '/update-budget', error: ${error}}`);

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to update budget',
      error: (error as Error).message,
    });
  }
};
