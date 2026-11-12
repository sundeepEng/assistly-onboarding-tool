import { NextPage } from "next";

type SelectOption = {
  option: string;
  value: string;
};

interface SelectComponentProps {
  label?: string;
  options: SelectOption[];
  name: string;
  onChange: (value: React.ChangeEvent<HTMLSelectElement>) => void;
  value?: string;
  className?: string;
  error?: string;
  placeholder?: string;
  note?: string;
}

const SelectComponent: NextPage<SelectComponentProps> = ({
  label,
  options,
  name,
  onChange,
  value = "",
  className = "",
  error,
  placeholder,
  note,
}) => {
  return (
    <div className={`flex flex-col w-full max-w-sm ${className}`}>
      <label htmlFor={name} className="mb-1 text-[16px] text-[#181729]  font-jakarta">
        {label}
      </label>

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="h-9 px-2 pr-3 rounded-md border border-[#C8C8CC] bg-white text-[16px] font-jakarta font-semibold text-[#181729] focus:outline-none focus:ring-0 focus:border-[#C8C8CC]"
      >
        {note && (
          <option disabled value="__note__">
            {note}
          </option>
        )}
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map(({ option, value }) => (
          <option key={value} value={value}>
            {option}
          </option>
        ))}
      </select>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default SelectComponent;
