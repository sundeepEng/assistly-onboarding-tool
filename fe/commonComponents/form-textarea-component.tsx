import type { NextPage } from "next";
import { useController } from "react-hook-form";

export type FormTextareaComponentProps = {
    className?: string;
    label: string;
    value?: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    name: string;
    disabled?: boolean;  // Added disabled prop
    focus?:boolean
};

const FormTextareaComponent: NextPage<FormTextareaComponentProps> = ({
    ...props
}) => {
    const {
        field: { value, onChange, ...rest },
        fieldState: { error },
    } = useController({ name: props.name });
    return (
        <div
            className={`bg-background-default-default max-w-full overflow-hidden flex flex-col items-start justify-start box-border tracking-[normal] leading-[normal] text-left text-base text-schemes-on-surface font-poppins mq465:pl-[26px] mq465:pr-[26px] mq465:box-border`}
        >
            <div
                className={`w-full flex flex-col items-start justify-start gap-[17px] min-w-[170px] max-w-[625px]`}
            >
                <div className="self-stretch relative leading-[140%]">
                    {props?.label}
                </div>
                <textarea
                    {...props}
                    {...rest}
                    disabled={props.disabled}  // Added disabled attribute
                    className={`border-border-default-default border-2 border-solid bg-background-default-default [outline:none] self-stretch h-[81px] rounded-radius-200 box-border overflow-hidden shrink-0 flex flex-row items-start justify-start py-space-300 px-space-400 font-poppins text-base min-w-[240px] min-h-[80px] !bg-[transparent] resize-none ${
                        props?.className
                    } ${
                        props.disabled ? "cursor-not-allowed" : ""
                    }`}  // Added cursor style for disabled state
                    autoFocus={props?.focus||false}
                    value={value}
                    onChange={onChange}
                    placeholder={props?.placeholder}
                />
                <div className="text-red-500 leading-[140%] font-body-base">
                    {error?.message}
                </div>
            </div>
        </div>
    );
};

export default FormTextareaComponent;