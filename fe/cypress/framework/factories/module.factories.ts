/**
 * Module-level factories — response builders for the authenticated suites
 * (CRM, Clinical, HCM, Compliance, RevOps, Dashboard).
 *
 * Ported from the legacy module-commands.ts. Auth-side builders live in the
 * sibling factory files (token/home/user).
 */

import { TEST_HOME_ID, TEST_SENIOR_ID, TEST_USER_ID } from "../constants";

/** A shift row as GET /v1/hcm/shifts returns it. */
export const buildShiftRow = (overrides: Record<string, any> = {}) => ({
  id: 101,
  user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_name: "Priya Patel",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_start_time: "2026-03-02T13:00:00.000Z",
  shift_end_time: "2026-03-02T21:00:00.000Z",
  pay_rate: 12,
  ...overrides,
});

/** An invoice row as GET /v1/revops/invoice returns it. Amounts are dollars. */
export const buildInvoiceRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  invoice_id: "INV-2026-0001",
  home_id: TEST_HOME_ID,
  user_id: TEST_SENIOR_ID,
  billing_period: currentBillingPeriod(),
  status: "DUE",
  total_amount: 2500,
  due_date: "2026-03-15",
  created_by_user_id: TEST_USER_ID,
  items: [
    {
      invoice_item_id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
      item_category: "CARE_FEE",
      description: "Monthly care fee",
      amount: 2500,
    },
  ],
  ...overrides,
});

/**
 * The billing screen initialises its month filter to `new Date()` and filters
 * invoices by `billing_period === filterMonth`, so fixtures have to be stamped
 * with the *current* month or the stats read zero.
 */
export function currentBillingPeriod() {
  return new Date().toISOString().slice(0, 7);
}

/** The GET /v1/revops/budget/dashboard/metrics body. Amounts are **cents**. */
export const buildDashboardMetrics = (overrides: Record<string, any> = {}) => ({
  total_income: 1200000,
  total_expense: 450000,
  net_balance: 750000,
  utilization: 37.5,
  budget_expense_groceries: 150000,
  budget_expense_utilities: 90000,
  ...overrides,
});

/** A payout row as GET /v1/revops/payout returns it. Amounts are **cents**. */
export const buildPayoutRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  payroll_payout_id: "PAY-2026-0001",
  home_id: TEST_HOME_ID,
  pcho_user_id: TEST_USER_ID,
  pcg_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  period_type: "BIWEEKLY",
  period_start_date: "2026-02-01",
  period_end_date: "2026-02-14",
  base_amount_cents: 96000,
  total_amount_cents: 96000,
  status: "FINALIZED",
  updated_by_user_id: TEST_USER_ID,
  items: [],
  ...overrides,
});

/** A compliance training module as it is stored on `home.complianceTraining`. */
export const buildTrainingModule = (overrides: Record<string, any> = {}) => ({
  moduleId: "module-fire-safety",
  moduleName: "Fire Safety",
  moduleDescription: "Annual fire safety refresher",
  createdAt: "2026-01-10T10:00:00.000Z",
  modifiedAt: "2026-01-10T10:00:00.000Z",
  createdByUserId: TEST_USER_ID,
  documents: [
    {
      documentId: "fire-safety-video",
      documentName: "Fire Safety_video",
      // Must be one of ComplianceTrainingAllowedTypes or the screen filters the
      // whole module out (components/compliance/compliance-training.tsx).
      documentType: ".mp4",
      documentUrl: "https://bucket.s3.amazonaws.com/fire-safety.mp4",
    },
  ],
  ...overrides,
});

/** A user record as GET /v1/user/{id} returns it, with compliance documents. */
export const buildUserWithDocuments = (documents: any[] = []) => ({
  userId: TEST_USER_ID,
  name: "Test User",
  role: "PCHO",
  homeId: TEST_HOME_ID,
  completedComplianceModules: [],
  documents,
});

/** A certificate on a user record — `documentCategory` drives the certificates page. */
export const buildCertificate = (overrides: Record<string, any> = {}) => ({
  documentId: "cert-fire-safety",
  documentName: "Fire Safety Certificate",
  documentCategory: "certificate",
  documentType: ".pdf",
  documentUrl: "https://bucket.s3.amazonaws.com/certs/fire-safety.pdf",
  documentExpiryDate: "2027-01-10",
  createdByUserId: TEST_USER_ID,
  createdAt: "2026-01-10T10:00:00.000Z",
  ...overrides,
});
