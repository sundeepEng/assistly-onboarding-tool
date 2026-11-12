import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import {
  InvoiceItemSchema,
  InvoiceSchema,
  InvoiceWithItemsSchema,
} from '../models/Payments/invoice.model';
export class InvoiceDAL {
  private invoiceTableName: string;
  private invoiceItemTableName: string;

  constructor() {
    this.invoiceTableName = `invoice_${process.env.STAGE!}`;
    this.invoiceItemTableName = `invoice_item_${process.env.STAGE!}`;
  }

  private async getInvoiceItems(filters?: {
    [K in keyof Partial<z.infer<typeof InvoiceItemSchema>>]?:
      | Partial<z.infer<typeof InvoiceItemSchema>>[K]
      | Partial<z.infer<typeof InvoiceItemSchema>>[K][];
  }) {
    try {
      const postgresDB = await getPostgresConnection();

      const query = postgresDB(this.invoiceItemTableName).select('*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value == null) return;

          if (Array.isArray(value)) {
            query.whereIn(key, value as any[]);
          } else {
            query.where(key, value as any);
          }
        });
      }

      const invoiceItems = await query;

      const itemsByInvoiceId = new Map<number, z.infer<typeof InvoiceItemSchema>[]>();

      for (const item of invoiceItems) {
        const invoiceId = Number((item as any).invoice_id);
        if (Number.isNaN(invoiceId)) continue;
        const existing = itemsByInvoiceId.get(invoiceId) ?? [];
        existing.push(item);
        itemsByInvoiceId.set(invoiceId, existing);
      }

      return itemsByInvoiceId;
    } catch (error) {
      console.error(`path: invoice.dal, method: getInvoiceItems, error: ${error}`);
      throw error;
    }
  }

  private async upsertInvoiceItems(items: z.infer<typeof InvoiceItemSchema>[]) {
    try {
      const postgresDB = await getPostgresConnection();

      if (!items.length) {
        return [];
      }

      const updatedRecords = await postgresDB(this.invoiceItemTableName)
        .insert(items)
        .onConflict('invoice_item_id')
        .merge()
        .returning('*');

      return updatedRecords as z.infer<typeof InvoiceItemSchema>[];
    } catch (error) {
      console.error(`path: invoice.dal, method: updateInvoiceItems, error: ${error}`);
      throw error;
    }
  }

  private async deleteInvoiceItems(invoiceIds: string[]) {
    try {
      const postgresDB = await getPostgresConnection();

      if (!invoiceIds.length) {
        return;
      }

      await postgresDB(this.invoiceItemTableName).whereIn('invoice_item_id', invoiceIds).del();

      console.log(`Deleted ${invoiceIds.length} invoice items`);

      return;
    } catch (error) {
      console.error(`path: invoice.dal, method: deleteInvoiceItems, error: ${error}`);
      throw error;
    }
  }

  async createInvoice(invoiceData: z.infer<typeof InvoiceWithItemsSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const { items, ...updatedInvoiceData } = invoiceData;

      const result = await postgresDB(this.invoiceTableName)
        .insert(updatedInvoiceData)
        .returning('*');

      const invoiceId = result[0].id;

      // Build invoice_id: INV_<billingperiodYYYY_MM>_<000id>
      const billing = updatedInvoiceData.billing_period; // "YYYY-MM"
      const [yyyy, mm] = billing.split('-');
      const paddedId = String(invoiceId).padStart(3, '0');
      const generatedInvoiceId = `INV_${yyyy}_${mm}_${paddedId}`;

      // Update invoice row with generated invoice_id
      await postgresDB(this.invoiceTableName)
        .where({ id: invoiceId })
        .update({ invoice_id: generatedInvoiceId });

      const updatedItems = items.map((item) => ({
        ...item,
        invoice_id: invoiceId,
      }));

      await this.upsertInvoiceItems(updatedItems);

      return { ...invoiceData, id: invoiceId, items: updatedItems };
    } catch (error) {
      console.error(`path: invoice.dal, method: createInvoice, error: ${error}`);
      throw error;
    }
  }

  async getAllInvoices(filters?: Partial<z.infer<typeof InvoiceSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.invoiceTableName).select('*');

      if (filters?.id) {
        Array.isArray(filters.id) ? query.whereIn('id', filters.id) : query.where('id', filters.id);
      }

      if (filters?.invoice_id) {
        if (Array.isArray(filters.invoice_id)) {
          query.whereIn('invoice_id', filters.invoice_id);
        } else {
          query.where('invoice_id', filters.invoice_id);
        }
      }

      if (filters?.home_id) {
        if (Array.isArray(filters.home_id)) {
          query.whereIn('home_id', filters.home_id);
        } else {
          query.where('home_id', filters.home_id);
        }
      }

      if (filters?.user_id) {
        if (Array.isArray(filters.user_id)) {
          query.whereIn('user_id', filters.user_id);
        } else {
          query.where('user_id', filters.user_id);
        }
      }

      if (filters?.billing_period) {
        if (Array.isArray(filters.billing_period)) {
          query.whereIn('billing_period', filters.billing_period);
        } else {
          query.where('billing_period', filters.billing_period);
        }
      }

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query.whereIn('status', filters.status);
        } else {
          query.where('status', filters.status);
        }
      }

      if (filters?.parent_invoice_id != null) {
        query.where('parent_invoice_id', filters.parent_invoice_id);
      }

      if (filters?.due_date != null) {
        const dueDate = (filters as any).due_date as unknown;
        if (Array.isArray(dueDate)) {
          query.whereBetween('due_date', [dueDate[0], dueDate[1]]);
        } else {
          query.where('due_date', dueDate as string);
        }
      }

      await query.orderBy('updated_at', 'desc');

      const invoices = await query;
      if (!invoices.length) {
        return [];
      }

      const invoiceIds = invoices
        .map((i) => i.id)
        .filter((id): id is number => typeof id === 'number');

      const itemsByInvoiceId = await this.getInvoiceItems({
        invoice_id: invoiceIds,
      });

      return invoices.map((invoice) => ({
        ...invoice,
        items: typeof invoice.id === 'number' ? (itemsByInvoiceId.get(invoice.id) ?? []) : [],
      }));
    } catch (error) {
      console.error(`path: invoice.dal, method: getAllInvoices, error: ${error}`);
      throw error;
    }
  }

  async updateInvoice(invoiceId: number, invoiceData: z.infer<typeof InvoiceWithItemsSchema>) {
    try {
      const postgresDB = await getPostgresConnection();

      const { items, ...updatedInvoiceData } = invoiceData;

      // Update the main invoice record
      await postgresDB(this.invoiceTableName)
        .where({ id: invoiceId })
        .update(updatedInvoiceData)
        .returning('*');

      // Handle invoice items
      if (items?.length > 0) {
        // Get existing items for this invoice
        const existingItemsMap = await this.getInvoiceItems({ invoice_id: invoiceId });
        const existingItems = existingItemsMap.get(invoiceId) || [];

        console.info(`Existing items for invoice ${invoiceId}: ${JSON.stringify(existingItems)}`);

        // Extract invoice_item_id from existing items and payload items
        const existingItemIds = existingItems
          .map((item) => item.invoice_item_id)
          .filter((id): id is string => typeof id === 'string');

        console.info(
          `Existing item IDs for invoice ${invoiceId}: ${JSON.stringify(existingItemIds)}`
        );

        const payloadItemIds = items
          .map((item) => item.invoice_item_id)
          .filter((id): id is string => typeof id === 'string');

        console.info(
          `Payload item IDs for invoice ${invoiceId}: ${JSON.stringify(payloadItemIds)}`
        );

        // Find items to delete (exist in DB but not in payload)
        const itemsToDelete = existingItemIds.filter((id) => !payloadItemIds.includes(id));

        console.info(`Items to delete for invoice ${invoiceId}: ${JSON.stringify(itemsToDelete)}`);

        // Delete items that are not in the payload
        if (itemsToDelete.length > 0) {
          await this.deleteInvoiceItems(itemsToDelete);
        }

        // Upsert the items from the payload
        await this.upsertInvoiceItems(items);
      }

      return invoiceData;
    } catch (error) {
      console.error(`path: invoice.dal, method: updateInvoice, error: ${error}`);
      throw error;
    }
  }
}
