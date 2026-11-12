/// <reference types="cypress" />

/**
 * Clinical — Nurses
 *
 *   pages/clinical/nurse/index.tsx              the list
 *   components/nurse/nurse-home-page.tsx        its table
 *   components/nurse-action-cell.tsx            the ⋮ menu
 *   components/nurse/assign-seniors-modal.tsx   the Assign Seniors wrapper
 *   commonComponents/assign-users-modal.tsx     the modal it wraps
 *
 * All as a PCHO.
 *
 * THE ⋮ MENU
 *   Onboard, Assign Seniors and Delete — three, not five. "Initiate e-sign" is
 *   commented out in the source, and "Move to Clinical" is gated on
 *   `data.role === "NurseLead"`, which a clinical Nurse is not. Assign Seniors
 *   is the mirror image: gated on `router.pathname.startsWith("/clinical")`, so
 *   it exists here and nowhere else (the CRM side of that gate is pinned in
 *   cypress/e2e/crm/care-and-nurse-leads.cy.ts).
 *
 * ASSIGN SENIORS
 *   Two sections over one piece of state, `selectedUserIds`:
 *
 *     Currently Assigned  a removable chip per selected id, plus a count badge
 *     All Seniors         a searchable, scrollable checkbox list
 *
 *   Ticking a checkbox adds a chip; clicking a chip's × unticks the checkbox.
 *   Nothing is sent until Save Changes, which PUTs the whole nurse record back
 *   with `associatedUserIds` replaced. Cancel throws the selection away — the
 *   modal reloads it from the row every time it opens.
 *
 * AS-BUILT WORDING TO EXPECT
 *   This screen is the Nurse Lead screen with a different query behind it, and
 *   the strings were never re-pointed. On the Nurses board an empty list reads
 *   "No Nurse Leads added yet.", and deleting a nurse offers to "permanently
 *   delete this Nurse Lead" and then reports "Nurse Lead deleted successfully!"
 *   — while performing a soft delete. Pinned as built, and called out in the
 *   README rather than quietly matched.
 *
 * The nurse name is NOT a link: `navigateToNurse` is wired up in nurse-cell.tsx
 * but its `onClick` is commented out.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const NURSE_PATH = "/clinical/nurse";

const JUDITH = "nnnnnnnn-0001-4nnn-8nnn-nnnnnnnnnnnn";
const NURSE_TEST = "nnnnnnnn-0002-4nnn-8nnn-nnnnnnnnnnnn";
const GONE = "nnnnnnnn-0003-4nnn-8nnn-nnnnnnnnnnnn";

const JAKE = "5e510125-0001-4aaa-8aaa-aaaaaaaaaaaa";
const TEJA = "5e510125-0002-4aaa-8aaa-aaaaaaaaaaaa";
const ANDREA = "5e510125-0003-4aaa-8aaa-aaaaaaaaaaaa";
const SHELDON = "5e510125-0004-4aaa-8aaa-aaaaaaaaaaaa";
const GARY = "5e510125-0005-4aaa-8aaa-aaaaaaaaaaaa";
const DELETED_SENIOR = "5e510125-0006-4aaa-8aaa-aaaaaaaaaaaa";

const JUDITH_EMAIL = "judithh@yopmail.com";

/** A nurse as GET /v1/users?userType=Nurse returns them. */
const buildNurse = (
  userId: string,
  name: string,
  overrides: Record<string, any> = {}
) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}h@yopmail.com`,
  mobile: "4564548979",
  role: "Nurse",
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  ...overrides,
});

const JUDITH_ROW = buildNurse(JUDITH, "Judith Harper");
const NURSE_TEST_ROW = buildNurse(NURSE_TEST, "Nurse Test");
const DELETED_ROW = buildNurse(GONE, "Gone Away", { isDeleted: true });
/** Already signed in, so Onboard is greyed out for them. */
const ONBOARDED_ROW = buildNurse(JUDITH, "Judith Harper", {
  lastLoginTimestamp: "2026-02-01T10:00:00.000Z",
});

/** A nurse who already cares for two seniors. */
const buildAssignedNurse = (ids: any[] = [JAKE, TEJA]) =>
  buildNurse(JUDITH, "Judith Harper", { associatedUserIds: ids });

const buildSenior = (userId: string, name: string, overrides = {}) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}@assistly.com`,
  role: "Senior",
  homeId: TEST_HOME_ID,
  isDeleted: false,
  ...overrides,
});

const SENIORS = [
  buildSenior(JAKE, "Jake Harper"),
  buildSenior(TEJA, "Teja Senior"),
  buildSenior(ANDREA, "Andrea Williams"),
  buildSenior(SHELDON, "Sheldon Cooper"),
  buildSenior(GARY, "Gary Gold"),
  buildSenior(DELETED_SENIOR, "Removed Resident", { isDeleted: true }),
];

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  row: (name: string) => cy.contains(name).closest('div[class*="border-b"]'),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),

  // Assign Seniors modal
  subtitle: () => cy.contains("Select which seniors"),
  /** The header row holding the section label and its count badge. */
  assignedHeader: () => cy.contains("div", /^Currently Assigned$/).parent(),
  assignedCount: () => sel.assignedHeader().contains(/^\d+ seniors$/),
  /** The chip tray sits immediately after that header. */
  chips: () => cy.contains("div", /^Currently Assigned$/).parent().next(),
  chip: (name: string) => sel.chips().contains("div", name).parent(),
  chipRemove: (name: string) => sel.chip(name).find("button"),
  search: () => cy.get('input[name="search"]'),
  /** The scrollable list; rows below the fold are clipped, so assert presence. */
  list: () => cy.get('[class*="max-h-[320px]"]'),
  seniorRow: (name: string) =>
    sel.list().contains(name).closest('div[class*="border-b"]'),
  checkbox: (id: string) => cy.get(`input[type="checkbox"][name="${id}"]`),
  saveChanges: () => cy.contains("button", "Save Changes"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

/**
 * One handler for both queries the screen makes: the board asks for Nurses, the
 * Assign Seniors modal asks for Seniors.
 */
const stubUsersByType = (nurses: any[], seniors: any[] = SENIORS) =>
  cy
    .intercept("GET", "**/v1/users*", (req) => {
      const userType = req.query.userType as string | undefined;
      const users =
        userType === "Nurse" ? nurses : userType === "Senior" ? seniors : [];
      req.reply({ statusCode: 200, body: { users } });
    })
    .as("getUsers");

const visitBoard = (
  nurses: any[] = [JUDITH_ROW, NURSE_TEST_ROW],
  opts: { role?: any; seniors?: any[]; home?: any } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
  stubUsersByType(nurses, opts.seniors ?? SENIORS);
  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: { user: nurses[0] ?? JUDITH_ROW },
  }).as("getNurse");
  cy.visit(NURSE_PATH);
  cy.wait("@getUsers");
};

/** Open the modal for the first nurse and wait for the seniors to land. */
const openAssignSeniors = (
  nurse: Record<string, any> = buildAssignedNurse(),
  seniors: any[] = SENIORS
) => {
  visitBoard([nurse], { seniors });
  cy.openRowMenu("Judith Harper");
  sel.item("Assign Seniors").click();
  sel.subtitle().should("be.visible");
  cy.contains("All Seniors").should("be.visible");
};

describe("Clinical — Nurses", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The list
  // ──────────────────────────────────────────────────────────────────────────

  describe("The list", () => {
    beforeEach(() => visitBoard());

    it("names the board", () => {
      cy.contains("Nurses").should("be.visible");
    });

    it("counts the nurses", () => {
      cy.contains("2 Team members").should("be.visible");
    });

    it("renders the column headers", () => {
      ["Name", "Email", "Phone"].forEach((header) =>
        cy.contains(header).should("exist")
      );
    });

    it("does not offer the CRM-only Contract Status column", () => {
      cy.contains("Contract Status").should("not.exist");
    });

    it("lists every nurse", () => {
      cy.contains("Judith Harper").should("be.visible");
      cy.contains("Nurse Test").should("be.visible");
    });

    it("shows each nurse's email", () => {
      cy.contains(JUDITH_EMAIL).should("be.visible");
    });

    it("shows each nurse's phone", () => {
      cy.contains("4564548979").should("exist");
    });

    it("queries nurses scoped to the home", { tags: [Tags.NURSE] }, () => {
      cy.assertQuery("@getUsers", { userType: "Nurse", homeId: TEST_HOME_ID });
    });

    it("sends the session token with the list query", () => {
      cy.assertAuthorized("@getUsers");
    });

    it("dashes a nurse with no phone", () => {
      visitBoard([buildNurse(JUDITH, "Judith Harper", { mobile: "" })]);
      sel.row("Judith Harper").should("contain.text", "-");
    });

    it("dashes a nurse with no email", () => {
      visitBoard([buildNurse(JUDITH, "Judith Harper", { email: "" })]);
      sel.row("Judith Harper").should("contain.text", "-");
    });

    it("[as-built] calls an empty nurse list 'No Nurse Leads added yet.'", () => {
      // The Nurses board reuses the Nurse Lead table verbatim, wording included.
      visitBoard([]);
      cy.contains("No Nurse Leads added yet.").should("be.visible");
    });

    it("counts an empty board as zero", () => {
      visitBoard([]);
      cy.contains("0 Team members").should("be.visible");
    });

    it("[as-built] does not open a nurse when the name is clicked", () => {
      // `navigateToNurse` exists in nurse-cell.tsx but its onClick is commented
      // out, so the row is inert — unlike the Care Team board.
      cy.contains("Judith Harper").click();
      cy.location("pathname").should("eq", NURSE_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the board to a role without CLINICAL_NURSE", () => {
      visitBoard([JUDITH_ROW], { role: "Lead" });
      cy.assertRestricted();
    });

    it("refuses the board when the home has no clinical module", () => {
      visitBoard([JUDITH_ROW], {
        home: buildHome({ authorizedModules: ["CRM"] }),
      });
      cy.assertRestricted();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The ⋮ menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("The ⋮ menu", () => {
    it("offers Onboard, Assign Seniors and Delete", () => {
      visitBoard();
      cy.openRowMenu("Judith Harper");
      ["Onboard", "Assign Seniors", "Delete"].forEach((label) =>
        sel.item(label).should("be.visible")
      );
    });

    it("offers nothing else", () => {
      visitBoard();
      cy.openRowMenu("Judith Harper");
      // Initiate e-sign is commented out in nurse-action-cell.tsx, and Move to
      // Clinical is gated on role === "NurseLead".
      sel.item("Initiate e-sign").should("not.exist");
      sel.item("Move to Clinical").should("not.exist");
    });

    it("greys out Onboard for a nurse who has already signed in", () => {
      visitBoard([ONBOARDED_ROW]);
      cy.openRowMenu("Judith Harper");
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("keeps Onboard active for a nurse who has never signed in", () => {
      visitBoard();
      cy.openRowMenu("Judith Harper");
      sel.item("Onboard").should("have.class", "cursor-pointer");
    });

    it("does not even confirm when a greyed-out Onboard is clicked", () => {
      visitBoard([ONBOARDED_ROW]);
      cy.openRowMenu("Judith Harper");
      sel.item("Onboard").click();
      cy.contains("Are you sure you want to onboard").should("not.exist");
    });

    it("sends nothing when a greyed-out Onboard is clicked", () => {
      cy.intercept("POST", "**/signup").as("signup");
      visitBoard([ONBOARDED_ROW]);
      cy.openRowMenu("Judith Harper");
      sel.item("Onboard").click();
      cy.assertNoRequest("@signup");
    });

    it("keeps Assign Seniors available to an onboarded nurse", () => {
      // Only Onboard is disabled by lastLoginTimestamp.
      visitBoard([ONBOARDED_ROW]);
      cy.openRowMenu("Judith Harper");
      sel.item("Assign Seniors").should("have.class", "cursor-pointer");
    });

    it("leaves a deleted nurse's actions inert", () => {
      visitBoard([JUDITH_ROW, DELETED_ROW]);
      sel.row("Gone Away")
        .find('div[class*="pointer-events-none"]')
        .should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Onboard
  // ──────────────────────────────────────────────────────────────────────────

  describe("Onboard", () => {
    const startOnboard = (nurses: any[] = [JUDITH_ROW]) => {
      visitBoard(nurses);
      cy.openRowMenu("Judith Harper");
      sel.item("Onboard").click();
    };

    it("asks for confirmation first", () => {
      startOnboard();
      cy.contains("Are you sure you want to onboard this").should("be.visible");
    });

    it("warns that an email will be sent", () => {
      startOnboard();
      cy.contains("An email will be sent to the").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard();
      cy.assertNoRequest("@signup");
    });

    it("abandons the action on Cancel", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard();
      sel.cancel().click();
      cy.assertNoRequest("@signup");
    });

    it("invites the nurse to register", { tags: [Tags.NURSE] }, () => {
      cy.stubPost("/signup", "signup", 200, {});
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq(JUDITH_EMAIL);
        expect(request.body.role).to.eq("Nurse");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses a nurse with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard([buildNurse(JUDITH, "Judith Harper", { email: "" })]);
      sel.confirm().click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("reports a rejected signup", () => {
      cy.stubPost("/signup", "signup", 400, { error: "User already exists" });
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("User already exists");
    });

    it("falls back to a generic message when the API gives no reason", () => {
      cy.stubPost("/signup", "signup", 500, {});
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("Signup failed");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Delete", () => {
    const startDelete = (nurses: any[] = [JUDITH_ROW]) => {
      visitBoard(nurses);
      cy.openRowMenu("Judith Harper");
      sel.item("Delete").click();
    };

    it("[as-built] asks to permanently delete a 'Nurse Lead'", () => {
      // Two things are wrong with this sentence and both are as built: the row
      // is a Nurse, not a Nurse Lead, and the delete is soft.
      startDelete();
      cy.contains("permanently delete this Nurse Lead").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteNurse");
      startDelete();
      cy.assertNoRequest("@deleteNurse");
    });

    it("abandons the delete on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteNurse");
      startDelete();
      sel.cancel().click();
      cy.assertNoRequest("@deleteNurse");
    });

    it("deletes the nurse by id", () => {
      cy.stubDelete("/v1/user", "deleteNurse", 200, {});
      startDelete();
      sel.confirm().click();

      cy.wait("@deleteNurse").then(({ request }) => {
        expect(request.url).to.contain(JUDITH);
      });
      cy.assertPopover("Nurse Lead deleted successfully!");
    });

    it("authorises the delete with the session token", () => {
      cy.stubDelete("/v1/user", "deleteNurse", 200, {});
      startDelete();
      sel.confirm().click();
      cy.wait("@deleteNurse");
      cy.assertAuthorized("@deleteNurse");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteNurse", 500, { error: "Delete failed" });
      startDelete();
      sel.confirm().click();

      cy.wait("@deleteNurse");
      cy.assertPopover("Delete failed");
    });
  });

  describe("Soft delete — what a deleted nurse looks like", () => {
    beforeEach(() => visitBoard([JUDITH_ROW, DELETED_ROW]));

    it("keeps the deleted nurse on the board rather than removing them", () => {
      cy.contains("Gone Away").should("be.visible");
    });

    it("greys the deleted nurse's row", () => {
      sel.row("Gone Away").should("have.class", "opacity-50");
    });

    it("leaves an active nurse's row untouched", () => {
      sel.row("Judith Harper").should("not.have.class", "opacity-50");
    });

    it("drops the deleted nurse from the header count", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("sorts the deleted nurse below the active ones", () => {
      // The board rebuilds the list as [...active, ...deleted] whatever order
      // the API returned — here the deleted one comes back first.
      //
      // Read every row in ONE pass inside `should`, rather than looking up the
      // two rows in nested `then`s. The page seeds `orderUserData` as `[]` and
      // fills it from an effect, so there is a re-render between any two
      // queries — long enough on a slow dev server to detach the first row and
      // hand back a zeroed rect. `should` re-runs the whole callback instead.
      visitBoard([DELETED_ROW, JUDITH_ROW]);

      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((row) => row.textContent || "");
        const active = text.findIndex((t) => t.includes("Judith Harper"));
        const deleted = text.findIndex((t) => t.includes("Gone Away"));

        expect(active, "the active nurse's row is rendered").to.be.greaterThan(-1);
        expect(deleted, "the deleted nurse sits below the active one").to.be.greaterThan(
          active
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Assign Seniors — opening the modal
  // ──────────────────────────────────────────────────────────────────────────

  describe("Assign Seniors — opening", () => {
    it("opens without a confirmation step", () => {
      visitBoard([buildAssignedNurse()]);
      cy.openRowMenu("Judith Harper");
      sel.item("Assign Seniors").click();

      cy.contains("Are you sure").should("not.exist");
      cy.contains("All Seniors").should("be.visible");
    });

    it("names the nurse in the subtitle", () => {
      openAssignSeniors();
      cy.contains("Select which seniors Judith Harper will care for").should(
        "be.visible"
      );
    });

    it("shows both sections", () => {
      openAssignSeniors();
      cy.contains("Currently Assigned").should("be.visible");
      cy.contains("All Seniors").should("be.visible");
    });

    it("fetches the seniors for the home", { tags: [Tags.SENIOR] }, () => {
      openAssignSeniors();
      cy.get("@getUsers.all").then((interceptions: any) => {
        const senior = interceptions.find(
          (i: any) =>
            new URL(i.request.url).searchParams.get("userType") === "Senior"
        );
        expect(senior, "a userType=Senior query was sent").to.exist;
        expect(new URL(senior.request.url).searchParams.get("homeId")).to.eq(
          TEST_HOME_ID
        );
      });
    });

    it("says so while the seniors are still loading", { tags: [Tags.SENIOR] }, () => {
      visitBoard([buildAssignedNurse()]);
      cy.intercept("GET", "**/v1/users*", (req) => {
        const userType = req.query.userType as string | undefined;
        req.reply({
          statusCode: 200,
          body: { users: userType === "Senior" ? SENIORS : [] },
          delay: 1500,
        });
      });
      cy.openRowMenu("Judith Harper");
      sel.item("Assign Seniors").click();
      cy.contains("Loading...").should("be.visible");
    });

    it("sends nothing merely by opening", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      openAssignSeniors();
      cy.assertNoRequest("@saveAssignment");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Currently Assigned
  // ──────────────────────────────────────────────────────────────────────────

  describe("Currently Assigned", () => {
    it("shows a chip for each senior already assigned", () => {
      openAssignSeniors();
      sel.chips().should("contain.text", "Jake Harper");
      sel.chips().should("contain.text", "Teja Senior");
    });

    it("counts the assigned seniors", () => {
      openAssignSeniors();
      sel.assignedCount().should("have.text", "2 seniors");
    });

    it("shows each assigned senior's initials", () => {
      openAssignSeniors();
      sel.chip("Jake Harper").should("contain.text", "JH");
    });

    it("says so when a nurse cares for nobody", () => {
      openAssignSeniors(buildAssignedNurse([]));
      cy.contains("No seniors assigned yet.").should("be.visible");
      sel.assignedCount().should("have.text", "0 seniors");
    });

    it("reads plain id strings as an assignment", () => {
      openAssignSeniors(buildAssignedNurse([JAKE]));
      sel.chips().should("contain.text", "Jake Harper");
    });

    it("reads id objects as an assignment too", () => {
      // The API has returned both shapes; coerceInitialSelectedIds takes either.
      openAssignSeniors(
        buildAssignedNurse([{ userId: JAKE, userName: "Jake Harper" }])
      );
      sel.chips().should("contain.text", "Jake Harper");
      sel.assignedCount().should("have.text", "1 seniors");
    });

    it("removes a senior when their × is clicked", () => {
      openAssignSeniors();
      sel.chipRemove("Jake Harper").click();
      sel.chips().should("not.contain.text", "Jake Harper");
      sel.chips().should("contain.text", "Teja Senior");
    });

    it("drops the count when a senior is removed", () => {
      openAssignSeniors();
      sel.chipRemove("Jake Harper").click();
      sel.assignedCount().should("have.text", "1 seniors");
    });

    it("unticks the matching checkbox when a chip is removed", () => {
      openAssignSeniors();
      sel.checkbox(JAKE).should("be.checked");
      sel.chipRemove("Jake Harper").click();
      sel.checkbox(JAKE).should("not.be.checked");
    });

    it("falls back to the empty state when every chip is removed", () => {
      openAssignSeniors();
      sel.chipRemove("Jake Harper").click();
      sel.chipRemove("Teja Senior").click();
      cy.contains("No seniors assigned yet.").should("be.visible");
    });

    it("sends nothing when a chip is removed", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      openAssignSeniors();
      sel.chipRemove("Jake Harper").click();
      cy.assertNoRequest("@saveAssignment");
    });

    // A senior who has been soft-deleted but is still in `associatedUserIds`
    // stays assigned, as a nameless chip, and Save re-sends the id. That is a
    // bug rather than a decision, so the tests for the intended behaviour live
    // in known-defects.cy.ts.
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. All Seniors
  // ──────────────────────────────────────────────────────────────────────────

  describe("All Seniors", () => {
    beforeEach(() => openAssignSeniors());

    it("lists every active senior in the home", () => {
      ["Jake Harper", "Teja Senior", "Andrea Williams", "Sheldon Cooper", "Gary Gold"].forEach(
        (name) => sel.list().should("contain.text", name)
      );
    });

    it("leaves a deleted senior out of the list", () => {
      sel.list().should("not.contain.text", "Removed Resident");
    });

    it("offers a checkbox per senior", () => {
      sel.list().find('input[type="checkbox"]').should("have.length", 5);
    });

    it("pre-ticks the seniors already assigned", () => {
      sel.checkbox(JAKE).should("be.checked");
      sel.checkbox(TEJA).should("be.checked");
    });

    it("leaves the unassigned seniors unticked", () => {
      sel.checkbox(ANDREA).should("not.be.checked");
      sel.checkbox(GARY).should("not.be.checked");
    });

    it("highlights the row of a ticked senior", () => {
      sel.seniorRow("Jake Harper").should("have.class", "bg-[#f5f7ff]");
      sel.seniorRow("Andrea Williams").should("have.class", "bg-white");
    });

    it("adds a chip when a senior is ticked", () => {
      sel.checkbox(ANDREA).check();
      sel.chips().should("contain.text", "Andrea Williams");
      sel.assignedCount().should("have.text", "3 seniors");
    });

    it("removes the chip when a senior is unticked", () => {
      sel.checkbox(JAKE).uncheck();
      sel.chips().should("not.contain.text", "Jake Harper");
      sel.assignedCount().should("have.text", "1 seniors");
    });

    it("accepts several seniors at once", () => {
      sel.checkbox(ANDREA).check();
      sel.checkbox(SHELDON).check();
      sel.checkbox(GARY).check();
      sel.assignedCount().should("have.text", "5 seniors");
    });

    it("survives being ticked and unticked again", () => {
      sel.checkbox(ANDREA).check();
      sel.checkbox(ANDREA).uncheck();
      sel.assignedCount().should("have.text", "2 seniors");
      sel.chips().should("not.contain.text", "Andrea Williams");
    });

    it("sends nothing when a checkbox is ticked", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      sel.checkbox(ANDREA).check();
      cy.assertNoRequest("@saveAssignment");
    });

    it("says so when the home has no seniors at all", () => {
      openAssignSeniors(buildAssignedNurse([]), []);
      cy.contains("No seniors found.").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Search
  // ──────────────────────────────────────────────────────────────────────────

  describe("Search", () => {
    beforeEach(() => openAssignSeniors());

    it("starts empty", () => {
      sel.search().should("have.value", "");
    });

    it("narrows the list to a matching name", () => {
      sel.search().type("Andrea");
      sel.list().should("contain.text", "Andrea Williams");
      sel.list().should("not.contain.text", "Gary Gold");
    });

    it("matches on a partial name", () => {
      sel.search().type("Will");
      sel.list().should("contain.text", "Andrea Williams");
    });

    it("ignores case", () => {
      sel.search().type("aNdReA");
      sel.list().should("contain.text", "Andrea Williams");
    });

    it("matches a surname as well as a first name", () => {
      sel.search().type("Cooper");
      sel.list().should("contain.text", "Sheldon Cooper");
    });

    it("can match more than one senior", () => {
      sel.search().type("a");
      sel.list().find('input[type="checkbox"]').should("have.length.greaterThan", 1);
    });

    it("ignores surrounding whitespace", () => {
      sel.search().type("   Gary   ");
      sel.list().should("contain.text", "Gary Gold");
    });

    it("says so when nothing matches", () => {
      sel.search().type("Nobody At All");
      cy.contains("No seniors found.").should("be.visible");
    });

    it("restores the full list when the search is cleared", () => {
      sel.search().type("Andrea");
      sel.list().should("not.contain.text", "Gary Gold");
      sel.search().clear();
      sel.list().should("contain.text", "Gary Gold");
    });

    it("keeps the assigned chips while filtering", () => {
      sel.search().type("Andrea");
      sel.chips().should("contain.text", "Jake Harper");
      sel.assignedCount().should("have.text", "2 seniors");
    });

    it("lets a filtered senior be ticked", () => {
      sel.search().type("Gary");
      sel.checkbox(GARY).check();
      sel.chips().should("contain.text", "Gary Gold");
    });

    it("keeps a selection made under one search after the term changes", () => {
      sel.search().type("Gary");
      sel.checkbox(GARY).check();
      sel.search().clear().type("Sheldon");
      sel.chips().should("contain.text", "Gary Gold");
      sel.checkbox(SHELDON).check();
      sel.assignedCount().should("have.text", "4 seniors");
    });

    it("sends nothing while searching", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      sel.search().type("Andrea");
      cy.assertNoRequest("@saveAssignment");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Save Changes
  // ──────────────────────────────────────────────────────────────────────────

  describe("Save Changes", () => {
    it("saves the seniors that were added", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.have.members([
          JAKE,
          TEJA,
          ANDREA,
        ]);
      });
    });

    it("saves the seniors that were removed", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.chipRemove("Jake Harper").click();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.deep.eq([TEJA]);
      });
    });

    it("saves an empty assignment when every senior is removed", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.chipRemove("Jake Harper").click();
      sel.chipRemove("Teja Senior").click();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.deep.eq([]);
      });
    });

    it("PUTs to the nurse's own record", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.url).to.contain(JUDITH);
      });
    });

    it("keeps the rest of the nurse record intact", { tags: [Tags.NURSE] }, () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.name).to.eq("Judith Harper");
        expect(request.body.email).to.eq(JUDITH_EMAIL);
        expect(request.body.role).to.eq("Nurse");
      });
    });

    it("strips the fields the user endpoint rejects", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors(
        buildNurse(JUDITH, "Judith Harper", {
          associatedUserIds: [JAKE],
          lastLoginTimestamp: "2026-02-01T10:00:00.000Z",
          modifiedAt: "2026-02-02T10:00:00.000Z",
          clinical: { roomNumber: 1 },
        })
      );

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment").then(({ request }) => {
        ["modifiedAt", "clinical", "lastLoginTimestamp"].forEach((field) =>
          expect(request.body, `${field} omitted`).not.to.have.property(field)
        );
      });
    });

    it("confirms the assignment", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment");
      cy.assertPopover("Seniors assigned successfully");
    });

    it("closes the modal once saved", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment");
      cy.contains("All Seniors").should("not.exist");
    });

    it("saves an unchanged assignment rather than refusing", () => {
      // There is no dirty check: Save Changes always PUTs.
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.saveChanges().click();
      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.have.members([JAKE, TEJA]);
      });
    });

    it("reports a rejected save", () => {
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 500,
        body: { error: "Assignment failed" },
      }).as("saveAssignment");
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment");
      cy.assertPopover("Assignment failed");
    });

    it("falls back to its own message when the API gives no reason", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as(
        "saveAssignment"
      );
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();

      cy.wait("@saveAssignment");
      cy.assertPopover("Not able to assign seniors, please try again");
    });

    it("keeps the modal and the selection after a failed save", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as(
        "saveAssignment"
      );
      openAssignSeniors();

      sel.checkbox(ANDREA).check();
      sel.saveChanges().click();
      cy.wait("@saveAssignment");
      cy.dismissPopover();

      cy.contains("All Seniors").should("be.visible");
      sel.checkbox(ANDREA).should("be.checked");
    });

    it("refuses a nurse row with no userId", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      const nameless = buildAssignedNurse();
      delete (nameless as any).userId;
      openAssignSeniors(nameless);

      sel.saveChanges().click();
      cy.assertPopover("Unable to update nurse: missing nurse userId.");
      cy.assertNoRequest("@saveAssignment");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Cancel and reopening
  // ──────────────────────────────────────────────────────────────────────────

  describe("Cancel", () => {
    it("closes the modal", () => {
      openAssignSeniors();
      sel.cancel().click();
      cy.contains("All Seniors").should("not.exist");
    });

    it("sends nothing", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveAssignment");
      openAssignSeniors();
      sel.checkbox(ANDREA).check();
      sel.cancel().click();
      cy.assertNoRequest("@saveAssignment");
    });

    it("discards the changes it was cancelled on", () => {
      openAssignSeniors();
      sel.checkbox(ANDREA).check();
      sel.chipRemove("Jake Harper").click();
      sel.cancel().click();

      cy.openRowMenu("Judith Harper");
      sel.item("Assign Seniors").click();
      cy.contains("All Seniors").should("be.visible");

      sel.chips().should("contain.text", "Jake Harper");
      sel.chips().should("not.contain.text", "Andrea Williams");
      sel.assignedCount().should("have.text", "2 seniors");
    });

    it("clears the search when reopened", () => {
      openAssignSeniors();
      sel.search().type("Andrea");
      sel.cancel().click();

      cy.openRowMenu("Judith Harper");
      sel.item("Assign Seniors").click();
      sel.search().should("have.value", "");
      sel.list().should("contain.text", "Gary Gold");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a senior is searched for, assigned, and another dropped", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors();

      sel.search().type("Sheldon");
      sel.checkbox(SHELDON).check();
      sel.search().clear();
      sel.chipRemove("Teja Senior").click();
      sel.assignedCount().should("have.text", "2 seniors");

      sel.saveChanges().click();
      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.have.members([JAKE, SHELDON]);
      });
      cy.assertPopover("Seniors assigned successfully");
      cy.contains("All Seniors").should("not.exist");
    });

    it("E2E — a nurse with nobody assigned is given their first seniors", () => {
      cy.stubPut("/v1/user", "saveAssignment", 200, {});
      openAssignSeniors(buildAssignedNurse([]));

      cy.contains("No seniors assigned yet.").should("be.visible");
      sel.checkbox(ANDREA).check();
      sel.checkbox(GARY).check();
      sel.assignedCount().should("have.text", "2 seniors");

      sel.saveChanges().click();
      cy.wait("@saveAssignment").then(({ request }) => {
        expect(request.body.associatedUserIds).to.have.members([ANDREA, GARY]);
      });
    });

    it("E2E — a nurse is deleted and returns as an inactive row", () => {
      cy.stubDelete("/v1/user", "deleteNurse", 200, {});
      visitBoard([JUDITH_ROW, NURSE_TEST_ROW]);
      cy.contains("2 Team members").should("be.visible");

      cy.openRowMenu("Judith Harper");
      sel.item("Delete").click();

      // The API soft-deletes, so the refetch returns the same nurse flagged.
      stubUsersByType([
        buildNurse(JUDITH, "Judith Harper", { isDeleted: true }),
        NURSE_TEST_ROW,
      ]);
      sel.confirm().click();

      cy.wait("@deleteNurse");
      cy.assertPopover("Nurse Lead deleted successfully!");
      cy.dismissPopover();

      cy.contains("1 Team members", { timeout: 10000 }).should("be.visible");
      sel.row("Judith Harper").should("have.class", "opacity-50");
    });
  });
});
