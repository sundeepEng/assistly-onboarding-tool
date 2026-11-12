import { useState, useEffect, useRef } from "react";
import { useController } from "react-hook-form";

type FormSelectOption = {
  option: string;
  value: string;
};

interface MultiSelectComponentProps {
  name: string;
  options: FormSelectOption[];
  placeholder?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
  containerClass?: string;
  titleClass?: string;
  optionsClass?: string;
  
}

const MultiSelectComponent = ({
  name,
  options,
  placeholder = "Select options",
  className = "",
  label,
  disabled = false,
  containerClass = "",
  titleClass = "",
  optionsClass = "",
}: MultiSelectComponentProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    field: { value = [], onChange },
    fieldState: { error },
  } = useController({ name });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef?.current &&
        !dropdownRef?.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleOption = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v: string) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectedLabels = options
    .filter((opt) => value?.includes(opt?.value))
    .map((opt) => opt?.option)
    .join(", ");

  return (
    <div
      ref={dropdownRef}
      className={`self-stretch flex flex-col items-start justify-start text-schemes-on-surface`}
    >
      <div className={`w-full flex flex-col items-start justify-start`}>
        <div
          className={`self-stretch flex flex-col items-start justify-start relative gap-space-200 ${containerClass}`}
        >
          {label && (
            <div
              className={`self-stretch font-medium h-[21px] relative leading-[140%] inline-block z-[0] ${titleClass}`}
            >
              {label}
            </div>
          )}
          <div>
          <div
            className={`h-10 rounded-radius-200 bg-background-default-default border-border-default-default border-[1px] border-solid box-border flex flex-row items-center justify-between font-poppins text-base w-[420px] px-[15px] cursor-pointer ${className} ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={() => !disabled && setOpen((prev) => !prev)}
          >
            <span className="text-gray-700 truncate w-[85%]" title={selectedLabels}>
              {value.length > 0 ? selectedLabels : placeholder}
            </span>
            <span
              className={`material-icons notranslate MuiIcon-root MuiIcon-fontSizeMedium css-kp9ftd-MuiIcon-root transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              expand_more
            </span>
          </div>
           {error?.message && (
        <div className="text-red-500 leading-[140%] font-body-base mt-1">
          {error?.message}
        </div>
      )}
          </div>

          {open && (
            <ul
              className={`absolute z-50 bg-white p-0 border border-border-default-default rounded-md shadow-lg max-h-[234px] overflow-auto ${optionsClass}`}
            >
              {options?.map((option, index) => {
                const isSelected = value.includes(option?.value);
                return (
                  <li
                    key={index}
                    onClick={() => handleToggleOption(option?.value)}
                    className={`px-4 py-2 cursor-pointer hover:bg-gray-100 flex justify-between items-center ${
                      isSelected
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-800"
                    }`}
                  >
                    {option?.option}
                    {isSelected && <span className="text-sm">✓</span>}
                  </li>
                );
              })}
            </ul>
          )}
          
        </div>
      </div>

        
     
    </div>
  );
};

export default MultiSelectComponent;
