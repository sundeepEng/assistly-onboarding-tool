import React, { useState } from "react";
import { useController } from "react-hook-form";

const FormInputCheckboxComponent = ({
  name,
  label,
  initialChecked = false,
}) => {
  const {
    field: { value = false, onChange },
    fieldState: { error },
  } = useController({
    name,
    defaultValue: initialChecked,
  });

  return (
    <div className="flex gap-2">
      <div className="flex">
        <input
          type="checkbox"
          name={name}
          checked={value}
          onChange={onChange}
          className="w-5 h-5 appearance-none border-2 border-primary bg-white rounded ring-2 ring-primary 
          checked:after:content-['✔'] checked:after:text-primary checked:after:text-lg checked:after:font-bold checked:after:absolute checked:after:left-[2px] relative "
        />
      </div>
      <div className="flex">
        <label htmlFor={name} className="text-[16px] font-[400] leading-[24px] text-gray-700">
          {label}
        </label>
      </div>
    </div>
  );
};

export default FormInputCheckboxComponent;
