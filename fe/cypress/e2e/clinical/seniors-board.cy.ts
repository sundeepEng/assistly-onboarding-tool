/// <reference types="cypress" />

/**
 * Clinical — Seniors board
 *
 * The board at /clinical (pages/clinical/index.tsx) and its two views:
 *
 *   grid view   components/clinical/homePage/senior-grid.tsx  — cards, the default
 *   list view   components/clinical/homePage/senior-table.tsx — table + ⋮ menu
 *
 * `toggleState` drives the switch: false renders the grid, true the table. The
 * Toggle is icon-only here (no labels), so the two buttons are told apart by
 * their icons' viewBox — TileIcon is 25x24, GridIcon 33x23.
 *
 * The ⋮ menu lives in components/senior-action-cell.tsx and is list-view only:
 *
 *   Onboard          POST /signup — greyed out once the senior has signed in
 *   Add Medication   routes to /clinical/{id}?activeTab=Medication
 *   MedPass          routes to /clinical/{id}?activeTab=MedPass
 *   Incident Report  routes to /clinical/{id}?activeTab=Incident Report
 *   Initiate e-sign  POST /v1/initiate-esign, behind a document check
 *   Delete           DELETE /v1/user/{id} — a SOFT delete
 *
 * Soft delete is the important difference from CRM. The record comes back with
 * `isDeleted: true` rather than disappearing: the row is greyed and made
 * inert, sorted below the active seniors, and dropped from the header count —
 * but only roles holding VIEW_DELETED_SENIORS (PCHO, HomeAdmin) see it at all.
 *
 * API-level contracts for this board live in api-contracts.cy.ts.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const CLINICAL_PATH = "/clinical";

const ACTIVE = "Arthur Bean";
const ONBOARDED = "Mary Shaw";
const DELETED = "Gone Away";

/** A senior as GET /v1/users returns them for the clinical board. */
const buildSenior = (overrides: Record<string, any> = {}) => ({
  userId: "cccccccc-0001-4ccc-8ccc-cccccccccccc",
  name: ACTIVE,
  firstName: "Arthur",
  lastName: "Bean",
  email: "arthur.bean@assistly.com",
  role: "Senior",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  clinical: { roomNumber: 12, status: "In Home" },
  isDeleted: false,
  documents: [],
  ...overrides,
});

/** Already signed in, so the Onboard action is greyed out for them. */
const buildOnboardedSenior = (overrides: Record<string, any> = {}) =>
  buildSenior({
    userId: "cccccccc-0002-4ccc-8ccc-cccccccccccc",
    name: ONBOARDED,
    firstName: "Mary",
    lastName: "Shaw",
    email: "mary.shaw@assistly.com",
    lastLoginTimestamp: "2026-02-01T10:00:00.000Z",
    ...overrides,
  });

/** Soft-deleted: still returned by the API, flagged rather than removed. */
const buildDeletedSenior = (overrides: Record<string, any> = {}) =>
  buildSenior({
    userId: "cccccccc-0003-4ccc-8ccc-cccccccccccc",
    name: DELETED,
    firstName: "Gone",
    lastName: "Away",
    email: "gone.away@assistly.com",
    isDeleted: true,
    ...overrides,
  });

/** The onboarding paperwork verifySeniorDocuments() insists on before e-sign. */
const SIGNED_DOCS = [
  {
    documentId: "doc-contract",
    documentName: "Residency Agreement",
    documentCategory: "onboarding",
    isRequiredDocument: true,
    documentUrl: "https://bucket.s3.amazonaws.com/contract.pdf",
  },
];

const sel = {
  /** The Toggle's root: the only `w-fit cursor-pointer` block on the board. */
  viewToggle: () => cy.get("div.w-fit.cursor-pointer").first(),
  gridButton: () => sel.viewToggle().find('svg[viewBox="0 0 25 24"]'),
  listButton: () => sel.viewToggle().find('svg[viewBox="0 0 33 23"]'),
  /** SeniorCard is fixed at 283x260. */
  cards: () => cy.get('div[class*="h-[283px]"]'),
  rows: () => cy.get('div[class*="border-b"]'),
  row: (name: string) => cy.contains(name).closest('div[class*="border-b"]'),
  card: (name: string) => cy.contains(name).closest('div[class*="h-[283px]"]'),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
  statusPill: (name: string) => sel.row(name).contains("div", /In Home|Not Provided|Hospital/),
};

const ACTIVE_COLOUR = "#514CEB";

const stubSeniors = (users: any[] = [buildSenior()]) =>
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as("getSeniors");

const stubShifts = (shifts: any[] = []) =>
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts } }).as("getShifts");

const visitBoard = (
  users: any[] = [buildSenior()],
  opts: { role?: any; home?: ReturnType<typeof buildHome> } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  stubShifts();
  stubSeniors(users);
  cy.visit(CLINICAL_PATH);
  cy.wait("@getSeniors");
};

/** The board opens on the grid; the ⋮ menu only exists in the list view. */
const goToListView = () => {
  sel.listButton().click({ force: true });
  cy.contains("Vital Signs").should("be.visible");
};

const openMenu = (name: string) => {
  goToListView();
  cy.openRowMenu(name);
};

describe("Clinical — Seniors board", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Grid / list view switching
  // ──────────────────────────────────────────────────────────────────────────

  describe("View switching", () => {
    beforeEach(() => visitBoard());

    it("opens on the grid view", () => {
      sel.cards().should("have.length", 1);
      cy.contains("Vital Signs").should("not.exist");
    });

    it("marks the grid icon as the active view on load", () => {
      sel.gridButton().find("path").first().should("have.attr", "fill", ACTIVE_COLOUR);
    });

    it("switches to the list view", () => {
      sel.listButton().click({ force: true });
      cy.contains("Vital Signs").should("be.visible");
      sel.cards().should("not.exist");
    });

    it("marks the list icon as active once switched", () => {
      sel.listButton().click({ force: true });
      sel.listButton().find("path").first().should("have.attr", "fill", ACTIVE_COLOUR);
    });

    it("switches back to the grid view", () => {
      sel.listButton().click({ force: true });
      cy.contains("Vital Signs").should("be.visible");

      sel.gridButton().click({ force: true });
      sel.cards().should("have.length", 1);
      cy.contains("Vital Signs").should("not.exist");
    });

    it("shows the same seniors in both views", () => {
      cy.contains(ACTIVE).should("be.visible");
      sel.listButton().click({ force: true });
      cy.contains(ACTIVE).should("be.visible");
    });

    it("keeps the header count the same across views", () => {
      cy.contains("1 members").should("be.visible");
      sel.listButton().click({ force: true });
      cy.contains("1 members").should("be.visible");
    });

    it("clicking the already-active view does not change it", () => {
      sel.gridButton().click({ force: true });
      sel.cards().should("have.length", 1);
    });

    it("shows the empty state in the grid view", () => {
      visitBoard([]);
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("shows an empty list view without cards or rows", () => {
      visitBoard([]);
      sel.listButton().click({ force: true });
      // senior-table.tsx ignores `customEmptyMessage` and always prints this,
      // which is why the two views disagree when the board is empty.
      cy.contains("No Personal Care Givers added yet.").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Grid view
  // ──────────────────────────────────────────────────────────────────────────

  describe("Grid view", () => {
    it("renders one card per senior", () => {
      visitBoard([buildSenior(), buildOnboardedSenior()]);
      sel.cards().should("have.length", 2);
      cy.contains(ACTIVE).should("be.visible");
      cy.contains(ONBOARDED).should("be.visible");
    });

    it("shows the senior's clinical status on the card", () => {
      visitBoard();
      cy.contains("In Home").should("be.visible");
    });

    it("opens the profile modal when a card is clicked", () => {
      visitBoard();
      sel.card(ACTIVE).click();
      cy.get(".ReactModal__Content").should("be.visible");
    });

    it("shows the chosen senior in the profile modal", () => {
      visitBoard([buildSenior(), buildOnboardedSenior()]);
      sel.card(ONBOARDED).click();
      cy.get(".ReactModal__Content").contains(ONBOARDED).should("be.visible");
    });

    it("offers no ⋮ menu in the grid view", () => {
      visitBoard();
      cy.get("svg.cursor-pointer").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. List view
  // ──────────────────────────────────────────────────────────────────────────

  describe("List view", () => {
    beforeEach(() => {
      visitBoard();
      goToListView();
    });

    it("renders every column header", () => {
      ["Seniors", "Added", "Vital Signs", "Status"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("renders the senior's name", () => {
      cy.contains(ACTIVE).should("be.visible");
    });

    it("formats the Added date as MM/DD/YYYY", () => {
      cy.contains("01/02/2026").should("be.visible");
    });

    it("shows the senior's clinical status", () => {
      cy.contains("In Home").should("be.visible");
    });

    it("offers a ⋮ menu on the row", () => {
      cy.openRowMenu(ACTIVE);
      sel.item("MedPass").should("be.visible");
    });
  });

  describe("List view — changing the clinical status", () => {
    beforeEach(() => {
      visitBoard();
      goToListView();
    });

    it("falls back to Not Provided when the senior has no status", () => {
      visitBoard([buildSenior({ clinical: { roomNumber: 12 } })]);
      goToListView();
      cy.contains("Not Provided").should("be.visible");
    });

    it("saves a new status against the clinical record", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});

      sel.statusPill(ACTIVE).click();
      cy.get('textarea[name="refuse comment"]').clear();
      cy.get('textarea[name="refuse comment"]').type("Hospital");
      cy.contains("button", "Save").click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.status).to.eq("Hospital");
      });
      cy.assertPopover("Status Changed!");
    });

    it("sends nothing until Save is pressed", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");

      sel.statusPill(ACTIVE).click();
      cy.get('textarea[name="refuse comment"]').clear();
      cy.get('textarea[name="refuse comment"]').type("Hospital");
      cy.assertNoRequest("@updateClinical");
    });

    it("reports a rejected status change", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { error: [{ message: "Status is not valid" }] },
      }).as("updateClinical");

      sel.statusPill(ACTIVE).click();
      cy.get('textarea[name="refuse comment"]').clear();
      cy.get('textarea[name="refuse comment"]').type("Nowhere");
      cy.contains("button", "Save").click();

      cy.wait("@updateClinical");
      cy.assertPopover("Status is not valid");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. The row menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("Row menu", () => {
    it("offers all six actions to a PCHO", () => {
      visitBoard();
      openMenu(ACTIVE);
      [
        "Onboard",
        "Add Medication",
        "MedPass",
        "Incident Report",
        "Initiate e-sign",
        "Delete",
      ].forEach((label) => sel.item(label).should("be.visible"));
    });

    it("greys out Onboard for a senior who has already signed in", () => {
      visitBoard([buildOnboardedSenior()]);
      openMenu(ONBOARDED);
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("keeps Onboard active for a senior who has never signed in", () => {
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Onboard").should("have.class", "cursor-pointer");
    });

    it("sends nothing when a greyed-out Onboard is clicked", () => {
      cy.intercept("POST", "**/signup").as("signup");
      visitBoard([buildOnboardedSenior()]);
      openMenu(ONBOARDED);
      sel.item("Onboard").click();
      cy.assertNoRequest("@signup");
    });
  });

  describe("Row menu — Onboard", () => {
    it("invites the senior to register", { tags: [Tags.SENIOR] }, () => {
      cy.stubPost("/signup", "signup", 201, {});
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Onboard").click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq("arthur.bean@assistly.com");
        expect(request.body.role).to.eq("Senior");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses a senior with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      visitBoard([buildSenior({ email: "" })]);
      openMenu(ACTIVE);
      sel.item("Onboard").click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("reports a rejected signup", () => {
      cy.stubPost("/signup", "signup", 400, { error: "User already exists" });
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Onboard").click();

      cy.wait("@signup");
      cy.assertPopover("User already exists");
    });

    it("falls back to a generic message when the API sends an error array", () => {
      cy.stubPost("/signup", "signup", 400, { error: ["bad", "worse"] });
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Onboard").click();

      cy.wait("@signup");
      cy.assertPopover("Signup failed");
    });
  });

  describe("Row menu — navigation actions", () => {
    beforeEach(() => {
      visitBoard();
      cy.stubUser(buildSenior());
    });

    it("opens the senior's Medication tab", () => {
      openMenu(ACTIVE);
      sel.item("Add Medication").click();

      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/clinical/${buildSenior().userId}`
      );
      cy.location("search").should("contain", "activeTab=Medication");
    });

    it("opens the senior's MedPass tab", () => {
      openMenu(ACTIVE);
      sel.item("MedPass").click();

      cy.location("search", { timeout: 10000 }).should("contain", "activeTab=MedPass");
    });

    it("opens the senior's Incident Report tab", () => {
      openMenu(ACTIVE);
      sel.item("Incident Report").click();

      cy.location("search", { timeout: 10000 }).should("contain", "activeTab=Incident");
    });

    it("navigates to the senior whose menu was opened", () => {
      visitBoard([buildSenior(), buildOnboardedSenior()]);
      cy.stubUser(buildOnboardedSenior());
      openMenu(ONBOARDED);
      sel.item("MedPass").click();

      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `/clinical/${buildOnboardedSenior().userId}`
      );
    });
  });

  describe("Row menu — Initiate e-sign", () => {
    it("asks for confirmation first", () => {
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      cy.contains("Are you sure you want to initiate e-sign for this Senior?").should(
        "be.visible"
      );
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.cancel().click();
      cy.assertNoRequest("@esign");
    });

    it("names the home, the sender and the recipient", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 201, {});
      visitBoard([buildSenior({ documents: SIGNED_DOCS })]);
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();

      cy.wait("@esign").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.senderUserId).to.eq(TEST_USER_ID);
        expect(request.body.recipientUserId).to.eq(buildSenior().userId);
      });
    });

    it("refuses a senior with no email address", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      visitBoard([buildSenior({ email: "", documents: SIGNED_DOCS })]);
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();

      cy.assertPopover("E-sign cannot be initiated without a recipient email.");
      cy.assertNoRequest("@esign");
    });

    it("refuses a contract that has already been signed", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      visitBoard([
        buildSenior({
          onboardingESignEnvelopeStatus: "completed",
          documents: SIGNED_DOCS,
        }),
      ]);
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();

      cy.assertPopover("This contract has already been signed.");
      cy.assertNoRequest("@esign");
    });

    it("refuses a senior with no onboarding documents", () => {
      // verifySeniorDocuments() treats "no required documents configured" as a
      // failure, so a senior with an empty `documents` array never gets there.
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      visitBoard([buildSenior({ documents: [] })]);
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();

      cy.assertPopover("Please edit all documents before starting e-sign.");
      cy.assertNoRequest("@esign");
    });

    it("refuses a senior whose required document was never uploaded", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      visitBoard([
        buildSenior({
          documents: [{ ...SIGNED_DOCS[0], documentUrl: undefined }],
        }),
      ]);
      openMenu(ACTIVE);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();

      cy.assertPopover("Please edit all documents before starting e-sign.");
      cy.assertNoRequest("@esign");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Soft delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Delete", () => {
    it("asks for confirmation first", () => {
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Delete").click();
      cy.contains("Are you sure you want to delete Senior ?").should("be.visible");
    });

    it("sends nothing until the delete is confirmed", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteSenior");
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Delete").click();
      cy.assertNoRequest("@deleteSenior");
    });

    it("abandons the delete on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteSenior");
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Delete").click();
      sel.cancel().click();
      cy.assertNoRequest("@deleteSenior");
    });

    it("deletes the senior by id", () => {
      cy.stubDelete("/v1/user", "deleteSenior", 200, {});
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Delete").click();
      sel.confirm().click();

      cy.wait("@deleteSenior").then(({ request }) => {
        expect(request.url).to.contain(buildSenior().userId);
      });
      cy.assertPopover("Senior deleted successfully!");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteSenior", 500, { error: "Delete failed" });
      visitBoard();
      openMenu(ACTIVE);
      sel.item("Delete").click();
      sel.confirm().click();

      cy.wait("@deleteSenior");
      cy.assertPopover("Delete failed");
    });
  });

  describe("Soft delete — what a deleted senior looks like", () => {
    it("keeps the deleted senior on the board rather than removing them", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();
      cy.contains(DELETED).should("be.visible");
    });

    it("fades the deleted senior's row", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();
      sel.row(DELETED).should("have.class", "opacity-50");
    });

    it("greys the deleted senior's row", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();
      sel.row(DELETED).should("have.class", "bg-[#bcb9b9]");
    });

    it("leaves the active senior's row untouched", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();
      sel.row(ACTIVE).should("not.have.class", "opacity-50");
    });

    it("sorts the deleted senior below the active ones", () => {
      // index.tsx rebuilds the list as [...active, ...deleted] regardless of the
      // order the API returned them in — here the deleted one comes back first.
      visitBoard([buildDeletedSenior(), buildSenior()]);
      goToListView();

      cy.contains(ACTIVE)
        .closest('div[class*="border-b"]')
        .then(($active) => {
          cy.contains(DELETED)
            .closest('div[class*="border-b"]')
            .then(($deleted) => {
              expect(
                $active[0].getBoundingClientRect().top,
                "active row sits above the deleted one"
              ).to.be.lessThan($deleted[0].getBoundingClientRect().top);
            });
        });
    });

    it("drops the deleted senior from the header count", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      cy.contains("1 members").should("be.visible");
    });

    it("makes the deleted senior's actions inert", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();

      // senior-table.tsx puts `pointer-events-none` on the SeniorActions root,
      // which is several levels above the ⋮ icon — so walk the ancestors rather
      // than guessing the depth.
      sel.row(DELETED)
        .find("svg.cursor-pointer")
        .parents("div")
        .should(($ancestors) => {
          const inert = [...$ancestors].some((el) =>
            String(el.className).includes("pointer-events-none")
          );
          expect(inert, "⋮ menu wrapped in a pointer-events-none container").to.be.true;
        });
    });

    it("leaves the active senior's actions clickable", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      goToListView();

      sel.row(ACTIVE)
        .find("svg.cursor-pointer")
        .parents("div")
        .should(($ancestors) => {
          const inert = [...$ancestors].some((el) =>
            String(el.className).includes("pointer-events-none")
          );
          expect(inert, "active row's ⋮ menu is not disabled").to.be.false;
        });
    });

    it("fades the deleted senior's card in the grid view", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      sel.card(DELETED).should("have.class", "opacity-50");
    });

    it("makes the deleted senior's card unclickable", () => {
      visitBoard([buildSenior(), buildDeletedSenior()]);
      sel.card(DELETED).should("have.class", "pointer-events-none");
    });

    it("hides the deleted senior from a role without VIEW_DELETED_SENIORS", { tags: [Tags.PCG] }, () => {
      // utils/roles.ts grants it to PCHO and HomeAdmin only.
      visitBoard([buildSenior(), buildDeletedSenior()], { role: "PCG" });
      cy.contains(ACTIVE).should("be.visible");
      cy.contains(DELETED).should("not.exist");
    });

    it("hides the deleted senior from that role in the list view too", { tags: [Tags.PCG] }, () => {
      visitBoard([buildSenior(), buildDeletedSenior()], { role: "PCG" });
      goToListView();
      cy.contains(ACTIVE).should("be.visible");
      cy.contains(DELETED).should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a senior is deleted and comes back as an inactive row", () => {
      cy.stubDelete("/v1/user", "deleteSenior", 200, {});
      visitBoard([buildSenior(), buildOnboardedSenior()]);
      cy.contains("2 members").should("be.visible");

      openMenu(ACTIVE);
      sel.item("Delete").click();

      // The API soft-deletes, so the refetch returns the same senior flagged.
      stubSeniors([
        buildSenior({ isDeleted: true }),
        buildOnboardedSenior(),
      ]);
      sel.confirm().click();

      cy.wait("@deleteSenior");
      cy.assertPopover("Senior deleted successfully!");
      cy.dismissPopover();

      cy.contains("1 members", { timeout: 10000 }).should("be.visible");
      cy.contains(ACTIVE).should("be.visible");
      sel.row(ACTIVE).should("have.class", "opacity-50");
    });

    it("E2E — a senior is onboarded, then the action is greyed out on return", () => {
      cy.stubPost("/signup", "signup", 201, {});
      visitBoard();

      openMenu(ACTIVE);
      sel.item("Onboard").should("have.class", "cursor-pointer");
      sel.item("Onboard").click();
      cy.wait("@signup");
      cy.assertPopover("Email sent successfully.");
      cy.dismissPopover();

      // They accept the invitation and sign in, so the record gains a timestamp.
      stubSeniors([buildSenior({ lastLoginTimestamp: "2026-02-01T10:00:00.000Z" })]);
      cy.visit(CLINICAL_PATH);
      cy.wait("@getSeniors");

      openMenu(ACTIVE);
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("E2E — a PCHO reviews a senior in both views and opens their MedPass", () => {
      visitBoard();
      cy.stubUser(buildSenior());

      sel.card(ACTIVE).click();
      cy.get(".ReactModal__Content").contains(ACTIVE).should("be.visible");
      cy.get("body").type("{esc}");

      goToListView();
      cy.contains("01/02/2026").should("be.visible");

      cy.openRowMenu(ACTIVE);
      sel.item("MedPass").click();
      cy.location("search", { timeout: 10000 }).should("contain", "activeTab=MedPass");
    });
  });
});
