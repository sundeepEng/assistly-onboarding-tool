const versionTag: string = '/v1';

//Routes
const signUpRoute: string = '/signup';
const pchoSignUpRoute: string = '/pcho-signup';
const homeAdminSignUpRoute: string = '/home-admin-signup';
const accountActivationRoute: string = '/activate-account';
const signInRoute: string = '/signin';
const resetPasswordRoute: string = '/reset-password';
const confirmResetPasswordRoute: string = '/confirm-reset-password';
const refreshTokenRoute: string = '/refresh-token';
const createUserRoute: string = versionTag + '/user';
const getAllUsersRoute: string = versionTag + '/users';
const getUserByIdRoute: string = versionTag + '/user/{id}';
const updateUserRoute: string = versionTag + '/user/{id}';
const deleteUserRoute: string = versionTag + '/user/{id}';
const homeTourRoute: string = versionTag + '/user/home-tour';
const updatePasswordRoute: string = '/update-password';
const updateClinicalRoute: string = versionTag + '/clinical/user/{id}';
const s3PreSignedURLRoute: string = versionTag + '/s3-pre-signed-url';
const rbacRoute: string = versionTag + '/rbac';
const getAllShiftsRoute: string = versionTag + '/hcm/shifts';
const createShiftRoute: string = versionTag + '/hcm/shift';
const getShiftsByUserIdRoute: string = versionTag + '/hcm/shifts/user/{id}';
const updateShiftRoute: string = versionTag + '/hcm/shift/{id}';
const deleteShiftRoute: string = versionTag + '/hcm/shift/{id}';
const createPayrollRoute: string = versionTag + '/hcm/payroll';
const getPayrollsRoute: string = versionTag + '/hcm/payrolls';
const upsertTeamRoasterRoute: string = versionTag + '/hcm/roaster';
const getTeamRoasterRoute: string = versionTag + '/hcm/roasters';
const upsertHomeRoute: string = versionTag + '/home';
const getHomeByIdRoute: string = versionTag + '/home/{id}';
const campaignRoute: string = versionTag + '/crm/campaign';
const salesMetricsRoute: string = versionTag + '/crm/sales/metrics';
const initiateESignRoute: string = versionTag + '/initiate-esign';
const eSignWebhookRoute: string = versionTag + '/esign-webhook';
const embeddedSignRoute: string = versionTag + '/slug-url';
const docusealBuilderTokenRoute: string = versionTag + '/docuseal/builder-token';
const docusealCreateSubmissionRoute: string = versionTag + '/docuseal/create-submission';
const sqsJobStatusRoute: string = versionTag + '/sqs-job-status/{id}';
const createBroadcastRoute: string = versionTag + '/hcm/broadcast';
const getAllBroadcastsRoute: string = versionTag + '/hcm/broadcasts';
const upsertConversationRoute: string = versionTag + '/hcm/communication/conversation';
const getUserConversationsRoute: string = versionTag + '/hcm/communication/conversations';
const upsertConversationMessagesRoute: string =
  versionTag + '/hcm/communication/conversation/message';
const getConversationMessagesRoute: string =
  versionTag + '/hcm/communication/conversation/{id}/messages';
const webVitalsRoute: string = versionTag + '/performance/web-vitals';
const generateCertificateRoute: string = versionTag + '/compliance/generate-certificate';
const createInvoiceRoute: string = versionTag + '/revops/invoice';
const updateInvoiceRoute: string = versionTag + '/revops/invoice/{id}';
const payoutRoute: string = versionTag + '/revops/payout';
const paymentRoute: string = versionTag + '/revops/payment';
const updatePayoutRoute: string = versionTag + '/revops/payout/{id}';
const updatePaymentRoute: string = versionTag + '/revops/payment/{id}';
const stripeCreateAccountRoute: string = versionTag + '/revops/stripe/create-account';
const stripeOnboardingLinkRoute: string = versionTag + '/revops/stripe/onboarding-link';
const stripeWebhookRoute: string = versionTag + '/revops/stripe/webhook';
const budgetRoute: string = versionTag + '/revops/budget';
const updateBudgetRoute: string = versionTag + '/revops/budget/{id}';
const budgetDashboardMetricsRoute: string = versionTag + '/revops/budget/dashboard/metrics';
const registerNotificationDeviceRoute: string = versionTag + '/notifications/devices';
const deleteNotificationDeviceRoute: string = versionTag + '/notifications/devices/{deviceId}';
const enqueueNotificationRoute: string = versionTag + '/notifications';
const getNotificationEventsRoute: string = versionTag + '/notifications/events';
const supportRoute: string = versionTag + '/support';
const createTaskRoute: string = versionTag + '/task';
const getAllTasksRoute: string = versionTag + '/tasks';
const updateTaskRoute: string = versionTag + '/task/{id}';
const deleteTaskRoute: string = versionTag + '/task/{id}';
const taskDailyTrackingRoute: string = versionTag + '/task-daily-tracking';

export const Routes = {
  signUpRoute,
  pchoSignUpRoute,
  homeAdminSignUpRoute,
  signInRoute,
  accountActivationRoute,
  resetPasswordRoute,
  confirmResetPasswordRoute,
  refreshTokenRoute,
  getAllUsersRoute,
  getUserByIdRoute,
  createUserRoute,
  updateUserRoute,
  deleteUserRoute,
  homeTourRoute,
  updatePasswordRoute,
  updateClinicalRoute,
  s3PreSignedURLRoute,
  rbacRoute,
  getAllShiftsRoute,
  createShiftRoute,
  getShiftsByUserIdRoute,
  updateShiftRoute,
  deleteShiftRoute,
  createPayrollRoute,
  getPayrollsRoute,
  upsertTeamRoasterRoute,
  getTeamRoasterRoute,
  upsertHomeRoute,
  getHomeByIdRoute,
  campaignRoute,
  salesMetricsRoute,
  initiateESignRoute,
  eSignWebhookRoute,
  embeddedSignRoute,
  docusealBuilderTokenRoute,
  docusealCreateSubmissionRoute,
  sqsJobStatusRoute,
  createBroadcastRoute,
  getAllBroadcastsRoute,
  upsertConversationRoute,
  getUserConversationsRoute,
  upsertConversationMessagesRoute,
  getConversationMessagesRoute,
  webVitalsRoute,
  generateCertificateRoute,
  createInvoiceRoute,
  updateInvoiceRoute,
  registerNotificationDeviceRoute,
  deleteNotificationDeviceRoute,
  enqueueNotificationRoute,
  getNotificationEventsRoute,
  stripeCreateAccountRoute,
  stripeOnboardingLinkRoute,
  stripeWebhookRoute,
  supportRoute,
  createTaskRoute,
  getAllTasksRoute,
  updateTaskRoute,
  deleteTaskRoute,
  taskDailyTrackingRoute,
  payoutRoute,
  paymentRoute,
  updatePayoutRoute,
  updatePaymentRoute,
  budgetRoute,
  updateBudgetRoute,
  budgetDashboardMetricsRoute,
};

//Methods
const httpMethodGet: string = 'GET';
const httpMethodPost: string = 'POST';
const httpMethodPut: string = 'PUT';
const httpMethodDelete: string = 'DELETE';

export const Methods = {
  httpMethodDelete,
  httpMethodGet,
  httpMethodPut,
  httpMethodPost,
};

//Other variables
export const unprotectedRoutes: string[] = [
  signInRoute,
  pchoSignUpRoute,
  homeAdminSignUpRoute,
  accountActivationRoute,
  resetPasswordRoute,
  confirmResetPasswordRoute,
  eSignWebhookRoute,
  refreshTokenRoute,
  webVitalsRoute,
  stripeWebhookRoute,
];

const initialContact: string = 'initial contact';
const tour: string = 'tour';
const onboarding: string = 'onboarding';
const contract: string = 'contract';
const lost: string = 'lost';

export const Milestones = {
  initialContact,
  tour,
  onboarding,
  contract,
  lost,
};

const PCHO: string = 'PCHO';
const LEAD: string = 'Lead';
const SENIOR: string = 'Senior';
const PCGLEAD: string = 'PCGLead';
const PCG: string = 'PCG';
const REFERRAL: string = 'Referral';
const COMPLIANCEGUEST: string = 'ComplianceGuest';
const NURSE: string = 'Nurse';
const NURSELEAD: string = 'NurseLead';
const HOMEADMIN: string = 'HomeAdmin';
const SALESREPRESENTATIVE: string = 'SalesRepresentative';
const SALESDIRECTOR: string = 'SalesDirector';

export const UserTypes = {
  PCHO,
  LEAD,
  SENIOR,
  PCG,
  PCGLEAD,
  REFERRAL,
  COMPLIANCEGUEST,
  NURSE,
  NURSELEAD,
  HOMEADMIN,
  SALESREPRESENTATIVE,
  SALESDIRECTOR,
};

export const DocumentCategory = {
  ONBOARDING: 'onboarding',
  CERTIFICATE: 'certificate',
  OTHER: 'other',
};

export const HomeTypes = {
  PERSONAL_CARE_HOME: 'Personal Care Home',
  IN_HOME_CARE: 'In Home Care',
  ASSISTED_LIVING: 'Assisted Living',
  MEMORY_CARE: 'Memory Care',
  ADULT_DAY_CENTER: 'Adult Day Center',
};

export const DocumentStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  DECLINED: 'declined',
};

export const DEFAULT_HOME_CAPACITY: number = 10;

const usersTableName: string = 'users';
const clinicalTableName: string = 'clinical';
const homeTableName: string = 'home';
const roleAssetsMappingTableName: string = 'role-assets-mapping';
const sqsJobsTableName: string = 'sqs-jobs';
const notificationDevicesTableName: string = 'notification-devices';
const wsConnectionsTableName: string = 'ws-connections';
export const DynamoTableNames = {
  usersTableName,
  clinicalTableName,
  homeTableName,
  roleAssetsMappingTableName,
  sqsJobsTableName,
  notificationDevicesTableName,
  wsConnectionsTableName,
};
