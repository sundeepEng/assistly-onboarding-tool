import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DateTimePickerProps {
  label?: string;
  minDate?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date | null) => void;
  onTimeChange?: (time: string) => void;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label = "Select Date & Time",
  minDate = new Date(),
  defaultDate = new Date(),
  onDateChange,
  onTimeChange,
}) => {
  // Initializing date and time as empty
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Empty initial date
  const [selectedTime, setSelectedTime] = useState<string>(""); // Empty initial time
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // Function to generate time slots based on the selected date
  const generateTimeSlots = (date: Date | null) => {
    if (!date) return [];

    const slots: string[] = [];
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const startHour = isToday ? now.getHours() + 1 : 8; // If today, start after current hour; else start at 8 AM
    const endHour = 17; // 5 PM

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour !== 11) slots.push(`${hour.toString().padStart(2, "0")}:30`); // Skip 11:30 AM for lunch hour
    }

    // Convert 12-hour format for PM times
    for (let hour = 12; hour < endHour; hour++) {
      slots.push(`${hour}:00`);
      if (hour < endHour - 1) slots.push(`${hour}:30`);
    }

    return slots;
  };

  // Update time slots when date changes
  useEffect(() => {
    const newTimeSlots = generateTimeSlots(selectedDate);
    setTimeSlots(newTimeSlots);
    if (newTimeSlots.length > 0 && selectedTime === "") {
      setSelectedTime(newTimeSlots[0]); // Set first available slot if no time is selected
    }
  }, [selectedDate]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    setTimeSlots(generateTimeSlots(date));
    if (onDateChange) onDateChange(date);
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTime(event.target.value);
    if (onTimeChange) onTimeChange(event.target.value);
  };

  return (
    <div className="max-w-sm mx-auto p-4 bg-white shadow-md rounded-lg">
      <label className="block text-gray-700 font-poppins mb-2">{label}</label>

      {/* Date Picker */}
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        dateFormat="MM/dd/yyyy"
        minDate={minDate}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        className="w-full p-2 font-poppins border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="mt-4">
        <label className="block text-gray-700 font-poppins mb-2">Time</label>

        {/* Time Picker */}
        <select
          value={selectedTime}
          onChange={handleTimeChange}
          className="w-[58%] p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {/* Display available time slots */}
          {timeSlots.length > 0 ? (
            timeSlots.map((time, index) => (
              <option key={index} value={time}>
                {time}
              </option>
            ))
          ) : (
            <option disabled>No available slots</option>
          )}
        </select>
      </div>
    </div>
  );
};

export default DateTimePicker;
