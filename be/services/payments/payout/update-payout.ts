import { PayoutDAL } from './../../../dal/payout.dal';
import { z } from 'zod';
import { PayOutWithItemsSchema } from '../../../models/Payments/payout.model';
import { FormatResponse } from '../../../utils/response-formatter';

const payoutDAL: PayoutDAL = new PayoutDAL();
export const updatePayoutHandler = async (
  id: any,
  updatedPayoutData: z.infer<typeof PayOutWithItemsSchema>
) => {
  if (!id || !updatedPayoutData) {
    console.error(`{api: '/update-payout', error: No body provided}`);

    return FormatResponse(404, {
      message: 'Failed to update payout',
      error: 'id and body are required',
    });
  }

  id = Number(id);

  try {
    if (updatedPayoutData.id && updatedPayoutData.id !== id) {
      return FormatResponse(409, {
        message: 'Failed to update payout',
        error: 'Payout ID mismatch - id in the body does not match with the path parameter',
      });
    }
    const existingPayout = await payoutDAL.getAllPayouts({ id });

    if (!existingPayout) {
      return FormatResponse(404, {
        message: 'Failed to update payout',
        error: `Payout with id ${id} not found`,
      });
    }

    const updatedItems =
      updatedPayoutData.items.length > 0
        ? updatedPayoutData.items.map((item) => {
            return {
              ...item,
              updated_at: new Date().toISOString(),
            };
          })
        : [];

    updatedPayoutData = {
      ...updatedPayoutData,
      items: updatedItems,
      updated_at: new Date().toISOString(),
    };

    let validatedData = PayOutWithItemsSchema.parse(updatedPayoutData);

    // Check if payout_id is present in all payout items
    const itemsMissingPayoutId = validatedData.items.filter(
      (item) => typeof item.payout_id !== 'number'
    );

    if (itemsMissingPayoutId.length > 0) {
      return FormatResponse(400, {
        message: 'Failed to update payout',
        error: 'payout_id is required for all payout items and should be a number',
      });
    }

    await payoutDAL.updatePayout(id, validatedData);

    console.info(`Payout ${id} updated successfully`);

    return FormatResponse(200, {
      message: 'Payout updated successfully',
      payout: updatedPayoutData,
    });
  } catch (error) {
    console.error(`{api: '/update-payout', error: ${error}}`);

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to update payout',
      error: (error as Error).message,
    });
  }
};
