import { zodResolver } from "@hookform/resolvers/zod";
import { NextPage } from "next";
import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

type FormData = Record<string, any>;
type FormMethods = ReturnType<typeof useForm<FormData>>;
interface FormProps<T extends FormData> {
  children: any;
  onSubmit: (data: T) => void;
  defaultValues?: T;
  getValues?: T;
  mode?: "all" | "onSubmit" | "onBlur" | "onChange";
  useFormMethodsRef?: React.MutableRefObject<FormMethods>;
  schema: any;
  disabled?: boolean;
}

const Form: NextPage<FormProps<FormData>> = ({
  children,
  onSubmit,
  defaultValues,
  getValues,
  mode = "all",
  schema,
  disabled = false,
  ...props
}) => {
  const [isDisabled, setIsDisabled] = useState(disabled);
  const [formRenderKey, setFormRenderKey] = useState(0);
   useEffect(() => {
    setIsDisabled(disabled);
    setFormRenderKey((prev) => prev + 1);
  }, [disabled]);
  const methods = useForm<FormData>({
    mode: "onChange",
    defaultValues,
    resolver: zodResolver(schema),
  });

  if (props.useFormMethodsRef) {
    props.useFormMethodsRef.current = methods;
  }

  const {
    handleSubmit,
    watch,
    formState: { errors },
  } = methods;
  useEffect(() => {
    watch();
  }, [watch]);

   const submitHandler = (data: FormData) => {
    if (isDisabled) return;
    onSubmit(data);
  };

  // Log errors when they change
  // useEffect(() => {
  //   if (Object.keys(errors).length > 0) {
  //     console.error("Validation Errors:", errors);
  //   }
  // }, [errors]);

  return (
     <FormProvider {...methods}>
      <form
        key={`form-root-${formRenderKey}`}
        onSubmit={handleSubmit(submitHandler)}
        {...props}
      >
        <fieldset
          disabled={isDisabled}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          {children}
        </fieldset>
      </form>
    </FormProvider>
  );
};

export default Form;
