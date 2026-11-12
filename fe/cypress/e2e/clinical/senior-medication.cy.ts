/// <reference types="cypress" />

/**
 * Clinical — Add Medication, and where a medication surfaces afterwards
 *
 *   components/clinical/clinicalTabs/add-medication.tsx   the modal
 *   components/clinical/clinicalTabs/medication.tsx       the Medication tab
 *   components/clinical/clinicalTabs/medpass.tsx          the MedPass tab
 *   model/clinical/clinical.model.ts                      the validation
 *
 * HOW MANY TIMINGS CAN BE SELECTED?
 *
 * There is no upper limit anywhere:
 *   - `timeOptions24H` (utils/dateUtils.ts) builds 48 options — every 30
 *     minutes from 00:00 to 23:30;
 *   - the schema is `z.array(z.string().time()).min(1)` — a minimum of one and
 *     no `.max()`;
 *   - MultiSelectComponent has no cap of its own.
 * So all 48 can be selected at once. "select all 48" below proves it.
 *
 * WHERE A SAVED MEDICATION SHOWS UP — the two tabs filter differently:
 *
 *   Medication tab  !overTheCounter && (no enddate || enddate >= today)
 *                   One row per medication.
 *   MedPass         startdate <= date && !overTheCounter
 *                                     && (no enddate || enddate >= date)
 *                   One row per medication PER TIMING — so a three-times-a-day
 *                   medication produces three MedPass rows.
 *
 * The difference that catches people out: MedPass also checks `startdate`, so a
 * medication that starts tomorrow is on the Medication tab today but not in
 * today's MedPass.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SENIOR = "Arthur Bean";
const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";

// ── Dates ────────────────────────────────────────────────────────────────────
// The modal stamps `min` with date-fns `format(new Date(), "yyyy-MM-dd")` and
// MedPass compares against `getYYYYMMDDString(new Date())` — both LOCAL, so the
// fixtures are built locally too.
//
// The Medication tab is the odd one out: it derives today from
// `new Date().toISOString().split("T")[0]`, which is UTC. The two tabs
// therefore disagree about what "today" is for part of every day, which is why
// no test here asserts on a course ending exactly today.

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 24 * 60 * 60 * 1000;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * DAY));

/** A saved medication, as it is stored on `clinical.medication`. */
const buildMedication = (overrides: Record<string, any> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Dolo",
  dosage: "650",
  directions: "Before Eating",
  startdate: today(),
  enddate: "",
  timings: ["07:30:00"],
  additionalComments: "",
  overTheCounter: false,
  ...overrides,
});

const buildSenior = (medication: any[] = [], overrides: Record<string, any> = {}) => ({
  userId: SENIOR_ID,
  name: SENIOR,
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  clinical: { roomNumber: 12, status: "In Home", medication },
  ...overrides,
});

const sel = {
  modal: () => cy.get(".ReactModal__Content"),
  addButton: () => cy.contains("button", "Add Medication"),
  name: () => cy.get('input[name="medication.name"]'),
  dosage: () => cy.get('input[name="medication.dosage"]'),
  directions: () => cy.get('input[name="medication.directions"]'),
  startDate: () => cy.get('input[name="medication.startdate"]'),
  endDate: () => cy.get('input[name="medication.enddate"]'),
  comments: () => cy.get('textarea[name="medication.additionalComments"]'),
  save: () => cy.contains("button", "Save"),
  closeModal: () => cy.get(".ReactModal__Content div.absolute.top-4.right-6"),
  /** The multi-select's trigger — the only 420px-wide control in the modal. */
  timingsTrigger: () => sel.modal().find('div[class*="w-[420px]"]').first(),
  timingOptions: () => cy.get("ul li"),
  rows: () => cy.get('div[class*="border-b"]'),
};

/** Open the timings dropdown, tick each label, and close it again. */
const chooseTimings = (...labels: string[]) => {
  sel.timingsTrigger().click();
  labels.forEach((label) => sel.timingOptions().contains(label).click());
  sel.timingsTrigger().click();
};

const stubSeniors = (users: any[]) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as("getSeniors");

const stubShifts = () =>
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );

const visitMedicationTab = (senior: Record<string, any> = buildSenior()) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  stubShifts();
  stubSeniors([senior]);
  cy.stubUser(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=Medication`);
  sel.addButton().should("be.visible");
};

const visitMedPassTab = (senior: Record<string, any>) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  stubShifts();
  stubSeniors([senior]);
  cy.stubUser(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=MedPass`);
  cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
};

const openModal = () => {
  sel.addButton().click();
  sel.name().should("be.visible");
};

/** Fill everything the schema insists on. */
const fillRequired = ({
  name = "Dolo",
  dosage = "650",
  start = today(),
} = {}) => {
  sel.name().clear().type(name);
  sel.dosage().clear().type(dosage);
  sel.startDate().type(start);
};

const stubSave = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode, body }).as("saveMedication");

/** The medication the app just sent, off the PUT payload. */
const savedMedication = (request: any) =>
  request.body.medication[request.body.medication.length - 1];

describe("Clinical — Add Medication", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Opening the modal
  // ──────────────────────────────────────────────────────────────────────────

  describe("Opening", () => {
    beforeEach(() => visitMedicationTab());

    it("opens from the Add Medication button", () => {
      openModal();
      sel.modal().contains("Add Medication").should("be.visible");
    });

    it("renders every field", () => {
      openModal();
      ["Name", "Dosage", "Directions", "Start Date", "End Date", "Timings"].forEach(
        (label) => sel.modal().contains(label).should("be.visible")
      );
      sel.comments().should("exist");
    });

    it("marks the required fields", () => {
      openModal();
      ["Name * :", "Dosage * :", "Start Date * :", "Timings * :"].forEach((label) =>
        sel.modal().contains(label).should("be.visible")
      );
    });

    it("leaves Directions and End Date optional", () => {
      openModal();
      sel.modal().contains("Directions :").should("be.visible");
      sel.modal().contains("End Date :").should("be.visible");
    });

    it("starts with an empty form", () => {
      openModal();
      sel.name().should("have.value", "");
      sel.dosage().should("have.value", "");
      sel.startDate().should("have.value", "");
    });

    it("closes on the cross", () => {
      openModal();
      sel.closeModal().click();
      sel.name().should("not.exist");
    });

    it("opens the bulk modal instead when Bulk is switched on", () => {
      // The toggle changes what the button *does*, not just its label.
      cy.contains("span", "Bulk").siblings("button").click();
      cy.contains("button", "Add Bulk Medication").click();
      sel.name().should("not.exist");
      cy.get(".ReactModal__Content").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Validation", () => {
    beforeEach(() => {
      visitMedicationTab();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveMedication");
      openModal();
    });

    it("refuses an empty form", () => {
      sel.save().click();
      cy.assertNoRequest("@saveMedication");
    });

    it("refuses a medication with no name", () => {
      sel.dosage().type("650");
      sel.startDate().type(today());
      chooseTimings("07:30 AM");
      sel.save().click();
      cy.assertNoRequest("@saveMedication");
    });

    it("refuses a name containing punctuation the schema forbids", () => {
      fillRequired({ name: "Dolo@650" });
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.contains("Only alphabets, numbers, and special characters").should("be.visible");
      cy.assertNoRequest("@saveMedication");
    });

    it("accepts a name with brackets, hyphens and underscores", () => {
      stubSave();
      fillRequired({ name: "Paracetamol (Extra) - 500_mg" });
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).name).to.eq("Paracetamol (Extra) - 500_mg");
      });
    });

    it("refuses a medication with no start date", () => {
      sel.name().type("Dolo");
      sel.dosage().type("650");
      chooseTimings("07:30 AM");
      sel.save().click();

      // An untouched date field is `undefined`, so Zod's invalid_type message
      // fires — the `.refine()` wording only appears once it holds "".
      cy.contains("Required").should("be.visible");
      cy.assertNoRequest("@saveMedication");
    });

    it("refuses a medication with no timings", () => {
      fillRequired();
      sel.save().click();

      // Same again: untouched timings are `undefined`, which hits the array's
      // own message. `.min(1)`'s wording needs an empty array to appear.
      cy.contains("Should select atleast 1 medpass time").should("be.visible");
      cy.assertNoRequest("@saveMedication");
    });

    it("clears the timings error once one is chosen", () => {
      stubSave();
      fillRequired();
      sel.save().click();
      cy.contains("Should select atleast 1 medpass time").should("be.visible");

      chooseTimings("07:30 AM");
      sel.save().click();
      cy.wait("@saveMedication");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Dates
  // ──────────────────────────────────────────────────────────────────────────

  describe("Dates", () => {
    beforeEach(() => {
      visitMedicationTab();
      openModal();
    });

    it("stops the start date before today", () => {
      sel.startDate().should("have.attr", "min", today());
    });

    it("caps the start date at a four-digit year", () => {
      sel.startDate().should("have.attr", "max", "9999-12-31");
    });

    it("stops the end date before today while no start date is chosen", () => {
      sel.endDate().should("have.attr", "min", today());
    });

    it("moves the end date's floor to the chosen start date", () => {
      const start = daysFromNow(5);
      sel.startDate().type(start);
      sel.endDate().should("have.attr", "min", start);
    });

    it("accepts a course starting today", () => {
      stubSave();
      fillRequired({ start: today() });
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).startdate).to.eq(today());
      });
    });

    it("accepts a course starting in the future", () => {
      stubSave();
      fillRequired({ start: daysFromNow(30) });
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).startdate).to.eq(daysFromNow(30));
      });
    });

    it("accepts a course with no end date", () => {
      stubSave();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).enddate ?? "").to.eq("");
      });
    });

    it("accepts a single-day course", () => {
      stubSave();
      fillRequired();
      sel.endDate().type(today());
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        const med = savedMedication(request);
        expect(med.startdate).to.eq(today());
        expect(med.enddate).to.eq(today());
      });
    });

    it("accepts a course running into next year", () => {
      stubSave();
      fillRequired();
      sel.endDate().type(daysFromNow(400));
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).enddate).to.eq(daysFromNow(400));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Timings — one, several, and the lack of any cap
  // ──────────────────────────────────────────────────────────────────────────

  describe("Timings", () => {
    beforeEach(() => {
      visitMedicationTab();
      stubSave();
      openModal();
    });

    it("offers a slot every thirty minutes across the day", () => {
      sel.timingsTrigger().click();
      sel.timingOptions().should("have.length", 48);
    });

    it("offers midnight and the last slot of the day", () => {
      sel.timingsTrigger().click();
      sel.timingOptions().contains("12:00 AM").should("exist");
      sel.timingOptions().contains("11:30 PM").should("exist");
    });

    it("saves a once-a-day medication", () => {
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.deep.eq(["07:30:00"]);
      });
    });

    it("saves a twice-a-day medication", () => {
      fillRequired();
      chooseTimings("07:30 AM", "08:00 PM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.deep.eq(["07:30:00", "20:00:00"]);
      });
    });

    it("saves a three-times-a-day medication", () => {
      // The low-dose case: same medicine, smaller dose, taken morning, midday
      // and evening.
      fillRequired({ dosage: "250" });
      chooseTimings("07:30 AM", "12:00 PM", "06:00 PM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        const med = savedMedication(request);
        expect(med.dosage).to.eq("250");
        expect(med.timings).to.deep.eq(["07:30:00", "12:00:00", "18:00:00"]);
      });
    });

    it("saves a four-times-a-day medication", () => {
      fillRequired();
      chooseTimings("08:00 AM", "12:00 PM", "04:00 PM", "08:00 PM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.have.length(4);
      });
    });

    it("saves six timings", () => {
      fillRequired();
      chooseTimings(
        "06:00 AM",
        "09:00 AM",
        "12:00 PM",
        "03:00 PM",
        "06:00 PM",
        "09:00 PM"
      );
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.have.length(6);
      });
    });

    it("imposes no upper limit — all forty-eight can be chosen", () => {
      // Neither the schema (min(1), no max) nor MultiSelectComponent caps the
      // selection, so every slot in the day is selectable at once.
      fillRequired();
      sel.timingsTrigger().click();
      sel.timingOptions().each(($option) => cy.wrap($option).click());
      sel.timingsTrigger().click();
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.have.length(48);
      });
    });

    it("keeps the timings in the order they were picked", () => {
      fillRequired();
      chooseTimings("08:00 PM", "07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.deep.eq(["20:00:00", "07:30:00"]);
      });
    });

    it("lets a timing be unpicked again", () => {
      fillRequired();
      sel.timingsTrigger().click();
      sel.timingOptions().contains("07:30 AM").click();
      sel.timingOptions().contains("12:00 PM").click();
      sel.timingOptions().contains("07:30 AM").click(); // untick
      sel.timingsTrigger().click();
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.deep.eq(["12:00:00"]);
      });
    });

    it("sends the timings as 24-hour HH:mm:ss", () => {
      fillRequired();
      chooseTimings("12:00 AM", "12:30 PM", "11:30 PM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).timings).to.deep.eq([
          "00:00:00",
          "12:30:00",
          "23:30:00",
        ]);
      });
    });

    it("shows the chosen timings on the closed control", () => {
      chooseTimings("07:30 AM", "12:00 PM");
      sel.modal().contains("07:30 AM, 12:00 PM").should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. What gets saved
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving", () => {
    it("sends the whole medication", () => {
      visitMedicationTab();
      stubSave();
      openModal();

      sel.name().type("Dolo");
      sel.dosage().type("650");
      sel.directions().type("Before Eating");
      sel.startDate().type(today());
      sel.endDate().type(daysFromNow(7));
      chooseTimings("07:30 AM");
      sel.comments().type("Stop if drowsy.");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        const med = savedMedication(request);
        expect(med.name).to.eq("Dolo");
        expect(med.dosage).to.eq("650");
        expect(med.directions).to.eq("Before Eating");
        expect(med.startdate).to.eq(today());
        expect(med.enddate).to.eq(daysFromNow(7));
        expect(med.additionalComments).to.eq("Stop if drowsy.");
      });
    });

    it("marks the medication as not over-the-counter", () => {
      visitMedicationTab();
      stubSave();
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).overTheCounter).to.eq(false);
      });
    });

    it("gives the medication its own id", () => {
      visitMedicationTab();
      stubSave();
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).id, "generated id").to.match(
          /^[0-9a-f-]{36}$/i
        );
      });
    });

    it("appends to the senior's existing medications rather than replacing them", () => {
      visitMedicationTab(buildSenior([buildMedication({ name: "Aspirin" })]));
      stubSave();
      openModal();
      fillRequired({ name: "Dolo" });
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        const names = request.body.medication.map((m: any) => m.name);
        expect(names).to.include("Aspirin");
        expect(names).to.include("Dolo");
      });
    });

    it("keeps the senior's other clinical fields", () => {
      visitMedicationTab();
      stubSave();
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(12);
        expect(request.body.status).to.eq("In Home");
      });
    });

    it("confirms the medication was added", () => {
      visitMedicationTab();
      stubSave();
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication");
      cy.assertPopover("Medication added");
    });

    it("closes the modal once saved", () => {
      visitMedicationTab();
      stubSave();
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication");
      sel.name().should("not.exist");
    });

    it("reports a rejected save", () => {
      visitMedicationTab();
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { message: "clinical service unavailable" },
      }).as("saveMedication");
      openModal();
      fillRequired();
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication");
      cy.assertPopover("Error in adding the medication");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. The Medication tab
  // ──────────────────────────────────────────────────────────────────────────

  describe("Medication tab", () => {
    it("lists a saved medication with its dose and directions", () => {
      visitMedicationTab(buildSenior([buildMedication()]));
      cy.contains("Dolo - 650").should("be.visible");
      cy.contains("Directions: Before Eating").should("be.visible");
    });

    it("formats the dates as MM/DD/YYYY", () => {
      // Relative, not hardcoded: the Medication tab hides a course whose end
      // date has passed, so fixed dates quietly stop rendering once they age
      // out and the test starts failing for a reason that has nothing to do
      // with formatting.
      const start = daysFromNow(-2);
      const end = daysFromNow(2);
      const mmddyyyy = (iso: string) => {
        const [y, m, d] = iso.split("-");
        return `${m}/${d}/${y}`;
      };

      visitMedicationTab(
        buildSenior([buildMedication({ startdate: start, enddate: end })])
      );
      cy.contains(mmddyyyy(start)).should("be.visible");
      cy.contains(mmddyyyy(end)).should("be.visible");
    });

    it("dashes a medication with no end date", () => {
      visitMedicationTab(buildSenior([buildMedication({ enddate: "" })]));
      cy.contains("Dolo - 650")
        .closest('div[class*="border-b"]')
        .should("contain.text", "-");
    });

    it("lists every timing in twelve-hour form", () => {
      visitMedicationTab(
        buildSenior([buildMedication({ timings: ["07:30:00", "12:00:00", "18:00:00"] })])
      );
      // timeFormat() builds the hour with parseInt, so the table shows "7:30 AM"
      // where the dropdown option reads "07:30 AM".
      cy.contains("7:30 AM, 12:00 PM, 6:00 PM").should("exist");
    });

    it("keeps a medication whose course has not ended", () => {
      visitMedicationTab(
        buildSenior([buildMedication({ enddate: daysFromNow(3) })])
      );
      cy.contains("Dolo - 650").should("be.visible");
    });

    it("keeps a medication whose course has ended", () => {
      // The enddate filter was removed upstream (commit 90a2c6e9 — "exclude
      // over-the-counter only"): an ended course still appears on the tab —
      // the nurse still needs the record even though MedPass drops it.
      visitMedicationTab(
        buildSenior([buildMedication({ enddate: daysFromNow(-2) })])
      );
      cy.contains("Dolo - 650").should("be.visible");
    });

    it("keeps a medication whose course ends tomorrow", () => {
      // Deliberately not "ends today": medication.tsx derives today from
      // `toISOString()` (UTC) while everything else here is local, so a course
      // ending today is in or out depending on the hour. See the note above
      // "leaves out a medication whose course ended yesterday".
      visitMedicationTab(buildSenior([buildMedication({ enddate: daysFromNow(1) })]));
      cy.contains("Dolo - 650").should("be.visible");
    });

    it("accepts an empty dosage despite the required marker", () => {
      // `dosage: z.string()` accepts "", so a field that is focused and then
      // cleared passes validation — only an untouched (undefined) dosage is
      // caught. The asterisk on the label promises more than the schema does.
      visitMedicationTab();
      stubSave();
      openModal();
      sel.name().type("Dolo");
      sel.dosage().type("650").clear();
      sel.startDate().type(today());
      chooseTimings("07:30 AM");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).dosage, "dosage saved").to.eq("");
      });
    });

    it("shows a medication that starts in the future", () => {
      // The Medication tab does NOT filter on startdate — only MedPass does.
      visitMedicationTab(
        buildSenior([buildMedication({ startdate: daysFromNow(7) })])
      );
      cy.contains("Dolo - 650").should("be.visible");
    });

    it("leaves over-the-counter medications to their own tab", () => {
      visitMedicationTab(
        buildSenior([buildMedication({ name: "Vitamin C", overTheCounter: true })])
      );
      cy.contains("Vitamin C").should("not.exist");
    });

    it("lists several medications at once", () => {
      visitMedicationTab(
        buildSenior([
          buildMedication({ name: "Dolo" }),
          buildMedication({
            id: "22222222-2222-4222-8222-222222222222",
            name: "Aspirin",
            dosage: "75",
          }),
        ])
      );
      cy.contains("Dolo - 650").should("be.visible");
      cy.contains("Aspirin - 75").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. MedPass — one row per timing, for today only
  // ──────────────────────────────────────────────────────────────────────────

  describe("MedPass", () => {
    const medRows = () => cy.contains("Dolo").closest('div[class*="border-b"]');

    it("shows a once-a-day medication once", () => {
      visitMedPassTab(buildSenior([buildMedication({ timings: ["07:30:00"] })]));
      cy.get('div[class*="border-b"]').filter(':contains("Dolo")').should("have.length", 1);
    });

    it("shows a twice-a-day medication twice", () => {
      visitMedPassTab(
        buildSenior([buildMedication({ timings: ["07:30:00", "20:00:00"] })])
      );
      cy.get('div[class*="border-b"]').filter(':contains("Dolo")').should("have.length", 2);
    });

    it("shows a three-times-a-day medication three times", () => {
      visitMedPassTab(
        buildSenior([buildMedication({ timings: ["07:30:00", "12:00:00", "18:00:00"] })])
      );
      cy.get('div[class*="border-b"]').filter(':contains("Dolo")').should("have.length", 3);
    });

    it("shows a six-times-a-day medication six times", () => {
      visitMedPassTab(
        buildSenior([
          buildMedication({
            timings: ["06:00:00", "09:00:00", "12:00:00", "15:00:00", "18:00:00", "21:00:00"],
          }),
        ])
      );
      cy.get('div[class*="border-b"]').filter(':contains("Dolo")').should("have.length", 6);
    });

    it("gives each row its own timing", () => {
      visitMedPassTab(
        buildSenior([buildMedication({ timings: ["07:30:00", "12:00:00"] })])
      );
      cy.contains("7:30 AM").should("be.visible");
      cy.contains("12:00 PM").should("be.visible");
    });

    it("includes a medication with no end date", () => {
      visitMedPassTab(buildSenior([buildMedication({ enddate: "" })]));
      medRows().should("exist");
    });

    it("includes a medication that started before today and runs on", () => {
      visitMedPassTab(
        buildSenior([
          buildMedication({ startdate: daysFromNow(-10), enddate: daysFromNow(10) }),
        ])
      );
      medRows().should("exist");
    });

    it("leaves out a medication that starts tomorrow", () => {
      // The difference from the Medication tab: MedPass also checks startdate,
      // so a course that has not begun is not on today's round.
      visitMedPassTab(
        buildSenior([buildMedication({ startdate: daysFromNow(1) })])
      );
      cy.contains("Dolo").should("not.exist");
    });

    it("leaves out a medication whose course ended yesterday", () => {
      visitMedPassTab(
        buildSenior([
          buildMedication({ startdate: daysFromNow(-10), enddate: daysFromNow(-1) }),
        ])
      );
      cy.contains("Dolo").should("not.exist");
    });

    it("includes a medication ending today", () => {
      visitMedPassTab(buildSenior([buildMedication({ enddate: today() })]));
      medRows().should("exist");
    });

    it("leaves out an over-the-counter medication", () => {
      visitMedPassTab(
        buildSenior([buildMedication({ overTheCounter: true })])
      );
      cy.contains("Dolo").should("not.exist");
    });

    it("expands several medications independently", () => {
      visitMedPassTab(
        buildSenior([
          buildMedication({ name: "Dolo", timings: ["07:30:00", "20:00:00"] }),
          buildMedication({
            id: "22222222-2222-4222-8222-222222222222",
            name: "Aspirin",
            timings: ["09:00:00"],
          }),
        ])
      );
      cy.get('div[class*="border-b"]').filter(':contains("Dolo")').should("have.length", 2);
      cy.get('div[class*="border-b"]').filter(':contains("Aspirin")').should("have.length", 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a three-times-a-day medication is added and shows up in both tabs", () => {
      visitMedicationTab();
      stubSave();
      openModal();

      sel.name().type("Dolo");
      sel.dosage().type("250");
      sel.directions().type("After food");
      sel.startDate().type(today());
      chooseTimings("07:30 AM", "12:00 PM", "06:00 PM");
      sel.save().click();

      let saved: any;
      cy.wait("@saveMedication").then(({ request }) => {
        saved = savedMedication(request);
        expect(saved.timings).to.have.length(3);
      });
      cy.assertPopover("Medication added");
      cy.dismissPopover();

      // Feed the medication the app actually sent back as the senior's record.
      cy.then(() => {
        const senior = buildSenior([saved]);
        visitMedicationTab(senior);
        cy.contains("Dolo - 250").should("be.visible");
        // timeFormat() builds the hour with parseInt, so the table shows "7:30 AM"
      // where the dropdown option reads "07:30 AM".
      cy.contains("7:30 AM, 12:00 PM, 6:00 PM").should("exist");

        visitMedPassTab(senior);
        cy.get('div[class*="border-b"]')
          .filter(':contains("Dolo")')
          .should("have.length", 3);
      });
    });

    it("E2E — a validation error is corrected and the medication then saves", () => {
      visitMedicationTab();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveMedication");
      openModal();

      fillRequired({ name: "Dolo@650" });
      chooseTimings("07:30 AM");
      sel.save().click();
      cy.contains("Only alphabets, numbers, and special characters").should("be.visible");
      cy.assertNoRequest("@saveMedication");

      stubSave();
      sel.name().clear().type("Dolo 650");
      sel.save().click();

      cy.wait("@saveMedication").then(({ request }) => {
        expect(savedMedication(request).name).to.eq("Dolo 650");
      });
      cy.assertPopover("Medication added");
    });

    it("E2E — a future course is on the Medication tab but not today's MedPass", () => {
      const future = buildMedication({
        startdate: daysFromNow(7),
        timings: ["07:30:00", "20:00:00"],
      });

      visitMedicationTab(buildSenior([future]));
      cy.contains("Dolo - 650").should("be.visible");

      visitMedPassTab(buildSenior([future]));
      cy.contains("Dolo").should("not.exist");
    });
  });
});
