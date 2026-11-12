import { Knex } from 'knex';
import { UserShiftsDAL } from '../../dal/user-shifts.dal';

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();

export interface ShiftOverlapInput {
  id?: number;
  user_id?: string;
  shift_start_time: string;
  shift_end_time: string;
  shift_status?: string;
  is_unavailability_approved?: boolean | null;
  isOverlap?: boolean;
  [key: string]: any;
}

/**
 * Checks if two shifts overlap.
 */
export const shiftsOverlap = (shiftA: ShiftOverlapInput, shiftB: ShiftOverlapInput): boolean => {
  const startA = new Date(shiftA.shift_start_time).getTime();
  const endA = new Date(shiftA.shift_end_time).getTime();
  const startB = new Date(shiftB.shift_start_time).getTime();
  const endB = new Date(shiftB.shift_end_time).getTime();

  return startA < endB && endA > startB;
};

/**
 * Determines whether a shift counts as occupied time for overlap detection.
 * Available shifts are always occupied. Timeoff/vacation shifts count only
 * when explicitly approved (is_unavailability_approved === true).
 * Pending (null/undefined) and rejected (false) timeoff/vacation are ignored.
 */
export const isOccupiedShift = (shift: ShiftOverlapInput): boolean => {
  if (shift.shift_status === 'available') return true;

  if (shift.shift_status === 'timeoff' || shift.shift_status === 'vacation') {
    return shift.is_unavailability_approved === true;
  }

  return true;
};

/**
 * Determines the overlap priority of a shift.
 * Approved timeoff/vacation has the highest priority (0) because it represents
 * confirmed unavailability. Available shifts share priority 1.
 * Pending, rejected, and non-occupied shifts are excluded from priority.
 */
const getOverlapPriority = (shift: ShiftOverlapInput): number => {
  if (shift.is_unavailability_approved === true) return 0;
  return 1;
};

/**
 * Re-evaluates isOverlap for a list of shifts.
 * Only occupied shifts participate in overlap detection.
 * Approved timeoff/vacation shifts are treated as canonical (highest priority).
 * Within the same priority, first shift by start time is isOverlap: false.
 * Subsequent occupied shifts are isOverlap: true if they overlap with any previous occupied shift.
 * Non-occupied shifts (e.g., rejected timeoff/vacation) are always isOverlap: false.
 */
export const computeOverlapFlags = (shifts: ShiftOverlapInput[]): ShiftOverlapInput[] => {
  const sortedShifts = [...shifts].sort((a, b) => {
    const priorityDiff = getOverlapPriority(a) - getOverlapPriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(a.shift_start_time).getTime() - new Date(b.shift_start_time).getTime();
  });

  return sortedShifts.map((currentShift, index) => {
    if (!isOccupiedShift(currentShift)) {
      return { ...currentShift, isOverlap: false };
    }

    const previousOccupiedShifts = sortedShifts.slice(0, index).filter(isOccupiedShift);

    if (previousOccupiedShifts.length === 0) {
      return { ...currentShift, isOverlap: false };
    }

    const overlapsWithPrevious = previousOccupiedShifts.some((previousShift) =>
      shiftsOverlap(currentShift, previousShift)
    );

    return { ...currentShift, isOverlap: overlapsWithPrevious };
  });
};

/**
 * Fetches all shifts for a user on a given date (including shifts that span midnight).
 * When a transaction is provided, rows are locked with FOR UPDATE to prevent concurrent modifications.
 */
export const getSameDayShifts = async (
  userId: string,
  shiftDate: string,
  excludeShiftId?: number,
  trx?: Knex
): Promise<ShiftOverlapInput[]> => {
  return await userShiftsDAL.getShiftsByUserAndDate(userId, shiftDate, trx, {
    forUpdate: !!trx,
    excludeShiftId,
  });
};

/**
 * Re-evaluates overlaps for all shifts on the same day as the provided shift,
 * and persists any changes to the database.
 * Optionally accepts an extra shift (e.g., the updated/new version) to include in the evaluation.
 */
export const reevaluateAndPersistOverlaps = async (
  userId: string,
  shiftDate: string,
  options?: {
    excludeShiftId?: number;
    includeShift?: ShiftOverlapInput;
  },
  trx?: Knex
): Promise<ShiftOverlapInput[]> => {
  let sameDayShifts = await getSameDayShifts(userId, shiftDate, options?.excludeShiftId, trx);

  if (options?.includeShift) {
    sameDayShifts.push(options.includeShift);
  }

  if (sameDayShifts.length === 0) {
    return [];
  }

  const reevaluatedShifts = computeOverlapFlags(sameDayShifts);

  for (const shift of reevaluatedShifts) {
    if (shift.id === undefined) continue;

    const originalShift = sameDayShifts.find((s) => s.id === shift.id);
    const originalIsOverlap = originalShift?.isOverlap ?? false;
    const newIsOverlap = shift.isOverlap ?? false;
    if (originalShift && originalIsOverlap !== newIsOverlap) {
      await userShiftsDAL.updateShift(
        shift.id,
        {
          isOverlap: newIsOverlap,
          updated_at: new Date().toISOString(),
        },
        trx
      );
      console.info(
        `Reevaluate overlaps: Shift ${shift.id} isOverlap changed from ${originalIsOverlap} to ${newIsOverlap}`
      );
    }
  }

  return reevaluatedShifts;
};
