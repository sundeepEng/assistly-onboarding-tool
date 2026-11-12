import { signUpHandler } from './auth/signup';
import { signInHandler } from './auth/signin';
import { resetPasswordHandler } from './reset-password';
import { confirmResetPasswordHandler } from './confirm-reset-password';
import { getAllUsersHandler } from './get-all-users';
import { getUserByIdHandler } from './get-user-by-id';
import { createUserHandler } from './create-user';
import { updateUserHandler } from './update-user';
import { updatePasswordHandler } from './update-password';
import { updateClinicalHandler } from './update-clinical';
import { s3PresignedUrlHandler } from './s3-pre-signed-url';
import { getRBACRoleHandler } from './rbac/get-rbac';
import { upsertRBACRoleHandler } from './rbac/upsert-rbac';
import { getAllShiftsHandler } from './hcm/get-all-shifts';
import { createShiftHandler } from './hcm/create-shift';
import { updateShiftHandler } from './hcm/update-shift';
import { getShiftsForUserHandler } from './hcm/get-shifts-by-user';
import { deleteShiftHandler } from './hcm/delete-shift';
import { upsertTeamRoasterHandler } from './hcm/upsert-team-roaster';
import { getTeamRoasterHandler } from './hcm/get-team-roaster';
import { upsertHomeHandler } from './home/upsert-home';
import { getHomeByIdHandler } from './home/get-home-by-id';
import { homeTourHandler } from './home/home-tour';
import { initiateESignHandler } from './third-party-integrations/esign/initiate-esign';
import { ESignWebhookHandler } from './third-party-integrations/esign/envelope-webhook';
import { generateESignEnvelopeHandler } from './third-party-integrations/esign/generate-esign-envelope';
import { sqsJobsHandler } from './third-party-integrations/esign/sqs-jobs';
import { createBroadcastHandler } from './hcm/create-broadcast';
import { getAllBroadcastsHandler } from './hcm/get-all-broadcasts';
import { upsertConversationHandler } from './hcm/upsert-conversation';
import { getUserConversationsHandler } from './hcm/get-user-conversations';
import { upsertConversationMessagesHandler } from './hcm/upsert-conversation-messages';
import { getConversationMessagesHandler } from './hcm/get-conversation-messages';
import { deleteUserHandler } from './delete-user';
import { accountActivationHandler } from './auth/activate-account';
import { EmbeddedSignatureHandler } from './third-party-integrations/esign/embedded-sign';
import { refreshTokenHandler } from './auth/refresh-token';
import { webVitalsHandler } from './third-party-integrations/performance/web-vitals';
import { pchoSignUpHandler } from './auth/pcho-signup';
import { homeAdminSignUpHandler } from './auth/home-admin-signup';
import { generateCertificateHandler } from './compliance/generate-certificate';
import { createInvoiceHandler } from './payments/invoice/create-invoice';
import { getAllInvoicesHandler } from './payments/invoice/get-all-invoices';
import { updateInvoiceHandler } from './payments/invoice/update-invoice';
import { registerNotificationDeviceHandler } from './notifications/register-device';
import { deleteNotificationDeviceHandler } from './notifications/delete-device';
import { enqueueNotificationHandler } from './notifications/enqueue-notification';
import { getNotificationEventsHandler } from './notifications/get-notification-events';
import { createSupportTicketHandler } from './support/create-support-ticket';
import { createStripeAccountHandler } from './third-party-integrations/stripe/create-stripe-account';
import { stripeWebhookHandler } from './third-party-integrations/stripe/stripe-webhook';
import { createPayoutHandler } from './payments/payout/create-payout';
import { getAllPayoutsHandler } from './payments/payout/get-all-payouts';
import { updatePayoutHandler } from './payments/payout/update-payout';
import { deletePayoutHandler } from './payments/payout/delete-payout';
import { upsertCampaignHandler } from './crm/upsert-campaign';
import { createStripeOnboardingLinkHandler } from './third-party-integrations/stripe/create-stripe-onboarding-link';
import { createPaymentHandler } from './payments/payment/create-payment';
import { getAllPaymentsHandler } from './payments/payment/get-all-payments';
import { updatePaymentHandler } from './payments/payment/update-payment';
import { createBudgetHandler } from './payments/budget/create-budget';
import { getAllBudgetsHandler } from './payments/budget/get-all-budgets';
import { updateBudgetHandler } from './payments/budget/update-budget';
import { getBudgetDashboardMetricsHandler } from './payments/budget/get-budget-dashboard-metrics';
import { generateDocusealBuilderTokenHandler } from './third-party-integrations/esign/generate-docuseal-builder-token';
import { createDocusealSubmissionHandler } from './third-party-integrations/esign/create-submission';
import { getSalesMetricsHandler } from './crm/get-sales-metrics';
import { createTaskHandler } from './hcm/create-task';
import { getAllTasksHandler } from './hcm/get-all-tasks';
import { updateTaskHandler } from './hcm/update-task';
import { deleteTaskHandler } from './hcm/delete-task';
import { getDailyTaskTrackingHandler } from './hcm/get-daily-task-tracking';
import { upsertTaskDailyTrackingHandler } from './hcm/upsert-task-daily-tracking';

export const handlers = {
  signUpHandler,
  pchoSignUpHandler,
  homeAdminSignUpHandler,
  accountActivationHandler,
  signInHandler,
  resetPasswordHandler,
  confirmResetPasswordHandler,
  refreshTokenHandler,
  createUserHandler,
  getAllUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
  deleteUserHandler,
  updatePasswordHandler,
  updateClinicalHandler,
  s3PresignedUrlHandler,
  getRBACRoleHandler,
  upsertRBACRoleHandler,
  getAllShiftsHandler,
  createShiftHandler,
  updateShiftHandler,
  getShiftsForUserHandler,
  deleteShiftHandler,
  upsertTeamRoasterHandler,
  getTeamRoasterHandler,
  upsertHomeHandler,
  getHomeByIdHandler,
  homeTourHandler,
  initiateESignHandler,
  generateESignEnvelopeHandler,
  EmbeddedSignatureHandler,
  generateDocusealBuilderTokenHandler,
  createDocusealSubmissionHandler,
  ESignWebhookHandler,
  sqsJobsHandler,
  createBroadcastHandler,
  getAllBroadcastsHandler,
  upsertConversationHandler,
  getUserConversationsHandler,
  upsertConversationMessagesHandler,
  getConversationMessagesHandler,
  webVitalsHandler,
  generateCertificateHandler,
  createInvoiceHandler,
  getAllInvoicesHandler,
  updateInvoiceHandler,
  registerNotificationDeviceHandler,
  deleteNotificationDeviceHandler,
  enqueueNotificationHandler,
  getNotificationEventsHandler,
  createSupportTicketHandler,
  createStripeAccountHandler,
  stripeWebhookHandler,
  createPayoutHandler,
  getAllPayoutsHandler,
  updatePayoutHandler,
  deletePayoutHandler,
  upsertCampaignHandler,
  getSalesMetricsHandler,
  createStripeOnboardingLinkHandler,
  createPaymentHandler,
  getAllPaymentsHandler,
  updatePaymentHandler,
  createBudgetHandler,
  getAllBudgetsHandler,
  updateBudgetHandler,
  getBudgetDashboardMetricsHandler,
  createTaskHandler,
  getAllTasksHandler,
  updateTaskHandler,
  deleteTaskHandler,
  getDailyTaskTrackingHandler,
  upsertTaskDailyTrackingHandler,
};
