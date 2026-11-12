import { NextPage } from "next";
import { useController } from "react-hook-form";

type FormselectOption = {
  option: string;
  value: string;
};

interface FormSelectComponentProps {
  label: string;
  options: FormselectOption[];
  className?: string;
  value?: string;
  onChange?: (value: React.ChangeEvent<HTMLSelectElement>) => void;
  name: string;
  disabled?: boolean;
  placeHolder?: string;
  titleClass?: string;
  containerClass?: string;
}

const FormSelectComponent: NextPage<FormSelectComponentProps> = ({
  placeHolder = "Select",
  ...props
}) => {
  const {
    field: { value, onChange, ...rest },
    fieldState: { error },
  } = useController({ name: props.name });

  const handleOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e);
    props?.onChange?.(e);
  };

  return (
    <div className="font-poppins">
      <div
        className={`self-stretch flex flex-col items-start justify-start ${props?.className}`}
      >
        <div className="w-full flex flex-col items-start justify-start min-w-[170px] max-w-[625px]">
          <div
            className={`self-stretch flex flex-col items-start justify-start gap-space-200 ${props?.containerClass}`}
          >
            <div
              className={`self-stretch h-[21px] leading-[140%] inline-block z-[0] ${props?.titleClass}`}
            >
              {props?.label}
            </div>
            <select
              {...props}
              {...rest}
              value={value || ""}
              onChange={handleOnChange}
              disabled={props?.disabled}
              className={`block self-stretch h-8 bg-transparent rounded-radius-200 bg-background-default-default border-border-default-default border-[1px] border-solid box-border flex-row items-center justify-start font-poppins text-base min-w-[240px] px-[15px]  ${
                props?.disabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="" disabled>
                {placeHolder}
              </option>
              {props.options.map((option, index) => (
                <option value={option?.value} key={index}>
                  {option?.option}
                </option>
              ))}
            </select>
            {typeof error?.message === "string" && (
              <div className="text-red-500 leading-[140%] font-body-base">
                {error.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSelectComponent;
