import { z } from 'zod';
import { InvoiceWithItemsSchema } from '../../../models/Payments/invoice.model';
import { InvoiceDAL } from '../../../dal/invoice.dal';
import { FormatResponse } from '../../../utils/response-formatter';

const invoiceDAL: InvoiceDAL = new InvoiceDAL();

export const updateInvoiceHandler = async (
  id: any,
  updatedInvoiceData: z.infer<typeof InvoiceWithItemsSchema>
) => {
  if (!id || !updatedInvoiceData) {
    console.error(`{api: '/update-invoice', error: No body provided}`);

    return FormatResponse(404, {
      message: 'Failed to update invoice',
      error: 'id and body are required',
    });
  }

  id = Number(id);

  try {
    if (updatedInvoiceData.id && updatedInvoiceData.id !== id) {
      return FormatResponse(409, {
        message: 'Failed to update invoice',
        error: 'Invoice ID mismatch - id in the body does not match with the path parameter',
      });
    }

    const existingInvoice = await invoiceDAL.getAllInvoices({ id });

    if (!existingInvoice) {
      return FormatResponse(404, {
        message: 'Failed to update invoice',
        error: `Invoice with id ${id} not found`,
      });
    }

    const updatedItems =
      updatedInvoiceData.items.length > 0
        ? updatedInvoiceData.items.map((item) => {
            return {
              ...item,
              updated_at: new Date().toISOString(),
            };
          })
        : [];

    updatedInvoiceData = {
      ...updatedInvoiceData,
      items: updatedItems,
      updated_at: new Date().toISOString(),
    };

    let validatedData = InvoiceWithItemsSchema.parse(updatedInvoiceData);

    // Check if invoice_id is present in all invoice items
    const itemsMissingInvoiceId = validatedData.items.filter(
      (item) => typeof item.invoice_id !== 'number'
    );

    if (itemsMissingInvoiceId.length > 0) {
      return FormatResponse(400, {
        message: 'Failed to update invoice',
        error: 'invoice_id must be present for every invoice item',
      });
    }

    await invoiceDAL.updateInvoice(id, validatedData);

    console.info(`Invoice ${id} updated successfully`);

    return FormatResponse(200, {
      message: 'Invoice updated successfully',
      invoice: updatedInvoiceData,
    });
  } catch (error) {
    console.error(`{api: '/update-invoice', error: ${error}}`);

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to update invoice',
      error: (error as Error).message,
    });
  }
};
