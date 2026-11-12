import { forwardRef, useState, useEffect } from "react"; // Import from React, not Next.js
import EyeOffIcon from "../public/icons/close-eye";
import EyeIcon from "../public/icons/eye";

interface InputFieldComponentProps {
    label: string | React.ReactNode;
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
    | "file";
    accept?: string,
    passwordType?: boolean;
    containerClass?: string;
    titleClass?: string;
    inputClass?: string;
    disabled?: boolean;
    key?: any
    required?: boolean;
    max?: string; // Add max prop for date input
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const InputFieldComponent = forwardRef<
    HTMLInputElement,
    InputFieldComponentProps
>(
    (
        {
            className = "",
            label,
            placeholder,
            value = "",
            onChange,
            name,
            error = "",
            type = "text",
            containerClass,
            passwordType,
            titleClass,
            inputClass,
            disabled,
            key,
            required = false,
            max = "",
            onKeyDown,

        },
        ref
    ) => {
        const [InputValue, setInputvalue] = useState<string>(value);
        const [showPassword, setShowPassword] = useState(false);

        // Sync internal state with external value prop
        useEffect(() => {
            setInputvalue(value);
        }, [value]);

        const InputChangehanlder = (e: React.ChangeEvent<HTMLInputElement>) => {
            setInputvalue(e.target.value);
            onChange?.(e);
        };

        return (
            <div
                className={`bg-background-default-default max-w-full overflow-hidden flex flex-col items-start justify-start tracking-[normal] leading-[normal] text-left text-base text-black font-poppins mq279:pr-5 mq279:box-border mq557:pl-[26px] mq557:pr-[351px] mq557:box-border mq465:pl-[26px] mq465:pr-[26px] mq465:box-border`}
            >
                <div className="w-full flex flex-col items-start justify-start">
                    <div
                        className={`self-stretch flex flex-col items-start justify-start gap-space-200 max-w-full ${containerClass}`}
                    >
                        <div
                            className={`self-stretch h-[21px] relative leading-[140%] inline-block ${titleClass}`}
                        >
                            {label}
                        </div>
                        <div
                            className={`self-stretch h-8 rounded-radius-200 bg-background-default-default border-border-default-default border-[1px] border-solid box-border overflow-visible shrink-0 flex flex-row items-center justify-start py-space-300 px-[15px] w-full ${className} ${disabled ? "bg-gray-100 cursor-not-allowed" : ""
                                }`}
                        >
                            <input
                                ref={ref}
                                key={key}
                                name={name}
                                className={`w-full [border:none] [outline:none] font-poppins text-base bg-[transparent] flex-1 relative leading-[100%] text-left inline-block max-w-full ${inputClass} ${disabled
                                    ? "cursor-not-allowed opacity-70"
                                    : ""
                                    }`}
                                placeholder={placeholder}
                                value={InputValue}
                                onChange={InputChangehanlder}
                                onKeyDown={onKeyDown}
                                type={
                                    passwordType
                                        ? !showPassword
                                            ? "password"
                                            : "text"
                                        : type || "text"
                                }
                                readOnly={disabled}
                                required={required}
                                max={max}
                            />
                            {passwordType && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        !disabled &&
                                        setShowPassword(!showPassword)
                                    }
                                    className={`ml-2 focus:outline-none ${disabled
                                        ? "cursor-not-allowed opacity-70"
                                        : ""
                                        }`}
                                    disabled={disabled}
                                >
                                    {showPassword ? (
                                        <EyeIcon />
                                    ) : (
                                        <EyeOffIcon />
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="text-red-600 leading-[140%] font-body-base">
                            {error ?? error}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

InputFieldComponent.displayName = "InputFieldComponent";

export default InputFieldComponent;
