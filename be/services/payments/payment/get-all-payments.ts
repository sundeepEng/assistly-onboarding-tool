import { PaymentDAL } from '../../../dal/payment.dal';
import { FormatResponse } from '../../../utils/response-formatter';

const paymentDAL: PaymentDAL = new PaymentDAL();

export const getAllPaymentsHandler = async (queryParams?: any) => {
  try {
    const payments =
      queryParams && Object.keys(queryParams).length > 0
        ? await paymentDAL.getAllPayments(queryParams)
        : await paymentDAL.getAllPayments();

    return FormatResponse(200, {
      message: 'Fetched payments successfully',
      payments,
    });
  } catch (error) {
    console.error(`{api: '/get-all-payments', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to fetch payments',
      error: error as Error,
    });
  }
};
