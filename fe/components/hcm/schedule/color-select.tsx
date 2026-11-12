import React, { useState, useEffect } from "react";
import { useController } from "react-hook-form";
import { Check } from "lucide-react";
import { FlexibleDropdownIcon } from "../../../public/icons/flexibleDropdownIcon";

interface ColorSelectComponentProps {
  name: string;
  label?: string;
  className?: string;
}

export const predefinedColors = [
  { label: "Red", value: "#D93025" },
  { label: "Orange", value: "#F57C00" },
  { label: "Yellow", value: "#FBC02D" },
  { label: "Gold", value: "#FFD700" },
  { label: "Pink", value: "#F8BBD0" },
  { label: "Green", value: "#388E3C" },
  { label: "Teal", value: "#00897B" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#9C27B0" },
  { label: "Indigo", value: "#3F51B5" },
  { label: "Cyan", value: "#00BCD4" },
  { label: "Brown", value: "#795548" },
];

const DEFAULT_COLOR = "#3b82f6";

const ColorSelectComponent: React.FC<ColorSelectComponentProps> = ({
  name,
  label,
  className = "",
}) => {
  const {
    field: { value, onChange },
    fieldState: { error },
  } = useController({ name });

  const [isOpen, setIsOpen] = useState(false);

  // Set default color if none selected
  useEffect(() => {
    if (!value) {
      onChange(DEFAULT_COLOR);
    }
  }, [value, onChange]);

  return (
    <div className={`relative inline-block font-poppins ${className}`}>
      {label && <label className="block mb-1 text-sm">{label}</label>}

      {/* Select-style dropdown trigger */}
      <div className="w-16">
        <div
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full h-10 px-3 rounded border-2 border-gray-300 flex items-center justify-between shadow-sm "
          style={{ backgroundColor: "#fff" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: value || DEFAULT_COLOR }}
            />
          </div>
          <FlexibleDropdownIcon isDropdownOpen={isOpen} />
        </div>
      </div>

      {/* Color palette */}
      {isOpen && (
        <div className="absolute z-10 mt-2 p-2 bg-white rounded shadow-lg grid grid-cols-6 gap-2 min-w-[400px] -left-72">
          {predefinedColors.map((color) => (
            <div
              key={color?.value}
              onClick={() => {
                onChange(color?.value);
                setIsOpen(false);
              }}
              className="w-12 h-6 rounded-full relative border border-gray-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: color?.value }}
            >
              {value === color?.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="text-white" size={14} strokeWidth={3} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error?.message && (
        <p className="text-sm text-red-500 mt-1">{error?.message}</p>
      )}
    </div>
  );
};

export default ColorSelectComponent;
