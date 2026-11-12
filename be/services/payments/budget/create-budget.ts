import { z } from 'zod';
import { CreateBudgetSchema } from '../../../models/Payments/budget.model';
import { FormatResponse } from '../../../utils/response-formatter';
import { BudgetDAL } from '../../../dal/budget.dal';
import { UsersDAL } from '../../../dal/users.dal';
import { HomeDAL } from '../../../dal/home.dal';

const budgetDAL: BudgetDAL = new BudgetDAL();
const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const createBudgetHandler = async (newBudgetData: z.infer<typeof CreateBudgetSchema>) => {
  if (!newBudgetData) {
    return FormatResponse(404, {
      message: 'Failed to create budget',
      error: 'No data provided',
    });
  }

  try {
    newBudgetData = {
      ...newBudgetData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    CreateBudgetSchema.parse(newBudgetData);

    // Validate created_by_user_id exists
    if (Object.keys(await usersDAL.fetchUserById(newBudgetData.created_by_user_id))?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create budget',
        error: `User not found with userID - ${newBudgetData.created_by_user_id}`,
      });
    }

    // Validate home exists
    if (Object.keys(await homeDAL.getHomeById(newBudgetData.home_id))?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create budget',
        error: `Home not found with homeId - ${newBudgetData.home_id}`,
      });
    }

    const created = await budgetDAL.createBudget(newBudgetData);

    return FormatResponse(201, {
      message: 'Budget created successfully',
      budget: created,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: err.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to create budget',
      error: err as Error,
    });
  }
};
