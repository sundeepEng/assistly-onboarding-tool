import { InvoiceDAL } from '../../../dal/invoice.dal';
import { FormatResponse } from '../../../utils/response-formatter';
import { PaymentDAL } from '../../../dal/payment.dal';

const invoiceDAL: InvoiceDAL = new InvoiceDAL();
const paymentDAL: PaymentDAL = new PaymentDAL();

export const getAllInvoicesHandler = async (queryParams?: any) => {
  try {
    const invoices =
      queryParams && Object.keys(queryParams).length > 0
        ? await invoiceDAL.getAllInvoices(queryParams)
        : await invoiceDAL.getAllInvoices();

    const invoiceIds = invoices
      .map((inv: any) => inv?.id)
      .filter((id: any): id is number => typeof id === 'number');

    const payments = invoiceIds.length
      ? await paymentDAL.getAllPayments({
          subject_type: 'INVOICE',
          subject_id: invoiceIds as any,
        } as any)
      : [];

    const paymentsByInvoiceId = new Map<number, any[]>();
    for (const p of payments) {
      const sid = (p as any)?.subject_id;
      if (typeof sid !== 'number') continue;
      const arr = paymentsByInvoiceId.get(sid) ?? [];
      arr.push(p);
      paymentsByInvoiceId.set(sid, arr);
    }

    const enrichedInvoices = invoices.map((inv: any) => ({
      ...inv,
      payments: typeof inv?.id === 'number' ? (paymentsByInvoiceId.get(inv.id) ?? []) : [],
    }));

    return FormatResponse(200, {
      message: 'Fetched invoices successfully',
      invoices: enrichedInvoices,
    });
  } catch (error) {
    console.error(`{api: '/get-all-invoices', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to fetch invoices',
      error: error as Error,
    });
  }
};
