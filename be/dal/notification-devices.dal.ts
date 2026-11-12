import { getPostgresConnection } from '../utils/postgres-client';

export interface NotificationDeviceRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
  timezone: string;
  appVersion?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RawNotificationDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  device_token: string;
  platform: string;
  timezone: string;
  app_version?: string;
  metadata?: any;
  is_active: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

const toRecord = (row: RawNotificationDeviceRow): NotificationDeviceRecord => ({
  id: row.id,
  userId: row.user_id,
  deviceId: row.device_id,
  deviceToken: row.device_token,
  platform: row.platform as 'ios' | 'android',
  timezone: row.timezone,
  appVersion: row.app_version,
  metadata: row.metadata
    ? typeof row.metadata === 'string'
      ? JSON.parse(row.metadata)
      : row.metadata
    : undefined,
  isActive: row.is_active,
  lastSeenAt: row.last_seen_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class NotificationDevicesDAL {
  private tableName = 'notification_devices';

  private async getDb() {
    return getPostgresConnection();
  }

  async getDevice(userId: string, deviceId: string): Promise<NotificationDeviceRecord | null> {
    const db = await this.getDb();
    const row = await db(this.tableName)
      .where({ user_id: userId, device_id: deviceId, is_active: true })
      .first();
    return row ? toRecord(row as RawNotificationDeviceRow) : null;
  }

  async getDevicesByUserId(userId: string): Promise<NotificationDeviceRecord[]> {
    const db = await this.getDb();
    const rows = await db(this.tableName)
      .where({ user_id: userId, is_active: true })
      .orderBy('updated_at', 'desc');
    return rows.map((row) => toRecord(row as RawNotificationDeviceRow));
  }

  async getDevicesByToken(deviceToken: string): Promise<NotificationDeviceRecord[]> {
    const db = await this.getDb();
    const rows = await db(this.tableName).where({ device_token: deviceToken });
    return rows.map((row) => toRecord(row as RawNotificationDeviceRow));
  }

  async upsertDevice(
    record: Partial<NotificationDeviceRecord> & {
      userId: string;
      deviceId: string;
      deviceToken: string;
      platform: 'ios' | 'android';
    }
  ) {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const insertRow = {
      user_id: record.userId,
      device_id: record.deviceId,
      device_token: record.deviceToken,
      platform: record.platform,
      timezone: record.timezone ?? 'UTC',
      app_version: record.appVersion ?? null,
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
      is_active: true,
      last_seen_at: now,
      created_at: record.createdAt ?? now,
      updated_at: now,
    };

    return db(this.tableName)
      .insert(insertRow)
      .onConflict(['user_id', 'device_id'])
      .merge({
        device_token: insertRow.device_token,
        platform: insertRow.platform,
        timezone: insertRow.timezone,
        app_version: insertRow.app_version,
        metadata: insertRow.metadata,
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      })
      .returning('*');
  }

  async deleteDevice(userId: string, deviceId: string) {
    const db = await this.getDb();
    return db(this.tableName).where({ user_id: userId, device_id: deviceId }).del();
  }

  async deleteDevicesByToken(deviceToken: string) {
    const db = await this.getDb();
    return db(this.tableName).where({ device_token: deviceToken }).del();
  }

  async markInactiveByToken(deviceToken: string) {
    const db = await this.getDb();
    const now = new Date().toISOString();
    return db(this.tableName)
      .where({ device_token: deviceToken })
      .update({ is_active: false, last_seen_at: now, updated_at: now });
  }

  async getInactiveDevicesForCleanup(): Promise<NotificationDeviceRecord[]> {
    const db = await this.getDb();
    const rows = await db(this.tableName)
      .where(function () {
        this.where('is_active', false).andWhere(
          'updated_at',
          '<',
          db.raw("NOW() - INTERVAL '30 days'")
        );
      })
      .orWhere(function () {
        this.where('last_seen_at', '<', db.raw("NOW() - INTERVAL '180 days'"));
      });
    return rows.map((row) => toRecord(row as RawNotificationDeviceRow));
  }

  async deleteStaleDevices(): Promise<number> {
    const db = await this.getDb();
    const deletedCount = await db(this.tableName)
      .where(function () {
        this.where('is_active', false).andWhere(
          'updated_at',
          '<',
          db.raw("NOW() - INTERVAL '30 days'")
        );
      })
      .orWhere(function () {
        this.where('last_seen_at', '<', db.raw("NOW() - INTERVAL '180 days'"));
      })
      .del();
    return deletedCount;
  }
}
