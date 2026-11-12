/**
 * Compatibility shim — the ported module specs import their builders and ids
 * from "../../support/module-commands" (the legacy path). Everything now lives
 * in the layered framework: builders in support/factories, ids in
 * support/constants, cy.* commands in support/commands/module.commands.ts.
 * New specs should import from those modules directly.
 */

export { TEST_HOME_ID, TEST_USER_ID, TEST_LEAD_ID, TEST_SENIOR_ID } from "./constants";
export {
  buildHome,
  buildUserRow,
  buildShiftRow,
  buildInvoiceRow,
  currentBillingPeriod,
  buildDashboardMetrics,
  buildPayoutRow,
  buildTrainingModule,
  buildUserWithDocuments,
  buildCertificate,
} from "./factories";

// Register the cy.* module commands as a side effect of this import.
import "./commands/module.commands";
