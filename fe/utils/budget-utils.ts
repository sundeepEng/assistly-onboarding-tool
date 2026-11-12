// Helper function to get date range based on period type and selected period
export function getDateRange(periodType: boolean, selectedPeriod: string): { startDate: string; endDate: string } {
  if (!selectedPeriod) {
    return { startDate: '', endDate: '' };
  }

  if (periodType) {
    // Quarterly - format: "2024-Q1"
    const [year, quarter] = selectedPeriod.split('-Q');
    const quarterNum = parseInt(quarter);
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), endMonth, 0).getDate();
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return { startDate, endDate };
  } else {
    // Monthly - format: "2024-03"
    const [year, month] = selectedPeriod.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    return { startDate, endDate };
  }
}

// Helper function to generate last 6 months options and future 3 months
export function getLast6MonthsOptions() {
  const options = [];
  const today = new Date();
  
  // Future 3 months
  for (let i = 3; i >= 1; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    options.push({ option: label, value });
  }

  // Last 6 months including current
  for (let i = 0; i < 6; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    options.push({ option: label, value });
  }
  
  return options;
}

// Helper function to generate quarterly options
export function getQuarterlyOptions() {
  const options = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
  
  // Future 1 quarter
  let nextQuarter = currentQuarter + 1;
  let nextYear = currentYear;
  if (nextQuarter > 4) {
    nextQuarter = 1;
    nextYear += 1;
  }
  options.push({ option: `Q${nextQuarter} ${nextYear}`, value: `${nextYear}-Q${nextQuarter}` });

  // Current + last 3 quarters
  for (let i = 0; i < 4; i++) {
    let year = currentYear;
    let quarter = currentQuarter - i;
    
    if (quarter <= 0) {
      quarter += 4;
      year -= 1;
    }
    
    const value = `${year}-Q${quarter}`;
    const label = `Q${quarter} ${year}`;
    
    options.push({ option: label, value });
  }
  
  return options;
}

// Helper function to get current period based on type
export function getCurrentPeriod(periodType: boolean): string {
  const today = new Date();
  
  if (periodType) {
    // Return current quarter
    const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
    return `${today.getFullYear()}-Q${currentQuarter}`;
  } else {
    // Return current month
    return today.toISOString().slice(0, 7);
  }
}

// Helper to convert snake_case to camelCase
export const snakeToCamel = (str: string) =>
  str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

// Month abbreviations for homeData budget lookup
export const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Format a snake_case category name to Title Case (e.g. "care_fee" → "Care Fee")
export const formatCategoryName = (name: string) =>
  name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// Budget category color mapping — each label:type pair is unique
export const BUDGET_CATEGORY_COLORS: Record<string, Record<string, string>> = {
  income: {
    'Care Fee': '#10b981',        // emerald-500
    'Monthly Fee': '#3b82f6',     // blue-500
    'Entertainment': '#8b5cf6',   // violet-500
    'Transport': '#14b8a6',       // amber-500
    'Medical': '#f97316',         // red-500
    'Misc': '#6b7280',            // gray-500
  },
  expense: {
    'Payroll': '#8dc248',
    'Groceries': '#e35518',       // orange
    'Utilities': '#06b6d4',       // cyan-500
    'Entertainment': '#8b5cf6',   // pink-500
    'Transport': '#14b8a6',       // teal-500
    'Medical': '#f97316',         // orange-500
    'Misc': '#6b7280',            // purple-500
  },
};

// All known category keys (snake_case) derived from BUDGET_CATEGORY_COLORS
// Used to ensure all categories are shown in the overview even if no API data exists yet
export const ALL_INCOME_CATEGORY_KEYS = Object.keys(BUDGET_CATEGORY_COLORS.income).map(
  name => name.toLowerCase().replace(/ /g, '_')
);
export const ALL_EXPENSE_CATEGORY_KEYS = Object.keys(BUDGET_CATEGORY_COLORS.expense).map(
  name => name.toLowerCase().replace(/ /g, '_')
);

// Helper function to get consistent unique color for a category
export function getCategoryColor(categoryName: string, categoryType: 'income' | 'expense' = 'income'): string {
  const typeColors = BUDGET_CATEGORY_COLORS[categoryType];
  if (typeColors && typeColors[categoryName]) {
    return typeColors[categoryName];
  }
  return '#6b7280'; // default gray
}

// Generate budget alerts by comparing thresholds with actual expense data
export interface BudgetAlertItem {
  id: string;
  thresholdName: string;
  category: string;
  type: 'warning' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  percentageUsed: number;
}

export function generateBudgetAlerts(
  homeData: any,
  dashboardMetricsData: any,
  dateRange: { startDate: string; endDate: string } | undefined
): BudgetAlertItem[] {
  if (!homeData || !dashboardMetricsData || !dateRange?.startDate) return [];

  const homeObj = homeData?.home || homeData || {};
  const thresholds = homeObj?.thresholds || {};
  const alerts: BudgetAlertItem[] = [];

  // Iterate all months in the date range
  const [startYear, startMonth] = dateRange.startDate.split('-').map(Number);
  const [endYear, endMonth] = dateRange.endDate.split('-').map(Number);

  let curYear = startYear;
  let curMonth = startMonth;

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
    const yearKey = curYear.toString();
    const monthKey = MONTH_ABBR[curMonth - 1];

    const yearData = thresholds[yearKey];
    if (yearData && yearData[monthKey]) {
      const monthData = yearData[monthKey];

      Object.entries(monthData).forEach(([category, thresholdData]: [string, any]) => {
        if (!thresholdData || typeof thresholdData !== 'object' || !thresholdData.isEnabled) return;

        const thresholdAmount = thresholdData.fixedAmount || 0;
        if (thresholdAmount <= 0) return;

        // Find matching expense in dashboardMetricsData (budget_expense_<snake_case>)
        const snakeCategory = category.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        const metricKey = `budget_expense_${snakeCategory}`;
        const actualValue = (dashboardMetricsData[metricKey] || 0) / 100;

        const percentageUsed = Math.round((actualValue / thresholdAmount) * 100);
        const monthLabel = new Date(curYear, curMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        if (actualValue >= thresholdAmount) {
          const exceededBy = actualValue - thresholdAmount;
          alerts.push({
            id: `${yearKey}-${monthKey}-${category}`,
            thresholdName: thresholdData.thresholdName || `${formatCategoryName(category)} Threshold`,
            category: `${formatCategoryName(category)} (${monthLabel})`,
            type: 'critical',
            message: `${formatCategoryName(category)} expenses have exceeded the budget limit by $${exceededBy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            currentValue: actualValue,
            thresholdValue: thresholdAmount,
            percentageUsed,
          });
        } else if (percentageUsed >= 80) {
          alerts.push({
            id: `${yearKey}-${monthKey}-${category}`,
            thresholdName: thresholdData.thresholdName || `${formatCategoryName(category)} Threshold`,
            category: `${formatCategoryName(category)} (${monthLabel})`,
            type: 'warning',
            message: `${formatCategoryName(category)} expenses have reached ${percentageUsed}% of the threshold`,
            currentValue: actualValue,
            thresholdValue: thresholdAmount,
            percentageUsed,
          });
        }
      });
    }

    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  // Sort: critical first, then warning
  return alerts.sort((a, b) => {
    if (a.type === 'critical' && b.type !== 'critical') return -1;
    if (a.type !== 'critical' && b.type === 'critical') return 1;
    return a.category.localeCompare(b.category);
  });
}

// Helper function to get month name from date string
export function getMonthYear(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Interface for threshold data
export interface ThresholdData {
  id: string;
  name: string;
  category: string;
  month: string;
  thresholdAmount: number;
  status: 'active' | 'inactive';
  enabled: boolean;
}

// Helper function to extract thresholds from homeData
export function extractThresholds(
  homeData: any,
  dateRange: { startDate: string; endDate: string } | undefined,
  periodType: 'monthly' | 'quarterly' | undefined
): ThresholdData[] {
  const homeThresholds = homeData?.home?.thresholds || homeData?.thresholds;

  if (!homeThresholds || !dateRange?.startDate) {
    return [];
  }

  const thresholds: ThresholdData[] = [];

  // Parse start/end manually to avoid timezone issues
  const [startYear, startMonth] = dateRange.startDate.split('-').map(Number);
  const [endYear, endMonth] = dateRange.endDate.split('-').map(Number);

  let curYear = startYear;
  let curMonth = startMonth; // 1-indexed

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
    const yearKey = curYear.toString();
    const monthKey = MONTH_ABBR[curMonth - 1];

    const yearData = homeThresholds[yearKey];
    if (yearData && yearData[monthKey]) {
      const monthData = yearData[monthKey];

      Object.entries(monthData).forEach(([category, thresholdData]: [string, any]) => {
        if (thresholdData && typeof thresholdData === 'object') {
          // Capitalize month abbreviation for display (e.g. 'apr' -> 'April 2026')
          const monthLabel = new Date(parseInt(yearKey), MONTH_ABBR.indexOf(monthKey)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          thresholds.push({
            id: `${yearKey}-${monthKey}-${category}`,
            name: thresholdData.thresholdName || `${category} Threshold`,
            category: category.charAt(0).toUpperCase() + category.slice(1),
            month: monthLabel,
            thresholdAmount: thresholdData.fixedAmount || 0,
            status: thresholdData.isEnabled ? 'active' : 'inactive',
            enabled: thresholdData.isEnabled
          });
        }
      });
    }

    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  return thresholds;
}

export function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}