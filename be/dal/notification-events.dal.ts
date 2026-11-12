import { getPostgresConnection } from '../utils/postgres-client';

export type NotificationEventStatus = 'queued' | 'picked' | 'sent' | 'failed' | 'dlq';

export interface NotificationEventRecipient {
  user_id: string;
  role?: string;
}

export interface CreateNotificationEventInput {
  correlationId: string;
  type: 'web' | 'cron';
  homeId?: string;
  entityId?: string;
  trigger: Record<string, any>;
  recipients?: NotificationEventRecipient[];
  payload?: Record<string, any>;
}

interface RecipientStatusEntry {
  status: 'sent' | 'failed';
  sent_at?: string;
  failed_at?: string;
  devices: Record<string, any>[];
}

export interface NotificationEventFilters {
  status?: NotificationEventStatus;
  type?: 'web' | 'cron';
  homeId?: string;
  entityId?: string;
  userId?: string;
  createdAtBefore?: string;
  limit?: number;
}

export class NotificationEventsDAL {
  private tableName: string;

  constructor() {
    this.tableName = 'notification_events';
  }

  async createEvent(input: CreateNotificationEventInput) {
    try {
      const postgresDB = await getPostgresConnection();

      const [event] = await postgresDB(this.tableName)
        .insert({
          correlation_id: input.correlationId,
          type: input.type,
          home_id: input.homeId ?? null,
          entity_id: input.entityId ?? null,
          trigger: JSON.stringify(input.trigger),
          recipients: input.recipients ? JSON.stringify(input.recipients) : null,
          payload: input.payload
            ? JSON.stringify({
                ...input.payload,
                // Per-recipient delivery status, populated by the worker after sending.
                recipient_status: input.payload.recipient_status ?? {},
              })
            : null,
        })
        .returning('*');

      return event;
    } catch (error) {
      console.error('[notification-events] Failed to create event:', error);
      throw error;
    }
  }

  async markPicked(id: string) {
    return this.updateStatus(id, 'picked', { picked_at: new Date().toISOString() });
  }

  async markSent(id: string, userId: string, deviceResults: Record<string, any>[]) {
    return this.updateRecipientStatusInPayload(id, userId, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      devices: deviceResults,
    });
  }

  async markFailed(
    id: string,
    userId: string,
    errorMessage: string,
    deviceResults?: Record<string, any>[]
  ) {
    return this.updateRecipientStatusInPayload(id, userId, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      devices: deviceResults ?? [],
    });
  }

  async markDlq(id: string, errorMessage?: string) {
    return this.updateStatus(id, 'dlq', {
      dlq_at: new Date().toISOString(),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    });
  }

  async incrementAttempt(id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      await postgresDB(this.tableName)
        .where({ id })
        .increment('attempt', 1)
        .update({ updated_at: new Date().toISOString() });
    } catch (error) {
      console.error('[notification-events] Failed to increment attempt:', error);
      throw error;
    }
  }

  private async updateRecipientStatusInPayload(
    id: string,
    userId: string,
    statusEntry: RecipientStatusEntry
  ) {
    try {
      const postgresDB = await getPostgresConnection();
      const existing = await postgresDB(this.tableName).where({ id }).first();
      if (!existing) {
        console.warn(`[notification-events] No event found for id=${id}`);
        return null;
      }

      const payload =
        typeof existing.payload === 'string'
          ? JSON.parse(existing.payload)
          : existing.payload || {};
      const recipientStatus = payload.recipient_status || {};

      recipientStatus[userId] = statusEntry;

      const status: NotificationEventStatus = Object.values(recipientStatus).some(
        (entry: any) => entry.status === 'sent'
      )
        ? 'sent'
        : 'failed';

      const [event] = await postgresDB(this.tableName)
        .where({ id })
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
          payload: JSON.stringify({ ...payload, recipient_status: recipientStatus }),
        })
        .returning('*');

      return event;
    } catch (error) {
      console.error(
        `[notification-events] Failed to update recipient status for event=${id}:`,
        error
      );
      throw error;
    }
  }

  private async updateStatus(
    id: string,
    status: NotificationEventStatus,
    extra: Record<string, any> = {}
  ) {
    try {
      const postgresDB = await getPostgresConnection();

      const [event] = await postgresDB(this.tableName)
        .where({ id })
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...extra,
        })
        .returning('*');

      return event;
    } catch (error) {
      console.error(`[notification-events] Failed to update status to ${status}:`, error);
      throw error;
    }
  }

  async getEvents(filters: NotificationEventFilters = {}) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.tableName).select('*');

      if (filters.status) {
        query.where('status', filters.status);
      }

      if (filters.type) {
        query.where('type', filters.type);
      }

      if (filters.homeId) {
        query.where('home_id', filters.homeId);
      }

      if (filters.entityId) {
        query.where('entity_id', filters.entityId);
      }

      if (filters.userId) {
        query.whereRaw(`recipients @> ?`, [JSON.stringify([{ user_id: filters.userId }])]);
      }

      if (filters.createdAtBefore) {
        query.where('created_at', '<', filters.createdAtBefore);
      }

      return await query.orderBy('created_at', 'desc').limit(filters.limit ?? 100);
    } catch (error) {
      console.error('[notification-events] Failed to fetch events:', error);
      throw error;
    }
  }

  async getEventById(id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      return await postgresDB(this.tableName).where({ id }).first();
    } catch (error) {
      console.error('[notification-events] Failed to fetch event by id:', error);
      throw error;
    }
  }
}
