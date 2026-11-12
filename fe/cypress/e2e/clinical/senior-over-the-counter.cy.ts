/// <reference types="cypress" />

/**
 * Clinical — Over-the-Counter medication
 *
 *   components/clinical/clinicalTabs/over-the-counter.tsx   the tab and its modal
 *   model/clinical/clinical.model.ts                        the shared validation
 *   utils/emarDataLayer.ts                                  the EMAR export
 *
 * All as a PCHO.
 *
 * HOW OTC DIFFERS FROM A DAILY MEDICATION
 *   Same `ClinicalSchema`, but a different form: Name, Reason, Dosage, Date,
 *   Timings — no End Date and no Additional Comments. The Date is capped at
 *   TODAY (`max={today}`), the mirror image of Add Medication, which floors it
 *   at today: an OTC dose records something already given.
 *
 *   "Reason" is stored on `directions`, not on a field of its own.
 *
 *   Saving writes TWO things: the medication with `overTheCounter: true`, and a
 *   medPass service marking it Pass. That service is what carries it into the
 *   EMAR.
 *
 * EMAR AND OTC
 *   emarDataLayer.ts iterates `clinical.medication` with no `overTheCounter`
 *   filter, so OTC doses do reach the export. What can be asserted from the UI
 *   is that an OTC dose alone is enough to generate an EMAR — the report's
 *   contents live in the PDF, which is deliberately out of scope for now. See
 *   the note on the EMAR block below.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
const OTC_TAB = "Over-The-Counter Medication";

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86400000;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * DAY));

/** An OTC dose as it is stored on `clinical.medication`. */
const buildOtc = (overrides: Record<string, any> = {}) => ({
  id: "99999999-9999-4999-8999-999999999999",
  name: "Ibuprofen",
  dosage: "200mg",
  directions: "Headache",
  startdate: today(),
  timings: ["14:00:00"],
  overTheCounter: true,
  ...overrides,
});

/** A scheduled (non-OTC) medication, for the tests that check the split. */
const buildDaily = (overrides: Record<string, any> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Tylenol",
  dosage: "100mg",
  directions: "After eating",
  startdate: daysFromNow(-30),
  enddate: "",
  timings: ["08:00:00"],
  overTheCounter: false,
  ...overrides,
});

const buildSenior = (
  medication: any[] = [],
  medPass: Record<string, any> = { services: [] }
) => ({
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
  clinical: { roomNumber: 12, status: "In Home", medication, medPass },
});

const sel = {
  addButton: () => cy.contains("button", "Add Over-the-Counter Medication"),
  modal: () => cy.get(".ReactModal__Content"),
  name: () => cy.get('input[name="medication.name"]'),
  reason: () => cy.get('input[name="medication.directions"]'),
  dosage: () => cy.get('input[name="medication.dosage"]'),
  date: () => cy.get('input[name="medication.startdate"]'),
  save: () => cy.contains("button", /^Save$/),
  closeModal: () => cy.get(".ReactModal__Content div.absolute.top-4.right-6"),
  timingsTrigger: () => sel.modal().find('div[class*="w-[420px]"]').first(),
  timingOptions: () => cy.get("ul li"),
  emarSelect: () => cy.get("select").first(),
};

/**
 * Tick timings in the dropdown.
 *
 * Two traps here, both worth stating:
 *
 * 1. The dropdown's labels are ZERO-PADDED ("02:00 PM"), built by
 *    `timeOptions24H`. The tables render the same instant through
 *    `timeFormat()`, which is NOT padded ("2:00 PM"). So the string used to
 *    pick an option is not the string the table shows afterwards.
 * 2. `cy.contains` matches substrings, and "12:00 PM" contains "2:00 PM" —
 *    asking for the latter silently ticks midday. The exact-match regex makes
 *    that impossible rather than relying on remembering it.
 */
const chooseTimings = (...paddedLabels: string[]) => {
  sel.timingsTrigger().click();
  paddedLabels.forEach((label) =>
    sel.timingOptions().contains(new RegExp(`^${label}$`)).click()
  );
  sel.timingsTrigger().click();
};

const stubSave = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode, body }).as("saveOtc");

const visitTab = (
  senior: Record<string, any> = buildSenior(),
  tab: string = OTC_TAB
) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [senior] } }).as(
    "getSeniors"
  );
  cy.stubUser(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent(tab)}`);
};

const openModal = (senior: Record<string, any> = buildSenior()) => {
  visitTab(senior);
  sel.addButton().click();
  sel.name().should("be.visible");
};

const fillRequired = ({
  name = "Ibuprofen",
  dosage = "200mg",
  date = today(),
} = {}) => {
  sel.name().clear().type(name);
  sel.dosage().clear().type(dosage);
  sel.date().type(date);
};

/** The OTC dose the app just wrote, off the PUT payload. */
const savedOtc = (request: any) =>
  request.body.medication.filter((m: any) => m.overTheCounter).slice(-1)[0];

describe("Clinical — Over-the-Counter medication", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The tab
  // ──────────────────────────────────────────────────────────────────────────

  describe("The tab", () => {
    it("offers the add action", () => {
      visitTab();
      sel.addButton().should("be.visible");
    });

    it("renders every column", () => {
      visitTab(buildSenior([buildOtc()]));
      // Presence, not visibility: the OTC table is wider than the viewport and
      // scrolls horizontally, so the right-hand headers sit outside the clip.
      ["S.No", "Medication", "Date", "Timings", "Reason", "MedPass By"].forEach(
        (header) => cy.contains(header).should("exist")
      );
    });

    it("lists a recorded dose", () => {
      visitTab(buildSenior([buildOtc()]));
      cy.contains("Ibuprofen").should("be.visible");
    });

    it("shows the reason it was given", () => {
      visitTab(buildSenior([buildOtc()]));
      cy.contains("Headache").should("be.visible");
    });

    it("formats the date as MM/DD/YYYY", () => {
      visitTab(buildSenior([buildOtc({ startdate: "2026-08-25" })]));
      cy.contains("08/25/2026").should("be.visible");
    });

    it("shows the timing in twelve-hour form", () => {
      visitTab(buildSenior([buildOtc({ timings: ["14:00:00"] })]));
      cy.contains("2:00 PM").should("be.visible");
    });

    it("lists every timing when several were given", () => {
      visitTab(
        buildSenior([buildOtc({ timings: ["09:00:00", "14:00:00", "21:00:00"] })])
      );
      cy.contains("9:00 AM, 2:00 PM, 9:00 PM").should("exist");
    });

    it("keeps scheduled medications off this tab", () => {
      visitTab(buildSenior([buildOtc(), buildDaily()]));
      cy.contains("Ibuprofen").should("be.visible");
      cy.contains("Tylenol").should("not.exist");
    });

    it("keeps OTC doses off the Medication tab", () => {
      visitTab(buildSenior([buildOtc(), buildDaily()]), "Medication");
      cy.contains("Tylenol - 100mg").should("be.visible");
      cy.contains("Ibuprofen").should("not.exist");
    });

    it("keeps OTC doses off the MedPass round", () => {
      visitTab(buildSenior([buildOtc(), buildDaily()]), "MedPass");
      cy.contains("Tylenol - 100mg").should("be.visible");
      cy.contains("Ibuprofen").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The form
  // ──────────────────────────────────────────────────────────────────────────

  describe("The form", () => {
    beforeEach(() => openModal());

    it("renders every field", () => {
      ["Name * :", "Reason:", "Dosage * :", "Date * :", "Timings * :"].forEach(
        (label) => sel.modal().contains(label).should("be.visible")
      );
    });

    it("offers no end date", () => {
      // Unlike Add Medication — an OTC dose is a single event, not a course.
      sel.modal().contains("End Date").should("not.exist");
    });

    it("offers no additional comments box", () => {
      sel.modal().find("textarea").should("not.exist");
    });

    it("starts empty", () => {
      sel.name().should("have.value", "");
      sel.dosage().should("have.value", "");
      sel.date().should("have.value", "");
    });

    it("closes on the cross", () => {
      sel.closeModal().click();
      sel.name().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Dates — today or earlier only
  // ──────────────────────────────────────────────────────────────────────────

  describe("Dates", () => {
    it("stops any date after today being chosen", () => {
      openModal();
      sel.date().should("have.attr", "max", today());
    });

    it("sets no floor on how far back the dose can be", () => {
      openModal();
      sel.date().should("not.have.attr", "min");
    });

    it("accepts a dose given today", () => {
      openModal();
      stubSave();
      fillRequired({ date: today() });
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).startdate).to.eq(today());
      });
    });

    it("accepts a dose given yesterday", () => {
      openModal();
      stubSave();
      fillRequired({ date: daysFromNow(-1) });
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).startdate).to.eq(daysFromNow(-1));
      });
    });

    it("accepts a dose given a month ago", () => {
      openModal();
      stubSave();
      fillRequired({ date: daysFromNow(-30) });
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).startdate).to.eq(daysFromNow(-30));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Validation", () => {
    beforeEach(() => {
      openModal();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveOtc");
    });

    it("refuses an empty form", () => {
      sel.save().click();
      cy.assertNoRequest("@saveOtc");
    });

    it("refuses a dose with no name", () => {
      sel.dosage().type("200mg");
      sel.date().type(today());
      chooseTimings("02:00 PM");
      sel.save().click();
      cy.assertNoRequest("@saveOtc");
    });

    it("refuses a name containing punctuation the schema forbids", () => {
      fillRequired({ name: "Ibuprofen@200" });
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.contains("Only alphabets, numbers, and special characters").should("be.visible");
      cy.assertNoRequest("@saveOtc");
    });

    it("accepts a name with brackets and hyphens", () => {
      stubSave();
      fillRequired({ name: "Ibuprofen (Nurofen) - 200" });
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).name).to.eq("Ibuprofen (Nurofen) - 200");
      });
    });

    it("refuses a dose with no date", () => {
      sel.name().type("Ibuprofen");
      sel.dosage().type("200mg");
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.contains("Required").should("be.visible");
      cy.assertNoRequest("@saveOtc");
    });

    it("refuses a dose with no timing", () => {
      fillRequired();
      sel.save().click();

      cy.contains("Should select atleast 1 medpass time").should("be.visible");
      cy.assertNoRequest("@saveOtc");
    });

    it("accepts a dose with no reason", () => {
      stubSave();
      sel.name().type("Ibuprofen");
      sel.dosage().type("200mg");
      sel.date().type(today());
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).name).to.eq("Ibuprofen");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Timings
  // ──────────────────────────────────────────────────────────────────────────

  describe("Timings", () => {
    beforeEach(() => {
      openModal();
      stubSave();
    });

    it("offers the same forty-eight slots as a scheduled medication", () => {
      sel.timingsTrigger().click();
      sel.timingOptions().should("have.length", 48);
    });

    it("saves a single timing", () => {
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).timings).to.deep.eq(["14:00:00"]);
      });
    });

    it("saves several timings", () => {
      fillRequired();
      chooseTimings("09:00 AM", "02:00 PM", "09:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).timings).to.deep.eq([
          "09:00:00",
          "14:00:00",
          "21:00:00",
        ]);
      });
    });

    it("marks only the first timing as administered", () => {
      // handleFormSubmit builds one service from `timings[0]`, so a dose given
      // three times records a single MedPass entry.
      fillRequired();
      chooseTimings("09:00 AM", "02:00 PM", "09:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        const services = request.body.medPass.services;
        expect(services, "one service per save, whatever the timing count").to.have.length(
          1
        );
        expect(services[0].timing).to.eq("09:00:00");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Saving
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving", () => {
    it("marks the dose as over-the-counter", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).overTheCounter).to.eq(true);
      });
    });

    it("stores the reason on directions", () => {
      openModal();
      stubSave();
      fillRequired();
      sel.reason().type("Headache after lunch");
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).directions).to.eq("Headache after lunch");
      });
    });

    it("gives the dose its own id", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).id).to.match(/^[0-9a-f-]{36}$/i);
      });
    });

    it("records the dose as already passed", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        const service = request.body.medPass.services.slice(-1)[0];
        expect(service.passOrRefuse).to.eq("Pass");
        expect(service.medicationId).to.eq(savedOtc(request).id);
        expect(service.providedBy).to.eq(TEST_USER_ID);
      });
    });

    it("keeps the senior's scheduled medications", () => {
      openModal(buildSenior([buildDaily()]));
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        const names = request.body.medication.map((m: any) => m.name);
        expect(names).to.include("Tylenol");
        expect(names).to.include("Ibuprofen");
      });
    });

    it("keeps the MedPass history already on the record", () => {
      openModal(
        buildSenior([buildDaily()], {
          services: [
            {
              medicationId: "11111111-1111-4111-8111-111111111111",
              passOrRefuse: "Pass",
              remarks: "",
              providedAt: new Date().toISOString(),
              providedBy: TEST_USER_ID,
              timing: "08:00:00",
            },
          ],
        })
      );
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(request.body.medPass.services, "existing entry plus the new one").to.have.length(
          2
        );
      });
    });

    it("confirms the dose was recorded", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc");
      cy.assertPopover("Medication added!");
    });

    it("closes the modal", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc");
      sel.name().should("not.exist");
    });

    it("reports a rejected save", () => {
      openModal();
      cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode: 500, body: {} }).as(
        "saveOtc"
      );
      fillRequired();
      chooseTimings("02:00 PM");
      sel.save().click();

      cy.wait("@saveOtc");
      cy.assertPopover("Medication not added!");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. EMAR
  //
  // What is assertable from the UI is that an OTC dose counts as administered
  // medication for the month — if it did not, selecting the month would report
  // "No medication was administered" instead of opening the modal.
  //
  // Whether the generated PDF actually prints an OTC row is NOT covered here:
  // the report's contents are only observable by reading the PDF, which is out
  // of scope by agreement. emarDataLayer.ts iterates `clinical.medication`
  // without filtering on `overTheCounter`, so the data reaches the generator —
  // but that is read from the source, not proven by these tests.
  // ──────────────────────────────────────────────────────────────────────────

  describe("EMAR", () => {
    const thisMonth = () => today().slice(0, 7);

    /** An OTC dose plus the Pass service the app writes alongside it. */
    const otcWithService = () => {
      const otc = buildOtc();
      return buildSenior([otc], {
        services: [
          {
            medicationId: otc.id,
            passOrRefuse: "Pass",
            remarks: "",
            providedAt: new Date().toISOString(),
            providedBy: TEST_USER_ID,
            timing: otc.timings[0],
          },
        ],
      });
    };

    it("counts an OTC dose as medication administered this month", () => {
      visitTab(otcWithService(), "MedPass");
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      sel.emarSelect().select(thisMonth());

      cy.contains("EMAR Generated").should("be.visible");
    });

    it("generates the report from an OTC dose alone", () => {
      // The senior has no scheduled medication at all — only the OTC dose — so
      // the report can only have come from it.
      visitTab(otcWithService(), "MedPass");
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      sel.emarSelect().select(thisMonth());

      cy.contains("Your EMAR report has been generated successfully").should(
        "be.visible"
      );
      cy.contains("button", "Download PDF").should("be.visible");
    });

    it("says so when the OTC dose falls outside the chosen month", () => {
      visitTab(otcWithService(), "MedPass");
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      // By index, not value — the dropdown repeats months on the 29th-31st.
      // See the EMAR month entry in known-defects.cy.ts.
      sel
        .emarSelect()
        .find("option")
        .its("length")
        .then((count) => sel.emarSelect().select(count - 1));

      cy.assertPopover("No medication was administered during selected period");
      cy.contains("EMAR Generated").should("not.exist");
    });

    it("lists an OTC dose that was recorded but never passed", () => {
      // The export warns only when no medication was ACTIVE in the month
      // (emarDataLayer.ts:149). An OTC dose dated inside the month is active,
      // so it reaches the sheet with its pass/refuse cell left blank rather
      // than suppressing the whole report.
      visitTab(buildSenior([buildOtc()], { services: [] }), "MedPass");
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      sel.emarSelect().select(thisMonth());

      cy.contains("EMAR Generated").should("be.visible");
    });

    it("says so when the senior has no medication at all", () => {
      // `!data?.clinical?.medication` is the one guard that still fires before
      // anything is built.
      visitTab(
        {
          ...buildSenior([]),
          clinical: { roomNumber: 12, status: "In Home", medPass: { services: [] } },
        },
        "MedPass"
      );
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      sel.emarSelect().select(thisMonth());

      cy.assertPopover("No medication was administered during selected period");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a dose is recorded and appears on the OTC tab", () => {
      openModal();
      stubSave();

      sel.name().type("Ibuprofen");
      sel.reason().type("Headache");
      sel.dosage().type("200mg");
      sel.date().type(today());
      chooseTimings("02:00 PM");

      let saved: any;
      sel.save().click();
      cy.wait("@saveOtc").then(({ request }) => {
        saved = savedOtc(request);
        expect(saved.overTheCounter).to.eq(true);
      });
      cy.assertPopover("Medication added!");
      cy.dismissPopover();

      // Feed the dose the app actually sent back as the senior's record.
      cy.then(() => {
        visitTab(buildSenior([saved]));
        cy.contains("Ibuprofen").should("be.visible");
        cy.contains("Headache").should("be.visible");
        cy.contains("2:00 PM").should("be.visible");
      });
    });

    it("E2E — a validation error is corrected and the dose then saves", () => {
      openModal();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveOtc");

      fillRequired({ name: "Ibuprofen@200" });
      chooseTimings("02:00 PM");
      sel.save().click();
      cy.contains("Only alphabets, numbers, and special characters").should("be.visible");
      cy.assertNoRequest("@saveOtc");

      stubSave();
      sel.name().clear().type("Ibuprofen 200");
      sel.save().click();

      cy.wait("@saveOtc").then(({ request }) => {
        expect(savedOtc(request).name).to.eq("Ibuprofen 200");
      });
    });

    it("E2E — a recorded dose then supports an EMAR for the month", () => {
      openModal();
      stubSave();
      fillRequired();
      chooseTimings("02:00 PM");

      let body: any;
      sel.save().click();
      cy.wait("@saveOtc").then(({ request }) => {
        body = request.body;
      });
      cy.assertPopover("Medication added!");
      cy.dismissPopover();

      cy.then(() => {
        // Re-read the senior with exactly what the app wrote.
        const senior = buildSenior(body.medication, body.medPass);
        visitTab(senior, "MedPass");
        cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
        cy.get("select").first().select(today().slice(0, 7));
        cy.contains("EMAR Generated").should("be.visible");
      });
    });
  });
});
