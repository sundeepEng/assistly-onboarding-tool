import { PayoutDAL } from './../../../dal/payout.dal';
import { FormatResponse } from '../../../utils/response-formatter';

const payoutDAL: PayoutDAL = new PayoutDAL();

export const deletePayoutHandler = async (id: any) => {
  if (!id) {
    console.error(`{api: '/delete-payout', error: Missing id}`);

    return FormatResponse(404, {
      message: 'Failed to delete payout',
      error: 'id is required',
    });
  }

  const payoutId = Number(id);

  if (Number.isNaN(payoutId)) {
    return FormatResponse(400, {
      message: 'Failed to delete payout',
      error: 'id must be a number',
    });
  }

  try {
    const existing = await payoutDAL.getAllPayouts({ id: payoutId });
    const payout = existing?.[0];

    if (!payout) {
      return FormatResponse(404, {
        message: 'Failed to delete payout',
        error: `Payout with id ${payoutId} not found`,
      });
    }

    if (payout.status !== 'DRAFT') {
      return FormatResponse(409, {
        message: 'Failed to delete payout',
        error: `Payout can be deleted only in DRAFT status. Current status: ${payout.status}`,
      });
    }

    await payoutDAL.deletePayoutById(payoutId);

    return FormatResponse(200, {
      message: 'Payout deleted successfully',
      id: payoutId,
    });
  } catch (error) {
    console.error(`{api: '/delete-payout', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to delete payout',
      error: (error as Error).message,
    });
  }
};
