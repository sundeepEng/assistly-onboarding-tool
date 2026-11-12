import { getFrontendUrl } from "../getFrontendUrls";

export const REVOPS_PAY_STUB_PERIOD_TYPE_UI = {
  BI_WEEKLY: "Bi-Weekly",
  MONTHLY: "Monthly",
} as const;

export const REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND = {
  BIWEEKLY: "BIWEEKLY",
  MONTHLY: "MONTHLY",
} as const;

export const REVOPS_PAY_STUB_STATUS_BACKEND = {
  PAID: "PAID",
} as const;

export const REVOPS_PAY_STUB_STATUS_UI = {
  PAID: "Paid",
  DUE: "Due",
} as const;

export const REVOPS_PAY_STUB_ACTION_TITLES = {
  EDIT: "Edit pay stub",
  EDIT_DISABLED_PAID: "Paid pay stubs cannot be edited",
} as const;

export const REVOPS_PAY_STUB_PLACEHOLDERS = {
  PERIOD_TYPE: "Select type",
  MONTH: "Select month",
  DATE_RANGE: "Select date range",
  CAREGIVER: "Select caregiver",
  CAREGIVER_LOADING: "Loading caregivers...",
} as const;

export const REVOPS_PAY_STUB_VALIDATION_MESSAGES = {
  PERIOD_TYPE_REQUIRED: "Select pay period type",
  MONTH_REQUIRED: "Select month",
  DATE_RANGE_REQUIRED: "Select date range",
  CAREGIVER_REQUIRED: "Select caregiver",
} as const;

export const REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS = [
  {
    option: REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY,
    value: REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY,
  },
  {
    option: REVOPS_PAY_STUB_PERIOD_TYPE_UI.MONTHLY,
    value: REVOPS_PAY_STUB_PERIOD_TYPE_UI.MONTHLY,
  },
] as const;

export type RevopsSelectOption = { option: string; value: string };

export function revopsPayStubPeriodTypeFromBackend(value?: string) {
  return value === REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY
    ? REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY
    : REVOPS_PAY_STUB_PERIOD_TYPE_UI.MONTHLY;
}

export function revopsPayStubStatusFromBackend(value?: string) {
  return value === REVOPS_PAY_STUB_STATUS_BACKEND.PAID
    ? REVOPS_PAY_STUB_STATUS_UI.PAID
    : REVOPS_PAY_STUB_STATUS_UI.DUE;
}

export function buildRevopsMonthOptions(args?: {
  monthsBack?: number;
  locale?: string;
}): RevopsSelectOption[] {
  const monthsBack = args?.monthsBack ?? 24;
  const locale = args?.locale ?? "en-US";

  const months: RevopsSelectOption[] = [];
  const now = new Date();

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const option = d.toLocaleString(locale, { month: "long", year: "numeric" });
    months.push({ option, value });
  }

  return months;
}

export function buildRevopsBiWeeklyDateRangeOptions(
  selectedMonth?: string,
): RevopsSelectOption[] {
  const defaultOptions: RevopsSelectOption[] = [
    { option: "1st - 15th", value: "1-15" },
    { option: "16th - 31st", value: "16-31" },
  ];

  const getOrdinalSuffix = (day: number) => {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  if (!selectedMonth) return defaultOptions;

  const [yyyy, mm] = selectedMonth.split("-").map(Number);
  if (!yyyy || !mm) return defaultOptions;

  const lastDay = new Date(yyyy, mm, 0).getDate();

  return [
    { option: "1st - 15th", value: "1-15" },
    {
      option: `16th - ${lastDay}${getOrdinalSuffix(lastDay)}`,
      value: `16-${lastDay}`,
    },
  ];
}

export const REVOPS_PAY_STUB_PAYMENT_METHOD_UI = {
  STRIPE: "Stripe",
  MANUAL: "Manual",
} as const;

export const REVOPS_PROCESS_PAYMENT_TEXT = {
  STRIPE_TITLE: "Stripe",
  STRIPE_HELPER: "Process payment instantly via Stripe",
  MANUAL_TITLE: "Record Manual Payment",
  MANUAL_HELPER: "Record an external payment",
  CTA_STRIPE: "Pay with Stripe",
  CTA_MANUAL: "Mark as Paid",
  REFERENCE_LABEL: "Reference ID / Check Number",
  REFERENCE_PLACEHOLDER: "e.g., TXN-2024-001 or Check #1234",
  AMOUNT_LABEL: "Amount",
} as const;

export const REVOPS_PAYMENT_SUBJECT_TYPE_BACKEND = {
  INVOICE: "INVOICE",
  PAYROLL_PAYOUT: "PAYROLL_PAYOUT",
} as const;

export const REVOPS_PAYMENT_PROVIDER_BACKEND = {
  STRIPE: "STRIPE",
  MANUAL: "MANUAL",
} as const;

const getRevopsPayrollUrl = () => {
  const frontendUrl = getFrontendUrl();
  return `${frontendUrl}/revops/payments`;
};

export const REVOPS_PAYMENT_REDIRECT_URLS = {
  SUCCESS: getRevopsPayrollUrl(),
  CANCEL: getRevopsPayrollUrl(),
} as const;

const getRevopsBillingInvoiceUrl = () => {
  const frontendUrl = getFrontendUrl();
  return `${frontendUrl}/revops/billing-invoice`;
};

export const REVOPS_SENIOR_PAYMENT_REDIRECT_URLS = {
  SUCCESS: getRevopsBillingInvoiceUrl(),
  CANCEL: getRevopsBillingInvoiceUrl(),
} as const;

export const REVOPS_PAYMENT_LOADER_TEXT = {
  STRIPE_REDIRECT: "You will be redirected to Stripe...",
  PROCESSING: "Processing payment...",
} as const;

export const REVOPS_PAYMENT_ERROR_MESSAGES = {
  CREATE_FAILED: "Payment failed. Please try again.",
} as const;

export const REVOPS_MANUAL_PAYMENT_TYPE_UI = {
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Check",
  CASH: "Cash",
  PAYPAL: "PayPal",
  ZELLE: "Zelle",
  VENMO: "Venmo",
  OTHER: "Other",
} as const;

export const REVOPS_DEFAULT_MANUAL_PAYMENT_TYPE =
  REVOPS_MANUAL_PAYMENT_TYPE_UI.BANK_TRANSFER;

export const REVOPS_MANUAL_PAYMENT_TYPE_OPTIONS: RevopsSelectOption[] = [
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.BANK_TRANSFER,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.BANK_TRANSFER,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.CHECK,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.CHECK,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.CASH,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.CASH,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.PAYPAL,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.PAYPAL,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.ZELLE,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.ZELLE,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.VENMO,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.VENMO,
  },
  {
    option: REVOPS_MANUAL_PAYMENT_TYPE_UI.OTHER,
    value: REVOPS_MANUAL_PAYMENT_TYPE_UI.OTHER,
  },
] as const;

export function revopsManualMethodToBackend(method: string) {
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.BANK_TRANSFER) return "BANK_TRANSFER";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.CHECK) return "CHECK";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.CASH) return "CASH";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.PAYPAL) return "PAYPAL";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.ZELLE) return "ZELLE";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.VENMO) return "VENMO";
  if (method === REVOPS_MANUAL_PAYMENT_TYPE_UI.OTHER) return "OTHER";
  return "OTHER";
}

export const REVOPS_PAYROLL_PERIOD_STATUS_UI = {
  PAID: "Paid",
  PROCESSED: "Processed",
  PENDING: "Pending",
} as const;
