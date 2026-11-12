/// <reference types="cypress" />

/**
 * Clinical — Care Plan
 *
 *   components/clinical/clinicalTabs/careplan.tsx   the three sections + comments
 *   commonComponents/toggle-button.tsx              Provided / Not Provided
 *   commonComponents/comments/comments.tsx          the comment thread
 *   components/clinical/clinicalTabs/clinical-tabs.tsx   Care Plan Actions + report
 *
 * WHERE THE DATA COMES FROM
 *   The care plan itself is authored in CRM (components/careplan/**) and lives on
 *   the *user* record at `carePlan.{adl,iadl,housekeeping,vitalSigns}`. "Move to
 *   Clinical" only re-roles that record — it copies nothing — so the Clinical
 *   Care Plan reads the very same fields the CRM form wrote. That is why the
 *   carry-over tests below assert against one fixture rather than driving the
 *   CRM form first: there is no transformation step to get wrong.
 *
 *   What the *clinical* side owns is the daily record of what was actually
 *   done, at `clinical.carePlan.services` (and `.comments`).
 *
 * WHAT REACHES THE THREE SECTIONS
 *   Care Plan Services  adl + iadl merged. A `careLevel` of "Independent" is
 *                       skipped; so is any sub-value of "No" or "Independent".
 *   Housekeeping        `housekeeping` entries whose level is set and not
 *                       "Not Required".
 *   Vital Signs         `vitalSigns` entries set to exactly `true`.
 *
 * RBAC (utils/roles.ts, and `hasAccess` does NOT treat EDIT as implying VIEW)
 *   PCG    CLINICAL_CAREPLAN EDIT      → services, housekeeping and vitals
 *   Nurse  CLINICAL_CAREPLAN VIEW only → vitals only, via CLINICAL_CAREPLAN_VITALS
 *   PCHO   CLINICAL_TABS EDIT          → everything today, plus the *_HISTORY_EDIT
 *                                        permissions for past days
 *   Past days are governed by the _HISTORY_EDIT permissions, which only PCHO and
 *   HomeAdmin hold — so PCG and Nurse can read history but not change it.
 *
 * Two defects found while writing this are pinned in known-defects.cy.ts and
 * noted at the relevant tests below.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
const CAREPLAN_TAB = "Care Plan";

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86400000;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * DAY));

/**
 * A care plan as the CRM form leaves it. Deliberately mixed:
 *   bathing     Assistance   → listed
 *   dressing    Independent  → NOT listed
 *   eating      Supervision  → listed
 *   continence  bladder Yes / bowel No → only "bladder" listed
 *   medication  (iadl) Assistance → listed, proving iadl is merged in
 */
const CRM_CARE_PLAN = {
  adl: {
    bathing: { careLevel: "Assistance" },
    dressing: { careLevel: "Independent" },
    eating: { careLevel: "Supervision" },
    continence: { bladder: "Yes", bowel: "No" },
    comments: "ignored by the builder",
  },
  iadl: {
    medication: { careLevel: "Assistance" },
  },
  housekeeping: {
    dailyCleanSweep: "Daily",
    weeklyDeepClean: "Not Required",
    laundry: "Weekly",
  },
  vitalSigns: {
    bloodPressure: true,
    pulse: false,
    bloodSugar: true,
  },
};

const buildSenior = (overrides: Record<string, any> = {}) => ({
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
  carePlan: CRM_CARE_PLAN,
  clinical: {
    roomNumber: 12,
    status: "In Home",
    medication: [],
    carePlan: { services: [], comments: [] },
  },
  ...overrides,
});

/** A recorded service, as clinical.carePlan.services stores one. */
const buildService = (overrides: Record<string, any> = {}) => ({
  serviceName: "bathing - Assistance",
  serviceCategory: "ADL",
  providedOrNot: "Provided",
  providedAt: `${today()}T12:00:00.000Z`,
  ...overrides,
});

/** A vital-sign entry: one per sign per day, holding that day's readings. */
const buildVitalEntry = (overrides: Record<string, any> = {}) => ({
  serviceName: "bloodpressure",
  serviceCategory: "Vital Signs",
  providedAt: `${today()}T00:00:00.000Z`,
  readings: [{ time: `${today()}T14:30:00.000Z`, value: "120/80" }],
  ...overrides,
});

const buildComment = (overrides: Record<string, any> = {}) => ({
  messageId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  message: "Settled well overnight.",
  // comments.tsx filters top-level comments on `parentMessageId === null`;
  // a `parentId` key leaves it undefined and the comment never renders.
  parentMessageId: null,
  createdAt: `${today()}T09:00:00.000Z`,
  createdByUserId: "user-123",
  ...overrides,
});

const sel = {
  servicesHeading: () => cy.contains("h2", "Care Plan Services"),
  housekeepingHeading: () => cy.contains("h2", "Housekeeping Services"),
  vitalsHeading: () => cy.contains("h2", "Vital Signs"),
  /** Each row is a `border-b` block holding the service name in a <strong>. */
  row: (name: string) => cy.contains("strong", name).closest("div.border-b"),
  provided: (name: string) => sel.row(name).contains("div", /^Provided$/),
  notProvided: (name: string) => sel.row(name).contains("div", /^Not Provided$/),
  datePicker: () => cy.get('input[name="careplanDate"]'),
  /** The vitals trigger sits beside its label and shows the readings summary. */
  vitalTrigger: (label: string) =>
    cy.contains("span", label).parent().find("div.cursor-pointer, div.cursor-default").first(),
  vitalTime: () => cy.get('input[type="time"]'),
  vitalValue: () => cy.get('input[placeholder="e.g. 120/80"]'),
  vitalAdd: () => cy.contains("button", /^Add$/),
  commentBox: () => cy.get("textarea").first(),
  addComment: () => cy.contains("button", "Add Comment"),
  carePlanActions: () => cy.contains("div", /^Care Plan Actions$/),
  reportSelect: () => cy.get('select[name="carePlanMonth"]'),
};

const GREEN = "bg-[#19D139]";
const GREY = "bg-[#00000038]";
const IDLE = "bg-[#D9D9D9]";

const stubSave = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode, body }).as("saveCarePlan");

const visitCarePlan = (
  senior: Record<string, any> = buildSenior(),
  role: any = "PCG"
) => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [senior] } }).as(
    "getSeniors"
  );
  cy.stubUser(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent(CAREPLAN_TAB)}`);
};

/** The services array the app just wrote. */
const savedServices = (request: any) => request.body.carePlan.services;

describe("Clinical — Care Plan", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. What carries over from the CRM care plan
  // ──────────────────────────────────────────────────────────────────────────

  describe("Carry-over from CRM", () => {
    beforeEach(() => visitCarePlan());

    it("shows all three sections", () => {
      sel.servicesHeading().should("be.visible");
      sel.housekeepingHeading().should("be.visible");
      sel.vitalsHeading().should("be.visible");
    });

    it("lists an ADL service at its CRM care level", () => {
      sel.row("Bathing").should("contain.text", "Assistance");
    });

    it("lists a second ADL service", () => {
      sel.row("Eating").should("contain.text", "Supervision");
    });

    it("merges IADL services in with the ADLs", () => {
      sel.row("Medication").should("contain.text", "Assistance");
    });

    it("lists a sub-service answered Yes", () => {
      // For non-careLevel keys the *sub-key* is shown, not its value.
      sel.row("Continence").should("contain.text", "bladder");
    });

    it("lists housekeeping at its assigned frequency", () => {
      sel.row("Daily Clean Sweep").should("contain.text", "Daily");
      sel.row("Laundry").should("contain.text", "Weekly");
    });

    it("labels vital signs with their display names", () => {
      cy.contains("Blood Pressure").should("be.visible");
      cy.contains("Blood Sugar").should("be.visible");
    });

    it("offers a Provided / Not Provided toggle on each service", () => {
      sel.provided("Bathing").should("be.visible");
      sel.notProvided("Bathing").should("be.visible");
    });

    it("starts every service unrecorded", () => {
      sel.provided("Bathing").parent().should("have.class", IDLE);
      sel.notProvided("Bathing").parent().should("have.class", IDLE);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Independent and other exclusions
  // ──────────────────────────────────────────────────────────────────────────

  describe("Exclusions", () => {
    beforeEach(() => visitCarePlan());

    it("leaves out an ADL marked Independent", () => {
      cy.contains("strong", "Dressing").should("not.exist");
    });

    it("leaves out a sub-service answered No", () => {
      sel.row("Continence").should("not.contain.text", "bowel");
    });

    it("leaves out housekeeping marked Not Required", () => {
      cy.contains("strong", "Weekly Deep Clean").should("not.exist");
    });

    it("leaves out a vital sign that is switched off", () => {
      cy.contains("Pulse / Heart Rate").should("not.exist");
    });

    it("leaves out an IADL marked Independent", () => {
      visitCarePlan(
        buildSenior({
          carePlan: {
            ...CRM_CARE_PLAN,
            iadl: { medication: { careLevel: "Independent" } },
          },
        })
      );
      cy.contains("strong", "Medication").should("not.exist");
    });

    it("keeps the care plan's own comments field out of the service list", () => {
      // `comments` is destructured off before the list is built.
      cy.contains("strong", "Comments").should("not.exist");
    });

    it("shows nothing at all when every service is Independent", () => {
      visitCarePlan(
        buildSenior({
          carePlan: {
            adl: { bathing: { careLevel: "Independent" } },
            iadl: {},
            housekeeping: {},
            vitalSigns: {},
          },
        })
      );
      sel.servicesHeading().should("not.exist");
      sel.housekeepingHeading().should("not.exist");
      sel.vitalsHeading().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Missing, incomplete or malformed CRM data
  // ──────────────────────────────────────────────────────────────────────────

  describe("Incomplete CRM data", () => {
    it("renders without a care plan at all", () => {
      visitCarePlan(buildSenior({ carePlan: undefined }));
      sel.servicesHeading().should("not.exist");
      cy.get("body").should("be.visible");
    });

    it("renders with an empty care plan", () => {
      visitCarePlan(buildSenior({ carePlan: {} }));
      sel.servicesHeading().should("not.exist");
    });

    it("renders when only housekeeping was filled in", () => {
      visitCarePlan(
        buildSenior({ carePlan: { housekeeping: { laundry: "Weekly" } } })
      );
      sel.housekeepingHeading().should("be.visible");
      sel.servicesHeading().should("not.exist");
      sel.vitalsHeading().should("not.exist");
    });

    it("renders when only vital signs were chosen", () => {
      visitCarePlan(
        buildSenior({ carePlan: { vitalSigns: { bloodPressure: true } } })
      );
      sel.vitalsHeading().should("be.visible");
      sel.servicesHeading().should("not.exist");
    });

    it("survives a service with no care level", () => {
      visitCarePlan(
        buildSenior({ carePlan: { adl: { bathing: {} }, vitalSigns: { pulse: true } } })
      );
      cy.contains("Pulse / Heart Rate").should("be.visible");
    });

    it("title-cases an unmapped housekeeping service", () => {
      // HOUSEKEEPING_LABELS does not know `windowCleaning`, so `formatKeyLabel`
      // splits the camel case and capitalises: "Window Cleaning". It used to
      // print the raw key.
      visitCarePlan(
        buildSenior({ carePlan: { housekeeping: { windowCleaning: "Monthly" } } })
      );
      sel.row("Window Cleaning").should("contain.text", "Monthly");
    });

    it("no longer shows the raw housekeeping key", () => {
      visitCarePlan(
        buildSenior({ carePlan: { housekeeping: { windowCleaning: "Monthly" } } })
      );
      cy.contains("windowCleaning").should("not.exist");
    });

    it("title-cases an unmapped vital sign", () => {
      // `spO2` splits on the lower-to-upper boundary only, so the digit stays
      // attached: "Sp O2". Derived from the real helper, not guessed.
      visitCarePlan(buildSenior({ carePlan: { vitalSigns: { spO2: true } } }));
      cy.contains("Sp O2").should("be.visible");
    });

    it("no longer shows the raw vital sign key", () => {
      visitCarePlan(buildSenior({ carePlan: { vitalSigns: { spO2: true } } }));
      cy.contains("spO2").should("not.exist");
    });

    it("treats a vital sign set to a non-true value as switched off", () => {
      // The filter is `val === true`, so "yes" or 1 do not qualify.
      visitCarePlan(
        buildSenior({
          carePlan: { vitalSigns: { bloodPressure: "yes" as any, bloodSugar: true } },
        })
      );
      cy.contains("Blood Sugar").should("be.visible");
      cy.contains("Blood Pressure").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Recording a service
  // ──────────────────────────────────────────────────────────────────────────

  describe("Recording a service", () => {
    beforeEach(() => {
      visitCarePlan();
      stubSave();
    });

    it("records a service as provided", () => {
      sel.provided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(entry.providedOrNot).to.eq("Provided");
        expect(entry.serviceCategory).to.eq("ADL");
      });
    });

    it("turns the Provided side green", () => {
      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan");
      sel.provided("Bathing").parent().should("have.class", GREEN);
    });

    it("records a service as not provided", () => {
      sel.notProvided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(entry.providedOrNot).to.eq("Not Provided");
      });
    });

    it("stamps the record with the selected date", () => {
      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(entry.providedAt.slice(0, 10)).to.eq(today());
      });
    });

    it("clears the record when the same side is clicked again", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [buildService()], comments: [] },
          },
        })
      );
      stubSave();
      sel.provided("Bathing").parent().should("have.class", GREEN);
      sel.provided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        expect(
          savedServices(request).filter((s: any) => s.serviceCategory === "ADL")
        ).to.have.length(0);
      });
    });

    it("replaces rather than duplicates when the answer is changed", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [buildService()], comments: [] },
          },
        })
      );
      stubSave();
      sel.notProvided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const bathing = savedServices(request).filter(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(bathing, "one entry, not two").to.have.length(1);
        expect(bathing[0].providedOrNot).to.eq("Not Provided");
      });
    });

    it("records a housekeeping service", () => {
      sel.provided("Daily Clean Sweep").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceCategory === "House Keeping"
        );
        expect(entry.serviceName).to.eq("dailycleansweep");
        expect(entry.providedOrNot).to.eq("Provided");
      });
    });

    it("keeps each service's record to itself", () => {
      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan");
      sel.provided("Eating").parent().should("have.class", IDLE);
    });

    it("shows a service recorded earlier as already answered", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [buildService({ providedOrNot: "Not Provided" })],
              comments: [],
            },
          },
        })
      );
      sel.notProvided("Bathing").parent().should("have.class", GREY);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Vital signs
  // ──────────────────────────────────────────────────────────────────────────

  describe("Vital signs", () => {
    beforeEach(() => {
      visitCarePlan();
      stubSave();
    });

    it("invites a reading when none has been taken", () => {
      sel.vitalTrigger("Blood Pressure").should("contain.text", "Add readings");
    });

    it("opens the reading panel", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().should("be.visible");
      sel.vitalValue().should("be.visible");
    });

    it("keeps Add disabled until both time and value are given", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalAdd().should("be.disabled");

      sel.vitalTime().type("14:30");
      sel.vitalAdd().should("be.disabled");

      sel.vitalValue().type("120/80");
      sel.vitalAdd().should("not.be.disabled");
    });

    it("keeps Add disabled with a value but no time", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalValue().type("120/80");
      sel.vitalAdd().should("be.disabled");
    });

    it("records a reading", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceCategory === "Vital Signs"
        );
        expect(entry.serviceName).to.eq("bloodpressure");
        expect(entry.readings).to.have.length(1);
        expect(entry.readings[0].value).to.eq("120/80");
      });
    });

    it("files the day's readings under the selected date", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceCategory === "Vital Signs"
        );
        // Dev now stamps providedAt with the current time-of-day rather than
        // date-midnight — the contract under test is the selected date.
        expect(entry.providedAt.slice(0, 10)).to.eq(today());
      });
    });

    it("shows the reading back in local twelve-hour time", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().click();
      cy.wait("@saveCarePlan");

      cy.contains("2:30 PM").should("be.visible");
      cy.contains("120/80").should("be.visible");
    });

    it("takes several readings for one sign", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("08:00");
      sel.vitalValue().type("118/76");
      sel.vitalAdd().click();
      cy.wait("@saveCarePlan");

      sel.vitalTime().type("20:00");
      sel.vitalValue().type("124/82");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceCategory === "Vital Signs"
        );
        expect(entry.readings).to.have.length(2);
      });
    });

    it("summarises the readings on the trigger", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [buildVitalEntry()], comments: [] },
          },
        })
      );
      sel.vitalTrigger("Blood Pressure").should("contain.text", "120/80");
    });

    it("removes a reading", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [buildVitalEntry()], comments: [] },
          },
        })
      );
      stubSave();
      sel.vitalTrigger("Blood Pressure").click();
      cy.contains("li", "120/80").find("button").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        expect(
          savedServices(request).filter((s: any) => s.serviceCategory === "Vital Signs"),
          "the whole entry goes when its last reading is removed"
        ).to.have.length(0);
      });
    });

    it("accepts a free-text value that is not a blood pressure", () => {
      sel.vitalTrigger("Blood Sugar").click();
      sel.vitalTime().type("09:15");
      sel.vitalValue().type("5.6 mmol/L");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceName === "bloodsugar"
        );
        expect(entry.readings[0].value).to.eq("5.6 mmol/L");
      });
    });

    it("does not validate the reading value at all", () => {
      // Nothing constrains the text — worth knowing before trusting the data.
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("09:15");
      sel.vitalValue().type("not a reading");
      sel.vitalAdd().should("not.be.disabled");
    });

    it("keeps each vital sign's readings separate", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [buildVitalEntry()], comments: [] },
          },
        })
      );
      sel.vitalTrigger("Blood Sugar").should("contain.text", "Add readings");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. The date picker
  // ──────────────────────────────────────────────────────────────────────────

  describe("Date picker", () => {
    beforeEach(() => visitCarePlan());

    it("starts on today", () => {
      sel.datePicker().should("have.value", today());
    });

    it("stops any date after today being chosen", () => {
      sel.datePicker().should("have.attr", "max", today());
    });

    it("moves the plan to an earlier day", () => {
      sel.datePicker().type(daysFromNow(-1));
      sel.datePicker().should("have.value", daysFromNow(-1));
    });

    it("still lists the same services on an earlier day", () => {
      sel.datePicker().type(daysFromNow(-1));
      sel.row("Bathing").should("contain.text", "Assistance");
    });

    it("shows only the records belonging to the day being viewed", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [
                buildService({ providedAt: `${daysFromNow(-1)}T12:00:00.000Z` }),
              ],
              comments: [],
            },
          },
        })
      );

      sel.provided("Bathing").parent().should("have.class", IDLE);
      sel.datePicker().type(daysFromNow(-1));
      sel.provided("Bathing").parent().should("have.class", GREEN);
    });

    it("shows the readings taken on the day being viewed", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [
                buildVitalEntry({
                  providedAt: `${daysFromNow(-1)}T00:00:00.000Z`,
                  readings: [
                    { time: `${daysFromNow(-1)}T14:30:00.000Z`, value: "118/70" },
                  ],
                }),
              ],
              comments: [],
            },
          },
        })
      );

      sel.vitalTrigger("Blood Pressure").should("contain.text", "Add readings");
      sel.datePicker().type(daysFromNow(-1));
      sel.vitalTrigger("Blood Pressure").should("contain.text", "118/70");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Role-based access
  // ──────────────────────────────────────────────────────────────────────────

  describe("A Personal Care Giver", { tags: [Tags.PCG] }, () => {
    beforeEach(() => {
      visitCarePlan(buildSenior(), "PCG");
      stubSave();
    });

    it("can record an ADL service", () => {
      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan").then(({ request }) => {
        expect(savedServices(request)).to.have.length(1);
      });
    });

    it("can record a housekeeping service", () => {
      sel.provided("Laundry").click();
      cy.wait("@saveCarePlan").then(({ request }) => {
        expect(savedServices(request)[0].serviceCategory).to.eq("House Keeping");
      });
    });

    it("can take a vital sign reading", () => {
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().should("not.be.disabled");
    });
  });

  describe("A Nurse", { tags: [Tags.NURSE] }, () => {
    beforeEach(() => {
      visitCarePlan(buildSenior(), "Nurse");
      stubSave();
    });

    it("can take a vital sign reading", () => {
      // CLINICAL_CAREPLAN_VITALS is EDIT for a Nurse.
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        expect(
          savedServices(request).find((s: any) => s.serviceCategory === "Vital Signs")
        ).to.exist;
      });
    });

    it("still sees the ADL services", () => {
      sel.row("Bathing").should("contain.text", "Assistance");
    });

    it("cannot record an ADL service", () => {
      // CLINICAL_CAREPLAN is VIEW only and CLINICAL_TABS is VIEW only, so
      // `canEditToday` is false and the toggle's wrapping <button> is disabled.
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.provided("Bathing").click({ force: true });
      cy.assertNoRequest("@saveCarePlan");
    });

    it("cannot record a housekeeping service", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.provided("Laundry").click({ force: true });
      cy.assertNoRequest("@saveCarePlan");
    });

    it("gets a disabled toggle rather than a silent no-op", () => {
      sel.provided("Bathing").parents("button").should("be.disabled");
    });
  });

  describe("Editing an earlier day", () => {
    it("lets a Care Admin change a past record", () => {
      // PCHO holds CLINICAL_CAREPLAN_ADL_HISTORY_EDIT.
      visitCarePlan(buildSenior(), "PCHO");
      stubSave();
      sel.datePicker().type(daysFromNow(-1));
      sel.provided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(entry.providedAt.slice(0, 10)).to.eq(daysFromNow(-1));
      });
    });

    it("lets a Care Admin take a past vital sign reading", () => {
      visitCarePlan(buildSenior(), "PCHO");
      stubSave();
      sel.datePicker().type(daysFromNow(-1));
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("09:00");
      sel.vitalValue().type("119/79");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const entry = savedServices(request).find(
          (s: any) => s.serviceCategory === "Vital Signs"
        );
        // See above: providedAt carries the save time, so assert the date part.
        expect(entry.providedAt.slice(0, 10)).to.eq(daysFromNow(-1));
      });
    });

    it("stops a Personal Care Giver changing a past ADL record", { tags: [Tags.PCG] }, () => {
      // PCG has no CLINICAL_CAREPLAN_ADL_HISTORY_EDIT.
      visitCarePlan(buildSenior(), "PCG");
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.datePicker().type(daysFromNow(-1));
      sel.provided("Bathing").click({ force: true });
      cy.assertNoRequest("@saveCarePlan");
    });

    it("stops a Personal Care Giver changing a past housekeeping record", { tags: [Tags.PCG] }, () => {
      visitCarePlan(buildSenior(), "PCG");
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.datePicker().type(daysFromNow(-1));
      sel.provided("Laundry").click({ force: true });
      cy.assertNoRequest("@saveCarePlan");
    });

    it("stops a Nurse taking a past vital sign reading", { tags: [Tags.NURSE] }, () => {
      // CLINICAL_CAREPLAN_VITALS_HISTORY_EDIT is PCHO and HomeAdmin only, so
      // the reading panel offers no inputs at all on an earlier day.
      // NOTE: deployed prod still grants Nurse this permission (main's roles.ts
      // predates dev's tightening) — this test tracks the intended contract
      // and greens on prod once the deploy lands.
      visitCarePlan(buildSenior(), "Nurse");
      sel.datePicker().type(daysFromNow(-1));
      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().should("not.exist");
      sel.vitalAdd().should("not.exist");
    });

    it("still lets a Personal Care Giver read the past day", { tags: [Tags.PCG] }, () => {
      visitCarePlan(buildSenior(), "PCG");
      sel.datePicker().type(daysFromNow(-1));
      sel.row("Bathing").should("contain.text", "Assistance");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Comments
  //
  // The section renders only for roles holding CLINICAL_CAREPLAN as **VIEW**,
  // which among the clinical roles is the Nurse alone — see the defect pinned
  // in known-defects.cy.ts. These tests therefore run as a Nurse.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Comments", { tags: [Tags.NURSE] }, () => {
    beforeEach(() => {
      visitCarePlan(buildSenior(), "Nurse");
      stubSave();
    });

    it("offers a comment box for today", () => {
      sel.commentBox().should("be.visible");
      sel.addComment().should("be.visible");
    });

    it("adds a comment", () => {
      sel.commentBox().type("Ate a full breakfast.");
      sel.addComment().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const comments = request.body.carePlan.comments;
        expect(comments[comments.length - 1].message).to.eq("Ate a full breakfast.");
      });
    });

    it("stamps the comment with the selected date", () => {
      sel.commentBox().type("Ate a full breakfast.");
      sel.addComment().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const comments = request.body.carePlan.comments;
        // The app stamps comments with toISOString() — a UTC date. Comparing
        // against local `today()` breaks whenever the two calendars disagree
        // (any run in a non-UTC timezone near midnight).
        expect(comments[comments.length - 1].createdAt.slice(0, 10)).to.eq(
          new Date().toISOString().slice(0, 10),
        );
      });
    });

    it("ignores an empty comment", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.addComment().click();
      cy.assertNoRequest("@saveCarePlan");
    });

    it("ignores a comment of only spaces", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveCarePlan");
      sel.commentBox().type("    ");
      sel.addComment().click();
      cy.assertNoRequest("@saveCarePlan");
    });

    it("trims the comment before saving", () => {
      sel.commentBox().type("   Slept well.   ");
      sel.addComment().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const comments = request.body.carePlan.comments;
        expect(comments[comments.length - 1].message).to.eq("Slept well.");
      });
    });

    it("shows a comment left today", { tags: [Tags.NURSE] }, () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: { services: [], comments: [buildComment()] },
          },
        }),
        "Nurse"
      );
      cy.contains("Settled well overnight.").should("be.visible");
    });

    it("hides a comment left on another day", { tags: [Tags.NURSE] }, () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [],
              comments: [
                buildComment({ createdAt: `${daysFromNow(-3)}T09:00:00.000Z` }),
              ],
            },
          },
        }),
        "Nurse"
      );
      cy.contains("Settled well overnight.").should("not.exist");
    });

    it("shows that day's comment when the date is changed", { tags: [Tags.NURSE] }, () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [],
              comments: [
                buildComment({ createdAt: `${daysFromNow(-1)}T09:00:00.000Z` }),
              ],
            },
          },
        }),
        "Nurse"
      );
      cy.contains("Settled well overnight.").should("not.exist");
      sel.datePicker().type(daysFromNow(-1));
      cy.contains("Settled well overnight.").should("be.visible");
    });

    it("takes the comment box away from a Nurse on an earlier day", () => {
      // CLINICAL_COMMENTS_HISTORY_EDIT is PCHO and HomeAdmin only.
      sel.datePicker().type(daysFromNow(-1));
      sel.addComment().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Care Plan Actions and the Care Report
  //
  // Stops at the modal — PDF contents are out of scope.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Care Plan Actions", () => {
    const withRecords = () =>
      buildSenior({
        clinical: {
          roomNumber: 12,
          status: "In Home",
          medication: [],
          carePlan: { services: [buildService(), buildVitalEntry()], comments: [] },
        },
      });

    it("offers the actions menu", () => {
      visitCarePlan();
      sel.carePlanActions().should("be.visible");
    });

    it("offers Generate and View", () => {
      visitCarePlan();
      sel.carePlanActions().click();
      cy.contains("div", /^Generate$/).should("be.visible");
      cy.contains("div", /^View$/).should("be.visible");
    });

    it("greys Generate out for a role that cannot generate", { tags: [Tags.NURSE] }, () => {
      // carePlanGenerateAccess needs CLINICAL_CAREPLAN or CLINICAL_TABS as EDIT.
      visitCarePlan(buildSenior(), "Nurse");
      sel.carePlanActions().click();
      // The label is an inner <div>; the state class is on its wrapper.
      cy.contains("div", /^Generate$/)
        .parent()
        .should("have.class", "cursor-not-allowed");
    });

    it("starts generating for a role that can", () => {
      visitCarePlan(buildSenior(), "PCHO");
      cy.intercept("POST", "**/generate-care-plan**", {
        statusCode: 200,
        body: {},
      }).as("generate");
      sel.carePlanActions().click();
      cy.contains("div", /^Generate$/).click();

      cy.contains("Gathering resident information").should("be.visible");
    });

    it("says the report must be generated before it can be viewed", () => {
      visitCarePlan();
      cy.intercept("POST", "/api/s3/exists", {
        statusCode: 200,
        body: { exists: false },
      }).as("exists");
      sel.carePlanActions().click();
      cy.contains("div", /^View$/).click();

      cy.wait("@exists");
      cy.assertPopover("You must generate the care plan prior to viewing it.");
    });

    it("says the same when the existence check fails outright", () => {
      visitCarePlan();
      cy.intercept("POST", "/api/s3/exists", { statusCode: 500, body: {} }).as("exists");
      sel.carePlanActions().click();
      cy.contains("div", /^View$/).click();

      cy.wait("@exists");
      cy.assertPopover("You must generate the care plan prior to viewing it.");
    });

    it("opens the report when one exists", () => {
      visitCarePlan();
      cy.intercept("POST", "/api/s3/exists", {
        statusCode: 200,
        body: { exists: true },
      }).as("exists");
      cy.stubPresign();
      cy.window().then((win) => cy.stub(win, "open").as("openReport"));

      sel.carePlanActions().click();
      cy.contains("div", /^View$/).click();

      cy.wait("@exists");
      cy.get("@openReport").should("have.been.called");
    });
  });

  describe("Generating a Care Report", () => {
    /**
     * Pick a month by position, never by value.
     *
     * carePlanOptions is built with `date.setMonth(date.getMonth() - i)` on a
     * rolling Date, which repeats values near month end — `cy.select("2026-03")`
     * then throws "matched more than one option". Index 0 is the placeholder,
     * 1 is the current month, n+1 is n months back.
     */
    const selectMonth = (monthsBack: number) => sel.reportSelect().select(monthsBack + 1);

    const withRecords = () =>
      buildSenior({
        clinical: {
          roomNumber: 12,
          status: "In Home",
          medication: [],
          carePlan: { services: [buildService(), buildVitalEntry()], comments: [] },
        },
      });

    it("offers a month picker", () => {
      visitCarePlan();
      sel.reportSelect().should("be.visible");
      sel.reportSelect().find("option").should("have.length", 13);
    });

    it("opens the report modal for a month with records", () => {
      visitCarePlan(withRecords());
      selectMonth(0);

      cy.contains("Care Report Generated").should("be.visible");
      cy.contains("Your care plan monthly record has been generated successfully").should(
        "be.visible"
      );
    });

    it("offers the download action", () => {
      visitCarePlan(withRecords());
      selectMonth(0);
      cy.contains("button", "Download PDF").should("be.visible");
    });

    it("says so when the senior has no care plan at all", () => {
      visitCarePlan(buildSenior({ carePlan: {} }));
      selectMonth(0);

      cy.assertPopover("No care plan services recorded during selected period");
      cy.contains("Care Report Generated").should("not.exist");
    });

    /**
     * The guard tightened in the stg merge.
     *
     * It used to be `rows.length > 0 || vitalSignReadings.length > 0` — the
     * PLAN alone was enough, so an untouched month produced a blank sheet of
     * empty cells. It is now
     *
     *   rows.some(r => r.days.some(d => d.status || d.value))
     *
     * so a month is only reportable if something was actually RECORDED in it.
     * An empty month warns instead, matching how EMAR behaves.
     */
    it("refuses a month with a plan but no records", () => {
      visitCarePlan(withRecords());
      selectMonth(6);

      cy.assertPopover("No care plan services recorded during selected period");
    });

    it("generates no report for that month", () => {
      visitCarePlan(withRecords());
      selectMonth(6);

      cy.contains("Care Report Generated").should("not.exist");
    });

    it("still generates for a month that does have records", () => {
      // The control for the two above: same senior, the month the fixture's
      // service and vital entry were recorded in.
      visitCarePlan(withRecords());
      selectMonth(0);

      cy.contains("Care Report Generated").should("be.visible");
    });

    it("does nothing while the placeholder is selected", () => {
      visitCarePlan(withRecords());
      sel.reportSelect().select(0);
      cy.contains("Care Report Generated").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a carer works the round, records a vital, and the plan reflects it", { tags: [Tags.PCG] }, () => {
      visitCarePlan(buildSenior(), "PCG");
      stubSave();

      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan");
      sel.provided("Bathing").parent().should("have.class", GREEN);

      sel.notProvided("Eating").click();
      cy.wait("@saveCarePlan");
      sel.notProvided("Eating").parent().should("have.class", GREY);

      sel.vitalTrigger("Blood Pressure").click();
      sel.vitalTime().type("14:30");
      sel.vitalValue().type("120/80");
      sel.vitalAdd().click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const services = savedServices(request);
        expect(services.filter((s: any) => s.serviceCategory === "ADL")).to.have.length(2);
        expect(
          services.filter((s: any) => s.serviceCategory === "Vital Signs")
        ).to.have.length(1);
      });
    });

    it("E2E — an Independent service never reaches the clinical round", { tags: [Tags.PCG] }, () => {
      visitCarePlan(buildSenior(), "PCG");
      stubSave();

      cy.contains("strong", "Dressing").should("not.exist");
      sel.provided("Bathing").click();

      cy.wait("@saveCarePlan").then(({ request }) => {
        const names = savedServices(request).map((s: any) => s.serviceName);
        expect(names.join(" ")).to.not.contain("dressing");
      });
    });

    it("E2E — a Care Admin corrects yesterday's record", () => {
      visitCarePlan(
        buildSenior({
          clinical: {
            roomNumber: 12,
            status: "In Home",
            medication: [],
            carePlan: {
              services: [
                buildService({
                  providedOrNot: "Not Provided",
                  providedAt: `${daysFromNow(-1)}T12:00:00.000Z`,
                }),
              ],
              comments: [],
            },
          },
        }),
        "PCHO"
      );
      stubSave();

      sel.datePicker().type(daysFromNow(-1));
      sel.notProvided("Bathing").parent().should("have.class", GREY);

      sel.provided("Bathing").click();
      cy.wait("@saveCarePlan").then(({ request }) => {
        const bathing = savedServices(request).filter(
          (s: any) => s.serviceName === "bathing - Assistance"
        );
        expect(bathing).to.have.length(1);
        expect(bathing[0].providedOrNot).to.eq("Provided");
      });
    });
  });
});
