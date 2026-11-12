import { addDays, format, parseISO } from "date-fns";

interface Address {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${month}/${day}/${year}`;
}

export const getDaysAgo = (updatedAt?: string, createdAt?: string): string => {
  // Use current date if no valid updatedAt or createdAt is provided
  const currentDate = new Date();

  // If updatedAt exists, use it; otherwise, use createdAt
  const dateToCompare = updatedAt
    ? new Date(updatedAt)
    : createdAt
      ? new Date(createdAt)
      : currentDate;

  // If the date is invalid, return a fallback string
  if (isNaN(dateToCompare.getTime())) {
    return "Invalid date";
  }

  // Calculate the difference in time and convert to days
  const diffTime = Math.abs(currentDate.getTime() - dateToCompare.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Return the result as a string
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
};

export function extractTimeFromIso(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  // Handles timezone offset, returns "HH:mm"
  return date.toISOString().slice(11, 16);
}

/**
 * Converts local task-shift boundaries to UTC ISO strings.
 * Local times: 7AM, 12PM, 7PM, next day 7AM.
 * Output format: "YYYY-MM-DDTHH:mm:ssZ"
 */
export function getTaskTimeBoundaries(date: string) {
  const toUtc = (localDate: Date) =>
    localDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  const [year, month, day] = date.split("-").map(Number);

  return {
    morning_start: toUtc(new Date(year, month - 1, day, 7, 0, 0)),
    morning_end: toUtc(new Date(year, month - 1, day, 12, 0, 0)),
    afternoon_end: toUtc(new Date(year, month - 1, day, 19, 0, 0)),
    evening_end: toUtc(new Date(year, month - 1, day + 1, 7, 0, 0)),
  };
}

export const splitISOToDateTime = (
  iso?: string,
): {
  date: string;
  time: string;
} => {
  if (!iso || typeof iso !== "string") return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };

  // Use LOCAL date/time so edit form shows the same time user entered.
  // (toISOString() forces UTC and can shift hours based on timezone.)
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const yyyyMmDd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hhMm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  return { date: yyyyMmDd, time: hhMm };
};

// Function to fix incorrect timing format
export const fixTimingFormat = (timing) => {
  const parts = timing?.split(":");

  // If there are more than 3 parts (e.g., 11:54:00:00), take only the first three
  if (parts?.length > 3) {
    return parts?.slice(0, 3)?.join(":"); // Keep only HH:mm:ss
  }

  return timing; // Return original if already correct
};
// Build a UTC ISO timestamp for the selected calendar date.
// Uses local noon so the stored instant's date is the selected day in BOTH
// UTC and local time for every real timezone (UTC-12..UTC+12). Using the
// current UTC time could land on the previous local day for negative offsets.
export const getSelectedDateTimeIso = (date: string): string => {
  const selected = new Date(`${date}T12:00:00`);
  return selected.toISOString();
};

//This is the Time Options from 8AM to 8PM in 30 minutes interval
export const timeOptions = Array.from({ length: 25 }, (_, index) => {
  const hour = 8 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";

  const valueHour = hour?.toString().padStart(2, "0");
  const value = `${valueHour}:${minute}:00`;

  const displayHour = ((hour - 1) % 12) + 1;
  const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
  const option = `${displayHour
    ?.toString()
    .padStart(2, "0")}:${minute} ${suffix}`;

  return { option, value };
});

// Time options from 12:00 AM to 11:30 PM in 30-minute intervals
export const timeOptions24H = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2); // 0 to 23
  const minute = index % 2 === 0 ? "00" : "30";

  // Value in 24-hour format for forms/inputs
  const valueHour = hour.toString().padStart(2, "0");
  const value = `${valueHour}:${minute}:00`;

  // Display in 12-hour format with AM/PM
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  const option = `${displayHour.toString().padStart(2, "0")}:${minute} ${suffix}`;

  return { option, value };
});

export const dateFormat = (date) => {
  if (!date || typeof date !== "string" || !date.includes("-")) {
    // Return some default or error value
    return date;
  }

  const [year, month, day] = date?.split("-");

  if (!year || !month || !day) {
    return date;
  }

  const newDateFormat = `${month}/${day}/${year}`;
  return newDateFormat;
};

/**
 * Returns the UTC shift time range for a given week start date.
 * The range starts at 4:00 AM UTC on the start date,
 * and ends at 3:59:59.999 AM UTC on the following Monday (end of Sunday night).
 *
 * @param copyFromWeek - A string representing the start of the week (e.g., Monday)
 * @returns A tuple [startISO, endISO] as ISO strings
 */
export function getCopyWeekRange(copyFromWeek: string): [string, string] {
  const start = new Date(copyFromWeek);
  const end = addDays(start, 7);

  const startISO = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      4,
      0,
      0,
      0,
    ),
  ).toISOString();

  const endISO = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      3,
      59,
      59,
      999,
    ),
  ).toISOString();

  return [startISO, endISO];
}

export function getUtcDateTimeString(date: Date, time: string): string {
  const [hours, minutes, seconds] = time.split(":").map(Number);

  // Create new date object with time added
  const localDateTime = new Date(date);
  localDateTime?.setHours(hours, minutes, seconds || 0, 0);

  // Convert to UTC ISO string
  return localDateTime?.toISOString();
}

export function getYYYYMMDDString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // e.g., "2025-05-30"
}

export const timeFormat = (data: string): string => {
  const time24Hour = data;

  // Validate input to ensure it's a valid time string in the format HH:mm
  if (
    !time24Hour ||
    typeof time24Hour !== "string" ||
    !time24Hour.includes(":")
  ) {
    return data; // Or return an appropriate error message
  }

  // Split the time into hours and minutes
  const [hours, minutes] = time24Hour?.split(":");

  // Check if split was successful (i.e., we have two parts: hours and minutes)
  if (!hours || !minutes) {
    return data; // Return error if the format is incorrect
  }

  // Convert to 12-hour format
  let period = "AM";
  let hours12 = parseInt(hours, 10);

  if (hours12 >= 12) {
    period = "PM";
    if (hours12 > 12) {
      hours12 -= 12; // Convert hours above 12 PM (e.g., 13:00 -> 1:00 PM)
    }
  } else if (hours12 === 0) {
    hours12 = 12; // Handle midnight (00:00 -> 12:00 AM)
  }

  // Format and return the 12-hour time
  const time12Hour = `${hours12}:${minutes} ${period}`;
  return time12Hour;
};

export const timeArrayFormat = (times: string[] = []): string => {
  return times?.map(timeFormat).join(", ");
};

// Helper function to omit specific keys from an object
export const omit = (obj: any, keysToOmit: string[]) => {
  return (
    obj &&
    Object.fromEntries(
      Object.entries(obj).filter(([key]) => !keysToOmit?.includes(key)),
    )
  );
};

export function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = (now.getTime() - past.getTime()) / 1000;

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;

  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
}

/**
 * Converts an ISO string in UTC/ETC to local time formatted as "MM-DD-YYYY h:mm A"
 * @param isoUtcString ISO string in UTC (e.g., "2025-06-30T22:20:00Z")
 * @returns Formatted local time string like "  M"
 */
export function formatUtcToLocalDisplay(isoUtcString: string): string {
  if (!isoUtcString) return "—";
  const date = parseISO(isoUtcString);
  if (!date.getTime()) return "—";

  return format(date, "MM/dd/yyyy h:mm a");
}
/**
 * Calculates the age based on a birth date string in ISO format.
 * @param birthDateString - The birth date in ISO format (e.g., "1990-01-01").
 * @returns The age in years, or null if the input is invalid.
 */
export function calculateAge(birthDateString: string): number | null {
  if (!birthDateString) return null;
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return null; // invalid date

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function formatIsoToLocalTime(isoString: string): string {
  if (!isoString) return "—";
  const date = parseISO(isoString);
  if (isNaN(date.getTime())) return "—";
  return format(date, "h:mm a");
}

export function formatIsoToDate(isoString: string): string {
  if (!isoString) return "—";
  const date = parseISO(isoString);
  if (isNaN(date.getTime())) return "—";
  return format(date, "MM/dd/yyyy");
}

export function formatToShortDateRangeForPayStub(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return "—";

  const parseDate = (value: string) => {
    const v = String(value).trim();
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      return new Date(y, mo - 1, d);
    }
    return new Date(v);
  };

  const startDate = parseDate(startIso);
  const endDate = parseDate(endIso);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "—";

  const startMonthDay = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(startDate);

  const endMonthDayYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(endDate);

  return `${startMonthDay} - ${endMonthDayYear}`;
}

export function formatAddress(address?: Address): string {
  if (!address) return "—";

  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "—";
}

/**
 * Formats date range to match the required ISO format with specific times
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Array of formatted ISO strings: ['YYYY-MM-DDT04:00:00.000Z', 'YYYY-MM-DDT03:59:59.999Z']
 */
export const formatDateRange = (
  startDate?: string,
  endDate?: string,
): string[] => {
  if (!startDate || !endDate) return [];

  try {
    // Parse the dates and set proper times
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn("Invalid date values provided to formatDateRange:", {
        startDate,
        endDate,
      });
      return [];
    }

    start.setHours(4, 0, 0, 0); // 04:00:00.000Z
    end.setHours(3, 59, 59, 999); // 03:59:59.999Z

    return [start.toISOString(), end.toISOString()];
  } catch (error) {
    console.error("Error formatting date range:", error, {
      startDate,
      endDate,
    });
    return [];
  }
};
