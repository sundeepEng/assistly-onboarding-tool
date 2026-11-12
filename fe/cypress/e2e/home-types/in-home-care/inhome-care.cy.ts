/* eslint-disable cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on grid cells / documented settle windows */
/**
 * In-Home Care — the home-type branch
 *
 *   components/hcm/schedule/add-shift.tsx      Select Client + Shift Rate
 *   model/hcm/user-shifts.model.ts             assigned_to_user_id required
 *   components/hcm/schedule/schedule-board.tsx PCG sees only their own row
 *   components/hcm/schedule/day-view.tsx       senior sees only their PCGs
 *   components/hcm/team/team-roster-table.tsx  senior roster filters the same
 *   pages/clinical/index.tsx                   PCG sees only assigned seniors
 *   components/clinical/clinical-tabs.tsx      PCG gets no face carousel
 *   components/add-lead.tsx                    seeds IHC onboarding documents
 *   utils/createDocumentsFromS3.ts             the doc list is home-typed
 *   components/biography/personal-details.tsx  Mobile/address become required
 *   model/crm/{user,customer}.model.ts         UpdateLeadOrSeniorSchema(IHC)
 *   components/documents/document-card-ui.tsx  e-sign gate reads the IHC list
 *   components/dashboard/quick-actions.tsx     "Business Documents" title
 *
 * An In-Home Care home differs from a Residential one in how work is
 * assigned: shifts belong to a CLIENT (senior), the shift rate comes from
 * that client's payRate, and every board view filters by who is assigned
 * to whom. The home type lives on `home.homeType` — `"In Home Care"` vs
 * `"Residential"` — read by `useGetHomeType()` everywhere.
 */

import { Tags } from "../../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../../framework/module-commands";
import { TEST_USER_ID } from "../../../framework/constants";

const SCHEDULING_PATH = "/hcm/scheduling";
const CLINICAL_PATH = "/clinical";
const HOME = "/";

const IHC = { homeType: "In Home Care" };
const RESIDENTIAL = { homeType: "Residential" };

/** Tuesday 8 September 2026, 10:00 local — same frozen week as the rest of the suite. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();
const WED = new Date(2026, 8, 9);
const WED_TITLE = "Add Schedule - September 9, 2026";
const WED_EDIT_TITLE = "Edit Schedule - September 9, 2026";

const PRIYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALBERT = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";

/** Senior clients — `id` is read first by seniorOptions, `payRate` drives the rate. */
const MABEL = "dddddddd-0001-4ddd-8ddd-dddddddddddd";
const JOSEF = "dddddddd-0002-4ddd-8ddd-dddddddddddd";
const NO_RATE = "dddddddd-0003-4ddd-8ddd-dddddddddddd";
const GONE = "dddddddd-0004-4ddd-8ddd-dddddddddddd";

const buildClient = (id: string, name: string, overrides: Record<string, any> = {}) => ({
  id,
  userId: id,
  name,
  role: "Senior",
  homeId: TEST_HOME_ID,
  isDeleted: false,
  ...overrides,
});

const CLIENTS = [
  buildClient(MABEL, "Mabel Simmons", { payRate: 22 }),
  buildClient(JOSEF, "Josef Albers", { payRate: 31 }),
  buildClient(NO_RATE, "No Rate Nina"),
  buildClient(GONE, "Gone Gerald", { isDeleted: true, payRate: 40 }),
];

const buildMember = (
  userId: string,
  name: string,
  overrides: Record<string, any> = {}
) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  mobile: "5551112222",
  role: "PCG",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  roaster: [{ pay_rate: 15, pay_frequency: "Hourly" }],
  isDeleted: false,
  ...overrides,
});

const PRIYA_ROW = buildMember(PRIYA, "Priya Patel");
const ALBERT_ROW = buildMember(ALBERT, "Albert Einstein");
/** The session PCG — the schedule board keeps only this row for a PCG on IHC. */
const SELF_ROW = buildMember(TEST_USER_ID, "Self Caregiver");

const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0).toISOString();

const buildShift = (overrides: Record<string, any> = {}) => ({
  id: 5001,
  user_id: PRIYA,
  user_name: "Priya Patel",
  home_id: TEST_HOME_ID,
  shift_status: "available",
  shift_color: "#3b82f6",
  notes: "",
  pay_rate: 15,
  shift_start_time: at(WED, 9, 30),
  shift_end_time: at(WED, 14, 0),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  memberRow: (name: string) => cy.get(`div[title="${name}"]`).closest(".contents"),
  cell: (name: string, dayIndex: number) =>
    sel.memberRow(name).find('div[class*="min-h-[60px]"]').eq(dayIndex),
  shiftCard: () => cy.get('.shift-card[class*="border-2"]'),
  modalTitle: (text: string) => cy.contains(text),
  client: () => cy.get('select[name="assigned_to_user_id"]'),
  shiftRate: () => cy.get('input[name="pay_rate"]'),
  save: () => cy.contains("button", /^(Save|Saving\.\.\.)$/),
  faces: () => cy.get('div[class*="w-[138px]"]'),
  seniorCard: (name: string) => cy.contains(name).closest('div[class*="h-[283px]"]'),
};

// ── Setup ────────────────────────────────────────────────────────────────────

/** PCG + Senior + any other userType, answered from one handler. */
const stubUsers = (members: any[], seniors: any[] = CLIENTS) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: {
        users: userType === "PCG" ? members : userType === "Senior" ? seniors : [],
      },
    });
  }).as("getStaff");

const stubShifts = (shifts: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts },
  }).as("getShifts");

const stubCreate = () =>
  cy.intercept("POST", "**/v1/hcm/shift", { statusCode: 201, body: {} }).as("createShift");

const visitBoard = (
  opts: {
    role?: any;
    home?: any;
    members?: any[];
    seniors?: any[];
    shifts?: any[];
  } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome(IHC));
  stubUsers(opts.members ?? [PRIYA_ROW, ALBERT_ROW], opts.seniors);
  stubShifts(opts.shifts ?? []);
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(SCHEDULING_PATH);
  cy.contains("Today").should("be.visible");
};

/** Open Add Schedule on Priya's Wednesday cell. */
const openAddShift = () => {
  sel.cell("Priya Patel", 2).click({ force: true });
  sel.modalTitle(WED_TITLE).should("be.visible");
};

const openEditShift = () => {
  sel.shiftCard().first().click({ force: true });
  sel.modalTitle(WED_EDIT_TITLE).should("be.visible");
};

// ════════════════════════════════════════════════════════════════════════════
// 1. Add Shift — the client assignment
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — Add Shift client assignment", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  it("offers Select Client at an In-Home-Care home", () => {
    visitBoard();
    openAddShift();
    sel.client().should("exist");
  });

  it("withholds Select Client at a Residential home", () => {
    visitBoard({ home: buildHome(RESIDENTIAL) });
    openAddShift();
    sel.client().should("not.exist");
  });

  it("lists every active senior as a client", () => {
    visitBoard();
    openAddShift();
    sel.client().find("option").should("contain.text", "Mabel Simmons");
    sel.client().find("option").should("contain.text", "Josef Albers");
    sel.client().find("option").should("contain.text", "No Rate Nina");
  });

  it("leaves a deleted senior out of the client list", () => {
    visitBoard();
    openAddShift();
    sel.client().should("not.contain.text", "Gone Gerald");
  });

  it("offers the Shift Rate field only at an In-Home-Care home", () => {
    visitBoard();
    openAddShift();
    sel.shiftRate().should("exist");
  });

  it("withholds Shift Rate at a Residential home", () => {
    visitBoard({ home: buildHome(RESIDENTIAL) });
    openAddShift();
    sel.shiftRate().should("not.exist");
  });

  it("keeps the rate read-only — it is derived, never typed", () => {
    visitBoard();
    openAddShift();
    sel.shiftRate().should("have.attr", "readonly");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Add Shift — where the rate comes from
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — the shift rate", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  it("shows the caregiver's own wage before a client is chosen", () => {
    visitBoard();
    openAddShift();
    // Priya's roaster[0].pay_rate is 15.
    sel.shiftRate().should("have.value", "15");
  });

  it("fills the rate from the chosen client's payRate", () => {
    visitBoard();
    openAddShift();
    sel.client().select("Mabel Simmons");
    sel.shiftRate().should("have.value", "22");
  });

  it("re-derives the rate when the client changes", () => {
    visitBoard();
    openAddShift();
    sel.client().select("Mabel Simmons");
    sel.shiftRate().should("have.value", "22");
    sel.client().select("Josef Albers");
    sel.shiftRate().should("have.value", "31");
  });

  it("falls back to the caregiver's wage for a client with no payRate", () => {
    visitBoard();
    openAddShift();
    sel.client().select("No Rate Nina");
    sel.shiftRate().should("have.value", "15");
  });

  it("keeps the saved rate on first load when editing", () => {
    // ShiftRateField preserves defaultValues.pay_rate on the initial edit
    // render — the client selector has not been touched yet.
    visitBoard({
      shifts: [buildShift({ pay_rate: 40, assigned_to_user_id: MABEL })],
    });
    openEditShift();
    sel.shiftRate().should("have.value", "40");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Add Shift — the contract
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — shift contract", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const save = () => {
    cy.get('select[name="shift_start_time"]').select("09:00:00");
    cy.get('select[name="shift_end_time"]').select("13:00:00");
    sel.save().click();
  };

  it("refuses to save without a client — and sends nothing", () => {
    stubCreate();
    visitBoard();
    openAddShift();
    save();
    // AS-BUILT: the field's error slot renders the generic "Required", not the
    // zod message — the client gate still holds, nothing goes out.
    sel.client().parent().contains("Required").should("be.visible");
    cy.assertNoRequest("@createShift");
  });

  it("POSTs the shift with assigned_to_user_id", () => {
    stubCreate();
    visitBoard();
    openAddShift();
    sel.client().select("Mabel Simmons");
    save();
    cy.wait("@createShift").then(({ request }) => {
      expect(request.body[0].assigned_to_user_id).to.eq(MABEL);
      expect(request.body[0].pay_rate).to.eq(22);
    });
  });

  it("never sends assigned_to_user_id from a Residential home", () => {
    stubCreate();
    visitBoard({ home: buildHome(RESIDENTIAL) });
    openAddShift();
    save();
    cy.wait("@createShift").then(({ request }) => {
      expect(request.body[0]).to.not.have.property("assigned_to_user_id");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. The board views — who sees whose shifts
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — board visibility", { tags: [Tags.REGRESSION] }, () => {
  it("shows a PCG only their own row at an In-Home-Care home", { tags: [Tags.PCG] }, () => {
    visitBoard({
      role: "PCG",
      members: [SELF_ROW, PRIYA_ROW, ALBERT_ROW],
      shifts: [buildShift({ user_id: TEST_USER_ID, user_name: "Self Caregiver" })],
    });
    cy.contains("Self Caregiver").should("be.visible");
    cy.contains("Priya Patel").should("not.exist");
    cy.contains("Albert Einstein").should("not.exist");
  });

  it("shows a PCG every member at a Residential home", { tags: [Tags.PCG] }, () => {
    visitBoard({
      role: "PCG",
      home: buildHome(RESIDENTIAL),
      members: [SELF_ROW, PRIYA_ROW, ALBERT_ROW],
    });
    cy.contains("Priya Patel").should("be.visible");
    cy.contains("Albert Einstein").should("be.visible");
  });

  it(
    "shows a senior only the caregivers assigned to them",
    { tags: [Tags.SENIOR] },
    () => {
      visitBoard({
        role: "Senior",
        members: [PRIYA_ROW, ALBERT_ROW],
        shifts: [
          buildShift({ assigned_to_user_id: TEST_USER_ID }), // Priya → me
          buildShift({ id: 5002, user_id: ALBERT, user_name: "Albert Einstein" }), // Albert → nobody
        ],
      });
      cy.contains("Priya Patel").should("be.visible");
      cy.contains("Albert Einstein").should("not.exist");
    }
  );

  it(
    "tells a senior when nobody is assigned to them",
    { tags: [Tags.SENIOR] },
    () => {
      visitBoard({ role: "Senior", members: [PRIYA_ROW], shifts: [] });
      cy.contains("No shifts assigned in this week").should("be.visible");
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 5. The clinical board — a PCG only sees their clients
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — clinical board", { tags: [Tags.REGRESSION, Tags.PCG] }, () => {
  const CLINICAL_SENIORS = [
    {
      userId: MABEL,
      name: "Mabel Simmons",
      role: "Senior",
      homeId: TEST_HOME_ID,
      isDeleted: false,
      milestone: ["contract"],
      clinical: { roomNumber: 12, status: "In Home", medication: [] },
    },
    {
      userId: JOSEF,
      name: "Josef Albers",
      role: "Senior",
      homeId: TEST_HOME_ID,
      isDeleted: false,
      milestone: ["contract"],
      clinical: { roomNumber: 14, status: "In Home", medication: [] },
    },
  ];

  const visitClinical = (opts: { home?: any; shifts?: any[] } = {}) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(opts.home ?? buildHome(IHC));
    stubShifts(opts.shifts ?? []);
    cy.intercept("GET", "**/v1/users*", {
      statusCode: 200,
      body: { users: CLINICAL_SENIORS },
    }).as("getSeniors");
    cy.visit(CLINICAL_PATH);
  };

  it("shows a PCG only the seniors their today's shifts assign to them", () => {
    visitClinical({
      shifts: [buildShift({ assigned_to_user_id: MABEL })],
    });
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
    cy.contains("Josef Albers").should("not.exist");
  });

  it("shows a PCG every senior at a Residential home", () => {
    visitClinical({ home: buildHome(RESIDENTIAL) });
    cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
    cy.contains("Josef Albers").should("be.visible");
  });

  it("shows a PCG nobody when no shift assigns them a senior today", () => {
    visitClinical({ shifts: [] });
    cy.contains("Mabel Simmons").should("not.exist");
    cy.contains("Josef Albers").should("not.exist");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. The senior's record — a PCG on IHC gets no face carousel
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — senior record", { tags: [Tags.REGRESSION, Tags.PCG] }, () => {
  const CAROUSEL_SENIOR = {
    userId: MABEL,
    name: "Mabel Simmons",
    role: "Senior",
    home: "Comfort Cove",
    homeId: TEST_HOME_ID,
    milestone: ["contract"],
    isDeleted: false,
    documents: [],
    clinical: { roomNumber: 12, status: "In Home", medication: [] },
  };

  const visitSenior = (home: any) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCG");
    cy.stubHome(home);
    stubShifts([]);
    cy.intercept("GET", "**/v1/users*", {
      statusCode: 200,
      body: { users: [CAROUSEL_SENIOR] },
    }).as("getUsers");
    cy.intercept("GET", "**/v1/user/*", {
      statusCode: 200,
      body: { user: CAROUSEL_SENIOR },
    }).as("getUser");
    cy.visit(`/clinical/${MABEL}`);
  };

  it("withholds the face carousel from a PCG at an In-Home-Care home", () => {
    visitSenior(buildHome(IHC));
    // The record's tabs are the anchor — the senior's name only ever shows in
    // the carousel being withheld here.
    cy.contains("MedPass", { timeout: 10000 }).should("be.visible");
    sel.faces().should("not.exist");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. CRM — creating a lead seeds the IHC onboarding documents
// ════════════════════════════════════════════════════════════════════════════
// `createDocumentObjectsFromS3Folder` lists `{home}/Senior/*.docx` and keeps
// only the names in the home type's onboarding list — so the POST /v1/user
// payload's `documents` differ by home type, not just the form.
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — lead creation seeds IHC documents", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const CRM_PATH = "/crm";
  const S3_KEYS = [
    `${TEST_HOME_ID}/Senior/clinical_assessment.docx`,
    `${TEST_HOME_ID}/Senior/senior_bill_of_rights.docx`,
    `${TEST_HOME_ID}/Senior/service_agreement.docx`,
    `${TEST_HOME_ID}/Senior/admission_agreement.docx`,
    `${TEST_HOME_ID}/Senior/house_rules.docx`,
  ];

  const stubS3List = () =>
    cy.intercept("POST", "**/api/s3/list-objects", {
      statusCode: 200,
      body: { contents: S3_KEYS.map((key) => ({ key })) },
    });

  const docNames = (request: any) =>
    (request.body?.documents ?? []).map((d: any) => d.documentName);

  const visitLeadsAndCreate = (home: any) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(home);
    cy.stubUsers();
    stubS3List();
    cy.stubPost("/v1/user", "createLead", 201, { userId: "new-lead" });
    cy.visit(CRM_PATH);
    cy.wait("@getUsers");
    cy.contains("button", "Add New").click();
    cy.get('input[name="firstName"]').should("be.visible");
    cy.settleForm();
    cy.typeField("firstName", "Nora");
    cy.typeField("lastName", "Bennett");
    cy.typeField("email", "nora.bennett@assistly.com");
    cy.typeField("mobile", "5557654321");
    cy.contains("button", "Save").click();
  };

  it("seeds the IHC onboarding documents into the new lead", () => {
    visitLeadsAndCreate(buildHome(IHC));
    cy.wait("@createLead").then(({ request }) => {
      expect(docNames(request)).to.include.members([
        "clinical_assessment",
        "senior_bill_of_rights",
        "service_agreement",
      ]);
    });
  });

  it("leaves residential-only documents out of an IHC lead", () => {
    visitLeadsAndCreate(buildHome(IHC));
    cy.wait("@createLead").then(({ request }) => {
      expect(docNames(request)).to.not.include.members([
        "admission_agreement",
        "house_rules",
      ]);
    });
  });

  it("seeds the residential documents at a Residential home", () => {
    visitLeadsAndCreate(buildHome(RESIDENTIAL));
    cy.wait("@createLead").then(({ request }) => {
      expect(docNames(request)).to.include.members([
        "admission_agreement",
        "house_rules",
      ]);
      expect(docNames(request)).to.not.include("service_agreement");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. CRM — the record's Personal Details make IHC fields mandatory
// ════════════════════════════════════════════════════════════════════════════
// `UpdateLeadOrSeniorSchema(isInHomeCare)` backs Biography, Medical and every
// careplan tab — the starred labels are the visible end of that schema
// switch. `personal-details.tsx` renders "Mobile *" and the four address
// labels starred only at an In-Home-Care home.
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — biography required fields", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const LEAD_ID = "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee";

  const buildLead = (overrides: Record<string, any> = {}) => ({
    userId: LEAD_ID,
    name: "Nora Bennett",
    firstName: "Nora",
    lastName: "Bennett",
    role: "Lead",
    homeId: TEST_HOME_ID,
    milestone: ["initial contact", "tour"],
    isDeleted: false,
    ...overrides,
  });

  const visitRecord = (home: any, lead: any = buildLead()) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(home);
    cy.stubUsers();
    cy.stubUser(lead);
    cy.stubPut("/v1/user", "updateLead", 200, {});
    cy.visit(`/crm/${LEAD_ID}`);
    cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
    cy.settleForm();
  };

  it("stars Mobile and the address fields at an In-Home-Care home", () => {
    visitRecord(buildHome(IHC));
    ["Mobile *", "Street 1 *", "City *", "State *", "Zip code *"].forEach(
      (label) => cy.contains(label).should("be.visible")
    );
  });

  it("leaves the same labels unstarred at a Residential home", () => {
    visitRecord(buildHome(RESIDENTIAL));
    cy.contains(/^Mobile$/).should("be.visible");
    cy.contains(/^Street 1$/).should("be.visible");
    cy.contains(/^City$/).should("be.visible");
    cy.contains(/^State$/).should("be.visible");
    cy.contains(/^Zip code$/).should("be.visible");
  });

  const PARTIAL_BIOGRAPHY = {
    personalDetails: { gender: "Male", birthdate: "1948-04-12" },
  };

  it("refuses to save Personal Details without the IHC-required address", () => {
    visitRecord(buildHome(IHC), buildLead({ biography: PARTIAL_BIOGRAPHY }));
    cy.contains("button", "Save").click();
    // The section header flags — the flag is the as-built contract, not the
    // zod wording (which differs for missing key vs empty string).
    cy.contains(".MuiAccordionSummary-root", "Personal Details")
      .find(".text-red-500")
      .should("exist");
    cy.get("@updateLead.all").then((calls: any) => {
      expect(calls).to.have.length(0);
    });
  });

  it("saves the same incomplete biography at a Residential home", () => {
    visitRecord(
      buildHome(RESIDENTIAL),
      buildLead({ biography: PARTIAL_BIOGRAPHY })
    );
    cy.contains("button", "Save").click();
    cy.wait("@updateLead").then(({ request }) => {
      expect(request.method).to.eq("PUT");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. Documents — the e-sign gate reads the IHC onboarding list
// ════════════════════════════════════════════════════════════════════════════
// `document-card-ui.tsx` decides showEsign per document: for a senior doc the
// envelope must be COMPLETED when the name is in the home type's onboarding
// list — otherwise the button shows unconditionally. `service_agreement`
// sits in the IHC list but not the residential one, so the same pending
// document flips the affordance between home types.
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — document e-sign gating", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const LEAD_ID = "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee";

  const buildDoc = (name: string, overrides: Record<string, any> = {}) => ({
    documentId: `${name}-doc-1`,
    documentName: name,
    documentCategory: "onboarding",
    documentUrl: "https://bucket.s3.amazonaws.com/doc.docx",
    createdByUserId: TEST_USER_ID,
    createdAt: "2026-04-01T10:00:00.000Z",
    isRequiredDocument: false,
    ...overrides,
  });

  const visitDocuments = (home: any, envelopeStatus: string) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(home);
    cy.stubUsers();
    cy.stubUser({
      userId: LEAD_ID,
      name: "Nora Bennett",
      role: "Lead",
      homeId: TEST_HOME_ID,
      milestone: ["contract"],
      isDeleted: false,
      docusignEnvelopeStatus: envelopeStatus,
      documents: [buildDoc("service_agreement")],
    });
    cy.intercept("POST", "**/s3-pre-signed-url", {
      statusCode: 200,
      body: { url: "https://bucket.s3.amazonaws.com/doc.docx" },
    });
    cy.visit(`/crm/${LEAD_ID}`);
    cy.contains("Documents", { timeout: 10000 }).click();
  };

  it("withholds E-Sign for a pending IHC onboarding envelope", () => {
    visitDocuments(buildHome(IHC), "pending");
    cy.contains("service_agreement", { timeout: 10000 }).should("be.visible");
    cy.contains("E-Sign").should("not.exist");
  });

  it("offers E-Sign once the IHC envelope completes", () => {
    visitDocuments(buildHome(IHC), "completed");
    cy.contains("service_agreement", { timeout: 10000 }).should("be.visible");
    cy.contains("E-Sign").should("be.visible");
  });

  it("offers E-Sign for the same pending document at a Residential home", () => {
    visitDocuments(buildHome(RESIDENTIAL), "pending");
    cy.contains("service_agreement", { timeout: 10000 }).should("be.visible");
    cy.contains("E-Sign").should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9b. Copy Week — the client survives the copy on IHC
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — copy week", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  /** Second registration wins — answers the source-week lookup by param. */
  const stubCopySource = (shifts: any[]) =>
    cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
      const isCopyLookup = new URL(req.url).searchParams.has("shift_start_time");
      req.reply({ statusCode: 200, body: { shifts: isCopyLookup ? shifts : [] } });
    }).as("getShifts");

  const confirmCopy = () => {
    cy.get('select[name="copyWeek"]').select("2026-08-31");
    cy.contains("Confirm Copy Week").should("be.visible");
    cy.contains("button", "Confirm").click();
  };

  it("carries assigned_to_user_id onto the copied shifts", () => {
    stubCreate();
    visitBoard({ members: [PRIYA_ROW] });
    stubCopySource([
      buildShift({
        assigned_to_user_id: MABEL,
        shift_start_time: at(new Date(2026, 8, 1), 9, 30),
        shift_end_time: at(new Date(2026, 8, 1), 14, 0),
      }),
    ]);
    confirmCopy();
    cy.wait("@createShift").then(({ request }) => {
      expect(request.body).to.have.length(1);
      expect(request.body[0].assigned_to_user_id).to.eq(MABEL);
    });
  });

  it("omits the client key from a Residential copy", () => {
    stubCreate();
    visitBoard({ home: buildHome(RESIDENTIAL), members: [PRIYA_ROW] });
    stubCopySource([
      buildShift({ shift_start_time: at(new Date(2026, 8, 1), 9, 30), shift_end_time: at(new Date(2026, 8, 1), 14, 0) }),
    ]);
    confirmCopy();
    cy.wait("@createShift").then(({ request }) => {
      expect(request.body[0]).to.not.have.property("assigned_to_user_id");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9c. Failure handling — the save error reaches the user
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — save failure", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  it("surfaces the server's error when the shift save fails", () => {
    cy.intercept("POST", "**/v1/hcm/shift", {
      statusCode: 500,
      body: { error: "Shift overlap detected" },
    }).as("createShift");
    visitBoard();
    openAddShift();
    sel.client().select("Mabel Simmons");
    cy.get('select[name="shift_start_time"]').select("09:00:00");
    cy.get('select[name="shift_end_time"]').select("13:00:00");
    sel.save().click();
    cy.wait("@createShift");
    cy.contains("Shift overlap detected").should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. The clinical board's empty message + the Nurse contrast
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — clinical board messages", { tags: [Tags.REGRESSION] }, () => {
  const CLINICAL_SENIORS = [
    {
      userId: MABEL,
      name: "Mabel Simmons",
      role: "Senior",
      homeId: TEST_HOME_ID,
      isDeleted: false,
      milestone: ["contract"],
      clinical: { roomNumber: 12, status: "In Home", medication: [] },
    },
    {
      userId: JOSEF,
      name: "Josef Albers",
      role: "Senior",
      homeId: TEST_HOME_ID,
      isDeleted: false,
      milestone: ["contract"],
      clinical: { roomNumber: 14, status: "In Home", medication: [] },
    },
  ];

  const visitClinical = (
    role: any,
    opts: { home?: any; shifts?: any[]; me?: any } = {}
  ) => {
    cy.clearAuthSession();
    cy.setAuthSession(role);
    cy.stubHome(opts.home ?? buildHome(IHC));
    stubShifts(opts.shifts ?? []);
    cy.intercept("GET", "**/v1/users*", {
      statusCode: 200,
      body: { users: CLINICAL_SENIORS },
    }).as("getSeniors");
    cy.intercept("GET", "**/v1/user/*", {
      statusCode: 200,
      body: { user: opts.me ?? { userId: TEST_USER_ID, role } },
    }).as("getUser");
    cy.visit(CLINICAL_PATH);
  };

  it("tells the PCG exactly why their board is empty", { tags: [Tags.PCG] }, () => {
    visitClinical("PCG", { shifts: [] });
    cy.contains("No shifts assigned to you today", { timeout: 10000 }).should(
      "be.visible"
    );
  });

  it(
    "does not change a nurse's world — she still sees only her assignments",
    { tags: [Tags.NURSE] },
    () => {
      // isNurseUser filters on associatedUserIds regardless of home type —
      // the IHC shift-assignment rule is a PCG-only contract.
      visitClinical("Nurse", {
        me: {
          userId: TEST_USER_ID,
          role: "Nurse",
          homeId: TEST_HOME_ID,
          associatedUserIds: [{ userId: MABEL }],
        },
      });
      cy.contains("Mabel Simmons", { timeout: 10000 }).should("be.visible");
      cy.contains("Josef Albers").should("not.exist");
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 11. The dashboard — documents are titled by home type
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — dashboard", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const visitDashboard = (home: any) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(home);
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user: { documents: [] } } });
    stubShifts([]);
    cy.visit(HOME);
  };

  it("titles the home's documents Business Documents", () => {
    visitDashboard(buildHome(IHC));
    cy.contains("Business Documents", { timeout: 10000 }).should("be.visible");
  });

  it("still titles them Home Documents at a Residential home", () => {
    visitDashboard(buildHome(RESIDENTIAL));
    cy.contains("Home Documents", { timeout: 10000 }).should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. The record's document section — IHC docs stay in the main list
// ════════════════════════════════════════════════════════════════════════════

describe("In-Home Care — document sections", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const LEAD_ID = "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee";

  it("keeps an IHC onboarding document out of Additional Documents", () => {
    // AS-BUILT: actions.tsx's main section is every onboarding-category doc —
    // the residential-name sort only reorders within it, so an IHC name like
    // service_agreement is never demoted to Additional Documents. The sort
    // itself ignores the IHC list (cosmetic only).
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome(IHC));
    cy.stubUsers();
    cy.stubUser({
      userId: LEAD_ID,
      name: "Nora Bennett",
      role: "Lead",
      homeId: TEST_HOME_ID,
      milestone: ["contract"],
      isDeleted: false,
      documents: [
        {
          documentId: "sa-doc-1",
          documentName: "service_agreement",
          documentCategory: "onboarding",
          documentUrl: "https://bucket.s3.amazonaws.com/doc.docx",
          createdByUserId: TEST_USER_ID,
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });
    cy.intercept("POST", "**/s3-pre-signed-url", {
      statusCode: 200,
      body: { url: "https://bucket.s3.amazonaws.com/doc.docx" },
    });
    cy.visit(`/crm/${LEAD_ID}`);
    cy.contains("Documents", { timeout: 10000 }).click();
    cy.contains("h2", "Additional Documents", { timeout: 10000 })
      .parent()
      .contains("service_agreement")
      .should("not.exist");
  });
});
