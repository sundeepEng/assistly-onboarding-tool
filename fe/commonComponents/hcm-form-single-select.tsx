import React, { useState, useRef, useEffect } from "react";
import { useController } from "react-hook-form";

interface Option {
  label: string;
  value: string;
}

interface HcmCustomSelectProps {
  name: string;
  options: Option[];
  label?: string;
  onChange?: (value: string) => void;
}

const HcmCustomSelect: React.FC<HcmCustomSelectProps> = ({
  name,
  options,
  label,
  onChange: externalOnChange,
}) => {
  const {
    field: { value, onChange },
  } = useController({ name });

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    externalOnChange?.(val);
    setOpen(false);
  };

  const selected = options?.find((opt) => opt?.value === value);
  return (
    <div className="relative w-[216px] flex flex-col" ref={ref}>
      {label && (
        <label className="block text-sm font-medium mb-1 text-gray-600">
          {label}
        </label>
      )}
      <div
        onClick={() => setOpen((prev) => !prev)}
        className={`border border-solid border-gray-300 rounded-md px-4 py-2 h-[40px] bg-white font-poppins text-base cursor-pointer flex items-center justify-between ${
          open ? "ring-2 ring-blue-400 border-blue-400" : ""
        }`}
      >
        <span className={selected ? "" : "text-gray-400"}>
          {selected?.label || "Select"}
        </span>
        <span className="text-gray-500">&#x25BC;</span>
      </div>
      {open && (
        <div className="absolute top-[100%] left-0 z-10 w-full mt-1 border border-gray-300 rounded-md bg-white shadow-md max-h-[160px] overflow-y-auto">
          {options?.map((opt) => (
            <div
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                opt?.value === value ? "bg-gray-100 font-medium" : ""
              }`}
            >
              {opt?.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HcmCustomSelect;
