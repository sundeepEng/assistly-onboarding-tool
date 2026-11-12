import { z } from 'zod';
import { PayOutWithItemsSchema } from '../../../models/Payments/payout.model';
import { FormatResponse } from '../../../utils/response-formatter';
import { UsersDAL } from '../../../dal/users.dal';
import { HomeDAL } from '../../../dal/home.dal';
import { PayoutDAL } from '../../../dal/payout.dal';

const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const payoutDAL: PayoutDAL = new PayoutDAL();

export const createPayoutHandler = async (newPayoutData: z.infer<typeof PayOutWithItemsSchema>) => {
  if (!newPayoutData) {
    return FormatResponse(404, {
      message: 'Failed to create payout',
      error: 'No data provided',
    });
  }
  try {
    newPayoutData = {
      ...newPayoutData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    PayOutWithItemsSchema.parse(newPayoutData);

    console.info(
      `{api: '/create-payout', message: 'Validated data', data: ${JSON.stringify(newPayoutData)}}`
    );
    // Check if the pcho with user_id exists in the system
    if (Object.keys(await usersDAL.fetchUserById(newPayoutData?.pcho_user_id))?.length === 0) {
      console.error(
        `{api: '/create-payout', error: User not found with ID: ${newPayoutData?.pcho_user_id}}`
      );
      return FormatResponse(404, {
        message: 'Failed to create payout',
        error: `PCHO with userID - ${newPayoutData?.pcho_user_id}  not found`,
      });
    }

    //check if the caregiver with user_id exists in the system
    if (Object.keys(await usersDAL.fetchUserById(newPayoutData?.pcg_user_id))?.length === 0) {
      console.error(
        `{api: '/create-payout', error: User not found with ID: ${newPayoutData?.pcg_user_id}}`
      );
      return FormatResponse(404, {
        message: 'Failed to create payout',
        error: `Caregiver with userID - ${newPayoutData?.pcg_user_id}  not found`,
      });
    }

    // Check if the home with id exists
    if (Object.keys(await homeDAL.getHomeById(newPayoutData?.home_id))?.length === 0) {
      console.error(
        `{api: '/create-payout', error: Home not found with ID: ${newPayoutData?.home_id}}`
      );
      return FormatResponse(404, {
        message: 'Failed to create payout',
        error: `Home with homeId - ${newPayoutData?.home_id}  not found`,
      });
    }

    // Validate start <= end
    const start = new Date(newPayoutData.period_start_date);
    const end = new Date(newPayoutData.period_end_date);

    if (start > end) {
      return FormatResponse(400, {
        message: 'Invalid pay period',
        error: 'Start date cannot be after end date',
      });
    }

    // Check overlapping payout
    const overlapping = await payoutDAL.checkOverlappingPayout({
      home_id: newPayoutData.home_id,
      pcg_user_id: newPayoutData.pcg_user_id,
      period_start_date: newPayoutData.period_start_date,
      period_end_date: newPayoutData.period_end_date,
    });

    if (overlapping.length > 0) {
      return FormatResponse(409, {
        message: 'Failed to create payout',
        error: 'Paystub already exists for this user and pay period',
      });
    }

    const updatedItems =
      newPayoutData.items.length > 0
        ? newPayoutData.items.map((item) => {
            return {
              ...item,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          })
        : [];

    newPayoutData = { ...newPayoutData, items: updatedItems };
    await payoutDAL.createPayout(newPayoutData);
    return FormatResponse(201, {
      message: 'Payout created successfully',
      payout: newPayoutData,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: err.errors,
      });
    }
    return FormatResponse(500, {
      message: 'Failed to create Payout',
      error: err as Error,
    });
  }
};
