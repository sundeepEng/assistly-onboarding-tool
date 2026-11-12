import { format, subMonths, startOfMonth } from 'date-fns';
import { MONTH_RANGE } from './constants';

export interface BillingPeriodOption {
  option: string;
  value: string;
}

/**
 * Generates billing period options for current month and previous two months
 * Returns format: "February 2026" for display and "2026-02" for value
 */
export const getBillingPeriodOptions = (): BillingPeriodOption[] => {
  const options: BillingPeriodOption[] = [];
  
  // Get current month and previous two months
  for (let i = 0; i < MONTH_RANGE; i++) {
    const date = subMonths(new Date(), i);
    const monthYear = format(date, 'MMMM yyyy'); // "February 2026"
    const yearMonth = format(date, 'yyyy-MM'); // "2026-02"
    
    options.push({
      option: monthYear,
      value: yearMonth
    });
  }
  
  return options;
};

// Invoice Item Categories
export const INVOICE_ITEM_CATEGORIES = [
  { option: 'Entertainment', value: 'ENTERTAINMENT' },
  { option: 'Transport', value: 'TRANSPORT' },
  { option: 'Medical', value: 'MEDICAL' },
  { option: 'Miscellaneous', value: 'MISC' },
] as const;

// Invoice Statuses
export const INVOICE_STATUSES = [
  { option: 'Draft', value: 'DRAFT' },
  { option: 'Finalized', value: 'FINALIZED' },
  { option: 'Paid', value: 'PAID' },
  { option: 'Void', value: 'VOID' },
] as const;

// Format currency amount
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Generate invoice ID

// Generate invoice item ID
export const generateInvoiceItemId = (): string => {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate total amount from items
export const calculateTotalAmount = (items: Array<{ amount: number }>): number => {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0);
};

// Validate billing period format (YYYY-MM)
export const isValidBillingPeriod = (period: string): boolean => {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
};

// Format billing period for display (YYYY-MM -> Month YYYY)
export const formatBillingPeriod = (period: string): string => {
  if (!isValidBillingPeriod(period)) return period;
  
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMMM yyyy');
};

// Format billing period month only (YYYY-MM -> Month YYYY)
export const formatBillingPeriodMonth = (period: string): string => {
  if (!isValidBillingPeriod(period)) return period;
  
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMMM yyyy');
};

// Get current billing period
export const getCurrentBillingPeriod = (): string => {
  return format(new Date(), 'yyyy-MM');
};

// Get default due date (15th of next month)
export const getDefaultDueDate = (): string => {
  const nextMonth = subMonths(new Date(), -1);
  return format(nextMonth, 'yyyy-MM-15');
};

// Transform form data to API format
export const transformFormDataToInvoice = (formData: any, userId: string, homeId: string) => {
  const totalAmount = calculateTotalAmount(formData.lineItems || []);
  
  return {
    home_id: homeId,
    user_id: userId,
    billing_period: formData.billingPeriod,
    status: 'DRAFT',
    total_amount: totalAmount,
    due_date: formData.dueDate,
    notes: formData.notes || null,
    items: (formData.lineItems || []).map((item: any, index: number) => ({
      invoice_item_id: generateInvoiceItemId(),
      item_category: item.category,
      description: item.description,
      amount: item.amount,
    })),
  };
};

// Types
export type InvoiceItemCategory = typeof INVOICE_ITEM_CATEGORIES[number]['value'];
export type InvoiceStatus = typeof INVOICE_STATUSES[number]['value'];
export type BillingPeriodOptionType = BillingPeriodOption;




