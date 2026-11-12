import { PayoutDAL } from './../../../dal/payout.dal';
import { FormatResponse } from '../../../utils/response-formatter';
import { UsersDAL } from '../../../dal/users.dal';
import { PaymentDAL } from '../../../dal/payment.dal';

const payoutDAL: PayoutDAL = new PayoutDAL();
const usersDAL: UsersDAL = new UsersDAL();
const paymentDAL: PaymentDAL = new PaymentDAL();

export const getAllPayoutsHandler = async (queryParams?: any) => {
  try {
    const payouts =
      queryParams && Object.keys(queryParams).length > 0
        ? await payoutDAL.getAllPayouts(queryParams)
        : await payoutDAL.getAllPayouts();

    const payoutIds = payouts
      .map((p: any) => p?.id)
      .filter((id: any): id is number => typeof id === 'number');

    const payments = payoutIds.length
      ? await paymentDAL.getAllPayments({
          subject_type: 'PAYROLL_PAYOUT',
          subject_id: payoutIds as any,
        } as any)
      : [];

    const paymentsByPayoutId = new Map<number, any[]>();
    for (const p of payments) {
      const sid = (p as any)?.subject_id;
      if (typeof sid !== 'number') continue;
      const arr = paymentsByPayoutId.get(sid) ?? [];
      arr.push(p);
      paymentsByPayoutId.set(sid, arr);
    }

    const uniqueUserIds = Array.from(
      new Set(payouts.flatMap((payout: any) => [payout.pcg_user_id]))
    ).filter(Boolean);

    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);
    const userMap = new Map<string, string>(users.map((user: any) => [user.userId, user.name]));

    const enrichedPayouts = payouts.map((payout: any) => ({
      ...payout,
      pcg_user_name: userMap.get(payout.pcg_user_id) ?? '',
      payments: typeof payout?.id === 'number' ? (paymentsByPayoutId.get(payout.id) ?? []) : [],
    }));

    return FormatResponse(200, {
      message: 'Fetched payouts successfully',
      payouts: enrichedPayouts,
    });
  } catch (error) {
    console.error(`{api: '/get-all-payouts', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to fetch payouts',
      error: error as Error,
    });
  }
};
