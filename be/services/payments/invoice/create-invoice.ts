import { z } from 'zod';
import { InvoiceWithItemsSchema } from '../../../models/Payments/invoice.model';
import { FormatResponse } from '../../../utils/response-formatter';
import { UsersDAL } from '../../../dal/users.dal';
import { InvoiceDAL } from '../../../dal/invoice.dal';
import { HomeDAL } from '../../../dal/home.dal';

const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const invoiceDAL: InvoiceDAL = new InvoiceDAL();

export const createInvoiceHandler = async (
  newInvoiceData: z.infer<typeof InvoiceWithItemsSchema>
) => {
  if (!newInvoiceData) {
    return FormatResponse(404, {
      message: 'Failed to create invoice',
      error: 'No data provided',
    });
  }

  try {
    newInvoiceData = {
      ...newInvoiceData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    InvoiceWithItemsSchema.parse(newInvoiceData);

    console.info(
      `{api: '/create-invoice', message: 'Validated data', data: ${JSON.stringify(newInvoiceData)}}`
    );

    // Check if the user with user_id exists in the system
    if (Object.keys(await usersDAL.fetchUserById(newInvoiceData?.user_id))?.length === 0) {
      console.error(
        `{api: '/create-invoice', error: User not found with ID: ${newInvoiceData?.user_id}}`
      );
      return FormatResponse(404, {
        message: 'Failed to create invoice',
        error: `User with userID - ${newInvoiceData?.user_id}  not found`,
      });
    }

    // Check if the home with id exists
    if (Object.keys(await homeDAL.getHomeById(newInvoiceData?.home_id))?.length === 0) {
      console.error(
        `{api: '/create-invoice', error: Home not found with ID: ${newInvoiceData?.home_id}}`
      );
      return FormatResponse(404, {
        message: 'Failed to create invoice',
        error: `Home with homeId - ${newInvoiceData?.home_id}  not found`,
      });
    }

    const updatedItems =
      newInvoiceData.items.length > 0
        ? newInvoiceData.items.map((item) => {
            return {
              ...item,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          })
        : [];

    newInvoiceData = {
      ...newInvoiceData,
      items: updatedItems,
    };

    await invoiceDAL.createInvoice(newInvoiceData);

    return FormatResponse(201, {
      message: 'Invoice created successfully',
      invoice: newInvoiceData,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: err.errors,
      });
    }
    return FormatResponse(400, {
      message: 'Failed to create invoice',
      error: err as Error,
    });
  }
};
