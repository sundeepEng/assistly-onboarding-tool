/**
 * Safely returns a fallback value when the given value is null or undefined.
 */
export const safe = <T,>(
  v: T | undefined | null,
  fallback: T = "" as any,
) => v ?? fallback;
