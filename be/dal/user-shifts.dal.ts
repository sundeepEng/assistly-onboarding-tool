import { z } from 'zod';
import { Knex } from 'knex';
import { getPostgresConnection } from '../utils/postgres-client';
import { updateUserShiftSchema } from '../models/HCM/user-shifts.model';

export class UserShiftsDAL {
  private tableName: string;

  constructor() {
    this.tableName = `user_shifts_${process.env.STAGE!}`;
  }

  /**
   * Fetches all shifts for all users.
   * @return An array of shifts associated with all users.
   * @throws {Error} If there is an error during the database query.
   */

  async getAllShifts(
    filters?: Partial<z.infer<typeof updateUserShiftSchema>>,
    trx?: Knex,
    options?: { forUpdate?: boolean }
  ) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const query = postgresDB(this.tableName).select('*');

      //#region Filters
      if (filters?.id) {
        query.where('id', filters.id);
      }

      if (filters?.user_id) {
        if (Array.isArray(filters.user_id)) {
          query.whereIn('user_id', filters.user_id);
        } else {
          query.where('user_id', filters.user_id);
        }
      }

      if (filters?.home_id) {
        if (Array.isArray(filters.home_id)) {
          query.whereIn('home_id', filters.home_id);
        } else {
          query.where('home_id', filters.home_id);
        }
      }

      if (filters?.shift_status) {
        if (Array.isArray(filters.shift_status)) {
          query.whereIn('shift_status', filters.shift_status);
        } else {
          query.where('shift_status', filters.shift_status);
        }
      }

      if (filters?.is_unavailability_approved !== undefined) {
        query.where('is_unavailability_approved', filters.is_unavailability_approved);
      }

      if (filters?.isOverlap !== undefined) {
        query.where('isOverlap', filters.isOverlap);
      }

      // Date range filtering
      if (filters?.shift_start_time && filters?.shift_end_time) {
        query.andWhere((builder) => {
          builder
            .where('shift_start_time', '<=', `${filters.shift_end_time} 23:59:59` as string)
            .andWhere('shift_end_time', '>=', `${filters.shift_start_time} 00:00:00` as string);
        });
      } else if (filters?.shift_start_time != null) {
        if (Array.isArray(filters?.shift_start_time)) {
          query.whereBetween('shift_start_time', [
            filters?.shift_start_time[0],
            filters?.shift_start_time[1],
          ]);
        } else {
          const shiftStartTimeBegin = `${filters.shift_start_time} 00:00:00`;
          const shiftStartTimeEnd = `${filters.shift_start_time} 23:59:59`;
          query.whereBetween('shift_start_time', [shiftStartTimeBegin, shiftStartTimeEnd]);
        }
      }

      if (filters?.clock_in_timestamp != null && filters.clock_out_timestamp != null) {
        query.andWhere((builder) => {
          builder
            .where('clock_in_timestamp', '<=', `${filters.clock_out_timestamp} 23:59:59` as string)
            .andWhere(
              'clock_out_timestamp',
              '>=',
              `${filters.clock_in_timestamp} 00:00:00` as string
            );
        });
      } else if (filters?.clock_in_timestamp != null) {
        const clockInTimestampStart = `${filters.clock_in_timestamp} 00:00:00`;
        const clockInTimestampEnd = `${filters.clock_in_timestamp} 23:59:59`;
        query.whereBetween('clock_in_timestamp', [clockInTimestampStart, clockInTimestampEnd]);
      } else if (filters?.clock_out_timestamp != null) {
        const clockOutTimestampStart = `${filters.clock_out_timestamp} 00:00:00`;
        const clockOutTimestampEnd = `${filters.clock_out_timestamp} 23:59:59`;
        query.whereBetween('clock_out_timestamp', [clockOutTimestampStart, clockOutTimestampEnd]);
      }

      //#endregion

      if (options?.forUpdate) {
        query.forUpdate();
      }

      return await query.orderBy('shift_start_time', 'asc');
    } catch (err) {
      console.error(`{path: user-shift-dal, function: getAllShifts, error: ${err as Error}}`);
      throw err as Error;
    }
  }

  /**
   * Fetches all shifts for a given user on a specific date (including midnight-spanning shifts).
   * @param userId The ID of the user whose shifts are to be fetched.
   * @param shiftDate The date in YYYY-MM-DD format.
   * @return An array of shifts associated with the user on that date.
   * @throws {Error} If there is an error during the database query.
   */
  async getShiftsByUserAndDate(
    userId: string,
    shiftDate: string,
    trx?: Knex,
    options?: { forUpdate?: boolean; excludeShiftId?: number }
  ) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const query = postgresDB(this.tableName)
        .select('*')
        .where('user_id', userId)
        .andWhere((builder) => {
          builder
            .whereRaw('??::date = ?', ['shift_start_time', shiftDate])
            .orWhereRaw('??::date = ?', ['shift_end_time', shiftDate]);
        });

      if (options?.excludeShiftId) {
        query.andWhere('id', '!=', options.excludeShiftId);
      }

      if (options?.forUpdate) {
        query.forUpdate();
      }

      return await query.orderBy('shift_start_time', 'asc');
    } catch (err) {
      console.error(
        `{path: user-shift-dal, function: getShiftsByUserAndDate, error: ${err as Error}}`
      );
      throw err as Error;
    }
  }

  /**
   * Fetches all shifts for a given user.
   * @param userId The ID of the user whose shifts are to be fetched.
   * @return An array of shifts associated with the user.
   * @throws {ZodError} If the userId is not a valid UUID.
   * @throws {Error} If there is an error during the database query.
   */
  async geShiftsByUserID(userId: string) {
    const userIDvalidation = z.string().uuid();

    try {
      userIDvalidation.parse(userId);
      const postgresDB = await getPostgresConnection();
      const userShifts = await postgresDB(this.tableName)
        .select('*')
        .where({ user_id: userId })
        .orderBy('shift_start_time', 'asc');
      return userShifts?.length ? userShifts : [];
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(`{path: user-shift-dal, function: geShiftsByUserID, error: ${err.errors}}`);
        throw err.errors;
      }
      console.error(`{path: user-shift-dal, function: getAllShifts, error: ${err as Error}}`);
      throw err as Error;
    }
  }

  /**
   * Creates a new shift for the user.
   * @param shift The shift data to be created.
   * @throws {Error} If there is an error during the database query.
   * @returns
   */
  async createShift(shift: Record<string, any> | Record<string, any>[], trx?: Knex) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const newShift = await postgresDB(this.tableName).insert(shift).returning('*');
      return newShift;
    } catch (err) {
      console.error(`{path: user-shift-dal, method: createShift, error: ${err as Error}}`);
      throw err as Error;
    }
  }

  /**
   * Updates an existing shift for the user.
   * @param id The ID of the shift to be updated.
   * @param shiftData
   * @returns updated shift data
   * @throws {Error} If there is an error during the database query.
   * @throws {ZodError} If the userId is not a valid UUID.
   */
  async updateShift(shiftId: number, shiftData: Record<string, any>, trx?: Knex) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const updatedShift = await postgresDB(this.tableName)
        .where({ id: shiftId })
        .update(shiftData)
        .returning('*');

      return updatedShift;
    } catch (err) {
      console.error('Error updating shift', err as Error);
      throw err as Error;
    }
  }

  /**
   * Deletes a shift for the user.
   * @param shiftId The ID of the shift to be deleted.
   * @returns The deleted shift data.
   * @throws {Error} If there is an error during the database query.
   */
  async deleteShift(shiftId: number, trx?: Knex) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());

      const deletedShift = await postgresDB(this.tableName)
        .where({ id: shiftId })
        .del()
        .returning('*');
      return deletedShift;
    } catch (err) {
      console.error('Error deleting shift', err as Error);
      throw err as Error;
    }
  }

  async deleteShiftsByUserId(userId: string, shiftStartTime: string) {
    try {
      const postgresDB = await getPostgresConnection();
      const deletedShifts = await postgresDB(this.tableName)
        .where('user_id', userId)
        .andWhere('shift_start_time', '>=', shiftStartTime)
        .del()
        .returning('*');

      return;
    } catch (err) {
      console.error('Error deleting shifts for the user', err as Error);
      throw err as Error;
    }
  }

  /**
   * Checks if a shift overlaps with existing shifts for a user.
   * @param userId The ID of the user.
   * @param shiftStartTime The start time of the shift to check.
   * @param shiftEndTime The end time of the shift to check.
   * @returns {boolean} True if there is an overlap, false otherwise.
   * @throws {Error} If there is an error during the database query.
   */
  async checkShiftOverLap(
    userId: string,
    shiftStartTime: string,
    shiftEndTime: string,
    excludeShiftId?: number, // Optional parameter for update scenario
    trx?: Knex
  ) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const query = postgresDB(this.tableName)
        .where('user_id', userId)
        .andWhere((builder) => {
          builder
            .where('shift_start_time', '<', shiftEndTime)
            .andWhere('shift_end_time', '>', shiftStartTime);
        })
        .andWhere((builder) => {
          builder.where('shift_status', 'available').orWhere((subBuilder) => {
            subBuilder
              .whereIn('shift_status', ['timeoff', 'vacation'])
              .andWhere('is_unavailability_approved', true);
          });
        });

      // If updating, exclude the current shift from overlap check
      if (excludeShiftId) {
        query.andWhere('id', '!=', excludeShiftId);
      }

      console.info(
        `DEBUG DAL - Checking overlap for userId=${userId}, start=${shiftStartTime}, end=${shiftEndTime}, excludeId=${excludeShiftId}`
      );

      const overlapExists = await query.first();

      console.info(
        `DEBUG DAL - Overlap found: ${overlapExists ? 'YES' : 'NO'}, overlapShift=${JSON.stringify(overlapExists)}`
      );

      return overlapExists ? true : false;
    } catch (err) {
      console.error('Failed to check shift overlap', err as Error);
      throw err as Error;
    }
  }

  /**
   * Checks if there is an existing timeoff or vacation shift for the same user
   * that overlaps with the given time range. This check is independent of approval status
   * and is used to prevent duplicate timeoff/vacation requests for the same time.
   */
  async checkTimeoffVacationOverlap(
    userId: string,
    shiftStartTime: string,
    shiftEndTime: string,
    excludeShiftId?: number,
    trx?: Knex
  ) {
    try {
      const postgresDB = trx ?? (await getPostgresConnection());
      const query = postgresDB(this.tableName)
        .where('user_id', userId)
        .whereIn('shift_status', ['timeoff', 'vacation'])
        .andWhere((builder) => {
          builder
            .where('shift_start_time', '<', shiftEndTime)
            .andWhere('shift_end_time', '>', shiftStartTime);
        });

      // If updating, exclude the current shift from overlap check
      if (excludeShiftId) {
        query.andWhere('id', '!=', excludeShiftId);
      }

      console.info(
        `DEBUG DAL - Checking timeoff/vacation overlap for userId=${userId}, start=${shiftStartTime}, end=${shiftEndTime}, excludeId=${excludeShiftId}`
      );

      const overlapExists = await query.first();

      console.info(
        `DEBUG DAL - Timeoff/vacation overlap found: ${overlapExists ? 'YES' : 'NO'}, overlapShift=${JSON.stringify(overlapExists)}`
      );

      return overlapExists ? true : false;
    } catch (err) {
      console.error('Failed to check timeoff/vacation overlap', err as Error);
      throw err as Error;
    }
  }
}
