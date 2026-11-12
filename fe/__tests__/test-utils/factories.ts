/**
 * Data factories.
 *
 * Each factory returns a payload that satisfies the module's zod schema, so a
 * test can express "valid except for X" as `makeLead({ email: "nope" })` instead
 * of restating every field.
 */

import { TEST_HOME_ID, TEST_USER_ID } from "./auth";

const uuid = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(
    n
  ).repeat(3)}-${String(n).repeat(12)}`.slice(0, 36);

export const UUIDS = {
  lead: uuid(3),
  referral: uuid(4),
  senior: uuid(5),
  pcg: uuid(6),
  nurse: uuid(7),
  medication: uuid(8),
  home: TEST_HOME_ID,
  user: TEST_USER_ID,
  // RevOps — the `uuid(n)` helper only works for single digits, so the extra ids
  // the billing/payroll payloads need are spelled out.
  invoiceItem: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  payout: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
  payoutItem: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
  pcho: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4",
};

// ── CRM ──────────────────────────────────────────────────────────────────────

/** Minimal valid input for `CreateLeadSchema` / the Add Lead form. */
export const makeLeadInput = (overrides: Record<string, any> = {}) => ({
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@assistly.com",
  mobile: "5551234567",
  ...overrides,
});

/** A lead row as the `/v1/users` list endpoint returns it. */
export const makeLeadRow = (overrides: Record<string, any> = {}) => ({
  userId: UUIDS.lead,
  name: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@assistly.com",
  mobile: "5551234567",
  role: "Lead",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact"],
  createdAt: "2026-01-15T10:00:00.000Z",
  modifiedAt: "2026-01-20T10:00:00.000Z",
  ...overrides,
});

export const makeLeadsResponse = (users = [makeLeadRow()]) => ({ users });

export const makeReferralInput = (overrides: Record<string, any> = {}) => ({
  firstName: "Ravi",
  lastName: "Kumar",
  email: "ravi.kumar@partnerorg.com",
  mobile: "5559876543",
  referralOrgName: "Partner Org",
  ...overrides,
});

export const makeComplianceGuestInput = (overrides: Record<string, any> = {}) => ({
  firstName: "Cora",
  lastName: "Guest",
  email: "cora.guest@assistly.com",
  mobile: "5550001111",
  ...overrides,
});

export const makeNurseInput = (overrides: Record<string, any> = {}) => ({
  firstName: "Nina",
  lastName: "Nurse",
  email: "nina.nurse@assistly.com",
  mobile: "5552223333",
  role: "Nurse" as const,
  ...overrides,
});

// ── Clinical ─────────────────────────────────────────────────────────────────

/** Minimal valid `medication` block for `ClinicalSchema`. */
export const makeMedication = (overrides: Record<string, any> = {}) => ({
  name: "Metformin",
  dosage: "500mg",
  directions: "With food",
  startdate: "2026-02-01",
  timings: ["07:00:00"],
  ...overrides,
});

export const makeMedPassService = (overrides: Record<string, any> = {}) => ({
  medicationId: UUIDS.medication,
  passOrRefuse: "Pass" as const,
  timing: "07:00:00",
  providedBy: UUIDS.pcg,
  ...overrides,
});

export const makeIncidentReport = (overrides: Record<string, any> = {}) => ({
  incidentStartTime: "09:30",
  incidentDescription: "Resident slipped in the hallway",
  ...overrides,
});

export const makeSeniorRow = (overrides: Record<string, any> = {}) => ({
  userId: UUIDS.senior,
  name: "Arthur Bean",
  role: "Senior",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-02T10:00:00.000Z",
  clinical: { roomNumber: 12, status: "active" },
  ...overrides,
});

// ── HCM / Staffing ───────────────────────────────────────────────────────────

/** Minimal valid input for `createUserShiftSchema`. */
export const makeShiftInput = (overrides: Record<string, any> = {}) => ({
  user_id: UUIDS.pcg,
  home_id: TEST_HOME_ID,
  shift_start_time: "2026-03-02T13:00:00.000Z",
  shift_end_time: "2026-03-02T21:00:00.000Z",
  shift_color: "#3b82f6",
  pay_frequency: "Hourly" as const,
  ...overrides,
});

/** A shift row as `/v1/hcm/shifts` returns it. */
export const makeShiftRow = (overrides: Record<string, any> = {}) => ({
  id: 101,
  user_id: UUIDS.pcg,
  user_name: "Priya Patel",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_start_time: "2026-03-02T13:00:00.000Z",
  shift_end_time: "2026-03-02T21:00:00.000Z",
  pay_rate: 12,
  ...overrides,
});

export const makeShiftsResponse = (shifts = [makeShiftRow()]) => ({ shifts });

export const makeTimeOffInput = (overrides: Record<string, any> = {}) => ({
  shift_date: "2026-03-05",
  shift_start_time: "09:00:00",
  shift_end_time: "17:00:00",
  unavailability_reason: "Sick Leave",
  isMultipleDays: false,
  ...overrides,
});

// ── RevOps — billing & invoices ──────────────────────────────────────────────

/** Minimal valid input for `InvoiceSchema`. */
export const makeInvoiceInput = (overrides: Record<string, any> = {}) => ({
  home_id: TEST_HOME_ID,
  user_id: UUIDS.senior,
  billing_period: "2026-02",
  status: "DRAFT" as const,
  total_amount: 2500,
  due_date: "2026-03-15",
  created_by_user_id: TEST_USER_ID,
  ...overrides,
});

/** Minimal valid input for `InvoiceItemSchema`. */
export const makeInvoiceItem = (overrides: Record<string, any> = {}) => ({
  invoice_item_id: UUIDS.invoiceItem,
  item_category: "CARE_FEE" as const,
  description: "Monthly care fee",
  amount: 2500,
  ...overrides,
});

/** An invoice row as GET /v1/revops/invoice returns it. */
export const makeInvoiceRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  invoice_id: "INV-2026-0001",
  home_id: TEST_HOME_ID,
  user_id: UUIDS.senior,
  billing_period: "2026-02",
  status: "DUE",
  total_amount: 2500,
  due_date: "2026-03-15",
  created_by_user_id: TEST_USER_ID,
  items: [makeInvoiceItem()],
  ...overrides,
});

export const makeInvoicesResponse = (invoices = [makeInvoiceRow()]) => ({ invoices });

/** Minimal valid input for `InvoiceFormValidationSchema` (the Add Invoice form). */
export const makeInvoiceFormInput = (overrides: Record<string, any> = {}) => ({
  user_id: UUIDS.senior,
  billing_period: "2026-02",
  due_date: "2026-03-15",
  ...overrides,
});

// ── RevOps — budget ──────────────────────────────────────────────────────────

/** Minimal valid input for `BudgetSchema`. */
export const makeBudgetEntry = (overrides: Record<string, any> = {}) => ({
  transaction_type: "expense" as const,
  category_type: "GROCERIES" as const,
  home_id: TEST_HOME_ID,
  amount_cents: 15000,
  transaction_date: "2026-02-10",
  created_by_user_id: TEST_USER_ID,
  description: "Weekly grocery run",
  entry_mode: "one_time" as const,
  ...overrides,
});

/** The `/v1/revops/budget/dashboard/metrics` body, in cents as the API returns it. */
export const makeDashboardMetrics = (overrides: Record<string, any> = {}) => ({
  total_income: 1200000,
  total_expense: 450000,
  net_balance: 750000,
  utilization: 37.5,
  budget_expense_groceries: 150000,
  budget_expense_utilities: 90000,
  ...overrides,
});

/**
 * A home carrying budget thresholds, shaped `thresholds[year][monthAbbr][category]`
 * — the nested structure `extractThresholds`/`generateBudgetAlerts` walk.
 */
export const makeHomeWithThresholds = (
  thresholds: Record<string, any> = {
    "2026": {
      feb: {
        groceries: {
          thresholdName: "Groceries Cap",
          fixedAmount: 2000,
          isEnabled: true,
        },
      },
    },
  }
) => ({
  home: {
    homeId: TEST_HOME_ID,
    homeName: "Comfort Cove",
    homeType: "Residential",
    authorizedModules: ["CRM", "CLINICAL", "STAFF MANAGEMENT", "COMPLIANCE", "REVOPS"],
    thresholds,
  },
});

// ── RevOps — payroll ─────────────────────────────────────────────────────────

/** Minimal valid input for `PayOutSchema`. */
export const makePayout = (overrides: Record<string, any> = {}) => ({
  payroll_payout_id: "PAY-2026-0001",
  home_id: TEST_HOME_ID,
  pcho_user_id: UUIDS.pcho,
  pcg_user_id: UUIDS.pcg,
  period_type: "BIWEEKLY" as const,
  period_start_date: "2026-02-01",
  period_end_date: "2026-02-14",
  base_amount_cents: 96000,
  total_amount_cents: 96000,
  status: "DRAFT" as const,
  updated_by_user_id: TEST_USER_ID,
  ...overrides,
});

/** Minimal valid input for `PayOutItemSchema`. */
export const makePayoutItem = (overrides: Record<string, any> = {}) => ({
  payout_item_id: UUIDS.payoutItem,
  payout_id: 1,
  description: "Regular hours",
  amount_cents: 96000,
  ...overrides,
});

/** Minimal valid input for `CreatePaymentRequestSchema`. */
export const makePaymentRequest = (overrides: Record<string, any> = {}) => ({
  subject_type: "INVOICE" as const,
  subject_public_id: "INV-2026-0001",
  provider: "MANUAL" as const,
  payer_user_id: UUIDS.senior,
  initiated_by_user_id: TEST_USER_ID,
  ...overrides,
});

// ── Compliance ───────────────────────────────────────────────────────────────

/** Minimal valid input for `uploadTraningModule` (model/home/home-model.ts). */
export const makeTrainingModuleInput = (overrides: Record<string, any> = {}) => ({
  moduleName: "Fire Safety",
  moduleDescription: "Annual fire safety refresher",
  certificateDurationType: "1year",
  ...overrides,
});
