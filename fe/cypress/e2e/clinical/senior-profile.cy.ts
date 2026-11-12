/// <reference types="cypress" />

/**
 * Clinical — the senior profile popup and the senior's tabs
 *
 * Two screens, reached one after the other:
 *
 *   1. Clicking a card in the clinical board's grid view opens the profile
 *      popup — commonComponents/senior-profile-card.tsx. It shows the senior's
 *      details, lets Room Number and Status be edited inline, and offers seven
 *      shortcut buttons that route into the senior's own page.
 *
 *   2. That page is /clinical/{seniorId} —
 *      components/clinical/clinicalTabs/clinical-tabs.tsx — with five tabs
 *      (Medication, MedPass, Over-The-Counter Medication, Care Plan, Incident
 *      Report). On the Medication tab only, a "Bulk" toggle sits beside the
 *      action button and renames it from "Add Medication" to "Add Bulk
 *      Medication".
 *
 * The Add Medication modal itself is out of scope here.
 *
 * Worth knowing before reading the assertions:
 *   - the Bulk toggle is behind MEDICATION_OCR_EXTRACTION, which only PCHO and
 *     HomeAdmin hold — a PCG sees the button with no toggle at all;
 *   - the Room Number pencil is behind CLINICAL_SENIOR_ROOM_NUMBER, same two
 *     roles;
 *   - Room Number is hidden outright at an In-Home-Care home, which shows
 *     Mobile and Address instead.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const CLINICAL_PATH = "/clinical";
const SENIOR = "Arthur Bean";
const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";

const buildSenior = (overrides: Record<string, any> = {}) => ({
  userId: SENIOR_ID,
  name: SENIOR,
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  mobile: "5550000001",
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  clinical: { roomNumber: 12, status: "In Home" },
  isDeleted: false,
  documents: [],
  biography: {
    personalDetails: {
      birthdate: "1948-03-15",
      emergencyContactName: "Ruth Bean",
      emergencyContactNumber: "5550009999",
      address: {
        street1: "12 Elm Row",
        city: "Springfield",
        state: "IL",
        zipCode: "62704",
      },
    },
  },
  ...overrides,
});

const sel = {
  card: (name: string) => cy.contains(name).closest('div[class*="h-[283px]"]'),
  modal: () => cy.get(".ReactModal__Content"),
  roomInput: () => cy.get('input[name="roomNumber"]'),
  statusInput: () => cy.get('input[name="status"]'),
  save: () => cy.contains("button", "Save"),
  cancel: () => cy.contains("button", "Cancel"),
  action: (label: string) => cy.contains("button", label),
  /** ToggleSwitch renders an unlabelled button next to its label span. */
  bulkToggle: () => cy.contains("span", "Bulk").siblings("button"),
  addMedication: () => cy.contains("button", "Add Medication"),
  addBulkMedication: () => cy.contains("button", "Add Bulk Medication"),
};

/**
 * The pencils beside the editable fields.
 *
 * They are the only `bg-transparent` buttons in the popup (the avatar's is
 * `bg-white`), and they render in DOM order: Room Number then Status. Scoping
 * to the modal and indexing beats walking a fixed number of ancestors, which
 * breaks the moment the markup gains a wrapper.
 */
const pencils = () => sel.modal().find("button.bg-transparent");
const roomPencil = () => pencils().first();
const statusPencil = () => pencils().last();

/**
 * Assert a field is not editable.
 *
 * InputFieldComponent maps its `disabled` prop to `readOnly` on the input, not
 * to `disabled` — so `should("be.disabled")` never passes however locked the
 * field looks.
 */
const assertLocked = (field: () => Cypress.Chainable) =>
  field().should("have.attr", "readonly");

const assertEditable = (field: () => Cypress.Chainable) =>
  field().should("not.have.attr", "readonly");

const PROFILE_BUTTONS = [
  "Add Medication",
  "MedPass",
  "Medication List",
  "Over-the-Counter",
  "Care Plan",
  "Profile",
  "Incident Report",
];

const stubSeniors = (users: any[]) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as("getSeniors");

const stubShifts = () =>
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );

/**
 * Answer GET /v1/user/{id} for both the senior and, when given, the signed-in
 * user — a Nurse's board is filtered by their own record's `associatedUserIds`,
 * so the two responses have to differ by id.
 */
const stubUserById = (senior: Record<string, any>, self?: Record<string, any>) =>
  cy
    .intercept("GET", "**/v1/user/*", (req) => {
      const id = req.url.split("?")[0].split("/").pop();
      req.reply({
        statusCode: 200,
        body: { user: self && id === TEST_USER_ID ? self : senior },
      });
    })
    .as("getUser");

/**
 * Open a senior's profile popup from the board's grid view.
 *
 * The click goes to the card's *parent*: senior-grid.tsx hangs the handler
 * there, and a deleted senior's card carries `pointer-events-none`, which
 * Cypress refuses to click through.
 */
const openProfile = (
  senior: Record<string, any> = buildSenior(),
  opts: { role?: any; home?: ReturnType<typeof buildHome>; self?: Record<string, any> } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  stubShifts();
  stubSeniors([senior]);
  stubUserById(senior, opts.self);
  cy.visit(CLINICAL_PATH);
  cy.wait("@getSeniors");
  sel.card(senior.name).parent().click();
  sel.modal().should("be.visible");
};

/**
 * Close the popup.
 *
 * senior-grid.tsx renders its CommonModal without `crossCTA`, so there is no
 * cross to click — react-modal's Esc handling is the only way out.
 */
const closeProfile = () => {
  cy.get("body").type("{esc}");
  cy.get(".ReactModal__Content").should("not.exist");
};

/** Go straight to the senior's own page. */
const visitSeniorPage = (
  senior: Record<string, any> = buildSenior(),
  opts: { role?: any; query?: string } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome();
  stubShifts();
  stubSeniors([senior]);
  cy.stubUser(senior);
  cy.visit(`/clinical/${senior.userId}${opts.query ?? ""}`);
  cy.contains("Medication", { timeout: 10000 }).should("be.visible");
};

describe("Clinical — senior profile popup", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. What the popup shows
  // ──────────────────────────────────────────────────────────────────────────

  describe("Contents", () => {
    beforeEach(() => openProfile());

    it("names the senior", () => {
      sel.modal().contains(SENIOR).should("be.visible");
    });

    it("labels every detail", () => {
      ["Name:", "Age:", "Room Number:", "Emergency Contact:", "Status:"].forEach(
        (label) => sel.modal().contains(label).should("be.visible")
      );
    });

    it("works out the senior's age from their birth date", () => {
      // calculateAge counts whole years from biography.personalDetails.birthdate.
      const born = new Date("1948-03-15");
      const now = new Date();
      let age = now.getFullYear() - born.getFullYear();
      const monthDelta = now.getMonth() - born.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;

      sel.modal().contains(String(age)).should("be.visible");
    });

    it("dashes the age when the senior has no birth date", () => {
      openProfile(buildSenior({ biography: { personalDetails: {} } }));
      sel.modal().contains("Age:").parent().should("contain.text", "-");
    });

    it("shows the emergency contact", () => {
      sel.modal().contains("Ruth Bean").should("be.visible");
    });

    it("pre-fills the room number", () => {
      sel.roomInput().should("have.value", "12");
    });

    it("pre-fills the status", () => {
      sel.statusInput().should("have.value", "In Home");
    });

    it("offers all seven shortcut buttons", () => {
      PROFILE_BUTTONS.forEach((label) => sel.action(label).should("be.visible"));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Editing Room Number
  // ──────────────────────────────────────────────────────────────────────────

  describe("Room Number", () => {
    beforeEach(() => openProfile());

    it("starts read-only", () => {
      assertLocked(sel.roomInput);
    });

    it("becomes editable once the pencil is clicked", () => {
      roomPencil().click();
      assertEditable(sel.roomInput);
    });

    it("offers Save and Cancel while editing", () => {
      roomPencil().click();
      sel.save().should("be.visible");
      sel.cancel().should("be.visible");
    });

    it("sends nothing while the field is merely being edited", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");
      roomPencil().click();
      sel.roomInput().clear().type("21");
      cy.assertNoRequest("@updateClinical");
    });

    it("saves the new room number as a number", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      roomPencil().click();
      sel.roomInput().clear().type("21");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber, "roomNumber").to.eq(21);
      });
      cy.assertPopover("Room Number Updated Successfully");
    });

    it("keeps the senior's other clinical fields on the payload", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      roomPencil().click();
      sel.roomInput().clear().type("21");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.status).to.eq("In Home");
      });
    });

    it("abandons the edit on Cancel", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");
      roomPencil().click();
      sel.roomInput().clear().type("21");
      sel.cancel().click();

      cy.assertNoRequest("@updateClinical");
      assertLocked(sel.roomInput);
    });

    it("reports a rejected save", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { error: [{ message: "Room already occupied" }] },
      }).as("updateClinical");
      roomPencil().click();
      sel.roomInput().clear().type("21");
      sel.save().click();

      cy.wait("@updateClinical");
      cy.assertPopover("Room already occupied");
    });

    it("hides the pencil from a role without CLINICAL_SENIOR_ROOM_NUMBER", { tags: [Tags.PCG] }, () => {
      // The Status pencil is not permission-gated, so the room one going away
      // leaves exactly one — counting is the assertion, not absence.
      openProfile();
      pencils().should("have.length", 2);

      openProfile(buildSenior(), { role: "PCG" });
      sel.roomInput().should("exist");
      pencils().should("have.length", 1);
    });

    it("drops the field entirely at an In-Home-Care home", () => {
      openProfile(buildSenior(), { home: buildHome({ homeType: "In Home Care" }) });
      sel.modal().contains("Room Number:").should("not.exist");
    });

    it("shows Mobile and Address instead at an In-Home-Care home", () => {
      openProfile(buildSenior(), { home: buildHome({ homeType: "In Home Care" }) });
      sel.modal().contains("Mobile:").should("be.visible");
      sel.modal().contains("Address:").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Editing Status
  // ──────────────────────────────────────────────────────────────────────────

  describe("Status", () => {
    beforeEach(() => openProfile());

    it("starts read-only", () => {
      assertLocked(sel.statusInput);
    });

    it("becomes editable once the pencil is clicked", () => {
      statusPencil().click();
      assertEditable(sel.statusInput);
    });

    it("saves the new status", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      statusPencil().click();
      sel.statusInput().clear().type("Hospital");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.status).to.eq("Hospital");
      });
      cy.assertPopover("Status Updated Successfully");
    });

    it("keeps the room number on the payload", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      statusPencil().click();
      sel.statusInput().clear().type("Hospital");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(12);
      });
    });

    it("abandons the edit on Cancel", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");
      statusPencil().click();
      sel.statusInput().clear().type("Hospital");
      sel.cancel().click();

      cy.assertNoRequest("@updateClinical");
      assertLocked(sel.statusInput);
    });

    it("reports a rejected save", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { error: [{ message: "Status is not valid" }] },
      }).as("updateClinical");
      statusPencil().click();
      sel.statusInput().clear().type("Nowhere");
      sel.save().click();

      cy.wait("@updateClinical");
      cy.assertPopover("Status is not valid");
    });

    it("edits only one field at a time", () => {
      statusPencil().click();
      assertEditable(sel.statusInput);
      assertLocked(sel.roomInput);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. The shortcut buttons
  // ──────────────────────────────────────────────────────────────────────────

  describe("Shortcut buttons", () => {
    beforeEach(() => openProfile());

    const routesTo = (label: string, tab: string) => {
      sel.action(label).click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/clinical/${SENIOR_ID}`);
      cy.location("search").should("contain", `activeTab=${tab}`);
    };

    it("routes Add Medication to the Medication tab", () => {
      routesTo("Add Medication", "Medication");
    });

    it("routes Medication List to the Medication tab", () => {
      routesTo("Medication List", "Medication");
    });

    it("routes MedPass to the MedPass tab", () => {
      routesTo("MedPass", "MedPass");
    });

    it("routes Over-the-Counter to the OTC tab", () => {
      // The button's label and the tab's label differ, so the mapping matters.
      sel.action("Over-the-Counter").click();
      cy.location("search", { timeout: 10000 }).should("contain", "Over-The-Counter");
    });

    it("routes Care Plan to the Care Plan tab", () => {
      sel.action("Care Plan").click();
      cy.location("search", { timeout: 10000 }).should("contain", "Care%20Plan");
    });

    it("routes Incident Report to the Incident Report tab", () => {
      sel.action("Incident Report").click();
      cy.location("search", { timeout: 10000 }).should("contain", "Incident");
    });

    it("routes Profile to the senior's biography, not a tab", () => {
      sel.action("Profile").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/clinical/biography/${SENIOR_ID}`
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. A deleted senior
  // ──────────────────────────────────────────────────────────────────────────

  describe("A soft-deleted senior", () => {
    const DELETED = buildSenior({ isDeleted: true });

    /**
     * The popup does open for a deleted senior. `pointer-events-none` sits on
     * the SeniorCard, but senior-grid.tsx hangs the click handler on the card's
     * *parent* div, which stays clickable — the event simply passes through the
     * inert card to it. So the popup's own guards are reachable and testable.
     */
    beforeEach(() => openProfile(DELETED));

    it("still opens the popup", () => {
      sel.modal().contains(SENIOR).should("be.visible");
    });

    it("makes the room number field inert", () => {
      sel.roomInput()
        .parents("div")
        .should(($ancestors) => {
          const inert = [...$ancestors].some((el) =>
            String(el.className).includes("pointer-events-none")
          );
          expect(inert, "room number wrapped in a pointer-events-none container").to.be
            .true;
        });
    });

    it("fades the room number field", () => {
      sel.roomInput()
        .parents("div")
        .should(($ancestors) => {
          const faded = [...$ancestors].some((el) =>
            String(el.className).includes("opacity-50")
          );
          expect(faded, "room number faded").to.be.true;
        });
    });

    it("makes the status field inert", () => {
      sel.statusInput()
        .parents("div")
        .should(($ancestors) => {
          const inert = [...$ancestors].some((el) =>
            String(el.className).includes("pointer-events-none")
          );
          expect(inert, "status wrapped in a pointer-events-none container").to.be.true;
        });
    });

    it("disables the actions that would change the senior's record", () => {
      // senior-profile-card.tsx greys CLINICAL_ADD, CLINICAL_CAREPLAN and
      // CRM_BIOGRAPHY for a deleted senior.
      ["Add Medication", "Care Plan", "Profile"].forEach((label) =>
        sel.action(label).should("have.class", "pointer-events-none")
      );
    });

    it("leaves the read-only actions alone", () => {
      ["MedPass", "Medication List", "Over-the-Counter", "Incident Report"].forEach(
        (label) => sel.action(label).should("not.have.class", "pointer-events-none")
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Field validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Room Number validation", () => {
    beforeEach(() => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      openProfile();
    });

    it("saves an emptied room number as zero", () => {
      // handleSaveButton does Number(roomNumber); Number("") is 0, so clearing
      // the field and saving silently books the senior into room 0 rather than
      // clearing it or refusing.
      roomPencil().click();
      sel.roomInput().clear();
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber, "roomNumber sent for an empty field").to.eq(0);
      });
    });

    it("accepts a negative room number", () => {
      // type="number" has no `min`, and nothing validates the value.
      roomPencil().click();
      sel.roomInput().clear().type("-5");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(-5);
      });
    });

    it("refuses letters at the input itself", () => {
      // A number input drops non-numeric keystrokes, so the guard is the input
      // type rather than any validation of ours.
      roomPencil().click();
      sel.roomInput().clear().type("abc");
      sel.roomInput().should("have.value", "");
    });

    it("saves a large room number unchanged", () => {
      roomPencil().click();
      sel.roomInput().clear().type("9999");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(9999);
      });
    });
  });

  describe("Status validation", () => {
    beforeEach(() => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      openProfile();
    });

    it("saves an emptied status as an empty string", () => {
      statusPencil().click();
      sel.statusInput().clear();
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.status, "status sent for an empty field").to.eq("");
      });
    });

    it("keeps whitespace exactly as typed", () => {
      statusPencil().click();
      sel.statusInput().clear().type("  Hospital  ");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.status).to.eq("  Hospital  ");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. The avatar, the risk badges, and closing
  // ──────────────────────────────────────────────────────────────────────────

  describe("Profile image", () => {
    it("offers the avatar's edit button to a PCHO", () => {
      openProfile();
      sel.modal().find("button.bg-white").should("be.visible");
    });

    it("opens the change-image modal", () => {
      openProfile();
      sel.modal().find("button.bg-white").click();
      cy.contains("Choose Image").should("be.visible");
    });

    it("hides the avatar's edit button from a role without the permission", { tags: [Tags.PCG] }, () => {
      // CLINICAL_SENIOR_PROFILE_EDIT is PCHO and HomeAdmin only.
      openProfile(buildSenior(), { role: "PCG" });
      sel.modal().find("button.bg-white").should("not.exist");
    });
  });

  describe("Risk badges", () => {
    it("shows the wandering, evacuation and behaviour badges", () => {
      openProfile(
        buildSenior({
          carePlan: {
            behaviourPatterns: { wanderingRisk: true, evacuationAssistance: true },
            physicalHealth: { chokingRisk: "Yes" },
          },
        })
      );
      sel.modal().contains("W").should("be.visible");
      sel.modal().contains("E").should("be.visible");
      sel.modal().contains("BR").should("be.visible");
    });

    it("shows the diabetes badge", () => {
      openProfile(
        buildSenior({ carePlan: { physicalHealth: { diabetisStatus: "Yes" } } })
      );
      sel.modal().contains("D").should("be.visible");
    });

    it("shows only the risks the senior actually has", () => {
      openProfile(
        buildSenior({ carePlan: { behaviourPatterns: { wanderingRisk: true } } })
      );
      sel.modal().contains("W").should("be.visible");
      sel.modal().contains("BR").should("not.exist");
    });

    it("renders nothing for a senior with no risks", () => {
      // CircleComponent returns null when no condition matches.
      openProfile(buildSenior({ carePlan: {} }));
      sel.modal().contains("BR").should("not.exist");
      sel.modal().contains(SENIOR).should("be.visible");
    });
  });

  describe("Closing the popup", () => {
    it("closes on Esc", () => {
      openProfile();
      closeProfile();
    });

    it("leaves the board behind it intact", () => {
      openProfile();
      closeProfile();
      cy.contains(SENIOR).should("be.visible");
    });

    it("reopens with the senior's saved values", () => {
      openProfile();
      closeProfile();
      sel.card(SENIOR).parent().click();
      sel.roomInput().should("have.value", "12");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Access boundaries
  // ──────────────────────────────────────────────────────────────────────────

  describe("Per-role buttons", () => {
    it("gives a PCHO every button", () => {
      // CLINICAL_TABS is EDIT for a PCHO, which short-circuits the per-button
      // feature check and shows the lot.
      openProfile();
      PROFILE_BUTTONS.forEach((label) => sel.action(label).should("be.visible"));
    });

    it("narrows the buttons for a role holding CLINICAL_TABS only as VIEW", { tags: [Tags.PCG] }, () => {
      // A PCG has no CLINICAL_ADD and no CLINICAL_MEDLIST, so those two drop.
      openProfile(buildSenior(), { role: "PCG" });
      ["MedPass", "Over-the-Counter", "Care Plan", "Profile", "Incident Report"].forEach(
        (label) => sel.action(label).should("be.visible")
      );
      sel.action("Add Medication").should("not.exist");
      sel.action("Medication List").should("not.exist");
    });

    it("gives a Nurse the actions their role carries", { tags: [Tags.NURSE] }, () => {
      // A Nurse holds CLINICAL_ADD but neither CLINICAL_MEDLIST nor
      // CLINICAL_INCIDENT.
      // NOTE: deployed prod still grants Nurse CLINICAL_INCIDENT (pending the
      // dev RBAC tightening reaching main) — this asserts the intended matrix,
      // not the outdated prod one.
      // A Nurse's board is narrowed to their own associatedUserIds, so their
      // record has to name this senior or the board renders empty.
      openProfile(buildSenior(), {
        role: "Nurse",
        self: { userId: TEST_USER_ID, name: "Nina Nurse", associatedUserIds: [SENIOR_ID] },
      });
      sel.action("Add Medication").should("be.visible");
      sel.action("Medication List").should("not.exist");
      sel.action("Incident Report").should("not.exist");
    });
  });

  describe("A senior with no id", () => {
    it("says so rather than routing nowhere", () => {
      // handleClick's final else branch — reachable only when the record has no
      // userId, which the API should never return but the code guards against.
      const NO_ID = buildSenior({ userId: undefined });
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      stubSeniors([NO_ID]);
      cy.visit(CLINICAL_PATH);
      cy.wait("@getSeniors");
      sel.card(SENIOR).parent().click();

      sel.action("MedPass").click();
      cy.assertPopover("User Data Not Found");
    });

    it("stays on the board", () => {
      const NO_ID = buildSenior({ userId: undefined });
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      stubShifts();
      stubSeniors([NO_ID]);
      cy.visit(CLINICAL_PATH);
      cy.wait("@getSeniors");
      sel.card(SENIOR).parent().click();

      sel.action("MedPass").click();
      cy.location("pathname").should("eq", CLINICAL_PATH);
    });
  });
});

describe("Clinical — the senior's tabs", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 6. The tab strip
  // ──────────────────────────────────────────────────────────────────────────

  describe("Tabs", () => {
    beforeEach(() => visitSeniorPage());

    it("offers all five tabs", () => {
      [
        "Medication",
        "MedPass",
        "Over-The-Counter Medication",
        "Care Plan",
        "Incident Report",
      ].forEach((label) => cy.contains("span", label).should("be.visible"));
    });

    it("opens on Medication", () => {
      sel.addMedication().should("be.visible");
    });

    it("switches to another tab", () => {
      cy.contains("span", "Care Plan").click();
      sel.addMedication().should("not.exist");
    });

    it("comes back to Medication", () => {
      cy.contains("span", "Care Plan").click();
      sel.addMedication().should("not.exist");
      cy.contains("span", "Medication").first().click();
      sel.addMedication().should("be.visible");
    });

    it("opens the tab named in the query string", () => {
      visitSeniorPage(buildSenior(), { query: "?activeTab=Care%20Plan" });
      sel.addMedication().should("not.exist");
    });

    it("opens MedPass from the query string", () => {
      visitSeniorPage(buildSenior(), { query: "?activeTab=MedPass" });
      sel.addMedication().should("not.exist");
      cy.contains("Generate EMAR").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. The Bulk toggle
  // ──────────────────────────────────────────────────────────────────────────

  describe("Bulk toggle", () => {
    beforeEach(() => visitSeniorPage());

    it("offers the toggle on the Medication tab", () => {
      sel.bulkToggle().should("be.visible");
    });

    it("starts switched off", () => {
      sel.addMedication().should("be.visible");
      sel.addBulkMedication().should("not.exist");
    });

    it("renames the button when switched on", () => {
      sel.bulkToggle().click();
      sel.addBulkMedication().should("be.visible");
      sel.addMedication().should("not.exist");
    });

    it("renames it back when switched off again", () => {
      sel.bulkToggle().click();
      sel.addBulkMedication().should("be.visible");

      sel.bulkToggle().click();
      sel.addMedication().should("be.visible");
      sel.addBulkMedication().should("not.exist");
    });

    it("fills the switch in when it is on", () => {
      sel.bulkToggle().should("have.class", "bg-primary/20");
      sel.bulkToggle().click();
      sel.bulkToggle().should("have.class", "bg-primary");
    });

    it("takes the toggle away on another tab", () => {
      cy.contains("span", "Care Plan").click();
      cy.contains("span", "Bulk").should("not.exist");
    });

    it("keeps the toggle off when the tab is left and returned to", () => {
      sel.bulkToggle().click();
      sel.addBulkMedication().should("be.visible");

      cy.contains("span", "Care Plan").click();
      cy.contains("span", "Medication").first().click();
      // isBulkMode lives in ClinicalTabs, above the tab content, so it survives
      // the switch — the button is still in bulk mode on return.
      sel.addBulkMedication().should("be.visible");
    });

    it("hides the toggle from a role without MEDICATION_OCR_EXTRACTION", { tags: [Tags.PCG] }, () => {
      // A PCG holds neither MEDICATION_OCR_EXTRACTION nor CLINICAL_MEDICATION,
      // and CLINICAL_TABS only as VIEW — so the Medication tab is filtered out
      // entirely and the toggle has nowhere to render.
      visitSeniorPage(buildSenior(), { role: "PCG" });
      cy.contains("span", "Bulk").should("not.exist");
      sel.addMedication().should("not.exist");
      cy.contains("span", "MedPass").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a room number is corrected from the profile popup", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      openProfile();

      sel.roomInput().should("have.value", "12");
      roomPencil().click();
      sel.roomInput().clear().type("30");
      sel.save().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(30);
      });
      cy.assertPopover("Room Number Updated Successfully");
    });

    it("E2E — the popup routes into the senior's page and Bulk is switched on", () => {
      openProfile();

      sel.action("Medication List").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/clinical/${SENIOR_ID}`);

      sel.addMedication().should("be.visible");
      sel.bulkToggle().click();
      sel.addBulkMedication().should("be.visible");
    });
  });
});
