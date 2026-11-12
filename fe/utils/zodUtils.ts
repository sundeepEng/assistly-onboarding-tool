import { z } from "zod";

export const nullsToUndefinedDeep = (val: unknown): unknown => {
  if (val === null) return undefined;
  if (Array.isArray(val)) return val.map(nullsToUndefinedDeep);
  if (val && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [
        k,
        nullsToUndefinedDeep(v),
      ]),
    );
  }
  return val;
};

export const withNullsAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(nullsToUndefinedDeep, schema);
