import { useEffect, useState } from "react";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeekdaySelectProps {
  onChange?: (selected: number[]) => void;
  initialSelected?: string[];
  className?: string;
  selectedDate?: Date;
}

export default function WeekdaySelect({
  onChange,
  className,
  initialSelected = [],
  selectedDate,
}: WeekdaySelectProps) {
  const [selected, setSelected] = useState<number[]>(() => {
    if (initialSelected?.length > 0) {
      return initialSelected?.map((day) => weekDays?.indexOf(day));
    }
    if (selectedDate) {
      const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
      const jsDay = date.getDay(); // JS: 0=Sun, 1=Mon, ..., 6=Sat
      // Convert to weekDays index: 0=Mon, 6=Sun
      const weekDayIndex = jsDay === 0 ? 6 : jsDay - 1;
      return [weekDayIndex];
    }
    return [];
  });

  useEffect(() => {
    if (onChange) onChange(selected);
  }, [selected]);

  const toggleDay = (dayIndex: number) => {
    setSelected((prev) =>
      prev?.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  return (
    <div className="flex gap-2">
      {weekDays?.map((day, index) => {
        const isSelected = selected?.includes(index);
        return (
          <button
            key={day}
            onClick={() => toggleDay(index)}
            type="button"
            className={[
              "w-10 h-10 rounded-full border text-sm font-medium my-2 cursor-pointer",
              isSelected
                ? "bg-primary bg-opacity-20 border-primary text-primary"
                : "bg-white border-gray-300 text-gray-600",
              className,
            ].join(" ")}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}
