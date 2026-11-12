import type { NextPage } from "next";
import { useEffect, useState } from "react";

export type TextareaComponentProps = {
  className?: string;
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  name: string;
  error?: string;
  key?: any;
  autoFocus?: boolean;
  rows?: number;
};

const TextareaComponent: NextPage<TextareaComponentProps> = ({
  className = "",
  label,
  value = "",
  onChange,
  placeholder = "",
  name,
  error = "",
  key,
  autoFocus = false,
  rows,
}) => {
  const [textValue, setTextValue] =  useState(value ?? "");
    useEffect(() => {
    if (value !== undefined) setTextValue(value);
  }, [value]);
  const onTextChangeHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextValue(e.target.value);
    onChange(e);
  };
  return (
    <div
      className={`bg-background-default-default max-w-full overflow-hidden flex flex-col items-start justify-start box-border tracking-[normal] leading-[normal] text-left text-base text-schemes-on-surface font-poppins mq465:pl-[26px] mq465:pr-[26px] mq465:box-border`}
    >
      <div
        className={`flex flex-col items-start justify-start gap-[17px] min-w-[250px] !w-full`}
      >
        <div className="self-stretch relative leading-[140%]">{label}</div>
        <textarea
          key={key}
          name={name}
          className={`border-border-default-default border-2 border-solid bg-background-default-default [outline:none] self-stretch h-[81px] rounded-radius-200 box-border overflow-hidden shrink-0 flex-row items-start justify-start py-space-300 px-space-400 font-poppins text-base min-h-[80px] resize-none ${className} `}
          autoFocus={autoFocus}
          value={value || textValue}
          onChange={(e) => onTextChangeHandler(e)}
          placeholder={placeholder}
          rows={rows || 2}
          style={{
            height: "auto",
            minHeight: `${(rows || 1) * 10 + 32}px`,
          }}
        />
      </div>
      <div className="text-red-500 leading-[140%] font-body-base ">
        {error ?? error}
      </div>
    </div>
  );
};

export default TextareaComponent;
