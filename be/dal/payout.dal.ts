import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import {
  PayOutItemSchema,
  PayOutSchema,
  PayOutWithItemsSchema,
} from '../models/Payments/payout.model';

export class PayoutDAL {
  private payoutTableName: string;
  private payoutItemTableName: string;

  constructor() {
    this.payoutTableName = `payout_${process.env.STAGE!}`;
    this.payoutItemTableName = `payout_item_${process.env.STAGE!}`;
  }

  public async deletePayoutById(payoutId: number) {
    try {
      const postgresDB = await getPostgresConnection();

      await postgresDB.transaction(async (trx) => {
        await trx(this.payoutItemTableName).where('payout_id', payoutId).del();
        await trx(this.payoutTableName).where('id', payoutId).del();
      });

      return;
    } catch (error) {
      console.error(`path: payout.dal, method: deletePayoutById, error: ${error}`);
      throw error;
    }
  }

  private async getPayoutItems(filters?: {
    [K in keyof Partial<z.infer<typeof PayOutItemSchema>>]?:
      | Partial<z.infer<typeof PayOutItemSchema>>[K]
      | Partial<z.infer<typeof PayOutItemSchema>>[K][];
  }) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.payoutItemTableName).select('*');

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

      const payoutItems = await query;

      const itemsByPayoutId = new Map<number, z.infer<typeof PayOutItemSchema>[]>();

      for (const item of payoutItems) {
        const payoutId = Number((item as any).payout_id);
        if (Number.isNaN(payoutId)) continue;

        const existing = itemsByPayoutId.get(payoutId) ?? [];
        existing.push(item);
        itemsByPayoutId.set(payoutId, existing);
      }

      return itemsByPayoutId;
    } catch (error) {
      console.error(`path: payout.dal, method: getPayoutItems, error: ${error}`);
      throw error;
    }
  }

  private async upsertPayoutItems(items: z.infer<typeof PayOutItemSchema>[]) {
    try {
      const postgresDB = await getPostgresConnection();
      if (!items.length) {
        return [];
      }
      const updatedRecords = await postgresDB(this.payoutItemTableName)
        .insert(items)
        .onConflict('payout_item_id')
        .merge()
        .returning('*');
      return updatedRecords as z.infer<typeof PayOutItemSchema>[];
    } catch (error) {
      console.error(`path: payout.dal, method: updatePayoutItems, error: ${error}`);
      throw error;
    }
  }

  private async deletePayoutItems(payoutItemIds: string[]) {
    try {
      const postgresDB = await getPostgresConnection();

      if (!payoutItemIds.length) {
        return;
      }

      await postgresDB(this.payoutItemTableName).whereIn('payout_item_id', payoutItemIds).del();

      console.log(`Deleted ${payoutItemIds.length} payout items`);

      return;
    } catch (error) {
      console.error(`path: payout.dal, method: deletePayoutItems, error: ${error}`);
      throw error;
    }
  }

  // Define methods for interacting with the payout data
  async createPayout(payoutData: z.infer<typeof PayOutWithItemsSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const { items, ...updatedPayoutData } = payoutData;
      const result = await postgresDB(this.payoutTableName)
        .insert(updatedPayoutData)
        .returning('*');
      const payoutId = result[0]?.id;
      const updatedItems = items.map((item) => ({ ...item, payout_id: payoutId }));
      await this.upsertPayoutItems(updatedItems);
      return { ...payoutData, id: payoutId, items: updatedItems };
    } catch (error) {
      console.error(`path: payout.dal, method: createPayout, error: ${error}`);
      throw error;
    }
  }

  async getAllPayouts(filters?: Partial<z.infer<typeof PayOutSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.payoutTableName).select('*');

      if (filters?.id) {
        Array.isArray(filters.id) ? query.whereIn('id', filters.id) : query.where('id', filters.id);
      }

      if (filters?.payroll_payout_id) {
        Array.isArray(filters.payroll_payout_id)
          ? query.whereIn('payroll_payout_id', filters.payroll_payout_id)
          : query.where('payroll_payout_id', filters.payroll_payout_id);
      }

      if (filters?.home_id) {
        Array.isArray(filters.home_id)
          ? query.whereIn('home_id', filters.home_id)
          : query.where('home_id', filters.home_id);
      }

      if (filters?.pcho_user_id) {
        Array.isArray(filters.pcho_user_id)
          ? query.whereIn('pcho_user_id', filters.pcho_user_id)
          : query.where('pcho_user_id', filters.pcho_user_id);
      }

      if (filters?.pcg_user_id) {
        Array.isArray(filters.pcg_user_id)
          ? query.whereIn('pcg_user_id', filters.pcg_user_id)
          : query.where('pcg_user_id', filters.pcg_user_id);
      }

      if (filters?.period_type) {
        Array.isArray(filters.period_type)
          ? query.whereIn('period_type', filters.period_type)
          : query.where('period_type', filters.period_type);
      }

      if (filters?.status) {
        Array.isArray(filters.status)
          ? query.whereIn('status', filters.status)
          : query.where('status', filters.status);
      }

      if (filters?.period_start_date != null) {
        const startDate = filters.period_start_date as unknown;
        if (Array.isArray(startDate)) {
          query.whereBetween('period_start_date', [startDate[0], startDate[1]]);
        } else {
          query.where('period_start_date', startDate as string);
        }
      }

      if (filters?.period_end_date != null) {
        const endDate = filters.period_end_date as unknown;
        if (Array.isArray(endDate)) {
          query.whereBetween('period_end_date', [endDate[0], endDate[1]]);
        } else {
          query.where('period_end_date', endDate as string);
        }
      }

      await query.orderBy('updated_at', 'desc');

      const payouts = await query;

      if (!payouts.length) {
        return [];
      }

      const payoutIds = payouts
        .map((p) => p.id)
        .filter((id): id is number => typeof id === 'number');

      const itemsByPayoutId = await this.getPayoutItems({
        payout_id: payoutIds,
      });

      return payouts.map((payout) => ({
        ...payout,
        items: typeof payout.id === 'number' ? (itemsByPayoutId.get(payout.id) ?? []) : [],
      }));
    } catch (error) {
      console.error(`path: payout.dal, method: getAllPayouts, error: ${error}`);
      throw error;
    }
  }

  async updatePayout(payoutId: number, payoutData: z.infer<typeof PayOutWithItemsSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const { items, ...updatedPayoutData } = payoutData;

      // Update the main payout record
      await postgresDB(this.payoutTableName)
        .where('id', payoutId)
        .update(updatedPayoutData)
        .returning('*');

      // Handle payout items
      if (items?.length >= 0) {
        // Get existing items for this payout
        const existingItemsMap = await this.getPayoutItems({ payout_id: payoutId });
        const existingItems = existingItemsMap.get(payoutId) || [];

        console.info(`Existing items for payout ${payoutId}: ${JSON.stringify(existingItems)}`);

        // Extract payout_item_id from existing items and payload items
        const existingItemIds = existingItems
          .map((item) => item.payout_item_id)
          .filter((id): id is string => typeof id === 'string');

        console.info(
          `Existing item IDs for payout ${payoutId}: ${JSON.stringify(existingItemIds)}`
        );

        const payloadItemIds = items
          .map((item) => item.payout_item_id)
          .filter((id): id is string => typeof id === 'string');

        console.info(`Payload item IDs for payout ${payoutId}: ${JSON.stringify(payloadItemIds)}`);

        // Find items to delete (exist in DB but not in payload)
        const itemsToDelete = existingItemIds.filter((id) => !payloadItemIds.includes(id));

        console.info(`Items to delete for payout ${payoutId}: ${JSON.stringify(itemsToDelete)}`);

        // Delete items that are not in the payload
        if (itemsToDelete.length > 0) {
          await this.deletePayoutItems(itemsToDelete);
        }

        // Upsert the items from the payload
        await this.upsertPayoutItems(items);
      }

      return payoutData;
    } catch (error) {
      console.error(`path: payout.dal, method: updatePayout, error: ${error}`);
      throw error;
    }
  }

  async checkOverlappingPayout(params: {
    home_id: string;
    pcg_user_id: string;
    period_start_date: string;
    period_end_date: string;
  }) {
    try {
      const postgresDB = await getPostgresConnection();

      const overlapping = await postgresDB(this.payoutTableName)
        .where('home_id', params.home_id)
        .andWhere('pcg_user_id', params.pcg_user_id)
        .andWhere((builder) => {
          builder
            .where('period_start_date', '<', params.period_end_date)
            .andWhere('period_end_date', '>', params.period_start_date);
        });

      return overlapping;
    } catch (error) {
      console.error(`checkOverlappingPayout error: ${error}`);
      throw error;
    }
  }
}
