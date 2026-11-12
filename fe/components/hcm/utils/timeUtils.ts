// utils/timeUtils.ts
import { parseISO, format, differenceInMinutes, isValid, startOfWeek, isBefore, addDays, isAfter, isSameDay } from "date-fns";

export const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return "--:--";
  const date = parseISO(timestamp);
  return isValid(date) ? format(date, "h:mm a") : "--:--";
};

/**
 * Converts an ISO 8601 string to a local time string in "HH:mm:ss" format.
 * Optionally trims seconds if includeSeconds is false.
 * @param isoString ISO formatted datetime string
 * @param includeSeconds Whether to include seconds in the output (default: true)
 * @returns Time string like "14:30" or "14:30:00"
 */
export function getLocalTimeString(isoString: string, includeSeconds: boolean = true): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");

  return includeSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
}


/**
 * Generates time options from 12:00 AM to 12:00 PM in 15-minute intervals.
 * Each option has a display label and a value in "HH:mm:ss" format.
 */
export const scheduleTimeOptions = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const value = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;

  const label = new Date(0, 0, 0, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  return { option: label, value };
});

export const getShiftDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes, seconds = 0] = timeStr.split(":").map(Number);
  const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
  return dateObj.toISOString();
};




export const processShiftTimes = (shift: {
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
}) => {
  const { clock_in_timestamp = null, clock_out_timestamp = null, shift_start_time, shift_end_time } = shift || {};

  const clockIn = clock_in_timestamp ? parseISO(clock_in_timestamp) : null;
  const clockOut = clock_out_timestamp ? parseISO(clock_out_timestamp) : null;
  const shiftStart = shift_start_time ? parseISO(shift_start_time) : null;
  const shiftEnd = shift_end_time ? parseISO(shift_end_time) : null;

  const workedTimeDisplay = `${formatTime(clock_in_timestamp)} – ${formatTime(clock_out_timestamp)}`;
  const scheduledTimeDisplay = `${formatTime(shift_start_time)} – ${formatTime(shift_end_time)}`;

  let timeDifference: string | null = null;

  if (clockIn && clockOut && shiftStart && shiftEnd) {
    const actualMinutes = differenceInMinutes(clockOut, clockIn);
    const scheduledMinutes = differenceInMinutes(shiftEnd, shiftStart);
    const diff = actualMinutes - scheduledMinutes;
    const absDiff = Math.abs(diff);
    const hrs = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    const formattedDiff = `${hrs > 0 ? `${hrs} hr${hrs > 1 ? "s" : ""} ` : ""}${mins} min`;

    timeDifference = diff > 0 ? `${formattedDiff} over scheduled time` : diff == 0 ? null : `${formattedDiff} under scheduled time`;
  }

  return {
    workedTimeDisplay,
    scheduledTimeDisplay,
    timeDifference,
  };
};

/**
 * Given AVAILABLE shifts for a week, compute how many minutes are NOT assigned
 * for each day in that week. Uses day window [00:00:00, 23:59:00] (minute resolution).
 *
 * @param weekStartISO - Any ISO date within the target week (snapped to Monday)
 * @param shifts - Array of AVAILABLE shifts for that week
 *                 { shift_start_time: string|null, shift_end_time: string|null }
 * @returns {
 *   missingByDate: [{ date: 'YYYY-MM-DD', minutes: number, display: string }],
 *   missingDates:  string[], // only days with gaps
 *   weeklyMissingMinutes: number,
 *   weeklyMissingDisplay: string
 * }
 */
export const processMissingSchedulesByDay = (
  weekStartISO: string,
  shifts: { shift_start_time: string | null; shift_end_time: string | null }[] | null | undefined
) => {
  // Helpers (kept inside like your reference util)
  const fmtYMD = (d: Date) => format(d, "yyyy-MM-dd");
  const fmtPretty = (d: Date) => format(d, "EEE, MMM d");
  const fmtMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} hr${h !== 1 ? "s" : ""}${m ? ` ${m} min` : ""}` : `${m} min`;
  };

  const weekStart = startOfWeek(parseISO(weekStartISO), { weekStartsOn: 1 }); // Monday

  // Pre-parse & validate (assumes input already filtered to AVAILABLE)
  const parsed = (shifts ?? [])
    .filter((s): s is { shift_start_time: string; shift_end_time: string } => !!s?.shift_start_time && !!s?.shift_end_time)
    .map((s) => ({ start: parseISO(s.shift_start_time), end: parseISO(s.shift_end_time) }))
    .filter(({ start, end }) => isValid(start) && isValid(end) && !isBefore(end, start));

  const missingByDate: { date: string; minutes: number; display: string }[] = [];
  const missingDates: string[] = [];
  let weeklyMissingMinutes = 0;

  for (let i = 0; i < 7; i++) {
    const base = addDays(weekStart, i);

    // 00:00:00.000
    const dayStart = new Date(base);
    dayStart.setHours(0, 0, 0, 0);

    // 23:59:00.000 — minute resolution end
    const dayEndMinute = new Date(base);
    dayEndMinute.setHours(23, 59, 0, 0);

    // For duration math, treat end as exclusive at +1 minute (so a full day is 1440 minutes)
    const dayEndExclusive = new Date(dayEndMinute.getTime() + 60 * 1000);

    // Overlap if start <= dayEndMinute AND end >= dayStart (inclusive window on minutes)
    const overlaps = parsed
      .filter(({ start, end }) => !isAfter(start, dayEndMinute) && !isBefore(end, dayStart))
      .map(({ start, end }) => ({
        // clamp to [dayStart, dayEndMinute]
        start: new Date(Math.max(start.getTime(), dayStart.getTime())),
        end: new Date(Math.min(end.getTime(), dayEndMinute.getTime())),
      }))
      .filter(({ start, end }) => isBefore(start, end)) // keep positive-length
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let coveredUntil = dayStart;
    let missingMinutesForDay = 0;

    if (overlaps.length === 0) {
      // Whole day uncovered: [00:00, 24:00) -> 1440 minutes
      missingMinutesForDay = differenceInMinutes(dayEndExclusive, dayStart);
    } else {
      for (const { start, end } of overlaps) {
        // Gap before this shift
        if (isAfter(start, coveredUntil)) {
          missingMinutesForDay += differenceInMinutes(start, coveredUntil);
        }
        // Extend coverage
        if (isAfter(end, coveredUntil)) coveredUntil = end;

        // Already at/past end?
        if (!isBefore(coveredUntil, dayEndMinute)) break;
      }
      // Gap after last shift
      if (isBefore(coveredUntil, dayEndMinute)) {
        missingMinutesForDay += differenceInMinutes(dayEndExclusive, coveredUntil);
      }
    }

    const dateStr = fmtYMD(dayStart);
    weeklyMissingMinutes += missingMinutesForDay;
    missingByDate.push({
      date: dateStr,
      minutes: missingMinutesForDay,
      display: fmtMinutes(missingMinutesForDay),
    });
    if (missingMinutesForDay > 0) missingDates.push(dateStr);
  }

  return {
    missingByDate, // all 7 days with minutes + pretty label
    missingDates,  // only the dates with >0 minutes missing
    weeklyMissingMinutes,
    weeklyMissingDisplay: fmtMinutes(weeklyMissingMinutes),
  };
};



type Shift = {
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;

  pay_rate: string | null;
  pay_frequency: string | null;

  shift_start_time?: string;
  shift_end_time?: string;
};

export function calculateTotalWorkedHours(shifts: Shift[]): number {

  if (!Array.isArray(shifts) || shifts.length === 0) {
    return 0; // Return 0 if shifts is not an array or is empty
  }
  let totalMilliseconds = 0;

  for (const shift of shifts) {
    const { clock_in_timestamp, clock_out_timestamp } = shift;

    if (clock_in_timestamp && clock_out_timestamp) {
      const clockIn = new Date(clock_in_timestamp);
      const clockOut = new Date(clock_out_timestamp);

      if (!isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime())) {
        // If clock-out is before clock-in, assume it's the next day
        // if (clockOut.getTime() <= clockIn.getTime()) {
        //   clockOut.setDate(clockOut.getDate() + 1);
        // }
        const diff = clockOut.getTime() - clockIn.getTime();

        if (diff > 0) {
          totalMilliseconds += diff;
        }
      }
    }
  }

  const totalHours = totalMilliseconds / (1000 * 60 * 60);
  return Math.round(totalHours * 100) / 100
}

export function calculateTotalScheduledHours(shifts: any): number {
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return 0; // Return 0 if shifts is not an array or is empty
  }
  let totalMilliseconds = 0;

  for (const shift of shifts) {
    const { shift_start_time, shift_end_time } = shift;

    if (shift_start_time && shift_end_time) {
      const clockIn = new Date(shift_start_time);
      const clockOut = new Date(shift_end_time);

      if (!isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime())) {
        // If clock-out is before clock-in, assume it's the next day
        // if (clockOut.getTime() <= clockIn.getTime()) {
        //   clockOut.setDate(clockOut.getDate() + 1);
        // }
        const diff = clockOut.getTime() - clockIn.getTime();

        if (diff > 0) {
          totalMilliseconds += diff;
        }
      }
    }
  }

  const totalHours = totalMilliseconds / (1000 * 60 * 60);
  return Math.round(totalHours * 100) / 100;
}

//This function will take start and end ISO date strings and return the difference in hours, rounded to two decimal places.
export function getHoursDifference(startISO: string, endISO: string): number {

  const start = new Date(startISO);
  const end = new Date(endISO);

  if (!start.getTime() || !end.getTime()) return 0;



  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60); // ms to hours

  return Math.round(diffHours * 100) / 100; // e.g., 4.5
}




export function calculateTotalWages(shifts, overridePayRate?: string | number) {
  let totalWage = 0;

  if (!Array.isArray(shifts) || shifts.length === 0) {
    return 0; // Return 0 if shifts is not an array or is empty 
  }

  for (const shift of shifts) {
    let { clock_in_timestamp, clock_out_timestamp, pay_rate, pay_frequency } = shift;

    if (overridePayRate !== undefined) {
      pay_rate = overridePayRate;
    }
    // Do not calculate wages for monthly paid shifts
    if (pay_frequency?.toLowerCase() === "monthly") {
      continue;
    }

    pay_rate = parseFloat(pay_rate.replace(/[^0-9.-]+/g, ""));
    const start = new Date(clock_in_timestamp);
    const end = new Date(clock_out_timestamp);

    if (
      !start.getTime() ||
      !end.getTime() ||
      typeof pay_rate !== 'number'
    ) {
      continue;
    }

    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.round(hours * 100) / 100;
    const wage = roundedHours * pay_rate;

    totalWage += wage;
  }

  return Math.round(totalWage * 100) / 100;
}

export function calculateScheduledTotalWages(shifts) {
  let totalWage = 0;

  if (!Array.isArray(shifts) || shifts.length === 0) {
    return 0; // Return 0 if shifts is not an array or is empty
  }

  for (const shift of shifts) {
    let { shift_start_time, shift_end_time, pay_rate } = shift;

    pay_rate = parseFloat(pay_rate.replace(/[^0-9.-]+/g, ""));
    const start = new Date(shift_start_time);
    const end = new Date(shift_end_time);

    if (
      !start.getTime() ||
      !end.getTime() ||
      typeof pay_rate !== "number"
    ) {
      continue;
    }

    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.round(hours * 100) / 100;
    const wage = roundedHours * pay_rate;

    totalWage += wage;
  }

  return Math.round(totalWage * 100) / 100;
}


// This function takes ISO string and returns the date in this format: "Mon, Jan 1"
export function formatToLocalLongDate(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '—'; // or 'Invalid Date' or ''

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// This function takes ISO string and returns the date in this format: "Mon, Jan 1"
export function formatToLongDate(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '—'; // or 'Invalid Date' or ''

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getUtcDateTimeString(date: Date, time: string): string {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const localDateTime = new Date(date);
  localDateTime.setHours(hours, minutes, seconds || 0, 0);
  return localDateTime.toISOString();
}

export function getNumberOfTimeCards(shifts: Shift[]): number {
  return shifts.reduce((count, shift) => {
    if (shift?.clock_in_timestamp && shift?.clock_out_timestamp) {
      return count + 1;
    }
    return count;
  }, 0);
}


export function formatToDateWithTime(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '—';
  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return '—';
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric', hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return formatted.replace(',', '');
}

// Check if a shift is overnight
export const isOvernightShift = (shift: any) => {
  if (!shift?.shift_start_time || !shift?.shift_end_time) return false;
  const start = new Date(shift.shift_start_time);
  let end = new Date(shift.shift_end_time);
  if (end <= start) end = addDays(end, 1); // if end time is before start time, it crosses midnight
  return !isSameDay(start, end);
};

export function calculateShiftWage(
  shift: Shift,
  overridePayRate?: string | number,
) {
  let {
    pay_rate,
    clock_in_timestamp,
    clock_out_timestamp,
    pay_frequency,
  } = shift;

  if (overridePayRate !== undefined) {
    pay_rate = String(overridePayRate);
  }

  if (
    pay_frequency?.toLowerCase() === "monthly"
  ) {
    return null;
  }

  if (
    !pay_rate ||
    !clock_in_timestamp ||
    !clock_out_timestamp
  ) {
    return null;
  }

  const rate = parseFloat(
    String(pay_rate).replace(/[^0-9.-]+/g, ""),
  );

  const hours = getHoursDifference(
    clock_in_timestamp,
    clock_out_timestamp,
  );

  return Math.round(hours * rate * 100) / 100;
}