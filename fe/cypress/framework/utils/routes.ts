/**
 * Front-end routes under test (pages/). Page objects set these as `path`;
 * specs assert against them after redirects. Keep in sync with the router —
 * a page moved in pages/ is a value changed here.
 */

export const Routes = {
  login: "/login",
  activateAccount: "/activate-account",
  dashboard: "/",
  crm: "/crm",
  clinical: "/clinical",
  hcm: "/hcm",
  compliance: "/compliance",
  revops: "/revops",
  salesDashboard: "/crm/sales-dashboard",
} as const;

/** API endpoint paths (utils/constants.ts) — for interceptApi() calls. */
export const ApiPaths = {
  signin: "/signin",
  signup: "/signup",
  resetPassword: "/reset-password",
  confirmResetPassword: "/confirm-reset-password",
  activateAccount: "/activate-account",
  home: "/v1/home",
  user: "/v1/user",
  users: "/v1/users",
  clinicalUser: "/v1/clinical/user",
  hcmShifts: "/v1/hcm/shifts",
  hcmRoster: "/v1/hcm/roaster",
  hcmTasks: "/v1/tasks",
  invoice: "/v1/revops/invoice",
  payment: "/v1/revops/payment",
  budget: "/v1/revops/budget",
  dashboardMetrics: "/v1/revops/budget/dashboard/metrics",
  salesMetrics: "/v1/crm/sales/metrics",
} as const;
