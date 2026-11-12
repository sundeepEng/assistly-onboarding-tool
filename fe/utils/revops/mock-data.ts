export type RevopsMetric = {
  label: string;
  value: number;
  unit?: "currency" | "number";
  changePct?: number;
  changeLabel?: string;
  helperText?: string;
};

export type CashFlowPoint = {
  date: string;
  income: number;
  expense: number;
};

export type BudgetPoint = {
  date: string;
  planned: number;
  actual: number;
};

export type RecentActivityItem = {
  id: string;
  title: string;
  subtitle?: string;
  amount?: number;
  date: string;
};

export type RevopsDashboardMock = {
  metrics: RevopsMetric[];
  cashFlow: CashFlowPoint[];
  budget: BudgetPoint[];
  recentActivity: RecentActivityItem[];
};

export type RevopsPayrollMetric = {
  label: string;
  value: number;
  unit?: "currency" | "number";
};

export type RevopsPayrollPeriodStatus = "Paid" | "Processed" | "Pending";

export type RevopsPayrollPeriod = {
  id: string;
  status: RevopsPayrollPeriodStatus;
  processedDate: string;
  startDate: string;
  endDate: string;
  employees: number;
  amount: number;
};

export type RevopsPayrollStaffMember = {
  employeeId: string;
  name: string;
  role: string;
  hourlyRate: number;
  hireDate: string;
  status: "active" | "inactive";
};

export type RevopsPayStubStatus = "Paid" | "Due";

export type RevopsPayStubPeriodType = "Bi-Weekly" | "Monthly";

export type RevopsPayStubPaymentMethod = "Stripe" | "Manual";

export type RevopsPayStub = {
  id: string;
  caregiverId: string;
  caregiverName: string;
  payrollPayoutId?: string;
  pchoUserId?: string;
  pcgUserId?: string;
  hourlyRate: number;
  periodType: RevopsPayStubPeriodType;
  dateRange: string;
  hours: number;
  baseAmount: number;
  expenses: number;
  totalAmount: number;
  status: RevopsPayStubStatus;
  paidOn?: string;
  paymentMethod?: RevopsPayStubPaymentMethod;
  referenceId?: string;
};

export type RevopsPayrollSummary = {
  ytdPaid: number;
  ytdDue: number;
  avgHours: number;
  caregiversPaid: number;
  caregiversTotal: number;
};

export type RevopsPayrollMock = {
  metrics: RevopsPayrollMetric[];
  periods: RevopsPayrollPeriod[];
  staff: RevopsPayrollStaffMember[];
  payStubs: RevopsPayStub[];
  summary: RevopsPayrollSummary;
};

export type RevopsBudgetCategoryType = "income" | "expense";

export type RevopsBudgetCategory = {
  id: string;
  name: string;
  type: RevopsBudgetCategoryType;
  allocated: number;
  spent: number;
};

export type RevopsBudgetMock = {
  budgetId: string;
  budgetName: string;
  periodLabel: string;
  periodValue: string;
  totalBudget: number;
  totalSpent: number;
  categories: RevopsBudgetCategory[];
};

export const revopsDashboardMock: RevopsDashboardMock = {
  metrics: [
    {
      label: "Total Revenue",
      value: 95000,
      unit: "currency",
      changePct: 12.5,
      changeLabel: "from last period",
      helperText: "Q1 2024",
    },
    {
      label: "Net Income",
      value: 28260,
      unit: "currency",
      changePct: 8.2,
      changeLabel: "from last period",
      helperText: "After expenses",
    },
    {
      label: "Outstanding Receivables",
      value: 9300,
      unit: "currency",
      changePct: -2,
      changeLabel: "overdue invoices",
      helperText: "Requires attention",
    },
    {
      label: "Pending Payroll",
      value: 15920,
      unit: "currency",
      changeLabel: "Due in 3 days",
      helperText: "Next payment period",
    },
  ],
  cashFlow: [
    { date: "2024-01-01", income: 18000, expense: 12000 },
    { date: "2024-01-15", income: 19000, expense: 12800 },
    { date: "2024-02-01", income: 20000, expense: 13500 },
    { date: "2024-02-15", income: 18500, expense: 14000 },
    { date: "2024-03-01", income: 20500, expense: 15000 },
    { date: "2024-03-15", income: 19500, expense: 14500 },
  ],
  budget: [
    { date: "2024-01-01", planned: 200000, actual: 35000 },
    { date: "2024-01-15", planned: 200000, actual: 60000 },
    { date: "2024-02-01", planned: 200000, actual: 90000 },
    { date: "2024-02-15", planned: 200000, actual: 120000 },
    { date: "2024-03-01", planned: 200000, actual: 145000 },
    { date: "2024-03-15", planned: 200000, actual: 160000 },
  ],
  recentActivity: [
    {
      id: "1",
      title: "Invoice payment received",
      subtitle: "INV-2024-001",
      amount: 4500,
      date: "2024-03-14",
    },
    {
      id: "2",
      title: "Payroll scheduled",
      subtitle: "Period ending Mar 15",
      amount: -15920,
      date: "2024-03-13",
    },
    {
      id: "3",
      title: "New invoice created",
      subtitle: "Margaret Thompson",
      amount: 5200,
      date: "2024-03-12",
    },
  ],
};

export const revopsPayrollMock: RevopsPayrollMock = {
  metrics: [
    { label: "Total Payroll (YTD)", value: 47840, unit: "currency" },
    { label: "Pending Payroll", value: 15920, unit: "currency" },
    { label: "Avg. Hourly Rate", value: 28.33, unit: "number" },
    { label: "Active Employees", value: 3, unit: "number" },
  ],
  summary: {
    ytdPaid: 31880,
    ytdDue: 15960,
    avgHours: 80,
    caregiversPaid: 22,
    caregiversTotal: 34,
  },
  periods: [
    {
      id: "pp-1",
      status: "Paid",
      processedDate: "2024-01-15",
      startDate: "2023-12-31",
      endDate: "2024-01-14",
      employees: 3,
      amount: 15680,
    },
    {
      id: "pp-2",
      status: "Processed",
      processedDate: "2024-01-31",
      startDate: "2024-01-15",
      endDate: "2024-01-30",
      employees: 3,
      amount: 16240,
    },
    {
      id: "pp-3",
      status: "Pending",
      processedDate: "-",
      startDate: "2024-01-31",
      endDate: "2024-02-14",
      employees: 3,
      amount: 15920,
    },
  ],
  staff: [
    {
      employeeId: "EMP-001",
      name: "Sarah Williams",
      role: "Registered Nurse",
      hourlyRate: 35,
      hireDate: "2023-01-14",
      status: "active",
    },
    {
      employeeId: "EMP-002",
      name: "Michael Brown",
      role: "Certified Nursing Assistant",
      hourlyRate: 22,
      hireDate: "2023-03-19",
      status: "active",
    },
    {
      employeeId: "EMP-003",
      name: "Jennifer Martinez",
      role: "Care Coordinator",
      hourlyRate: 28,
      hireDate: "2023-05-09",
      status: "active",
    },
  ],
  payStubs: [
    {
      id: "stub-001",
      caregiverId: "EMP-001",
      caregiverName: "Sarah Williams",
      hourlyRate: 35,
      periodType: "Bi-Weekly",
      dateRange: "Jan 14 - Jan 27, 2024",
      hours: 82,
      baseAmount: 2870,
      expenses: 67,
      totalAmount: 2937,
      status: "Due",
    },
    {
      id: "stub-002",
      caregiverId: "EMP-002",
      caregiverName: "Michael Brown",
      hourlyRate: 22,
      periodType: "Bi-Weekly",
      dateRange: "Jan 14 - Jan 27, 2024",
      hours: 78,
      baseAmount: 1716,
      expenses: 0,
      totalAmount: 1716,
      status: "Due",
    },
    {
      id: "stub-003",
      caregiverId: "EMP-003",
      caregiverName: "Jennifer Martinez",
      hourlyRate: 28,
      periodType: "Bi-Weekly",
      dateRange: "Jan 15 - Jan 30, 2024",
      hours: 80,
      baseAmount: 2240,
      expenses: 25,
      totalAmount: 2265,
      status: "Due",
    },
    {
      id: "stub-004",
      caregiverId: "EMP-001",
      caregiverName: "Sarah Williams",
      hourlyRate: 35,
      periodType: "Bi-Weekly",
      dateRange: "Dec 31 - Jan 13, 2024",
      hours: 80,
      baseAmount: 2800,
      expenses: 45,
      totalAmount: 2845,
      status: "Paid",
      paidOn: "2024-01-15",
      paymentMethod: "Manual",
    },
    {
      id: "stub-005",
      caregiverId: "EMP-002",
      caregiverName: "Michael Brown",
      hourlyRate: 22,
      periodType: "Bi-Weekly",
      dateRange: "Dec 31 - Jan 13, 2024",
      hours: 76,
      baseAmount: 1672,
      expenses: 0,
      totalAmount: 1672,
      status: "Paid",
      paidOn: "2024-01-16",
      paymentMethod: "Stripe",
    },
    {
      id: "stub-006",
      caregiverId: "EMP-003",
      caregiverName: "Jennifer Martinez",
      hourlyRate: 28,
      periodType: "Bi-Weekly",
      dateRange: "Dec 31 - Jan 13, 2024",
      hours: 80,
      baseAmount: 2240,
      expenses: 32,
      totalAmount: 2272,
      status: "Paid",
      paidOn: "2024-01-15",
      paymentMethod: "Stripe",
    },
  ],
};

export const revopsBudgetMock: RevopsBudgetMock = {
  budgetId: "budget-q1-2024",
  budgetName: "Q1 2024 Budget",
  periodLabel: "2024-01",
  periodValue: "2024-01",
  totalBudget: 213000,
  totalSpent: 161740,
  categories: [
    {
      id: "cat-income-1",
      name: "Senior Care Revenue",
      type: "income",
      allocated: 120000,
      spent: 95000,
    },
    {
      id: "cat-expense-1",
      name: "Payroll Expenses",
      type: "expense",
      allocated: 60000,
      spent: 47840,
    },
    {
      id: "cat-expense-2",
      name: "Facility Maintenance",
      type: "expense",
      allocated: 15000,
      spent: 8200,
    },
  ],
};
