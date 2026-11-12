// components/DateRangeInput.tsx
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ErrorIcon from "../../../public/icons/error-icon";

type DateRange = {
  start: Date | null;
  end: Date | null;
};

interface DateRangeInputProps {
  /** Maximum number of days allowed in a range selection */
  maxRangeDays?: number;
  /** Minimum number of days allowed in a range selection */
  minRangeDays?: number;
  /** Number of years to show before current year */
  yearsBeforeCurrent?: number;
  /** Number of years to show after current year */
  yearsAfterCurrent?: number;
  /** Locale for date formatting */
  locale?: string;
  /** The currently selected date range */
  value: DateRange;
  /** Callback when date range changes */
  onChange: (range: DateRange) => void;
}

const DateRangeInput: React.FC<DateRangeInputProps> = ({
  maxRangeDays = Infinity,
  minRangeDays = 1,
  yearsBeforeCurrent = 20, // Increased from 3 to 20 years before current
  yearsAfterCurrent = 10, // Increased from 3 to 10 years after current
  locale = "en-US",
  value,
  onChange,
}) => {
  // Current year for generating dynamic year options
  const currentYear = new Date().getFullYear();
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Update temp range when value changes
  useEffect(() => {
    setTempRange(value);
  }, [value]);

  // Calculate years array dynamically
  const years = useMemo(() => {
    const result = [];
    for (
      let i = currentYear - yearsBeforeCurrent;
      i <= currentYear + yearsAfterCurrent;
      i++
    ) {
      result.push(i);
    }
    return result;
  }, [currentYear, yearsBeforeCurrent, yearsAfterCurrent]);

  // Get last week's range (today and 6 days back)
  const getWeekRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // Set end of day for today

    // Create start date (6 days before today)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0); // Set start of day

    return { start: weekStart, end: now };
  };

  // Initialize with current month and next month
  const [firstMonthDate, setFirstMonthDate] = useState(new Date());
  const [secondMonthDate, setSecondMonthDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });
  // Only use tempRange which is controlled by parent's value prop

  // Get localized month names
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      return new Date(2000, i, 1).toLocaleString(locale, { month: "long" });
    });
  }, [locale]);

  // Get localized days of week
  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      // i+1 because we want to start with Monday (1) through Sunday (7)
      return new Date(2000, 0, i + 3)
        .toLocaleString(locale, { weekday: "short" })
        .substring(0, 2);
    });
  }, [locale]);

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Call onChange when selected range changes
  useEffect(() => {
    if (onChange && tempRange.start && tempRange.end) {
      onChange(tempRange);
    }
  }, [tempRange, onChange]);

  const getDaysInMonth = useCallback((year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  }, []);

  const getFirstDayOfMonth = useCallback((year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  }, []);

  // Memoize generated month days to improve performance
  const generateMonthDays = useCallback(
    (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDayOfMonth = getFirstDayOfMonth(year, month);

      // Adjust for Monday as first day of week (0 is Sunday)
      // This transforms Sunday (0) to position 6, and Mon-Sat (1-6) to positions 0-5
      const firstDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

      const days = [];

      // Previous month days
      const prevMonthDays = getDaysInMonth(year, month - 1);
      for (let i = 0; i < firstDayIndex; i++) {
        days.push({
          day: prevMonthDays - firstDayIndex + i + 1,
          isCurrentMonth: false,
          date: new Date(
            year,
            month - 1,
            prevMonthDays - firstDayIndex + i + 1
          ),
        });
      }

      // Current month days
      for (let i = 1; i <= daysInMonth; i++) {
        days.push({
          day: i,
          isCurrentMonth: true,
          date: new Date(year, month, i),
        });
      }

      // Next month days
      const remainingDays = 42 - days.length; // 6 weeks
      for (let i = 1; i <= remainingDays; i++) {
        days.push({
          day: i,
          isCurrentMonth: false,
          date: new Date(year, month + 1, i),
        });
      }

      return days;
    },
    [getDaysInMonth, getFirstDayOfMonth]
  );

  // Memoize first month days
  const firstMonthDays = useMemo(() => {
    return generateMonthDays(firstMonthDate);
  }, [firstMonthDate, generateMonthDays]);

  // Memoize second month days
  const secondMonthDays = useMemo(() => {
    return generateMonthDays(secondMonthDate);
  }, [secondMonthDate, generateMonthDays]);

  // Validate date range selection based on min/max constraints
  const validateDateRange = useCallback(
    (start: Date, end: Date) => {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

      return diffDays >= minRangeDays && diffDays <= maxRangeDays;
    },
    [minRangeDays, maxRangeDays]
  );

  const handleDateClick = (date: Date) => {
    if (!tempRange.start || (tempRange.start && tempRange.end)) {
      // Start new selection
      setTempRange({ start: date, end: null });
    } else {
      // Complete the selection
      let newStart = tempRange.start;
      let newEnd = date;

      // Order dates correctly
      if (date < tempRange.start) {
        newStart = date;
        newEnd = tempRange.start;
      }

      // Validate range before applying
      if (validateDateRange(newStart, newEnd)) {
        setTempRange({ start: newStart, end: newEnd });
      } else {
        // Could show a validation message here
        setTempRange({ start: date, end: null });
      }
    }
  };

  const isDateInRange = (date: Date) => {
    if (!tempRange.start || !tempRange.end) return false;
    return date >= tempRange.start && date <= tempRange.end;
  };

  const isStartDate = (date: Date) => {
    return tempRange.start?.toDateString() === date.toDateString();
  };

  const isEndDate = (date: Date) => {
    return tempRange.end?.toDateString() === date.toDateString();
  };

  const prevFirstMonth = () => {
    const newDate = new Date(firstMonthDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setFirstMonthDate(newDate);

    // Keep second month ahead of first month
    ensureSecondMonthIsAfterFirst(newDate);
  };

  const nextSecondMonth = () => {
    const newDate = new Date(secondMonthDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSecondMonthDate(newDate);
  };

  // Ensure second month is always after first month
  const ensureSecondMonthIsAfterFirst = (firstDate: Date) => {
    const firstYear = firstDate.getFullYear();
    const firstMonth = firstDate.getMonth();
    const secondYear = secondMonthDate.getFullYear();
    const secondMonth = secondMonthDate.getMonth();

    const firstTotal = firstYear * 12 + firstMonth;
    const secondTotal = secondYear * 12 + secondMonth;

    if (secondTotal <= firstTotal) {
      const newSecondDate = new Date(firstDate);
      newSecondDate.setMonth(firstMonth + 1);
      setSecondMonthDate(newSecondDate);
    }
  };

  const changeFirstMonth = (monthIndex: number) => {
    const newDate = new Date(firstMonthDate);
    newDate.setMonth(monthIndex);
    setFirstMonthDate(newDate);

    // Keep second month ahead of first month
    ensureSecondMonthIsAfterFirst(newDate);
  };

  const changeFirstYear = (year: number) => {
    const newDate = new Date(firstMonthDate);
    newDate.setFullYear(year);
    setFirstMonthDate(newDate);

    // Keep second month ahead of first month
    ensureSecondMonthIsAfterFirst(newDate);
  };

  const changeSecondMonth = (monthIndex: number) => {
    const newDate = new Date(secondMonthDate);
    newDate.setMonth(monthIndex);

    // Validate that second month is after first month
    const firstTotal =
      firstMonthDate.getFullYear() * 12 + firstMonthDate.getMonth();
    const newSecondTotal = newDate.getFullYear() * 12 + monthIndex;

    if (newSecondTotal > firstTotal) {
      setSecondMonthDate(newDate);
    } else {
      // If invalid selection, set second month to one month after first month
      const adjustedDate = new Date(firstMonthDate);
      adjustedDate.setMonth(firstMonthDate.getMonth() + 1);
      setSecondMonthDate(adjustedDate);
    }
  };

  const changeSecondYear = (year: number) => {
    const newDate = new Date(secondMonthDate);
    newDate.setFullYear(year);

    // Validate that second month is after first month
    const firstTotal =
      firstMonthDate.getFullYear() * 12 + firstMonthDate.getMonth();
    const newSecondTotal = year * 12 + newDate.getMonth();

    if (newSecondTotal > firstTotal) {
      setSecondMonthDate(newDate);
    } else {
      // If invalid selection, adjust the month to make it valid
      newDate.setMonth(firstMonthDate.getMonth() + 1);
      setSecondMonthDate(newDate);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString(locale);
  };

  const applySelection = () => {
    if (tempRange.start && tempRange.end) {
      onChange(tempRange);
    }
    setIsOpen(false);
  };

  const clearSelection = () => {
    const emptyRange = { start: null, end: null };
    setTempRange(emptyRange);
    onChange(emptyRange);
  };

  // Create an accessible aria label for the input
  const getInputAriaLabel = () => {
    if (tempRange.start && tempRange.end) {
      return `Selected date range: ${formatDate(
        tempRange.start
      )} to ${formatDate(tempRange.end)}`;
    }
    return "Select date range";
  };
  return (
    <div className="relative" ref={calendarRef}>
      {/* Input Field */}
      <div
        className={`flex justify-between items-center border-[1px] border-solid border-border-default-default rounded-md px-4 h-[50px] cursor-pointer hover:border-[#3089AB] ${value?.start && "!border-primary"}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Open date picker"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsOpen(!isOpen);
            e.preventDefault();
          }
        }}
      >
        <input
          type="text"
          readOnly
          className={`border-none outline-none bg-transparent w-full text-lg ${tempRange.start && tempRange.end
            ? "text-primary"
            : "text-default-default"
            }`}
          value={
            tempRange.start && tempRange.end
              ? `${formatDate(tempRange.start)} - ${formatDate(
                tempRange.end
              )}`
              : "Select date range"
          }
          placeholder="Select date range"
          aria-label={getInputAriaLabel()}
        />
        {tempRange.start && tempRange.end ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            className="bg-transparent"
            aria-label="Clear selection"
          >
            {/* <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3089AB"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg> */}

            <div className="cursor-pointer">
              <ErrorIcon width="25" height="25" color="primary" />
            </div>
          </button>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        )}
      </div>

      {/* Calendar Popup */}
      {isOpen && (
        <div
          className="absolute z-10 mt-1 bg-white border border-gray-300 shadow-lg rounded-md overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Date range calendar"
        >
          {/* Calendar */}
          <div className="flex flex-row">
            {/* First Calendar */}
            <div className="p-3 space-y-0.6 min-w-[300px]">
              {/* Months */}
              <div className="grid grid-cols-5 items-center gap-x-3 mx-1.5 pb-3">
                {/* Prev Button */}
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={prevFirstMonth}
                    className="h-8 w-8 flex justify-center items-center text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
                    aria-label="Previous month"
                  >
                    <svg
                      className="flex-shrink-0 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Month / Year */}
                <div className="col-span-3 flex justify-center items-center gap-x-2">
                  {/* Improved styling for the month dropdown */}
                  <div className="relative min-w-[100px]">
                    <select
                      value={firstMonthDate.getMonth()}
                      onChange={(e) =>
                        changeFirstMonth(parseInt(e.target.value))
                      }
                      className="appearance-none w-full px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Select month"
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Improved styling for the year dropdown */}
                  <div className="relative min-w-16">
                    <select
                      value={firstMonthDate.getFullYear()}
                      onChange={(e) =>
                        changeFirstYear(parseInt(e.target.value))
                      }
                      className="appearance-none w-full px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Select year"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Next Button - Hidden for first calendar */}
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="opacity-0 pointer-events-none h-8 w-8"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <svg
                      className="flex-shrink-0 h-4 w-4"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Weeks */}
              <div
                className="grid grid-cols-7 gap-[2px] pb-2"
                role="row"
              >
                {daysOfWeek.map(day => (
                  <div
                    key={day}
                    className="flex h-8 items-center justify-center text-xs text-gray-500"
                    role="columnheader"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div role="grid" aria-label="Calendar">
                {[0, 1, 2, 3, 4, 5].map((week) => (
                  <div
                    key={`week-${week}`}
                    className="grid grid-cols-7 gap-[2px]"
                    role="row"
                  >
                    {firstMonthDays
                      .slice(week * 7, (week + 1) * 7)
                      .map((dayObj, i) => (
                        <div key={`day-${week}-${i}`} role="gridcell"
                          className="flex justify-center items-center">
                          <button
                            type="button"
                            onClick={() =>
                              dayObj.isCurrentMonth &&
                              handleDateClick(dayObj.date)
                            }
                            disabled={!dayObj.isCurrentMonth}
                            className={` h-9 w-9 flex justify-center items-center border-[1.5px] border-transparent text-xs rounded-md
                            ${!dayObj.isCurrentMonth
                                ? "text-gray-400"
                                : isDateInRange(dayObj.date)
                                  ? "bg-blue-100 text-gray-700"
                                  : "text-gray-700 hover:bg-gray-100"
                              }
                            ${isStartDate(dayObj.date) || isEndDate(dayObj.date)
                                ? "bg-blue-500 text-white"
                                : ""
                              }
                            ${isStartDate(dayObj.date) ? "rounded-l-md" : ""}
                            ${isEndDate(dayObj.date) ? "rounded-r-md" : ""}
                            disabled:opacity-50 disabled:pointer-events-none focus:outline-none`}
                            aria-label={
                              dayObj.isCurrentMonth
                                ? `${months[firstMonthDate.getMonth()]} ${dayObj.day
                                }, ${firstMonthDate.getFullYear()}`
                                : ""
                            }
                            aria-selected={
                              isStartDate(dayObj.date) ||
                              isEndDate(dayObj.date) ||
                              (dayObj.isCurrentMonth &&
                                isDateInRange(dayObj.date))
                            }
                            aria-disabled={!dayObj.isCurrentMonth}
                          >
                            {dayObj.day}
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Second Calendar */}
            <div className="p-3 space-y-0.6 min-w-[300px]">
              {/* Months */}
              <div className="grid grid-cols-5 items-center gap-x-3 mx-1.5 pb-3">
                {/* Prev Button - Hidden for second calendar */}
                <div className="col-span-1">
                  <button
                    type="button"
                    className="opacity-0 pointer-events-none h-8 w-8"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <svg
                      className="flex-shrink-0 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Month / Year */}
                <div className="col-span-3 flex justify-center items-center gap-x-2">
                  {/* Improved styling for the month dropdown */}
                  <div className="relative min-w-[100px]">
                    <select
                      value={secondMonthDate.getMonth()}
                      onChange={(e) =>
                        changeSecondMonth(parseInt(e.target.value))
                      }
                      className="appearance-none w-full px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Select month"
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Improved styling for the year dropdown */}
                  <div className="relative min-w-16">
                    <select
                      value={secondMonthDate.getFullYear()}
                      onChange={(e) =>
                        changeSecondYear(parseInt(e.target.value))
                      }
                      className="appearance-none w-full px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Select year"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Next Button */}
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={nextSecondMonth}
                    className="h-8 w-8 flex justify-center items-center text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
                    aria-label="Next month"
                  >
                    <svg
                      className="flex-shrink-0 h-4 w-4"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Weeks */}
              <div
                className="grid grid-cols-7 gap-[2px] pb-2"
                role="row"
              >
                {daysOfWeek.map(day => (
                  <div
                    key={day}
                    className="flex h-8 items-center justify-center text-xs text-gray-500"
                    role="columnheader"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div role="grid" aria-label="Calendar">
                {[0, 1, 2, 3, 4, 5].map((week) => (
                  <div
                    key={`week-${week}`}
                    className="grid grid-cols-7 gap-[2px]"
                    role="row"
                  >
                    {secondMonthDays
                      .slice(week * 7, (week + 1) * 7)
                      .map((dayObj, i) => (
                        <div key={`day-${week}-${i}`} role="gridcell"
                          className="flex justify-center items-center">
                          <button
                            type="button"
                            onClick={() =>
                              dayObj.isCurrentMonth &&
                              handleDateClick(dayObj.date)
                            }
                            disabled={!dayObj.isCurrentMonth}
                            className={`h-9 w-9 flex justify-center items-center border-[1.5px] border-transparent text-xs rounded-md
                            ${!dayObj.isCurrentMonth
                                ? "text-gray-400"
                                : isDateInRange(dayObj.date)
                                  ? "bg-blue-100 text-gray-700"
                                  : "text-gray-700 hover:bg-gray-100"
                              }
                            ${isStartDate(dayObj.date) || isEndDate(dayObj.date)
                                ? "bg-blue-500 text-white"
                                : ""
                              }
                            ${isStartDate(dayObj.date) ? "rounded-l-md" : ""}
                            ${isEndDate(dayObj.date) ? "rounded-r-md" : ""}
                            disabled:opacity-50 disabled:pointer-events-none focus:outline-none`}
                            aria-label={
                              dayObj.isCurrentMonth
                                ? `${months[secondMonthDate.getMonth()]} ${dayObj.day
                                }, ${secondMonthDate.getFullYear()}`
                                : ""
                            }
                            aria-selected={
                              isStartDate(dayObj.date) ||
                              isEndDate(dayObj.date) ||
                              (dayObj.isCurrentMonth &&
                                isDateInRange(dayObj.date))
                            }
                            aria-disabled={!dayObj.isCurrentMonth}
                          >
                            {dayObj.day}
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Button Group */}
          <div className="flex items-center py-3 px-4 justify-end border-t border-gray-300 gap-x-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:outline-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applySelection}
              className="py-2 px-3 inline-flex justify-center items-center gap-x-2 text-xs font-medium rounded-md border-[1.5px] border-transparent bg-blue-500 text-white hover:bg-blue-600 focus:outline-none cursor-pointer"
              disabled={!tempRange.start || !tempRange.end}
              aria-label={
                tempRange.start && tempRange.end
                  ? `Apply date range: ${formatDate(
                    tempRange.start
                  )} to ${formatDate(tempRange.end)}`
                  : "Apply date range selection (no range selected)"
              }
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeInput;
