type QueryParams = {
  [key: string]: string | string[];
};

/**
 * Normalize query parameters from AWS API Gateway event
 * Converts single-value arrays to string and keeps multi-values as array
 */
export function normalizeQueryParams(
  single: { [key: string]: string | undefined } | null,
  multi: { [key: string]: string[] | undefined } | null
): QueryParams {
  const result: QueryParams = {};

  // Handle multiValue query parameters
  if (multi) {
    for (const key of Object.keys(multi)) {
      const values = multi[key];
      if (values && values.length === 1) {
        result[key] = values[0]; // Convert to string if only one value
      } else if (values) {
        result[key] = values; // Keep as array if more than one value
      }
    }
  }

  // Handle singleValue query parameters
  if (single) {
    for (const key of Object.keys(single)) {
      const value = single[key];
      if (value !== undefined && !(key in result)) {
        result[key] = value;
      }
    }
  }

  return result;
}
