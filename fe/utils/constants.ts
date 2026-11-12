import { getS3PreSignedFromattedUrl } from "./uploadToS3";


export interface DocumentType {
  id: string;
  name: string;
  required: boolean;
  uploadType: "direct" | "withExpiration";
  alertPeriodInDays?: number;
}

export const AUDIENCE_LABELS = {
  referral: "Referrals",
  senior: "Leads",
} as const;

const INITIAL_CONTACT: string = "initial contact";
const TOUR: string = "tour";
const ON_BOARDING: string = "onboarding";
const CONTRACT: string = "contract";
const LOST: string = "lost";

export const ID_TOKEN = "idToken";
export const ACCESS_TOKEN = "accessToken";
export const USER_ID = "userId";

export const MEDICATION_EXTRACTION_URL = "/api/extract-medications";
export const ADL_TEMPLATE_EXTRACTION_URL = "/api/extract-adls";

export const MealToTimeMap: Record<string, string> = {
  breakfast: "07:00:00",
  morning: "07:00:00",
  am: "07:00:00",
  lunch: "12:00:00",
  noon: "12:00:00",
  midday: "12:00:00",
  afternoon: "12:00:00",
  dinner: "19:00:00",
  evening: "19:00:00",
  supper: "19:00:00",
  pm: "19:00:00",
  bedtime: "21:00:00",
  night: "21:00:00",
  hs: "21:00:00",
};

export const milestones = {
  INITIAL_CONTACT,
  TOUR,
  ON_BOARDING,
  CONTRACT,
  LOST,
};

export const InHomeCare = "In Home Care";

//FLAGS

export const accessAllModules=[
    "CRM",
    "CLINICAL",
    "STAFF MANAGEMENT",
    "COMPLIANCE",
    "REVOPS",
]


//Sidenavbar Elements
export const REFERRAL_AGENT = "Referral Agents";

export const CLINICAL = "clinical";
export const CRM = "crm";
export const COMPLIANCE = "compliance";

const PCHO: string = "PCHO";
export const NURSE: string = "Nurse";
export const PCG: string = "PCG";
export const SENIOR: string = "Senior";
const LEAD: string = "Lead";
const PCGLEAD: string = "PCGLead";
const NURSELEAD: string = "NurseLead";
const HCM: string = "HCM";
const TEAM: string = "Care Team";
const SALES_TEAM: string = "Sales Team";
const TIMESHEET: string = "Timesheet";
const SCHEDULING: string = "Scheduling";
const DOCUMENTS: string = "Documents";
const TRAINING: string = "Training";
const CERTIFICATES: string = "Certificates";
const REFERRAL: string = "Referral";
const COMPLIANCE_GUEST: string = "ComplianceGuest";
const HOME_ADMIN: string = "HomeAdmin";
const STAFF_MANAGEMENT: string = "StaffManagement";
const DASHBOARD: string = "Dashboard";
const TASKS: string = "Tasks";

export const sidebarMenuItems = {
  CRM: "CRM",
  LEAD,
  REFERRAL_AGENT,
  PCGLEAD: "PCG Lead",
  NURSELEAD: "Nurse Lead",
  COMPLIANCE_GUEST: "Compliance Guest",
  CLINICAL: "Clinical",
  SENIOR,
  PCG,
  STAFF_MANAGEMENT: "Staff Management",
  TIMESHEET,
  SCHEDULING,
  TEAM,
  SALES_TEAM,
  COMPLIANCE: "Compliance",
  DOCUMENTS,
  TRAINING,
  CERTIFICATES,
  DASHBOARD,
  TASKS,
};

export const routeItems = {
  CRM: "crm",
  REFERRAL: "referral",
  PCG: "pcg",
  NURSE: "nurse",
  COMPLIANCE_GUEST: "complianceguest",
  CLINICAL: "clinical",
  STAFF_MANAGEMENT: "hcm",
  REVOPS: "revops",
};

export const sideNav = {
  crm: [LEAD, REFERRAL_AGENT, PCGLEAD, NURSELEAD, COMPLIANCE_GUEST, NURSE],
  clinical: [SENIOR, PCG, HCM, NURSE],
  hcm: [TEAM, SALES_TEAM, TIMESHEET, SCHEDULING, DASHBOARD, TASKS],
  compliance: [DOCUMENTS, TRAINING, CERTIFICATES],
};

type Section = "crm" | "clinical" | "hcm" | "compliance" | "revops";

type SidebarItem = {
  name: string;
  icon?: any;
  path: string;
  key: string;
  section: Section;
  feature?: string;
};

export const getSidebarCellData = (role?: string): SidebarItem[] => [
  {
    name: role === SENIOR ? "My Details" : "Senior Leads",
    path: "/crm",
    key: routeItems.CRM,
    section: "crm",
    feature: "CRM",
  },
  {
    name: "Referral Agents",
    path: "/crm/referral",
    key: routeItems.REFERRAL,
    section: "crm",
    feature: "CRM_REFERRAL",
  },
  {
    name: "Care Leads",
    path: "/crm/pcg",
    key: routeItems.PCG,
    section: "crm",
    feature: "CRM_PCG",
  },
  {
    name: "Nurse Leads",
    path: "/crm/nurse",
    key: routeItems.NURSE,
    section: "crm",
    feature: "CRM_NURSE",
  },
  {
    name: "Compliance Guests",
    // icon:ComplianceDashboardIcon,
    path: "/crm/complianceguest",
    key: routeItems.COMPLIANCE_GUEST,
    section: "crm",
    feature: "CRM_COMPLIANCE_GUEST",
  },
  {
    name: "Sales Dashboard",
    path: "/crm/sales-dashboard",
    key: "sales-dashboard",
    section: "crm",
    feature: "CRM_SALES_DASHBOARD",
  },
  {
    name: "Seniors",
    path: "/clinical",
    key: routeItems.CLINICAL,
    section: "clinical",
    feature: "CLINICAL",
  },
  {
    name: "Care Team",
    path: "/clinical/pcg",
    key: routeItems.PCG,
    section: "clinical",
    feature: "CLINICAL_PCG",
  },
  {
    name: "Nurses",
    path: "/clinical/nurse",
    key: routeItems.NURSE,
    section: "clinical",
    feature: "CLINICAL_NURSE",
  },
  {
    name: sidebarMenuItems.DASHBOARD,
    path: "/hcm",
    key: routeItems.STAFF_MANAGEMENT,
    section: "hcm",
    feature: "HCM_DASHBOARD",
  },
  {
    name: sidebarMenuItems.SCHEDULING,
    path: "/hcm/scheduling",
    key: "scheduling",
    section: "hcm",
    feature: "HCM_SCHEDULING",
  },
  {
    name: sidebarMenuItems.TASKS,
    path: "/hcm/tasks",
    key: "tasks",
    section: "hcm",
    feature: "HCM_TASKS",
  },
  {
    name: sidebarMenuItems.TIMESHEET,
    path: "/hcm/timesheet",
    key: "timesheet",
    section: "hcm",
    feature: "HCM_TIMESHEETS",
  },
  {
    name: sidebarMenuItems.TEAM,
    path: "/hcm/team",
    key: "team",
    section: "hcm",
    feature: "HCM_TEAM_ROASTER",
  },
  {
    name: sidebarMenuItems.SALES_TEAM,
    path: "/hcm/sales-team",
    key: "sales-team",
    section: "hcm",
    feature: "HCM_SALES_TEAM",
  },
  {
    name: sidebarMenuItems.DOCUMENTS,
    path: "/compliance",
    key: "compliance",
    section: "compliance",
    feature: "COMPLIANCE_DOCUMENTS",
  },
  {
    name: sidebarMenuItems.TRAINING,
    path: "/compliance/training",
    key: "training",
    section: "compliance",
    feature: "COMPLIANCE_TRAINING",
  },
  {
    name: sidebarMenuItems.CERTIFICATES,
    path: "/compliance/certificates",
    key: "certificates",
    section: "compliance",
    feature: "COMPLIANCE_CERTIFICATES",
  },
  {
    name: "Budget",
    path: "/revops/budget",
    key: "budget",
    section: "revops",
    feature: "REVOPS_BUDGET",
  },
  role !== userRoles?.PCHO && {
    name: "Dashboard",
    path: "/revops",
    key: routeItems.REVOPS,
    section: "revops",
    feature: "REVOPS_DASHBOARD",
  },
  {
    name: "Billing & Invoice",
    path: "/revops/billing-invoice",
    key: "billing-invoice",
    section: "revops",
    feature: "REVOPS_BILLING_INVOICE",
  },
  {
    name: role === userRoles.PCG ? "My Payment" : "Payment",
    path: "/revops/payments",
    key: "payroll",
    section: "revops",
    feature: "REVOPS_PAYROLL",
  },
];

// Sales team role constants (matching backend UserTypes)
const SALES_REPRESENTATIVE: string = "SalesRepresentative";
const SALES_DIRECTOR: string = "SalesDirector";

export const userRoles = {
  PCHO,
  NURSE,
  NURSELEAD,
  PCG,
  SENIOR,
  LEAD,
  REFERRAL,
  PCGLEAD,
  COMPLIANCE_GUEST,
  SALES_REPRESENTATIVE,
  SALES_DIRECTOR,
  HOME_ADMIN,
};

const COMFORT_COVE: string = "comfort cove";

export const defaultPayRate = 12;

export const WEEK_DAYS_SHORT = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export const MIN_HOURS_DISPLAY_TEXT = 3; // 3 hours

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  VOID: "VOID",
  PENDING_APPROVAL: "PENDING_APPROVAL",
}

export const MONTH_RANGE = 3;

export const ComplianceTrainingAllowedTypes = [".mp4", ".ppt", ".pptx"];
export const ComplainceUploadTrainingAllowedTypes = {
  "video/mp4": "mp4",
  "application/vnd.ms-powerpoint": "ppt", // For older .ppt format
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx", // For .pptx format
};

export const homes = {
  COMFORT_COVE,
};
export const Yes = "Yes";
export const No = "No";
export const booleanOptions = [
  { option: "No", value: "No" },
  { option: "Yes", value: "Yes" },
];

export const roleOptions = [
  { option: "PCG", value: "PCG" },
  { option: "PCHO", value: "PCHO" },
];

export const genderOptions = [
  { option: "Female", value: "Female" },
  { option: "Male", value: "Male" },
  { option: "Other", value: "Other" },
];

export const raceOptions = [
  { option: "American Indian", value: "American Indian" },
  { option: "Asian", value: "Asian" },
  { option: "African American", value: "African American" },
  { option: "Hispanic or Latino", value: "Hispanic or Latino" },
  { option: "Caucasian", value: "Caucasian" },
  { option: "Other", value: "Other" },
];

export const contactOptions = [
  { option: "Email", value: "Email" },
  { option: "Phone", value: "Phone" },
];

export const maritalStatusOptions = [
  { option: "Single", value: "Single" },
  { option: "Married", value: "Married" },
  // TODO: Add more marital status options as needed
];


export const emergencyRelationOptions = [
  { option: "Spouse", value: "Spouse" },
  { option: "Sibling", value: "Sibling" },
  { option: "Other", value: "Other" },
];

export const OccupationOptions = [
  { option: "Veteran", value: "Veteran" },
  { option: "Other", value: "Other" },
];
export const levelOfPainOptions = [
  { option: "No Pain", value: "No Pain" },
  { option: "Mild Pain", value: "Mild Pain" },
  { option: "Moderate Pain", value: "Moderate Pain" },
  { option: "Severe Pain", value: "Severe Pain" },
  {
    option: "Request Pain Management Support",
    value: "Request Pain Management Support",
  },
];

export const chronicIllnessOptions = [
  { option: "None", value: "None" },
  { option: "Require ongoing monitoring", value: "Require ongoing monitoring" },
  { option: "Require medication support", value: "Require medication support" },
  {
    option: "Require specialist intervention",
    value: "Require specialist intervention",
  },
];

export const shortTermIllnessOptions = [
  { option: "None", value: "None" },
  {
    option: "Require temporary assistance",
    value: "Require temporary assistance",
  },
  { option: "Require medication support", value: "Require medication support" },
];

export const recurringIllnessOptions = [
  { option: "None", value: "None" },
  { option: "Minor", value: "Minor" },
  { option: "Moderate", value: "Moderate" },
  {
    option: "Severe, Require regular monitoring",
    value: "Severe, Require regular monitoring",
  },
];

export const reasonForTimeOffOptions = [
  { option: "Vacation(Unpaid)", value: "Vacation(Unpaid)" },
  { option: "Vacation(Paid)", value: "Vacation(Paid)" },
  { option: "Hoilday", value: "Hoilday" },
  { option: "Jury Duty", value: "Jury Duty" },
  { option: "Sick Leave", value: "Sick Leave" },
  { option: "Personal Medical Emergency", value: "Personal Medical Emergency" },
  { option: "Family Medical Emergency", value: "Family Medical Emergency" },
  { option: "Other", value: "Other" },
];

export const physicalDisabilitiesOptions = [
  { option: "None", value: "None" },
  {
    option: "Mobility aids needed [Wheelchair, Walker]",
    value: "Mobility aids needed [Wheelchair,Walker]",
  },
  { option: "Limited mobility", value: "Limited mobility" },
  { option: "Request full assistance", value: "Request full assistance" },
];

export const nursingProceduresOptions = [
  { option: "Not Applicable", value: "Not Applicable" },
  {
    option: "Requires daily nursing procedures",
    value: "Requires daily nursing procedures",
  },
  {
    option: "Requires weekly nursing procedures",
    value: "Requires weekly nursing procedures",
  },
  {
    option: "Requires specialized nursing procedures",
    value: "Requires specialized nursing procedures",
  },
];

export const eyeSightOptions = [
  { option: "Normal Vision", value: "Normal Vision" },
  {
    option: "Requires glasses / corrective lenses",
    value: "Requires glasses/Corrective lenses",
  },
  { option: "Partially impaired vision", value: "Partially impaired vision" },
  { option: "Severe vision impairment", value: "Severe vision impairment" },
  { option: "Blind", value: "Blind" },
];

export const hearingOptions = [
  { option: "Normal hearing", value: "Normal hearing" },
  { option: "Requires hearing aid", value: "Requires hearing aid" },
  { option: "Partially hearing impaired", value: "Partially hearing impaired" },
  {
    option: "Completely hearing impaired",
    value: "Completely hearing impaired",
  },
];
export const levelOfCareOptions = [
  { option: "Independent", value: "Independent" },
  { option: "Monitor & Cue", value: "Monitor & Cue" },
  { option: "Full Assistance", value: "Full Assistance" },
];

export const levelOfCareReducedOptions = [
  { option: "Independent", value: "Independent" },
  { option: "Full Assistance", value: "Full Assistance" },
];

export const housekeepingServiceOptions = [
  { option: "Not Required", value: "Not Required" },
  { option: "Staff Assisted", value: "Staff Assisted" },
  { option: "Scheduled - Weekly", value: "Scheduled - Weekly" },
  { option: "Scheduled - Daily", value: "Scheduled - Daily" },
  { option: "On Request", value: "On Request" },
];
// Flat 3-option list for the Add Service category dropdown
export const ADD_SERVICE_CATEGORY_OPTIONS = [
  { option: "ADL Service", value: "adl" },
  { option: "Vital Signs", value: "vitals" },
  { option: "House Chores", value: "housekeeping" },
];

export const TASK_CATEGORY_OPTIONS = [
  { option: "Cleaning", value: "Cleaning" },
  { option: "Kitchen", value: "Kitchen" },
  { option: "Laundry", value: "Laundry" },
  { option: "Medication", value: "Medication" },
  { option: "Inventory", value: "Inventory" },
  { option: "Security", value: "Security" },
  { option: "Outdoor", value: "Outdoor" },
  { option: "Other", value: "Other" },
];

export const TASK_SHIFT_OPTIONS = [
  { option: "Morning", value: "morning" },
  { option: "Afternoon", value: "afternoon" },
  { option: "Evening", value: "evening" },
];

export const TASK_TRACKING_SHIFT_OPTIONS = [
  { option: "All Shifts", value: "" },
  { option: "Morning", value: "Morning" },
  { option: "Afternoon", value: "Afternoon" },
  { option: "Evening", value: "Evening" },
];

export const TASK_TRACKING_STATUS_OPTIONS = [
  { option: "All Statuses", value: "" },
  { option: "Completed", value: "Completed" },
  { option: "Pending", value: "Pending" },
];

export const TASK_TRACKING_STATUS_BADGE_STYLES: Record<string, string> = {
  Completed: "bg-green-100 text-green-700",
  Pending: "bg-red-100 text-red-700",
};

 // Maps API-returned category names → one of the 3 UI sections
export const SECTION_CATEGORY_MAP: Record<string, ServiceSection> = {
  "ADL Services": "adl",
  "ADLs": "adl",
  "Activities of Daily Living": "adl",
  "Personal Care": "adl",
  "Mobility & Safety": "adl",
  "Medication Support": "adl",
  "Nutrition": "adl",
  "Vital Signs": "vitals",
  "Vital signs": "vitals",
  "Vitals": "vitals",
  "Blood Pressure": "vitals",
  "Housekeeping": "housekeeping",
  "House Keeping": "housekeeping",
  "House Chores": "housekeeping",
  "Laundry": "housekeeping",
  "Cleaning": "housekeeping",
};
export type ServiceSection = "adl" | "vitals" | "housekeeping";

export const adlAndHousekepping=["adl", "housekeeping"]
export const sectionHeadings: Record<ServiceSection, string> = {
                      adl: "ADL Services",
                      vitals: "Vital Signs",
                      housekeeping: "Housekeeping",
                    };
export  const baseVitalSignsPath = "carePlan.vitalSigns";
export const vitalSignsData = [
    { name: `${baseVitalSignsPath}.bloodPressure`, label: "Blood Pressure" },
    { name: `${baseVitalSignsPath}.bloodOxygen`, label: "Blood Oxygen Saturation" },
    { name: `${baseVitalSignsPath}.pulse`, label: "Pulse / Heart Rate" },
    { name: `${baseVitalSignsPath}.bloodSugar`, label: "Blood Sugar" },
    { name: `${baseVitalSignsPath}.pacemaker`, label: "Pacemaker Monitoring" },
  ];

  export const DEFAULT_ADL_FIELDS: { key: string; label: string; section: ServiceSection; path?: string }[] = [
  { key: "bathing", label: "Bathing - Level of Care:", section: "adl" },
  { key: "continence", label: "Continence - Level of Care:", section: "adl" },
  { key: "toileting", label: "Toileting - Level of Care:", section: "adl" },
  { key: "grooming", label: "Grooming - Level of Care:", section: "adl" },
  { key: "dressing", label: "Dressing - Level of Care:", section: "adl" },
  { key: "oralCare", label: "Oral Care - Level of Care:", section: "adl" },
  { key: "mobility", label: "Mobility - Level of Care:", section: "adl" },
  { key: "transferring", label: "Transferring - Level of Care:", section: "adl" },
  { key: "dailyCleanSweep", label: "Daily Clean Sweep:", section: "housekeeping", path: "carePlan.housekeeping.dailyCleanSweep" },
  { key: "weeklyDeepClean", label: "Weekly Deep Clean:", section: "housekeeping", path: "carePlan.housekeeping.weeklyDeepClean" },
  { key: "laundry", label: "Laundry:", section: "housekeeping", path: "carePlan.housekeeping.laundry" },
];

// Base path for ADL form fields
export const basePath = "carePlan.adl";

// The default set of ADL service keys that come out-of-the-box
export const DEFAULT_ADL_KEYS = new Set([
  "bathing",
  "continence",
  "toileting",
  "grooming",
  "dressing",
  "oralCare",
  "mobility",
  "transferring",
  "dailyCleanSweep",
  "weeklyDeepClean",
  "laundry",
]);

export const SECTION_LABELS: Record<ServiceSection, string> = {
  adl: "Detected ADL Services",
  vitals: "Vital Signs",
  housekeeping: "Housekeeping Services",
};

export const VITAL_SIGN_LABELS: Record<string, string> = {
  bloodPressure: "Blood Pressure",
  bloodOxygen: "Blood Oxygen Saturation",
  pulse: "Pulse / Heart Rate",
  bloodSugar: "Blood Sugar",
  pacemaker: "Pacemaker Monitoring",
};

export const HOUSEKEEPING_LABELS: Record<string, string> = {
  dailyCleanSweep: "Daily Clean Sweep",
  weeklyDeepClean: "Weekly Deep Clean",
  laundry: "Laundry",
};
export const billPayingOptions = [
  { option: "Supervise/Assistance", value: "Supervise/Assistance" },
  { option: "Independent", value: "Independent" },
];

export const levelOfStudyOptions = [
  { option: "High School", value: "High School" },
  { option: "Bachelors", value: "Bachelors" },
  { option: "Masters", value: "Masters" },
  // TODO: Add more level of study options as needed
];

export const levelOfCareOptions2 = [
  { option: "Independent", value: "Independent" },
  { option: "Staff Observe", value: "Staff Observe" },
  { option: "Assistance", value: "Assistance" },
];

export const addNewRoleOptions = [
  { option: "Lead", value: "Lead" },
  { option: "Nurse", value: "Nurse" },
];

export const leadActiveTabConstants = {
  BIOGRAPHY_TAB: "Biography",
  MEDICAL_TAB: "Medical",
  CAREPLAN_TAB: "Careplan",
  ACTIONS_TAB: "Documents",
};

export const leadCarePlanTabConstants = {
  ADLS_TAB: "ADL’S",
  IADLS_TAB: "IADL’S",
  MEDICATION_ADMINISTRATION_TAB: "Medication Administration",
  OVERALL_HEALTH_TAB: "Overall Health",
};

export const SeniorProfileCardButtons = [
  { label: "Add Medication", feature: "CLINICAL_ADD" },
  { label: "MedPass", feature: "CLINICAL_MEDPASS" },
  { label: "Medication List", feature: "CLINICAL_MEDLIST" },
  { label: "Over-the-Counter", feature: "CLINICAL_OTC" },
  { label: "Care Plan", feature: "CLINICAL_CAREPLAN" },
  { label: "Profile", feature: "CRM_BIOGRAPHY" },
  { label: "Incident Report", feature: "CLINICAL_INCIDENT" }
];

export const AccessLevelOptions = [
  {
    option: "Manager",
    value: "Manager",
  },
  {
    option: "Employee",
    value: "Employee",
  },
];

export const AccessRoleOptions = [
  { option: "Care Team", value: "PCG" },
  { option: "PCHO", value: "PCHO" },
];
export const WageOptions = [
  { option: "Hourly", value: "Hourly" },
  { option: "Monthly", value: "Monthly" },
];

export const NOT_CONTACTED = "Not Contacted";
export const CONTACTED = "Contacted";
export const NOT_INTRESTED = "Not Interested";
export const FOLLOWUP_REQUIRED = "Followup Required";

// referralStatusOptions.ts (or similar, depending on your project's naming conventions)

export const REFERRAL_STATUS_OPTIONS = [
  CONTACTED,
  NOT_CONTACTED,
  FOLLOWUP_REQUIRED,
  NOT_INTRESTED,
];

export const docuSignPath = "/v1/initiate-esign";
export const UserPath = "/v1/user";
export const GetUsersPath = "/v1/users";
export const ClinicalUserPath = "/v1/clinical/user";
export const MaxSizeforImage = 2;
export const userSigninPath = "/signin";
export const userSignUpPath = "/signup";
export const resetPasswordPath = "/reset-password";
export const confirmResetPasswordPath = "/confirm-reset-password";
export const hcmTeamRoasterPath = "/v1/hcm/roaster";
export const hcmRoastersPath = "/v1/hcm/roasters";
export const getShifts = "/v1/hcm/shifts";
export const hcmTeamRoaster = "/v1/hcm/roasters";
export const shiftsPath = "/v1/hcm/shifts";
export const updatePasswordPath = "/update-password";
export const homePath = "/v1/home";
export const getBullitenBoardPath = "/v1/hcm/broadcasts";
export const hcmTaskPath = "/v1/task";
export const hcmTasksPath = "/v1/tasks";
export const hcmTaskDailyTrackingPath = "/v1/task-daily-tracking";
export const bullitenBoardPath = "/v1/hcm/broadcast";
export const salesDashboardPath = "/crm/sales-dashboard";
export const upsertConversationPath = "/v1/hcm/communication/conversation";
export const upsertConversationMessagePath =
  "/v1/hcm/communication/conversation/message";

export const getConversationsPath="/v1/hcm/communication/conversations"
export const getConversationMessagesPath="/v1/hcm/communication/conversation"
export const activateAccountPath = "/activate-account"
export const HomeTourSchedulePath = "/v1/user/home-tour"
export const docusealSlugURL = "/v1/slug-url"
export const docusealCreateSubmissionURL = "/v1/docuseal/create-submission"
export const generateCertificate="/v1/compliance/generate-certificate"
export const payStubPath = "/v1/revops/payout";
export const revopsPaymentPath = "/v1/revops/payment";
export const invoicePath = "/v1/revops/invoice";
export const budgetPath = "/v1/revops/budget";
export const dashboardMetricsPath = "/v1/revops/budget/dashboard/metrics";
export const createSupportRequestPath = "/v1/support";
export const smartCrm="/v1/crm/campaign"
export const campaignDraft = "/api/generate-campaign-draft"
export const salesMetricsPath = "/v1/crm/sales/metrics"

// Budget Categories
export const BUDGET_INCOME_CATEGORIES = [
  { option: 'Care Fee', value: 'CARE_FEE' },
  { option: 'Monthly Fee', value: 'MONTHLY_FEE' },
  { option: 'Entertainment', value: 'ENTERTAINMENT' },
  { option: 'Transport', value: 'TRANSPORT' },
  { option: 'Medical', value: 'MEDICAL' },
  { option: 'Misc', value: 'MISC' },
];

export const BUDGET_EXPENSE_CATEGORIES = [
  { option: 'Groceries', value: 'GROCERIES' },
  { option: 'Utilities', value: 'UTILITIES' },
  { option: 'Entertainment', value: 'ENTERTAINMENT' },
  { option: 'Transport', value: 'TRANSPORT' },
  { option: 'Medical', value: 'MEDICAL' },
  { option: 'Misc', value: 'MISC' },
];

export const TRANSACTION_TYPE_OPTIONS = [
  { option: 'Income', value: 'income' },
  { option: 'Expense', value: 'expense' },
];

export const ENTRY_MODE_OPTIONS = [
  { option: 'One Time', value: 'one_time' },
  { option: 'Recurring', value: 'recurring' },
];

export const PAYROLL = "payroll";

export const stripeAccountCreationPath = "/v1/revops/stripe/create-account";
export const stripeOnboardingLinkPath = "/v1/revops/stripe/onboarding-link";
export const stripeStatusPath = "/v1/revops/stripe/status";

export const StripeStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESTRICTED: "RESTRICTED",
  ACTIVE: "ACTIVE",
};

export const medicalDocsAllowedFormats = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

export const personalDocsOfPCGAllowedFormats = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export const personalDocsOfNurseAllowedFormats = personalDocsOfPCGAllowedFormats;

export const homeDocsAllowedFormats = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export const MAX_FILE_SIZE_MB = 5;

export const PASS = "Pass";
export const REFUSE = "Refuse";

//Schema Base paths
//Biography
export const basePathPersonalDetails = "biography.personalDetails";
export const basePathValues = "biography.valuesAndBeliefs";
export const basePathActivityReferences = "biography.activityReferences";
//Medical
export const basePathMedicalGeneral = "medical.general";
export const basePathMedicalMobility = "medical.mobility";
export const basePathMedicalOverallHealth = "medical.overAllHealth";

export const SHIFT_STATUS_AVAILABLE = "available";
export const SHIFT_STATUS_TIMEOFF = "timeoff";
export const SHIFT_STATUS_VACATION = "vacation";

export const MIN_MESSAGES_BEFORE_SUMMARIZING = 20;

export const CHAT_DEFAULT_PROMPTS: Record<string, string[]> = {
  crm: [
    "My lead john is interested in my care home , what are the next steps for him.",
  ],
  hcm: [
    "Can you act as my shift scheduler for my care home . Here are the parameters for my care home. are 3 seniors who live in the care home who need 24/7 care. I have 2 care givers who have to assigned to care in the care home . Care giver 1's name is A she wants to work in the night only on weekdays . Care giver 2's name is B she wants to work in day times only . Based on the above criteria can you give me the schedule for the week for these care givers. Give me the schedule in table format.",
  ],
  clinical: [
    "My resident mr Bean is 82 years old, He is a diabetic, needs help with continence, Needs to be given Bed baths and is independent in eating. Can you give me a careplan for Mr Bean. Can you concise careplan in 200 words.",
  ],
  default: [
    "What can you do?",
    "Tell me a joke.",
    "How can I reset my password?",
    "Give me some productivity tips.",
  ],
};

// Documents
const DL = "DL";
const SSN = "SSN";
const MEDICATION_LIST = "Medication List";
const PHYSICIAN_CERTIFICATE = "Physician Certificate";

const ADMISSION_AGREEMENT = "Admission Agreement *";
const ADVANCE_DIRECTIVE_CHECKLIST = "Advance Directive Checklist";
const INVENTORY = "Inventory List";
const DISCHARGE_INFORMATION = "Discharge Information *";
const IN_THE_EVENT_OF_DEATH = "In The Event Of Death";
export const in_the_event_of_death="in_the_event_of_death"
export const tb_test="tb_test"
export const dl="dl"
export const cpr_and_first_aid ="cpr_and_first_aid"
export const background_check ="background_check"
const PARTY_RESPONSIBLE = "Party Responsible for Financial Transactions";
const HOUSE_RULES = "House Rules *";
const RESIDENT_RIGHTS = "Resident Rights *";
const NOTICE_OF_PRIVACY_PRACTICES = "Notice of Privacy Practices";
const WRITTEN_CONSENTS = "Written Consent/Denial *";
const RESIDENT_RECEIPT_OF_FORMS = "Resident Receipt of Forms *";
const DESIGNATING_REPRESENTATIVE = "Designating a Representative *";
const RESUME = "Resume";
const TB_TEST = "TB Test Report *";
const STAFF_RECEIPT_OF_FORMS = "Staff Receipt of Forms *";
const CPR_AND_FIRST_AID = "CPR & First Aid *";
const BACKGROUND_CHECK = "Background Check *";

const INDEMNITY_AGREEMENT = "Indemnity Agreement *";
const INDEPENDENT_CONTRACTOR_OFFER = "Independent Contractor Offer *";

// Documents for Senior/ Lead
export const documentRequiredForSenior = [
  // { name: "admission_agreement", label: ADMISSION_AGREEMENT, required: true },
  // { name: "house_rules", label: HOUSE_RULES, required: true },
  // { name: "residents_rights", label: RESIDENT_RIGHTS, required: true },
  // { name: "written_consents", label: WRITTEN_CONSENTS, required: true },
  // {
  //   name: "resident_receipt_of_forms",
  //   label: RESIDENT_RECEIPT_OF_FORMS,
  //   required: true,
  // },
  // // { name: "party_responsible", label: PARTY_RESPONSIBLE, required: true },
  // {
  //   name: "designating_representative",
  //   label: DESIGNATING_REPRESENTATIVE,
  //   required: true,
  // },
  // {
  //   name: "advance_directive_checklist",
  //   label: ADVANCE_DIRECTIVE_CHECKLIST,
  //   required: false,
  //   templateId:
  //     process.env.NEXT_PUBLIC_AWS_DOCUSEAL_ADVANCE_DIRECTIVE_CHECKLIST_ID,
  // },
  // {
  //   name: "inventory_list",
  //   label: INVENTORY,
  //   required: false,
  //   templateId: process.env.NEXT_PUBLIC_AWS_DOCUSEAL_INVENTORY_LIST_ID,
  // },
  // {
  //   name: "in_the_event_of_death",
  //   label: IN_THE_EVENT_OF_DEATH,
  //   required: false,
  // },
  // Always included extras
  { name: "dl", label: DL, required: false },
  { name: "ssn", label: SSN, required: false },
  { name: "medication_list", label: MEDICATION_LIST, required: false },
  {
    name: "physician_certificate",
    label: PHYSICIAN_CERTIFICATE,
    required: false,
  },
];

export const onboardingDocsForSeniors = [
  "admission_agreement",
  // "advance_directive_checklist",
  // "inventory_list",
  // "in_the_event_of_death",
  "house_rules",
  "residents_rights",
  "written_consents",
  "resident_receipt_of_forms",
  "designating_representative",
];

export const allOnboardingDocsForSeniors = [
  "admission_agreement",
  "house_rules",
  "residents_rights",
  "written_consents",
  "resident_receipt_of_forms",
  "designating_representative",
  "advance_directive_checklist",
  "in_the_event_of_death",
  "inventory_list",
];

export const inHomeCareOnboardingDocsForSeniors = [
  "clinical_assessment",
  "senior_bill_of_rights",
  "service_agreement",
];

// Documents for PCGLead / PCG
export const documentRequiredForPCG = [
  // { name: "indemnity_agreement", label: INDEMNITY_AGREEMENT, required: true },
  // {
  //   name: "independent_contractor_offer",
  //   label: INDEPENDENT_CONTRACTOR_OFFER,
  //   required: true,
  // },

  // { name: "residents_rights", label: RESIDENT_RIGHTS, required: true },
  // {
  //   name: "staff_receipt_of_forms",
  //   label: STAFF_RECEIPT_OF_FORMS,
  //   required: true,
  // },
  { name: "dl", label: DL, required: false },
  { name: "ssn", label: SSN, required: false },
  {
    name: "tb_test",
    label: TB_TEST,
    required: true,
    expiryDate: true,
    alertPeriodInDays: 30,
  },
  {
    name: "cpr_and_first_aid",
    label: CPR_AND_FIRST_AID,
    required: true,
    expiryDate: true,
    alertPeriodInDays: 30,
  },
  { name: "background_check", label: BACKGROUND_CHECK, required: true },
  // { name: "certificates", label: CERTIFICATES, required: false },
  { name: "resume", label: RESUME, required: false },
];

export const DocumentCategory = {
  ON_BOARDING: "onboarding",
  CERTIFICATE: "certificate",
  OTHER: "other",
};
export const DocumentType = {
  DOCUMENT: ".docx",
};

export const documentRequiredForNurse = [
  {
    name: "hospice_agreement",
    label: "Hospice Agreement *",
    required: true,
  },
];

export const onboardingDocsForPCG = [
  "indemnity_agreement",
  "independent_contractor_offer",
  "residents_rights",
  "staff_receipt_of_forms",
];

export const onboardingDocsForNurse = ["hospice_agreement"];

//Home Documents
export const HOMEDOCUMENTS: DocumentType[] = [
  {
    id: "1",
    name: "Septic Inspection Certificate",
    required: false,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "2",
    name: "Fire Alarm Inspection Report",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "3",
    name: "Exit/Emergency Light Testing",
    required: false,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "4",
    name: "State Permit",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "5",
    name: "Certificate of Occupancy",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "7",
    name: "Fire Drill and Safety Log",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "8",
    name: "Sprinkler Inspection Report",
    required: false,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
];

//InHomeCare Documents
export const InHomeCareDocuments: DocumentType[] = [
  {
    id: "1",
    name: "County Business License",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
  {
    id: "2",
    name: "State Permit",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
];

//PCHO Documents
export const PCHODOCUMENTS: DocumentType[] = [
  {
    id: "1",
    name: "TB Test",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 7,
  },
  {
    id: "2",
    name: "Resume",
    required: true,
    uploadType: "direct",
  },
  {
    id: "3",
    name: "CPR & First Aid",
    required: true,
    uploadType: "withExpiration",
    alertPeriodInDays: 30,
  },
];

export const ESIGN_ENVELOPE_STATUS_COMPLETED = "completed";
export const ESIGN_ENVELOPE_STATUS_DECLINED = "declined";
export const ESIGN_ENVELOPE_STATUS_ERROR = "error";
export const ESIGN_ENVELOPE_STATUS_PENDING = "pending";
export const ESIGN_ENVELOPE_STATUS_EXPIRED = "expired";
export const ESIGN_ENVELOPE_STATUS_SENT = "sent";

export const INITIATE_E_SIGN = "initiateESign";

export const USER_PATH_OMIT_FIELDS = [
  "modifiedAt",
  "clinical",
  "lastLoginTimestamp",
  "roaster",
  "associatedHomes", 
  "isReferredByUserName"
];

export const CAREPLAN_PATH_OMIT_FIELDS = [
   "clinical",
    "lastLoginTimestamp",
    "modifiedAt",
    "userId",
    "createdAt",  
];

export const CLINICAL_USER_PATH_OMIT_FIELDS = [
  "modifiedAt",
  "lastLoginTimestamp",
  "roaster",
];
export const HOME_PATH_OMIT_FIELDS = [
  "modifiedAt",
  "clinical",
  "lastLoginTimestamp",
  "roaster",
];
export const HCM_SHIFT_OMIT_FIELDS = [
  "created_at",
  "updated_at",
  "user_name",
  "created_by_user_name",
  "assigned_to_user_name",
  "assigned_to_user_id",
  "user_profile_image_url"
];

export const RECEIPT_STATUS = {
  EMPTY: "empty",
  NEW: "new",
  EXISTING: "existing",
  REMOVE: "remove",
} as const;

export const BROADCAST = "broadcasts";
export const COMMUNICATION = "communication";
export const TEAM_COMMUNICATION = "teamcommunication";

export const CARE_LEAD = "Care Leads";
export const CARE_TEAM = "Care Team";
export const SR_LEAD = "Senior Leads";

export const CARE_PLAN_TEMPLATE_PLACEHOLDERS = {
  ResidentInformation: {
    FullName: "",
    DateOfBirth: "",
    RoomNumber: "",
    PrimaryCaregiver: "",
    EmergencyContact: "",
    ContactPhone: "",
    KnownConditions: "",
  },
  CarePlanAndSupport: {
    MentalHealth: "",
    SpeechPatterns: "",
    EmotionalState: "",
    MedicationAdherence: "",
    SocialInteraction: "",
    PhysicalHealth: "",
    SafetyMeasures: "",
    GroomingMeasures: "",
  },
};
export const defaultTrainingFolder = "Default_Compliance_Training_Videos";

const bucket = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
const REGION = process.env.NEXT_PUBLIC_AWS_REGION;

export const CHAT_BOT_TRAINING_VIDEOS = {
  crm: [
    {
      header: "How to add new leads?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/crm/How to add new leads.mp4",
      }),
    },
    {
      header: "What are milestones?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/crm/What are milestones.mp4",
      }),
    },
    {
      header: "What are CRM Actions?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/crm/What are CRM Actions.mp4",
      }),
    },
    {
      header: "Understand Senior Documents",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/crm/Understand Senior Documents.mp4",
      }),
    },
  ],
  clinical: [
    {
      header: "Understanding Senior Dashboard",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/clinical/Understanding Senior Dashboard.mp4",
      }),
    },
    {
      header: "How to manage Medication?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/clinical/How to manage Medication.mp4",
      }),
    },
    {
      header: "How to use Care Plan Incident Report?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/clinical/How to use Care Plan Incident Report.mp4",
      }),
    },
    {
      header: "How to use Clinical Care Plan?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/clinical/How to use Clinical Care Plan.mp4",
      }),
    },
    {
      header: "How to generate Care Report?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/clinical/How to generate Care Report.mp4",
      }),
    },
  ],
  hcm: [
    {
      header: "How to manage Scheduling?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/hcm/How to manage Scheduling.mp4",
      }),
    },
    {
      header: "How to handle timesheet?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/hcm/How to handle Timesheet.mp4",
      }),
    },
    {
      header: "About Dashboard and Teams Roster",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/hcm/About Dashboard and Teams Roster.mp4",
      }),
    },
  ],
  compliance: [
    {
      header: "How to use Compliance Documents?",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/compliance/How to use compliance Documents.mp4",
      }),
    },
    {
      header: "Stay up to date with Training",
      s3Key: getS3PreSignedFromattedUrl({
        bucket,
        region: REGION,
        key: "assistly-onboarding-videos/compliance/Stay up to date with Training.mp4",
      }),
    },
  ],
};

export const campaignType={senior:'SENIOR', referral:'REFERRAL'}
export  const campaignOptions = [
    { option: "Select campaign type", value: "" },
    { option: "Update", value: "update" },
    { option: "Follow-Up", value: "followup" },
    { option: "Welcome", value: "welcome" },
    { option: "Event Recap", value: "recap" },
    { option: "General Announcement", value: "announcement" },
  ];
  export const toneOptions = [
    { option: "Select tone", value: "" },
    { option: "Warm", value: "warm" },
    { option: "Friendly", value: "friendly" },
    { option: "Professional", value: "professional" },
  ];
  export const campaignChannelType={email:"EMAIL",sms:"SMS"}

  export const FACESHEET_DOC_TYPES = [
    "insuranceDocument",
    "dnrForm",
    "advanceDirectiveWill",
  ]
  export const CARE_TEAM_FACESHEET_DOC_TYPES=[
     "backgroundCheck",
     "tbTestResult",
     "drivingLicense",
     "cprCertificate"
  ]
  
  export const FACESHEET_ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ]


  export const dateRangeOptions = [
    { option: "Last 7 days", value: "7" },
    { option: "Last 30 days", value: "30" },
    { option: "Last 90 days", value: "90" },
];

// Shared theme palette — keep the dashboard cohesive by reusing these 5 colors
// across all charts instead of introducing new ones per chart.
export const THEME_PALETTE = {
    primary: "#8b5cf67D", // brand indigo
    success: "#8dc2487D", // green
    warning: "#f973167D", // amber
    danger: "#e355187D",  // red
    info: "#06b6d47D",    // cyan
  //add 3 more clolors same as above but with different shades
    color1: "#3838e07D",
    color2: "#3dc59e7D",
    color3: "#d9842a7D",
};


export const SERIES_COLORS = [
    THEME_PALETTE.primary,
    THEME_PALETTE.info,
    THEME_PALETTE.warning,
    THEME_PALETTE.success,
    THEME_PALETTE.danger,
    THEME_PALETTE.color1,
    THEME_PALETTE.color2,
    THEME_PALETTE.color3,
];

export const CUSTOM_TEMPLATE_MAX_SIZE_MB = 20;

export const REP_COMPARISON_SERIES = [
        { key: "initial", label: "Initial Contact", color:"#8a5cf67D"  },
        { key: "tour", label: "Home Tour", color:"#06b6d47D"  },
        { key: "signed", label: "Agreement Signed", color: "#8dc2487D" },
        // { key: "boarded", label: "Boarded", color: THEME_PALETTE.success },
    ];
