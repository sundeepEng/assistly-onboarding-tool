/// <reference types="cypress" />

/**
 * Shared fixtures, selectors and helpers for the Incident Report specs.
 *
 * The spec is split across three files: one browser session doing ~80 page
 * visits degrades badly (see the clinical README). Everything the three have
 * in common lives here, so splitting costs no duplication.
 *
 * Clinical — Incident Report
 *
 *   components/clinical/clinicalTabs/incident-report.tsx        the tab + table
 *   components/clinical/clinicalTabs/incident-report-form.tsx   the seven-section form
 *   model/clinical/add-incident.model.ts                        the validation
 *   components/clinical/clinicalTabs/download-incident.tsx      the PDF button
 *
 * THE FORM
 *   Seven accordion sections, only the first open on mount. Ten fields are
 *   required by `IncidentReportFormSchema`:
 *
 *     facilityName, facilityPhone (10 digits), facilityAdministrator,
 *     residentName[0], incidentDate, incidentTime, detailsOfIncident,
 *     reporterName, incidentReportedDate, incidentReportedTime
 *
 *   Five of those are pre-filled from other records — the facility from the
 *   senior's `home`, the phone/email/administrator from the home's first PCHO,
 *   the resident from the senior, the reporter from the signed-in user — so an
 *   "empty" form is not actually empty. The tests below assert the pre-fill
 *   explicitly, because a required-field test that passes only because the
 *   field was already populated proves nothing.
 *
 * SAVING
 *   Appends to `clinical.incidentReport` and PUTs the whole clinical record.
 *   Date + time pairs are combined into UTC ISO on the way out.
 *
 * PDF generation is out of scope — the tests stop at the download control.
 */

import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "./module-commands";

export { buildHome, TEST_HOME_ID, TEST_USER_ID };

export const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
export const INCIDENT_TAB = "Incident Report";
export const PCHO_ID = "dddddddd-0001-4ddd-8ddd-dddddddddddd";

export const pad = (n: number) => String(n).padStart(2, "0");
export const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const DAY = 86400000;
export const today = () => asDate(new Date());
export const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * DAY));

/** An incident as `clinical.incidentReport` stores one. */
export const buildIncident = (overrides: Record<string, any> = {}) => ({
  incidentId: "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee",
  facilityName: "Comfort Cove",
  facilityPhone: "7065183473",
  facilityAdministrator: "Praveen Durvesula",
  residentName: ["Arthur Bean"],
  incidentDate: `${today()}T07:48:00.000Z`,
  incidentDetails: "Forgot the way and got lost",
  detailsOfIncident: "Forgot the way and got lost",
  reporterName: "Danny Ross",
  incidentReportedAt: `${today()}T07:49:00.000Z`,
  ...overrides,
});

export const buildSenior = (incidentReport: any[] = [], overrides: Record<string, any> = {}) => ({
  userId: SENIOR_ID,
  name: "Arthur Bean",
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  role: "Senior",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  clinical: { roomNumber: 12, status: "In Home", medication: [], incidentReport },
  ...overrides,
});

/** The home's first PCHO — the form reads facility contact details off them. */
export const FIRST_PCHO = {
  userId: PCHO_ID,
  name: "Praveen Durvesula",
  email: "praveen@assistly.com",
  mobile: "7065183473",
  role: "PCHO",
};

export const SIGNED_IN_USER = {
  userId: TEST_USER_ID,
  name: "Danny Ross",
  email: "danny@assistly.com",
  role: "PCHO",
};

export const sel = {
  addButton: () => cy.contains("button", "Add Incident"),
  modal: () => cy.get(".ReactModal__Content"),
  /**
   * The accordion header, NOT merely the text.
   *
   * MUI keeps collapsed panels mounted, so an unscoped `cy.contains(title)`
   * can match a label inside a hidden panel — Cypress then waits out its
   * actionability timeout on every click. Anchoring to the summary is both
   * correct and dramatically faster.
   */
  section: (title: string) => cy.contains(".MuiAccordionSummary-root", title),
  /**
   * The modal body scrolls, so Save often sits below the fold. `.click()`
   * scrolls it into view itself; assertions on it must use `exist`, not
   * `be.visible`, or they measure layout rather than behaviour.
   */
  save: () => sel.modal().contains("button", /^Save$/),
  field: (name: string) => cy.get(`input[name="${name}"]`),
  closeModal: () => cy.get(".ReactModal__Content div.absolute.top-4.right-6"),
  rows: () => cy.get('div[class*="border-b"]'),
  pdfButton: () => cy.get("div.border-solid.rounded-md").filter(":has(svg)"),
};

export const stubSave = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode, body }).as("saveIncident");

/**
 * The form reads the signed-in user by id and the home's PCHOs by userType, so
 * `/v1/user/{id}` has to answer differently depending on which id is asked for.
 */
export const stubUserLookups = (senior: Record<string, any>) =>
  cy
    .intercept("GET", "**/v1/user/*", (req) => {
      const id = req.url.split("?")[0].split("/").pop();
      const user =
        id === TEST_USER_ID ? SIGNED_IN_USER : id === PCHO_ID ? FIRST_PCHO : senior;
      req.reply({ statusCode: 200, body: { user } });
    })
    .as("getUser");

export const visitTab = (senior: Record<string, any> = buildSenior(), role: any = "PCHO") => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/users*", (req) => {
    // The form asks for the home's PCHOs; the board asks for seniors.
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCHO" ? [FIRST_PCHO] : [senior] },
    });
  }).as("getUsers");
  stubUserLookups(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent(INCIDENT_TAB)}`);
};

export const openForm = (senior: Record<string, any> = buildSenior()) => {
  visitTab(senior);
  sel.addButton().click();
  sel.field("facilityName").should("be.visible");
};

/** Fill only what the schema demands beyond what is already pre-filled. */
export const fillRequired = ({
  incidentDate = today(),
  incidentTime = "07:48",
  details = "Fell",
  reportedDate = today(),
  reportedTime = "07:49",
} = {}) => {
  // An empty override means "leave this field alone" — cy.type("") throws.
  //
  // `delay: 0` throughout, and the default details text is deliberately short:
  // the form revalidates its whole seven-section schema on every keystroke, so
  // runtime scales with characters typed. Cutting the default description from
  // 27 characters to 4 is worth more than any selector tuning here.
  sel.section("Resident(s) & Incident Details").click();
  if (incidentDate) sel.field("incidentDate").type(incidentDate, { delay: 0 });
  if (incidentTime) sel.field("incidentTime").type(incidentTime, { delay: 0 });
  if (details) sel.field("detailsOfIncident").type(details, { delay: 0 });
  sel.section("Reporter").click();
  if (reportedDate)
    sel.field("incidentReportedDate").type(reportedDate, { delay: 0 });
  if (reportedTime)
    sel.field("incidentReportedTime").type(reportedTime, { delay: 0 });
};

/** The incident the app just appended. */
export const savedIncident = (request: any) =>
  request.body.incidentReport[request.body.incidentReport.length - 1];

