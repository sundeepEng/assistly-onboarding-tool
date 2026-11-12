import { z, ZodTypeAny } from 'zod';

export function makeOptionalOnEmpty<T extends ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    schema.optional()
  );
}



/**
 * Converts `{}` (empty object) to undefined.
 * Useful for optional nested groups like `allegedPerpetratorDetails`.
 */
/** Convert {} (or object with only "", undefined, null) to undefined */
export function makeOptionalOnEmptyObject<T extends ZodTypeAny>(schema: T) {
  return z.preprocess((val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>);
      const isEmpty = entries.length === 0 || entries.every(([, v]) => {
        if (v === "" || v === undefined || v === null) return true;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return Object.keys(v as object).length === 0;
        }
        return false;
      });
      return isEmpty ? undefined : val;
    }
    return val;
  }, schema.optional());
}

/** Remove empty {} items from an array; if all empty -> [] (and optional) */
export function arrayOfNonEmpty<T extends ZodTypeAny>(itemSchema: T) {
  return z
    .array(itemSchema)
    .transform((arr) =>
      arr.filter((item) => {
        if (!item || typeof item !== "object") return true;
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length === 0) return false;
        return entries.some(([, v]) => {
          if (v === "" || v === undefined || v === null) return false;
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            return Object.keys(v as object).length > 0;
          }
          return true;
        });
      })
    )
    .optional();
}