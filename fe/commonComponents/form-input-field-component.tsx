import { NextPage } from "next";
import { useState } from "react";
import { useController } from "react-hook-form";
import EyeOffIcon from "../public/icons/close-eye";
import EyeIcon from "../public/icons/eye";

interface InputFieldComponentType {
  label?: string;
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  error?: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "search"
    | "tel"
    | "date"
    | "month"
    | "phone"
    | "time"
    | "file";
  accept?: string;
  passwordVisibility?: boolean;
  containerClass?: string;
  titleClass?: string;
  readOnly?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: string;
  SubcontainerClass?: string;
}
const FormInputFieldComponent: NextPage<InputFieldComponentType> = ({
  passwordVisibility,
  ...props
}) => {
  const {
    field: { value: inputValue, onChange, ...rest },
    fieldState: { error },
  } = useController({ name: props.name });

  const [showPassword, setShowPassword] = useState(false);
  const inputType =
    passwordVisibility && !showPassword ? "password" : props.type;
  const handleInputChange = (e) => {
    let val = e.target.value;
     if (passwordVisibility) {
      val = val.trim()
    }
    onChange(props?.type === "number" ? val && Number(val) : val);
    props.onChange?.(e);
  };
  return (
    <div
      className={`py-[5px] bg-background-default-default max-w-full overflow-hidden flex flex-col items-start justify-start tracking-[normal] leading-[normal] text-left text-base text-black font-poppins mq279:pr-5 mq279:box-border mq557:pl-[26px] mq557:pr-[351px] mq557:box-border mq465:pl-[26px] mq465:pr-[26px] mq465:box-border`}
    >
      <div className={`w-full flex flex-col items-start justify-start min-w-[170px] max-w-[625px] ${props?.SubcontainerClass}`}>
        <div
          className={`self-stretch flex flex-col items-start justify-start gap-space-200 max-w-full ${props?.containerClass}`}
        >
          <div
            className={`self-stretch h-[21px] relative leading-[140%] inline-block ${props?.titleClass}`}
          >
            {props.label}
          </div>
          <div className="self-stretch">
            <div
              className={`w-full h-8 rounded-radius-200 bg-background-default-default border-border-default-default border-[1px] border-solid box-border overflow-hidden flex items-center px-[15px] ${props.className}`}
            >
              <input
                type={inputType}
                value={inputValue ?? ""}
                {...props}
                {...rest}
                onChange={handleInputChange}
                readOnly={props?.readOnly}
                disabled={props?.disabled}
                className={`w-full border-none outline-none font-poppins text-base bg-transparent ${(props.readOnly || props.disabled) && "opacity-50 cursor-not-allowed"
                  }`}
              />
              {passwordVisibility && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-2 focus:outline-none bg-white"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              )}
            </div>
            <div className="text-[red] leading-[140%] font-body-base max-w-[350px]">
              {error?.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default FormInputFieldComponent;
