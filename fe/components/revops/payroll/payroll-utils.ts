export function formatCurrency(value: number | undefined | null) {
  const num = Number(value ?? 0);
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatShortDate(value: string) {
  if (!value || value === "-") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${Number(m)}/${Number(d)}/${y}`;
  }
  return value;
}
