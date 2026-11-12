/* eslint-disable cypress/no-force, cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Clinical — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE, like its CRM counterpart at
 * cypress/e2e/crm/known-defects.cy.ts. Each asserts the behaviour the UI
 * promises against code that does something else.
 *
 * A test here turning green means the bug is fixed: move it into the spec that
 * owns the area rather than deleting it. Never weaken an assertion to match the
 * code — if the behaviour turns out to be intended, delete the test and record
 * the decision in the owning spec.
 *
 * Run it on its own; exclude it from any "all clinical specs must pass" job:
 *
 *   npx cypress run --spec cypress/e2e/clinical/known-defects.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";

const pad = (n: number) => String(n).padStart(2, "0");
const asLocalDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const buildMedication = (overrides: Record<string, any> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Dolo",
  dosage: "650",
  directions: "Before Eating",
  startdate: "2020-01-01",
  enddate: "",
  timings: ["07:30:00"],
  additionalComments: "",
  overTheCounter: false,
  ...overrides,
});

const buildSenior = (medication: any[]) => ({
  userId: SENIOR_ID,
  name: "Arthur Bean",
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
});

const stubBoard = (senior: Record<string, any>) => {
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
};

describe("Clinical — known defects", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  // ═════════════════════════════════════════════════════════════════════════
  // 1. The Medication tab reads the clock in UTC, everything else reads local
  //
  //   medication.tsx:184  new Date().toISOString().split("T")[0]   ← UTC
  //   medpass.tsx:59      getYYYYMMDDString(new Date())            ← local
  //
  // So the two tabs disagree about which day it is for part of every day, and
  // a course sitting on that boundary is listed by one and not the other.
  //
  // Which way it breaks depends on the sign of the timezone offset, so the
  // fixture below is chosen to expose the divergence either way rather than
  // assuming a particular hemisphere. The clock is frozen at an hour where the
  // two dates are guaranteed to differ, so this does not pass or fail
  // depending on when it happens to run.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Medication tab date handling", () => {
    /** Minutes to add to local time to reach UTC. Positive west of UTC. */
    const offset = new Date().getTimezoneOffset();

    /**
     * A local instant whose UTC calendar date differs from its local one:
     * late evening when UTC is ahead, early morning when UTC is behind.
     */
    const divergentInstant = () => {
      const d = new Date();
      d.setHours(offset > 0 ? 23 : 1, 0, 0, 0);
      return d;
    };

    beforeEach(() => {
      // A machine running in UTC cannot express this bug at all — say so out
      // loud rather than reporting a false pass.
      expect(
        offset,
        "this defect is unobservable at UTC+0 — run the suite in a real timezone"
      ).to.not.eq(0);
    });

    it("[defect] keeps a course that is still current in the user's own timezone", () => {
      const now = divergentInstant();
      const localToday = asLocalDate(now);
      const localYesterday = asLocalDate(new Date(now.getTime() - 86400000));

      // West of UTC, UTC has already rolled over, so a course ending TODAY is
      // dropped early. East of UTC, UTC is still on yesterday, so a course that
      // ended YESTERDAY lingers. Either way the tab disagrees with MedPass.
      const enddate = offset > 0 ? localToday : localYesterday;
      const shouldBeListed = offset > 0;

      cy.clock(now.getTime(), ["Date"]);
      stubBoard(buildSenior([buildMedication({ enddate })]));
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=Medication`);
      cy.contains("button", "Add Medication").should("be.visible");

      if (shouldBeListed) {
        // Still today locally, and MedPass will administer it — so it belongs
        // on the list. The UTC comparison drops it.
        cy.contains("Dolo - 650").should("be.visible");
      } else {
        // Finished yesterday locally, and MedPass has already dropped it — so
        // the list should have too. The UTC comparison keeps it.
        cy.contains("Dolo - 650").should("not.exist");
      }
    });

    it("[defect] lists exactly the courses MedPass will administer", () => {
      // The same divergence, stated as the invariant that actually matters: a
      // nurse looking at the two tabs should not see two different answers.
      const now = divergentInstant();
      const localToday = asLocalDate(now);
      const localYesterday = asLocalDate(new Date(now.getTime() - 86400000));
      const enddate = offset > 0 ? localToday : localYesterday;
      const senior = buildSenior([buildMedication({ enddate })]);

      cy.clock(now.getTime(), ["Date"]);
      stubBoard(senior);

      cy.visit(`/clinical/${SENIOR_ID}?activeTab=MedPass`);
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
      cy.get("body")
        .then(($body) => $body.text().includes("Dolo"))
        .then((inMedPass) => {
          cy.visit(`/clinical/${SENIOR_ID}?activeTab=Medication`);
          cy.contains("button", "Add Medication").should("be.visible");
          cy.get("body").should(($body) => {
            expect(
              $body.text().includes("Dolo - 650"),
              `Medication tab should agree with MedPass (MedPass shows it: ${inMedPass})`
            ).to.eq(inMedPass);
          });
        });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. The EMAR month dropdown skips months and repeats others
  //
  //   clinical-tabs.tsx:198   date.setMonth(date.getMonth() - index)
  //
  // `setMonth` keeps the day-of-month, so stepping back from the 31st lands on
  // a day that does not exist in the shorter month and JavaScript rolls it
  // forward into the next one. On 31 August the twelve options come out as:
  //
  //   2026-08 2026-07 2026-07 2026-05 2026-05 2026-03 2026-03 2026-01
  //   2025-12 2025-12 2025-10 2025-10
  //
  // Five months are listed twice and five — June, April, February, November,
  // September — cannot be selected at all. It bites on the 29th, 30th and 31st
  // of any month, so roughly a tenth of the year, and `carePlanOptions` at
  // line 211 has the identical bug.
  //
  // The fix is to build the month from its first day:
  //   const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - index);
  // ═════════════════════════════════════════════════════════════════════════

  describe("EMAR month dropdown", () => {
    const buildMedPassSenior = () =>
      buildSenior([buildMedication({ enddate: "" })]);

    it("[defect] offers each of the last twelve months exactly once", () => {
      stubBoard(buildMedPassSenior());
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=MedPass`);
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");

      cy.get("select")
        .first()
        .find("option")
        .then(($options) => {
          const values = [...$options]
            .map((o) => (o as HTMLOptionElement).value)
            .filter(Boolean);
          const unique = new Set(values);
          expect(
            unique.size,
            `every month distinct — got ${values.join(" ")}`
          ).to.eq(values.length);
        });
    });

    it("[defect] can reach the month before last", () => {
      // Stated the way a user meets it: on the 31st, last month is listed twice
      // and the month before it is missing entirely.
      stubBoard(buildMedPassSenior());
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=MedPass`);
      cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");

      const twoMonthsBack = () => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 2);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      };

      cy.get("select")
        .first()
        .find("option")
        .then(($options) => {
          const values = [...$options].map((o) => (o as HTMLOptionElement).value);
          expect(values, "the month before last is offered").to.include(
            twoMonthsBack()
          );
        });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. "Dosage *" is not actually required
  //
  //   model/clinical/clinical.model.ts:21   dosage: z.string()
  //
  // `z.string()` accepts "". Only an untouched field is caught, because that
  // arrives as `undefined`. Focus the field, clear it, and the medication saves
  // with no dosage at all — on a medication record, where the dose is the
  // single most important number.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Dosage", () => {
    const sel = () => cy.get(".ReactModal__Content");

    const openAddMedication = () => {
      stubBoard(buildSenior([]));
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=Medication`);
      cy.contains("button", "Add Medication").click();
      cy.get('input[name="medication.name"]').should("be.visible");
    };

    const chooseFirstTiming = () => {
      cy.get(".ReactModal__Content").find('div[class*="w-[420px]"]').first().click();
      cy.get("ul li").contains("07:30 AM").click();
      cy.get(".ReactModal__Content").find('div[class*="w-[420px]"]').first().click();
    };

    it("[defect] refuses a medication whose dosage has been cleared", () => {
      // Stubbed rather than watched, so the save resolves against Cypress
      // instead of the real API.
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveMedication");
      openAddMedication();

      cy.get('input[name="medication.name"]').type("Dolo");
      cy.get('input[name="medication.dosage"]').type("650");
      cy.get('input[name="medication.dosage"]').clear();
      cy.get('input[name="medication.startdate"]').type(asLocalDate(new Date()));
      chooseFirstTiming();
      cy.contains("button", "Save").click();

      // NOT `assertNoRequest` straight after the click: the save is dispatched
      // a moment later, so an immediate absence check passes before the request
      // exists and the test reports the bug as fixed. Give it time to fire,
      // then read the alias. (An earlier version of this test passed for
      // exactly that reason while the dosage was still being submitted empty.)
      cy.wait(2000);
      cy.get("@saveMedication.all").should("have.length", 0);
    });

    it("[defect] says why a cleared dosage was refused", () => {
      // Stubbed so the attempted save does not reach the real API — without
      // this the modal reports "Error in adding the medication undefined!",
      // which is the network failing, not validation.
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 200,
        body: {},
      }).as("saveMedication");
      openAddMedication();

      cy.get('input[name="medication.name"]').type("Dolo");
      cy.get('input[name="medication.dosage"]').type("650");
      cy.get('input[name="medication.dosage"]').clear();
      cy.get('input[name="medication.startdate"]').type(asLocalDate(new Date()));
      chooseFirstTiming();
      cy.contains("button", "Save").click();

      // Desired: the save is refused, the modal stays open, and the dosage
      // error explains why. Today the form submits and the modal closes, so
      // the first assertion is what fails — phrased explicitly, because a bare
      // `.ReactModal__Content` miss reads like broken setup rather than the
      // symptom it actually is.
      cy.get("body").should(($body) => {
        expect(
          $body.find(".ReactModal__Content").length,
          "the modal stays open when the dosage is missing"
        ).to.be.greaterThan(0);
      });

      // Every other required field is filled, so a "Required" anywhere in the
      // modal can only be about the dosage. Matching on the word "Dosage"
      // instead would be satisfied by the field's own label — which is how an
      // earlier version of this test passed while proving nothing.
      sel().contains("Required").should("be.visible");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 4. Care Plan comments are invisible to almost everyone
  //
  //   careplan.tsx (bottom)  {hasAccess(role, "CLINICAL_CAREPLAN", "VIEW") && …}
  //
  // `hasAccess` checks the exact list for the access level asked for — EDIT does
  // NOT imply VIEW (utils/roleAccess.ts:13). Among the clinical roles only the
  // Nurse holds CLINICAL_CAREPLAN as VIEW, so the Nurse is the only person who
  // can see the Care Plan comments at all.
  //
  // The consequences are backwards:
  //   PCG   holds it as EDIT  → does the round, cannot leave a note about it
  //   PCHO  holds it as neither, yet holds CLINICAL_COMMENTS_HISTORY_EDIT —
  //         a permission to edit historical comments they can never reach
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care Plan comments", { tags: [Tags.SENIOR] }, () => {
    const CARE_PLAN_SENIOR = {
      userId: SENIOR_ID,
      name: "Arthur Bean",
      role: "Senior",
      home: "Comfort Cove",
      homeId: TEST_HOME_ID,
      milestone: ["initial contact", "tour", "onboarding", "contract"],
      createdAt: "2026-01-02T10:00:00.000Z",
      isDeleted: false,
      documents: [],
      carePlan: {
        adl: { bathing: { careLevel: "Assistance" } },
        vitalSigns: { bloodPressure: true },
      },
      clinical: {
        roomNumber: 12,
        status: "In Home",
        medication: [],
        carePlan: { services: [], comments: [] },
      },
    };

    const visitCarePlanAs = (role: string) => {
      cy.clearAuthSession();
      cy.setAuthSession(role as any);
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      }).as("getShifts");
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [CARE_PLAN_SENIOR] },
      }).as("getSeniors");
      cy.stubUser(CARE_PLAN_SENIOR);
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent("Care Plan")}`);
      cy.contains("h2", "Care Plan Services", { timeout: 10000 }).should("be.visible");
    };

    it("[defect] lets a Personal Care Giver comment on the round they worked", { tags: [Tags.PCG] }, () => {
      visitCarePlanAs("PCG");
      cy.contains("button", "Add Comment").should("be.visible");
    });

    it("[defect] shows the comments to the Care Admin who may edit them", () => {
      // PCHO is granted CLINICAL_COMMENTS_HISTORY_EDIT precisely so it can amend
      // historical comments — but the section never renders for it.
      visitCarePlanAs("PCHO");
      cy.contains("button", "Add Comment").should("be.visible");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 5. The Care Report month dropdown repeats months
  //
  //   clinical-tabs.tsx:210  carePlanOptions
  //
  // The same rolling-`setMonth` bug as the EMAR dropdown above, in a second
  // place. Both mutate one Date in a loop, so on the 29th–31st the short months
  // overflow and the list repeats values while skipping others. Fixing one and
  // not the other leaves half the bug in place.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care Report month dropdown", () => {
    it("[defect] offers each of the last twelve months exactly once", { tags: [Tags.SENIOR] }, () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      }).as("getShifts");
      const senior = {
        userId: SENIOR_ID,
        name: "Arthur Bean",
        role: "Senior",
        homeId: TEST_HOME_ID,
        milestone: ["contract"],
        createdAt: "2026-01-02T10:00:00.000Z",
        isDeleted: false,
        documents: [],
        carePlan: { adl: { bathing: { careLevel: "Assistance" } } },
        clinical: { roomNumber: 12, medication: [], carePlan: { services: [] } },
      };
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [senior] },
      }).as("getSeniors");
      cy.stubUser(senior);
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent("Care Plan")}`);

      cy.get('select[name="carePlanMonth"]')
        .find("option")
        .then(($options) => {
          const values = [...$options]
            .map((o) => (o as HTMLOptionElement).value)
            .filter(Boolean);
          expect(
            new Set(values).size,
            `every month distinct — got ${values.join(", ")}`
          ).to.eq(values.length);
        });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 6. The Care Team FaceSheet name field destroys the name it is editing
  //
  //   care-team-face-sheet.tsx:696  toTitleCase(String(nameField.value ?? ""))
  //
  // The input's value is re-derived through toTitleCase() on every render, and
  // toTitleCase trims and collapses whitespace. A space therefore never
  // survives long enough to type the next character against, so "Maurice
  // Olsen" is entered as "Mauriceolsen" — one word, lower-cased after the first
  // letter.
  //
  // It is not cosmetic. buildUpdatePayload() runs splitName() over that value,
  // so a member whose surname is corrected from the FaceSheet is saved with a
  // one-word `name` and a `firstName` that swallowed the surname. The fix is to
  // normalise on blur or on save, not on every render.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care Team FaceSheet — the name field", { tags: [Tags.PCG] }, () => {
    const PCG_ID = "pppppppp-0001-4ppp-8ppp-pppppppppppp";

    const visitFaceSheet = () => {
      const member = {
        userId: PCG_ID,
        name: "Morris Olsen",
        firstName: "Morris",
        lastName: "Olsen",
        email: "morris@yopmail.com",
        mobile: "8585854545",
        role: "PCG",
        homeId: TEST_HOME_ID,
        isDeleted: false,
        documents: [],
      };

      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      });
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [member] },
      }).as("getMembers");
      cy.stubUser(member);
      cy.visit(`/clinical/pcg/${PCG_ID}`);
      cy.contains("span", "FaceSheet").click({ force: true });
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    };

    it("[defect] keeps the space in a two-word name", () => {
      visitFaceSheet();
      cy.get('input[placeholder="Name"]').first().clear();
      cy.get('input[placeholder="Name"]').first().type("Maurice Olsen");
      cy.get('input[placeholder="Name"]')
        .first()
        .should("have.value", "Maurice Olsen");
    });

    it("[defect] saves a corrected surname rather than swallowing it", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      visitFaceSheet();

      cy.get('input[placeholder="Name"]').first().clear();
      cy.get('input[placeholder="Name"]').first().type("Maurice Olsen");
      cy.contains("button", /^Save$/).click();

      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.body.firstName).to.eq("Maurice");
        expect(request.body.lastName).to.eq("Olsen");
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 7. Saving the FaceSheet does not clear its "Unsaved changes" bar
  //
  //   inline-form.tsx:128  markCurrentAsClean()  — assigns initialRef.current
  //   inline-form.tsx:132  isDirty = useMemo(..., [values])
  //
  // On a successful save the FaceSheet calls markCurrentAsClean(), which moves
  // a ref. `isDirty` is memoised on `values` alone and never watches that ref,
  // so the assignment cannot re-render the bar away: marking the form clean is
  // a no-op for the UI.
  //
  // It is masked in normal use, because the save also invalidates the user
  // query and the refetched record differs, which resets the form for an
  // unrelated reason. Whenever the server echoes back an unchanged record —
  // React Query's structural sharing then hands back the very same object —
  // the member is left staring at "Unsaved changes" after a save that worked,
  // and pressing Save again re-sends the whole record.
  //
  // The fix is to track the baseline in state, or to include it in the memo's
  // dependencies, so `isDirty` recomputes when the form is marked clean.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care Team FaceSheet — the Save bar", () => {
    const PCG_ID = "pppppppp-0001-4ppp-8ppp-pppppppppppp";

    it("[defect] clears the Save bar on a successful save", { tags: [Tags.PCG] }, () => {
      const member = {
        userId: PCG_ID,
        name: "Morris Olsen",
        firstName: "Morris",
        lastName: "Olsen",
        email: "morris@yopmail.com",
        mobile: "8585854545",
        role: "PCG",
        homeId: TEST_HOME_ID,
        isDeleted: false,
        documents: [],
        facesheet: { backgroundCheck: "Yes", tbTest: "No", documents: {} },
      };

      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      });
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [member] },
      }).as("getMembers");
      // The refetch echoes the record back unchanged, which is what exposes the
      // memo: nothing else can clear the bar.
      cy.stubUser(member);
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});

      cy.visit(`/clinical/pcg/${PCG_ID}`);
      cy.contains("span", "FaceSheet").click({ force: true });
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");

      cy.get("select").eq(1).select("Yes");
      cy.contains("Unsaved changes").should("exist");

      cy.contains("button", /^Save$/).click();
      cy.wait("@saveFaceSheet");
      cy.assertPopover("FaceSheet updated successfully");
      cy.dismissPopover();

      cy.contains("Unsaved changes").should("not.exist");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 8. A deleted senior stays assigned to their nurse, namelessly
  //
  //   assign-users-modal.tsx:155  allActiveUsers — filters `isDeleted !== true`
  //   assign-users-modal.tsx:194  currentlyAssigned — falls back to `{ name: "" }`
  //
  // The two halves of the Assign Seniors modal disagree about deleted seniors.
  // `All Seniors` drops them, so there is no record left to resolve a name
  // from; `Currently Assigned` maps over the raw id list and, finding nothing,
  // falls back to `{ userId: id, name: "" }` — a chip with an avatar, a × and
  // no name, counted in the "N seniors" badge.
  //
  // Two consequences, both real:
  //
  //   1. The nurse's caseload is overstated. A home that has discharged three
  //      residents shows those three against every nurse who cared for them,
  //      with no way to tell who they were.
  //   2. Save re-sends the id. `selectedUserIds` still holds it, so every save
  //      of an unrelated change writes the discharged senior back onto the
  //      record — the assignment can never age out on its own.
  //
  // The fix belongs in `coerceInitialSelectedIds` or in `currentlyAssigned`:
  // drop ids that resolve to no active user, rather than rendering a blank.
  // Filtering only the chip would fix the display and leave consequence 2.
  // ═════════════════════════════════════════════════════════════════════════

  describe("Assign Seniors — a discharged senior", { tags: [Tags.NURSE, Tags.SENIOR] }, () => {
    const NURSE_ID = "nnnnnnnn-0001-4nnn-8nnn-nnnnnnnnnnnn";
    const ACTIVE_SENIOR = "5e510125-0001-4aaa-8aaa-aaaaaaaaaaaa";
    const DISCHARGED = "5e510125-0006-4aaa-8aaa-aaaaaaaaaaaa";

    const SENIORS = [
      {
        userId: ACTIVE_SENIOR,
        name: "Jake Harper",
        role: "Senior",
        homeId: TEST_HOME_ID,
        isDeleted: false,
      },
      {
        userId: DISCHARGED,
        name: "Removed Resident",
        role: "Senior",
        homeId: TEST_HOME_ID,
        isDeleted: true,
      },
    ];

    /** A nurse still carrying one active senior and one who has been deleted. */
    const buildNurse = () => ({
      userId: NURSE_ID,
      name: "Judith Harper",
      firstName: "Judith",
      lastName: "Harper",
      email: "judithh@yopmail.com",
      mobile: "4564548979",
      role: "Nurse",
      homeId: TEST_HOME_ID,
      isDeleted: false,
      documents: [],
      associatedUserIds: [ACTIVE_SENIOR, DISCHARGED],
    });

    const openAssignSeniors = () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      });
      cy.intercept("GET", "**/v1/users*", (req) => {
        const userType = req.query.userType as string | undefined;
        req.reply({
          statusCode: 200,
          body: {
            users:
              userType === "Nurse"
                ? [buildNurse()]
                : userType === "Senior"
                  ? SENIORS
                  : [],
          },
        });
      }).as("getUsers");

      cy.visit("/clinical/nurse");
      cy.wait("@getUsers");
      cy.openRowMenu("Judith Harper");
      cy.contains("div", /^Assign Seniors$/).click();
      cy.contains("All Seniors").should("be.visible");
    };

    it("[defect] counts only the seniors the nurse still cares for", () => {
      openAssignSeniors();
      cy.contains("div", /^Currently Assigned$/)
        .parent()
        .contains(/^\d+ seniors$/)
        .should("have.text", "1 seniors");
    });

    it("[defect] shows no nameless chip for a discharged senior", () => {
      openAssignSeniors();

      // Every chip carries a name. The discharged one renders an avatar, a ×
      // and an empty name div, so counting named chips is what tells them apart.
      cy.contains("div", /^Currently Assigned$/)
        .parent()
        .next()
        .find("button")
        .should("have.length", 1);
    });

    it("[defect] does not write a discharged senior back on save", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      cy.contains("button", "Save Changes").click();
      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.deep.eq([ACTIVE_SENIOR]);
      });
    });
  });
});
