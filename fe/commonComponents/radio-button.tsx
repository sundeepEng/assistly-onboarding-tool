import type { NextPage } from "next";

export type RadioButtonType = {
    className?: string;
    option: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    checked?: boolean;
};

const RadioButton: NextPage<RadioButtonType> = ({
    className = "",
    option,
    name,
    value,
    onChange,
    checked,
}) => {
    return (
        <div
            className={`m-[10px] self-stretch flex flex-row items-center justify-start p-px text-left text-base text-black font-poppins ${className}`}
            data-state={checked ? "on" : "off"}
        >
            <div
                className="flex-1 rounded-lg bg-white flex flex-row items-center justify-center p-px cursor-pointer !bg-transparent"
                onClick={() => onChange(value)} 
            >
                <div className="w-[35px] flex flex-col items-start justify-start box-border p-2.5">
                    <div
                        className={`frame-child w-4 h-4 relative rounded-full border-[2px] border-solid ${
                            checked
                                ? "bg-primary border-primary/20"
                                : "border-primary bg-transparent"
                        }`}
                    />
                </div>
                <div className="flex-1 rounded flex flex-row items-start justify-start p-2.5">
                    <div className="relative leading-[140%]">{option}</div>
                </div>
            </div>
        </div>
    );
};

export default RadioButton;
