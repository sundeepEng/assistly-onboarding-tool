import React, { useEffect, useRef } from 'react'

const InputcheckboxComponent = ({value,label,onChange,name,indeterminate=false,disabled=false}) => {
    const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return (
     <div className="flex gap-2">
      <div className="flex">
        <input
          disabled={disabled}
          type="checkbox"
          name={name}
          checked={value}
          onChange={onChange}
          className="w-5 h-5 appearance-none border-2 border-primary bg-white rounded ring-2 ring-primary 
          checked:after:content-['✔'] checked:after:text-primary checked:after:text-lg checked:after:font-bold checked:after:absolute checked:after:left-[2px] relative "
        />
      </div>
      <div className="flex">
        <label htmlFor={name}>{label}</label>
      </div>
    </div>
  )
}

export default InputcheckboxComponent
