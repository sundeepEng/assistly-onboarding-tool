function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function removeEmptyValuesDeep(value: any): any {
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : value;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value
      .map(removeEmptyValuesDeep)
      .filter((item) => item !== undefined);

    return cleanedArray.length === 0 ? undefined : cleanedArray;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, any> = {};

  Object.entries(value).forEach(([key, val]) => {
    const cleaned = removeEmptyValuesDeep(val);

    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  });

  return Object.keys(result).length === 0 ? undefined : result;
}

export function deepMerge<T>(target: T, source: Partial<T>): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source as T;
  }

  const output: Record<string, any> = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = (source as Record<string, any>)[key];
    const targetValue = (target as Record<string, any>)[key];

    // Handle undefined values - this means we want to remove this key
    if (sourceValue === undefined) {
      delete output[key];
      return;
    }

    if (Array.isArray(sourceValue)) {
      output[key] = sourceValue;
      return;
    }

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      output[key] = deepMerge(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output as T;
}

/** ---------------- helpers ---------------- */

export const safeStr = (v: any) =>
  typeof v === "string" ? v : v == null ? "" : String(v);

export const toDateInputValue = (value?: string) => {
  if (!value) return "";
  return value.slice(0, 10);
};

export const splitName = (fullName: string) => {
  const parts = safeStr(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};
