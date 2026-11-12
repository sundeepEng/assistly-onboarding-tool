import { useController } from "react-hook-form";
import RadioButton from "./radio-button";
import { NextPage } from "next";

type OptionType = {
    option: string;
    value: string;
};

interface FormSingleRadioSelectTypeProps {
    name: string;
    options: OptionType[];
    containerClassName?: string;
    itemClassName?: string;
    errorClassName?: string;
}

const FormSingleRadioSelect: NextPage<FormSingleRadioSelectTypeProps> = ({
    ...props
}) => {
    const {
        field: { value, onChange },
        fieldState: { error },
    } = useController({ name: props?.name });
    const handleOptions = (value: string) => {
        onChange(value);
    };
    return (
        <div className={props?.containerClassName || "flex flex-row gap-4"}>
            {props?.options?.map((option: OptionType) => (
                <div key={option?.value} className={props?.itemClassName || "flex items-center"}>
                    <RadioButton
                        name={props?.name}
                        value={option?.value}
                        option={option?.option}
                        onChange={() => handleOptions(option.value)}
                        checked={value === option.value}
                    />
                </div>
            ))}
            {error?.message && <span className={props?.errorClassName || "text-red-500 text-sm mt-1"}>{error?.message}</span>}
        </div>
    );
};
export default FormSingleRadioSelect;