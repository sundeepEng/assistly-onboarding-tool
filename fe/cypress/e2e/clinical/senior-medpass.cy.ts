/// <reference types="cypress" />

/**
 * Clinical — MedPass
 *
 *   components/clinical/clinicalTabs/medpass.tsx   the round, Pass/Refuse, comments
 *   commonComponents/toggle-button.tsx             the Pass|Refuse control
 *   utils/emarDataLayer.ts                         the EMAR month export
 *
 * Everything here runs as a PCHO. That matters: the date picker is behind
 * CLINICAL_MEDPASS_DATE_SELECTOR and the EMAR select behind CLINICAL_TABS
 * (EDIT), both of which only PCHO and HomeAdmin hold.
 *
 * WHAT LANDS ON THE ROUND
 *   `startdate <= chosen date && !overTheCounter && (no enddate || enddate >=
 *   chosen date)`, then one row per medication PER TIMING, sorted by time.
 *
 * PASS / REFUSE
 *   A row is actionable only once its scheduled moment has passed —
 *   `isFutureMedpassTime()` compares `${date}T${timing}` against now, both
 *   local. Acting early raises "Medication can't be given before scheduled
 *   time!" and sends nothing.
 *
 *   Pass   writes a service entry with passOrRefuse "Pass" and empty remarks.
 *   Refuse opens a comment popover first; its button reads "Save without
 *          Comments" until something is typed, then "Save".
 *   Clicking the active side again unselects it and removes the entry.
 *
 * TIME IS FROZEN AT NOON in every test that involves acting on a row, so
 * "before" and "after" are unambiguous whatever time the suite runs at. Without
 * that, a run at 00:05 or 23:55 would flip which rows are actionable.
 *
 * PDF generation is deliberately untested — the EMAR tests stop at the modal.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
const MEDICATION_ID = "11111111-1111-4111-8111-111111111111";

// ── Dates and times ──────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86400000;
const today = () => asDate(new Date());
const daysFromNow = (n: number) => asDate(new Date(Date.now() + n * DAY));

/** Noon today, local — the instant every action test runs at. */
const noon = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};

/**
 * Timings chosen so no label is a substring of another: "8:00 AM" would match
 * inside "18:00", and "1:00 AM" inside "11:00 AM", which would make row lookups
 * pick the wrong row.
 */
const MORNING = { value: "08:00:00", label: "8:00 AM" }; // before noon → actionable
const EVENING = { value: "20:00:00", label: "8:00 PM" }; // after noon  → too early

/** `new Date(`${date}T${timing}`).toISOString()` — the app's own conversion. */
const providedAtFor = (date: string, timing: string) =>
  new Date(`${date}T${timing}`).toISOString();

const buildMedication = (overrides: Record<string, any> = {}) => ({
  id: MEDICATION_ID,
  name: "Tylenol",
  dosage: "100mg",
  directions: "After eating",
  startdate: daysFromNow(-30),
  enddate: "",
  timings: [MORNING.value, EVENING.value],
  additionalComments: "",
  overTheCounter: false,
  ...overrides,
});

const buildService = (overrides: Record<string, any> = {}) => ({
  medicationId: MEDICATION_ID,
  passOrRefuse: "Pass",
  remarks: "",
  providedAt: providedAtFor(today(), MORNING.value),
  providedBy: TEST_USER_ID,
  timing: MORNING.value,
  ...overrides,
});

const buildSenior = (
  medication: any[] = [buildMedication()],
  medPass?: Record<string, any>
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
  clinical: {
    roomNumber: 12,
    status: "In Home",
    medication,
    ...(medPass ? { medPass } : {}),
  },
});

const sel = {
  row: (timeLabel: string) => cy.contains('div[class*="border-b"]', timeLabel),
  /** The clickable half is the parent of the div holding the word. */
  pass: (timeLabel: string) => sel.row(timeLabel).contains("div", /^Pass$/),
  refuse: (timeLabel: string) => sel.row(timeLabel).contains("div", /^Refuse$/),
  commentBox: () => cy.get('textarea[name="refuse comment"]'),
  saveComment: () => cy.contains("button", /^(Save without Comments|Save)$/),
  datePicker: () => cy.get('input[type="date"]').first(),
  emarSelect: () => cy.get("select").first(),
  emarModal: () => cy.contains("EMAR Generated"),
};

const GREEN = "bg-[#19D139]";
const REFUSED = "bg-[#00000038]";
const IDLE = "bg-[#D9D9D9]";

/**
 * Choose the oldest month the EMAR dropdown offers, by index.
 *
 * Index rather than value because the dropdown can list the same month twice —
 * `setMonth` overflows on the 29th-31st — and `cy.select(value)` refuses an
 * ambiguous match. Pinned in known-defects.cy.ts.
 */
const selectOldestEmarMonth = () =>
  sel
    .emarSelect()
    .find("option")
    .its("length")
    .then((count) => sel.emarSelect().select(count - 1));

const stubSave = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode, body }).as("saveMedpass");

const watchSave = () => cy.intercept("PUT", "**/v1/clinical/user/**").as("saveMedpass");

/**
 * Open the MedPass tab with the clock frozen at noon.
 *
 * `cy.clock(..., ["Date"])` fakes only Date, so React's own timers keep running.
 */
const visitMedPass = (senior: Record<string, any> = buildSenior(), freeze = true) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  if (freeze) cy.clock(noon().getTime(), ["Date"]);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [senior] } }).as(
    "getSeniors"
  );
  cy.stubUser(senior);
  cy.visit(`/clinical/${SENIOR_ID}?activeTab=MedPass`);
  cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
};

/** The medPass service the app just wrote, off the PUT payload. */
const savedService = (request: any) =>
  request.body.medPass.services[request.body.medPass.services.length - 1];

describe("Clinical — MedPass", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The round
  // ──────────────────────────────────────────────────────────────────────────

  describe("The round", () => {
    beforeEach(() => visitMedPass());

    it("renders every column", () => {
      ["Medication", "Date", "Timings", "Actions", "Comments", "MedPass By"].forEach(
        (header) => cy.contains(header).should("be.visible")
      );
    });

    it("names the medication with its dose", () => {
      cy.contains("Tylenol - 100mg").should("be.visible");
    });

    it("shows the directions under the name", () => {
      cy.contains("After eating").should("be.visible");
    });

    it("shows the round's date on every row", () => {
      const formatted = today().split("-");
      cy.contains(`${formatted[1]}/${formatted[2]}/${formatted[0]}`).should("be.visible");
    });

    it("gives each timing its own row", () => {
      cy.contains(MORNING.label).should("be.visible");
      cy.contains(EVENING.label).should("be.visible");
    });

    it("offers Pass and Refuse on every row", () => {
      sel.pass(MORNING.label).should("be.visible");
      sel.refuse(MORNING.label).should("be.visible");
    });

    it("starts an unactioned row with neither side chosen", () => {
      sel.pass(MORNING.label).parent().should("have.class", IDLE);
      sel.refuse(MORNING.label).parent().should("have.class", IDLE);
    });

    it("dashes the comment of an unactioned row", () => {
      sel.row(MORNING.label).should("contain.text", "-");
    });

    it("sorts the rows by time of day", () => {
      cy.contains(MORNING.label)
        .closest('div[class*="border-b"]')
        .then(($morning) => {
          cy.contains(EVENING.label)
            .closest('div[class*="border-b"]')
            .then(($evening) => {
              expect(
                $morning[0].getBoundingClientRect().top,
                "the morning dose sits above the evening one"
              ).to.be.lessThan($evening[0].getBoundingClientRect().top);
            });
        });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Pass
  // ──────────────────────────────────────────────────────────────────────────

  describe("Pass", () => {
    beforeEach(() => {
      visitMedPass();
      stubSave();
    });

    it("records the dose as passed", () => {
      sel.pass(MORNING.label).click();

      cy.wait("@saveMedpass").then(({ request }) => {
        const service = savedService(request);
        expect(service.passOrRefuse).to.eq("Pass");
        expect(service.medicationId).to.eq(MEDICATION_ID);
        expect(service.timing).to.eq(MORNING.value);
      });
    });

    it("turns the Pass side green", () => {
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass");
      sel.pass(MORNING.label).parent().should("have.class", GREEN);
    });

    it("leaves no remark on a passed dose", () => {
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).remarks).to.eq("");
      });
    });

    it("stamps who gave it", () => {
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).providedBy).to.eq(TEST_USER_ID);
      });
    });

    it("stamps the round's date and the dose's own time", () => {
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).providedAt).to.eq(
          providedAtFor(today(), MORNING.value)
        );
      });
    });

    it("keeps the senior's other clinical data", () => {
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(12);
        expect(request.body.medication).to.have.length(1);
      });
    });

    it("reports a rejected update", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode: 500, body: {} }).as(
        "saveMedpass"
      );
      sel.pass(MORNING.label).click();

      cy.wait("@saveMedpass");
      cy.assertPopover("Not able to update action!");
    });

    it("shows a dose passed earlier as already green", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      sel.pass(MORNING.label).parent().should("have.class", GREEN);
    });

    it("clears the dose when Pass is clicked a second time", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      stubSave();
      sel.pass(MORNING.label).click();

      cy.wait("@saveMedpass").then(({ request }) => {
        expect(request.body.medPass.services, "the entry is removed").to.have.length(0);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Refuse
  // ──────────────────────────────────────────────────────────────────────────

  describe("Refuse", () => {
    beforeEach(() => {
      visitMedPass();
      stubSave();
    });

    it("opens the comment box", () => {
      sel.refuse(MORNING.label).click();
      cy.contains("Comment here...").should("be.visible");
      sel.commentBox().should("be.visible");
    });

    it("offers to save without a comment", () => {
      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").should("be.visible");
    });

    it("sends nothing until the comment box is saved", () => {
      watchSave();
      sel.refuse(MORNING.label).click();
      sel.commentBox().should("be.visible");
      cy.assertNoRequest("@saveMedpass");
    });

    it("records the refusal with no remark", () => {
      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").click();

      cy.wait("@saveMedpass").then(({ request }) => {
        const service = savedService(request);
        expect(service.passOrRefuse).to.eq("Refuse");
        expect(service.remarks).to.eq("");
        expect(service.timing).to.eq(MORNING.value);
      });
    });

    it("renames the button once something is typed", () => {
      sel.refuse(MORNING.label).click();
      sel.commentBox().type("Senior asleep");
      cy.contains("button", /^Save$/).should("be.visible");
      cy.contains("button", "Save without Comments").should("not.exist");
    });

    it("records the refusal with the remark", () => {
      sel.refuse(MORNING.label).click();
      sel.commentBox().type("Senior refused, felt nauseous");
      cy.contains("button", /^Save$/).click();

      cy.wait("@saveMedpass").then(({ request }) => {
        const service = savedService(request);
        expect(service.passOrRefuse).to.eq("Refuse");
        expect(service.remarks).to.eq("Senior refused, felt nauseous");
      });
    });

    it("stamps who recorded the refusal", () => {
      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").click();

      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).providedBy).to.eq(TEST_USER_ID);
      });
    });

    it("closes the comment box once saved", () => {
      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").click();
      cy.wait("@saveMedpass");
      sel.commentBox().should("not.exist");
    });

    it("greys the Refuse side once chosen", () => {
      visitMedPass(
        buildSenior([buildMedication()], {
          services: [buildService({ passOrRefuse: "Refuse" })],
        })
      );
      sel.refuse(MORNING.label).parent().should("have.class", REFUSED);
    });

    it("reports a rejected refusal", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { message: "clinical service unavailable" },
      }).as("saveMedpass");
      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").click();

      cy.wait("@saveMedpass");
      cy.assertPopover("clinical service unavailable");
    });

    it("replaces a Pass with a Refuse rather than adding a second entry", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      stubSave();

      sel.refuse(MORNING.label).click();
      cy.contains("button", "Save without Comments").click();

      cy.wait("@saveMedpass").then(({ request }) => {
        expect(request.body.medPass.services).to.have.length(1);
        expect(request.body.medPass.services[0].passOrRefuse).to.eq("Refuse");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Acting before the scheduled time
  // ──────────────────────────────────────────────────────────────────────────

  describe("Before the scheduled time", () => {
    beforeEach(() => {
      visitMedPass();
      watchSave();
    });

    it("refuses to pass a dose that is not due yet", () => {
      sel.pass(EVENING.label).click();
      cy.assertPopover("Medication can't be given before scheduled time!");
      cy.assertNoRequest("@saveMedpass");
    });

    it("refuses to record a refusal before the dose is due", () => {
      sel.refuse(EVENING.label).click();
      cy.assertPopover("Medication can't be given before scheduled time!");
      cy.assertNoRequest("@saveMedpass");
    });

    it("does not open the comment box for a dose that is not due", () => {
      sel.refuse(EVENING.label).click();
      sel.commentBox().should("not.exist");
    });

    it("leaves the toggle untouched", () => {
      sel.pass(EVENING.label).click();
      cy.dismissPopover();
      sel.pass(EVENING.label).parent().should("have.class", IDLE);
    });

    it("still allows the earlier dose on the same round", () => {
      stubSave();
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).timing).to.eq(MORNING.value);
      });
    });

    it("allows every dose once the round is in the past", () => {
      // On yesterday's round both timings are behind us.
      visitMedPass();
      stubSave();
      sel.datePicker().type(daysFromNow(-1));
      sel.pass(EVENING.label).click();

      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).timing).to.eq(EVENING.value);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. The Comments column
  // ──────────────────────────────────────────────────────────────────────────

  describe("Comments column", () => {
    it("dashes a dose with no remark", () => {
      visitMedPass();
      sel.row(MORNING.label).should("contain.text", "-");
    });

    it("shows the remark left when the dose was refused", () => {
      visitMedPass(
        buildSenior([buildMedication()], {
          services: [
            buildService({ passOrRefuse: "Refuse", remarks: "Senior asleep" }),
          ],
        })
      );
      cy.contains("Senior asleep").should("be.visible");
    });

    it("keeps a remark to its own row", () => {
      visitMedPass(
        buildSenior([buildMedication()], {
          services: [
            buildService({ passOrRefuse: "Refuse", remarks: "Senior asleep" }),
          ],
        })
      );
      sel.row(MORNING.label).should("contain.text", "Senior asleep");
      sel.row(EVENING.label).should("not.contain.text", "Senior asleep");
    });

    it("leaves out a remark recorded on another day", () => {
      visitMedPass(
        buildSenior([buildMedication()], {
          services: [
            buildService({
              passOrRefuse: "Refuse",
              remarks: "Yesterday's note",
              providedAt: providedAtFor(daysFromNow(-1), MORNING.value),
            }),
          ],
        })
      );
      cy.contains("Yesterday's note").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. The date picker
  // ──────────────────────────────────────────────────────────────────────────

  describe("Date picker", () => {
    beforeEach(() => visitMedPass());

    it("defaults to today", () => {
      sel.datePicker().should("have.value", today());
    });

    it("stops any date after today being chosen", () => {
      sel.datePicker().should("have.attr", "max", today());
    });

    it("moves the round to an earlier day", () => {
      const yesterday = daysFromNow(-1);
      sel.datePicker().type(yesterday);
      sel.datePicker().should("have.value", yesterday);

      const parts = yesterday.split("-");
      cy.contains(`${parts[1]}/${parts[2]}/${parts[0]}`).should("be.visible");
    });

    it("keeps listing a course that was running on that day", () => {
      sel.datePicker().type(daysFromNow(-1));
      cy.contains("Tylenol - 100mg").should("be.visible");
    });

    it("drops a course that had not started on that day", () => {
      visitMedPass(buildSenior([buildMedication({ startdate: today() })]));
      sel.datePicker().type(daysFromNow(-5));
      cy.contains("Tylenol - 100mg").should("not.exist");
    });

    it("drops a course that had already finished on that day", () => {
      visitMedPass(
        buildSenior([
          buildMedication({ startdate: daysFromNow(-30), enddate: daysFromNow(-10) }),
        ])
      );
      sel.datePicker().type(daysFromNow(-1));
      cy.contains("Tylenol - 100mg").should("not.exist");
    });

    it("shows the actions recorded on the day being viewed", () => {
      visitMedPass(
        buildSenior([buildMedication()], {
          services: [
            buildService({
              providedAt: providedAtFor(daysFromNow(-1), MORNING.value),
            }),
          ],
        })
      );
      sel.pass(MORNING.label).parent().should("have.class", IDLE);

      sel.datePicker().type(daysFromNow(-1));
      sel.pass(MORNING.label).parent().should("have.class", GREEN);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Generate EMAR
  //
  // Stops at the modal — PDF generation is out of scope.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Generate EMAR", () => {
    const thisMonth = () => today().slice(0, 7);

    it("offers the current month and the eleven before it", () => {
      visitMedPass();
      sel.emarSelect().find("option").should("have.length", 13);
    });

    it("starts on the placeholder", () => {
      visitMedPass();
      sel.emarSelect().should("have.value", "");
    });

    it("opens the EMAR modal for a month with administered doses", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      sel.emarSelect().select(thisMonth());

      sel.emarModal().should("be.visible");
      cy.contains("Your EMAR report has been generated successfully").should(
        "be.visible"
      );
    });

    it("offers both actions on the modal", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      sel.emarSelect().select(thisMonth());

      cy.contains("button", "Download PDF").should("be.visible");
      cy.contains("button", "E-Sign PDF").should("be.visible");
    });

    it("generates a blank sheet for a prescribed course with no doses recorded", () => {
      // The guard asks whether any medication was ACTIVE in the month, not
      // whether any dose was given (emarDataLayer.ts:149,
      // `Object.keys(result.emar).length === 0`). A course that was prescribed
      // but never administered therefore yields a blank MAR sheet rather than
      // a warning — which is a real clinical artifact, not an empty report.
      //
      // This changed with the OTC rewrite: the old guard was `medPassMap.size
      // < 1`, i.e. "was anything given", and it warned here.
      visitMedPass(buildSenior([buildMedication()], { services: [] }));
      sel.emarSelect().select(thisMonth());

      cy.contains("EMAR Generated").should("be.visible");
    });

    it("says so when the senior has no medication at all", () => {
      visitMedPass(buildSenior([]));
      sel.emarSelect().select(thisMonth());

      cy.assertPopover("No medication was administered during selected period");
    });

    it("says so for a month with no doses even though other months have some", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      // The oldest option, where nothing was recorded. Picked BY INDEX, not by
      // value: on the 29th-31st the dropdown repeats months (see the EMAR
      // month entry in known-defects.cy.ts) and selecting by value then throws
      // "matched more than one option".
      selectOldestEmarMonth();

      cy.assertPopover("No medication was administered during selected period");
      cy.contains("EMAR Generated").should("not.exist");
    });

    it("does nothing while the placeholder is selected", () => {
      visitMedPass(buildSenior([buildMedication()], { services: [buildService()] }));
      sel.emarSelect().select("");
      cy.contains("EMAR Generated").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — the morning dose is passed and the evening one is refused too early", () => {
      visitMedPass();
      stubSave();

      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).passOrRefuse).to.eq("Pass");
      });
      sel.pass(MORNING.label).parent().should("have.class", GREEN);

      sel.refuse(EVENING.label).click();
      cy.assertPopover("Medication can't be given before scheduled time!");
      sel.commentBox().should("not.exist");
    });

    it("E2E — a refusal is recorded with a reason and shows in the Comments column", () => {
      visitMedPass();
      stubSave();

      sel.refuse(MORNING.label).click();
      sel.commentBox().type("Senior refused, felt nauseous");

      let saved: any;
      cy.contains("button", /^Save$/).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        saved = savedService(request);
        expect(saved.remarks).to.eq("Senior refused, felt nauseous");
      });

      // Feed the service the app actually wrote back as the senior's record.
      cy.then(() => {
        visitMedPass(buildSenior([buildMedication()], { services: [saved] }));
        sel.row(MORNING.label).should("contain.text", "Senior refused, felt nauseous");
        sel.refuse(MORNING.label).parent().should("have.class", REFUSED);
      });
    });

    it("E2E — yesterday's round is reviewed and every dose is actionable", () => {
      visitMedPass();
      stubSave();

      sel.datePicker().type(daysFromNow(-1));
      sel.pass(MORNING.label).click();
      cy.wait("@saveMedpass").then(({ request }) => {
        expect(savedService(request).providedAt).to.eq(
          providedAtFor(daysFromNow(-1), MORNING.value)
        );
      });
    });
  });
});
