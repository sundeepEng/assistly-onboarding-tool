import { useMemo, useRef, useState } from "react";
import { z } from "zod";

type ErrorMap<T> = Partial<Record<keyof T, string>>;
type TouchedMap<T> = Partial<Record<keyof T, boolean>>;

type UseZodFormProps<TSchema extends z.ZodObject<any>> = {
  schema: TSchema;
  initialValues: z.infer<TSchema>;
};

export function useZodForm<TSchema extends z.ZodObject<any>>({
  schema,
  initialValues,
}: UseZodFormProps<TSchema>) {
  type Values = z.infer<TSchema>;
  type Keys = keyof Values;

  const initialRef = useRef<Values>(initialValues);

  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<ErrorMap<Values>>({});
  const [touched, setTouched] = useState<TouchedMap<Values>>({});

  const getObjectSchema = (schema: z.ZodTypeAny): z.AnyZodObject => {
  if (schema instanceof z.ZodEffects) {
    return schema.innerType() as z.AnyZodObject;
  }
  return schema as z.AnyZodObject;
};

  const getFieldError = <K extends Keys>(key: K, value: Values[K]) => {
    const objectSchema = getObjectSchema(schema);
    const fieldSchema = objectSchema.shape[key as string] as z.ZodTypeAny;
    if (!fieldSchema) {
      return "";
    }
    const result = fieldSchema.safeParse(value);
    return result.success
      ? ""
      : result.error.issues[0]?.message || "Invalid value";
  };

  const setFieldValue = <K extends Keys>(key: K, value: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));

    setErrors((prev) => {
      if (!touched[key]) return prev;
      return {
        ...prev,
        [key]: getFieldError(key, value),
      };
    });
  };

  const setMultipleValues = (patch: Partial<Values>) => {
    setValues((prev) => {
      const next = { ...prev, ...patch };

      setErrors((prevErrors) => {
        const updated = { ...prevErrors };

        (Object.keys(patch) as Keys[]).forEach((key) => {
          if (touched[key]) {
            updated[key] = getFieldError(key, next[key]);
          }
        });

        return updated;
      });

      return next;
    });
  };

  const touchField = <K extends Keys>(key: K) => {
    setTouched((prev) => ({ ...prev, [key]: true }));

    setErrors((prev) => ({
      ...prev,
      [key]: getFieldError(key, values[key]),
    }));
  };

  const validateField = <K extends Keys>(key: K) => {
    const message = getFieldError(key, values[key]);
    setErrors((prev) => ({ ...prev, [key]: message }));
    return !message;
  };

 const validateForm = () => {
  const result = schema.safeParse(values);

  if (result.success) {
    setErrors({});
    return true;
  }

  const nextErrors: ErrorMap<Values> = {};
  Object.entries(result.error.flatten().fieldErrors).forEach(([key, value]) => {
    if (value?.[0]) {
      nextErrors[key as Keys] = value[0];
    }
  });

  setErrors(nextErrors);

  const objectSchema = getObjectSchema(schema);

  const nextTouched: TouchedMap<Values> = {};
  (Object.keys(objectSchema.shape) as Keys[]).forEach((key) => {
    nextTouched[key] = true;
  });

  setTouched(nextTouched);

  return false;
};

  const resetForm = (nextValues?: Values) => {
    const finalValues = nextValues ?? initialRef.current;
    initialRef.current = finalValues;
    setValues(finalValues);
    setErrors({});
    setTouched({});
  };

  const markCurrentAsClean = () => {
    initialRef.current = values;
  };

  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(values) !== JSON.stringify(initialRef.current);
    } catch {
      return false;
    }
  }, [values]);

  const bindField = <K extends Keys>(key: K) => ({
    value: values[key],
    onChange: (value: Values[K]) => setFieldValue(key, value),
    onBlur: () => touchField(key),
    error: touched[key] ? errors[key] || "" : "",
  });

  return {
    values,
    setValues,
    setFieldValue,
    setMultipleValues,
    errors,
    touched,
    touchField,
    validateField,
    validateForm,
    resetForm,
    markCurrentAsClean,
    isDirty,
    bindField,
  };
}

/** ---------------- UI atoms (matching your style) ---------------- */
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`
      w-full rounded-2xl bg-white shadow-md border border-solid border-[#D1D5DB] py-2
      print:shadow-none print:border-none print:rounded-none
      ${className}
    `}
  >
    {children}
  </div>
);