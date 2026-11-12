/// <reference types="cypress" />

/**
 * CRM — Senior Leads row actions
 *
 * The kebab (⋮) menu at the end of every Senior Leads row, in
 * components/lead-action-cell.tsx. Five actions, each behind its own role
 * permission and each with its own confirmation step:
 *
 *   Onboard          POST /signup          invites the lead to register
 *   Move to Clinical PUT  /v1/clinical/user then PUT /v1/user, then routes away
 *   Initiate e-sign  POST /v1/initiate-esign
 *   Lost             PUT  /v1/user          adds the `lost` milestone + a category
 *   Delete           DELETE /v1/user/{id}
 *
 * The board itself (table, filter, Add New) is covered by senior-leads-board.cy.ts;
 * this spec is only about the menu and what each action sends.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserRow, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const CRM_PATH = "/crm";
const LEAD = "Jane Doe";

/** A lead that has never signed in — `lastLoginTimestamp` is what gates Onboard. */
const buildLead = (overrides: Record<string, any> = {}) =>
  buildUserRow({ name: LEAD, ...overrides });

const LOST_CATEGORIES = [
  "Family Chose Another",
  "Pricing",
  "Location",
  "Timing",
  "Clinical Fit",
  "Other",
];

const sel = {
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string | RegExp) =>
    cy.contains(
      "div",
      typeof label === "string" ? new RegExp(`^${label}$`) : label
    ),
  lostCategory: (category: string) =>
    cy.get(`input[name="lostCategory"][value="${category}"]`),
};

/** Seed a session, stub the board, and open the row menu on the only lead. */
const openMenu = (
  users: any[] = [buildLead()],
  opts: { home?: ReturnType<typeof buildHome>; role?: any; salesHome?: boolean } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  // "Lost" is gated on BOTH CRM_MARK_AS_LOST and the `isSalesRequired` cookie
  // (lead-action-cell.tsx:489, added after this spec was first written).
  //
  // Setting the cookie directly does NOT work: Layout refetches the home on
  // every page load and overwrites it with `home.isSalesRequired ?? false`
  // (components/layout.tsx:44). The flag has to come from the stubbed home.
  const salesHome = opts.salesHome !== false;
  const home = opts.home ?? buildHome();
  cy.stubHome({ home: { ...home.home, isSalesRequired: salesHome } } as any);
  cy.stubUsers(users);
  cy.visit(CRM_PATH);
  cy.wait("@getUsers");
  cy.openRowMenu(LEAD);
};

/** Open the menu and start an action, landing on its confirmation dialog. */
const startAction = (
  label: string,
  users: any[] = [buildLead()],
  opts: { home?: ReturnType<typeof buildHome>; role?: any } = {}
) => {
  openMenu(users, opts);
  sel.item(label).click();
};

describe("CRM — Senior Leads row actions", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The menu itself
  // ──────────────────────────────────────────────────────────────────────────

  describe("The menu", () => {
    it("offers all five actions to a PCHO", () => {
      openMenu();
      ["Onboard", "Move to Clinical", "Initiate e-sign", "Lost", "Delete"].forEach(
        (label) => sel.item(label).should("be.visible")
      );
    });

    it("opens the menu belonging to the row it was clicked on", () => {
      openMenu([buildLead(), buildUserRow({ userId: "lead-2", name: "Arthur Bean" })]);
      sel.item("Delete").should("be.visible");
    });

    it("greys out Onboard for a lead that has already signed in", () => {
      openMenu([buildLead({ lastLoginTimestamp: "2026-02-01T10:00:00.000Z" })]);
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("does nothing when a greyed-out Onboard is clicked", () => {
      openMenu([buildLead({ lastLoginTimestamp: "2026-02-01T10:00:00.000Z" })]);
      sel.item("Onboard").click();
      cy.contains("Are you sure you want to onboard this Senior Lead?").should(
        "not.exist"
      );
    });

    it("hides Move to Clinical when the home has no Clinical module", () => {
      openMenu([buildLead()], {
        home: buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT"] }),
      });
      sel.item("Move to Clinical").should("not.exist");
      sel.item("Onboard").should("be.visible");
    });

    it("leaves only Delete on a lead already marked lost", () => {
      openMenu([buildLead({ milestone: ["initial contact", "lost"] })]);
      sel.item("Delete").should("be.visible");
      ["Onboard", "Move to Clinical", "Initiate e-sign", "Lost"].forEach((label) =>
        sel.item(label).should("not.exist")
      );
    });

    it("hides Lost at a home that does not run sales", () => {
      // New gate: the whole lost-lead workflow is sales-only, so at a
      // non-sales home the action is absent even for a role that holds
      // CRM_MARK_AS_LOST.
      openMenu([buildLead()], { salesHome: false });
      sel.item("Lost").should("not.exist");
      sel.item("Delete").should("be.visible");
    });

    it("offers a Sales Representative only the action their role carries", () => {
      // utils/roles.ts: SalesRepresentative holds CRM_ACTIONS and
      // CRM_MARK_AS_LOST, but none of the onboard/e-sign/delete permissions.
      openMenu([buildLead()], { role: "SalesRepresentative" });
      sel.item("Lost").should("be.visible");
      ["Onboard", "Move to Clinical", "Initiate e-sign", "Delete"].forEach((label) =>
        sel.item(label).should("not.exist")
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Onboard
  // ──────────────────────────────────────────────────────────────────────────

  describe("Onboard", () => {
    it("asks for confirmation first", () => {
      startAction("Onboard");
      cy.contains("Are you sure you want to onboard this Senior Lead?").should(
        "be.visible"
      );
    });

    it("sends nothing until the action is confirmed", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction("Onboard");
      cy.assertNoRequest("@signup");
    });

    it("abandons the action on Cancel", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction("Onboard");
      sel.cancel().click();
      cy.assertNoRequest("@signup");
    });

    it("invites the lead to register", () => {
      cy.stubPost("/signup", "signup", 201, {});
      startAction("Onboard");
      sel.confirm().click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq("jane.doe@assistly.com");
        expect(request.body.role).to.eq("Lead");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("refuses to onboard a lead with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startAction("Onboard", [buildLead({ email: "" })]);
      sel.confirm().click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("reports a rejected signup", () => {
      cy.stubPost("/signup", "signup", 400, { error: "User already exists" });
      startAction("Onboard");
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("User already exists");
    });

    it("falls back to a generic message when the API sends an error array", () => {
      cy.stubPost("/signup", "signup", 400, { error: ["bad", "worse"] });
      startAction("Onboard");
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("Signup failed");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Move to Clinical
  // ──────────────────────────────────────────────────────────────────────────


  // ──────────────────────────────────────────────────────────────────────────
  // Home capacity
  //   components/lead-action-cell.tsx — added with feat/homecapacity
  //
  // A home can only hold so many residents. When the API refuses the move with
  // a 409, the confirmation modal does NOT close: it is retitled "Home
  // Capacity Reached!", swaps its body for the API's own message and offers a
  // Contact Support link. Every other status closes the menu and shows the
  // usual popover instead — so the status code, not the message, decides.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Move to Clinical — the home is full", () => {
    const CAPACITY_MESSAGE =
      "This home has reached its capacity of 12 residents.\\nRemove a resident or raise the limit to continue.";

    const stubCapacityRefusal = (statusCode = 409) => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode,
        body: { error: CAPACITY_MESSAGE },
      }).as("updateClinical");
      cy.stubPut("/v1/user", "updateCrm", 200, {});
    };

    const refuse = () => {
      stubCapacityRefusal();
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateClinical");
    };

    it("retitles the modal rather than closing it", () => {
      refuse();
      cy.contains("Home Capacity Reached!").should("be.visible");
    });

    it("keeps the modal open", () => {
      refuse();
      cy.get(".ReactModal__Content").should("exist");
    });

    it("shows the message the API sent", () => {
      refuse();
      cy.contains("This home has reached its capacity of 12 residents").should(
        "be.visible"
      );
    });

    it("renders an escaped newline as a line break", () => {
      // The message arrives with a literal backslash-n, which the component
      // turns into a real newline for `whitespace-pre-line`.
      refuse();
      cy.contains("Remove a resident or raise the limit").should("be.visible");
      cy.contains("\\n").should("not.exist");
    });

    it("drops the original confirmation question", () => {
      refuse();
      cy.contains(
        "Are you sure you want to move this Senior Lead to clinical?"
      ).should("not.exist");
    });

    it("offers a Contact Support link", () => {
      refuse();
      cy.contains("Contact Support").should("be.visible");
    });

    it("withholds the Confirm button — there is nothing to retry", () => {
      refuse();
      cy.contains("button", /^Confirm$/).should("not.exist");
    });

    it("never writes the CRM record", () => {
      // The CRM update only runs inside the clinical call's `onSuccess`, so a
      // refused move must not half-promote the lead.
      refuse();
      cy.assertNoRequest("@updateCrm");
    });

    it("stays on the CRM board", () => {
      refuse();
      cy.location("pathname").should("eq", CRM_PATH);
    });

    it("opens the support modal from the link", () => {
      refuse();
      cy.contains("Contact Support").click();
      cy.contains("Home Capacity Reached!").should("not.exist");
    });

    it("closes on the cross", () => {
      refuse();
      cy.get(".ReactModal__Content").find('div[class*="right-6"]').first().click();
      cy.contains("Home Capacity Reached!").should("not.exist");
    });

    it("falls back to its own wording when the API sends no message", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 409,
        body: {},
      }).as("updateClinical");
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateClinical");
      cy.contains("Clinical update failed").should("be.visible");
    });

    it("[as-built] ignores an array error and uses the fallback", () => {
      // `!Array.isArray(apiError) && apiError` — a validation array is
      // discarded rather than being joined and shown.
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 409,
        body: { error: ["capacity", "exceeded"] },
      }).as("updateClinical");
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateClinical");
      cy.contains("Clinical update failed").should("be.visible");
    });

    it("treats any other status as an ordinary failure", () => {
      // 500 closes the modal and falls through to the popover — only 409 is
      // the capacity case.
      cy.intercept("PUT", "**/v1/clinical/user/**", {
        statusCode: 500,
        body: { error: "Something went wrong" },
      }).as("updateClinical");
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateClinical");
      cy.contains("Home Capacity Reached!").should("not.exist");
      cy.assertPopover("Something went wrong");
    });

    it("catches a 409 from the CRM half too", () => {
      // The clinical record is already written by then, so this is the worse
      // of the two: the lead is half-promoted and the modal explains why.
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 409,
        body: { error: CAPACITY_MESSAGE },
      }).as("updateCrm");
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateCrm");
      cy.contains("Home Capacity Reached!").should("be.visible");
    });

    it("does not route away when the CRM half is refused", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 409,
        body: { error: CAPACITY_MESSAGE },
      }).as("updateCrm");
      startAction("Move to Clinical");
      sel.confirm().click();
      cy.wait("@updateCrm");
      cy.location("pathname").should("eq", CRM_PATH);
    });
  });

  describe("Move to Clinical", () => {
    const stubBothUpdates = () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      cy.stubPut("/v1/user", "updateCrm", 200, {});
    };

    it("asks for confirmation first", () => {
      startAction("Move to Clinical");
      cy.contains(
        "Are you sure you want to move this Senior Lead to clinical?"
      ).should("be.visible");
    });

    it("writes the clinical record before the CRM one", () => {
      stubBothUpdates();
      startAction("Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateClinical").then(({ request }) => {
        expect(request.body.userId).to.eq(buildLead().userId);
        // Defaults to "In Home" when the lead has no clinical record yet.
        expect(request.body.status).to.eq("In Home");
      });
      cy.wait("@updateCrm");
    });

    it("promotes the lead to Senior and stamps the contract", { tags: [Tags.SENIOR] }, () => {
      stubBothUpdates();
      startAction("Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateClinical");
      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.role).to.eq("Senior");
        expect(request.body.milestone).to.include("contract");
        expect(request.body.contractCompletedOn, "contractCompletedOn").to.match(
          /^\d{4}-\d{2}-\d{2}$/
        );
      });
    });

    it("keeps the lead's existing milestones", () => {
      stubBothUpdates();
      startAction("Move to Clinical", [
        buildLead({ milestone: ["initial contact", "tour"] }),
      ]);
      sel.confirm().click();

      cy.wait("@updateClinical");
      cy.wait("@updateCrm").then(({ request }) => {
        expect(request.body.milestone).to.include.members([
          "initial contact",
          "tour",
          "contract",
        ]);
      });
    });

    it("does not repeat a contract milestone the lead already holds", () => {
      stubBothUpdates();
      startAction("Move to Clinical", [
        buildLead({ milestone: ["initial contact", "contract"] }),
      ]);
      sel.confirm().click();

      cy.wait("@updateClinical");
      cy.wait("@updateCrm").then(({ request }) => {
        const contracts = request.body.milestone.filter((m: string) => m === "contract");
        expect(contracts, "contract milestone entries").to.have.length(1);
      });
    });

    it("confirms the move and lands on the clinical board", () => {
      stubBothUpdates();
      startAction("Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.assertPopover("Senior Lead moved to clincial!");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical");
    });

    it("stops at the clinical failure and never touches the CRM record", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 500, {
        error: "Clinical service unavailable",
      });
      cy.intercept("PUT", "**/v1/user/**").as("updateCrm");
      startAction("Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateClinical");
      cy.assertPopover("Clinical service unavailable");
      cy.assertNoRequest("@updateCrm");
      cy.location("pathname").should("eq", CRM_PATH);
    });

    it("reports a CRM failure that follows a clinical success", () => {
      cy.stubPut("/v1/clinical/user", "updateClinical", 200, {});
      cy.stubPut("/v1/user", "updateCrm", 500, { error: "CRM write failed" });
      startAction("Move to Clinical");
      sel.confirm().click();

      cy.wait("@updateCrm");
      cy.assertPopover("CRM write failed");
      cy.location("pathname").should("eq", CRM_PATH);
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");
      startAction("Move to Clinical");
      sel.cancel().click();
      cy.assertNoRequest("@updateClinical");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Initiate e-sign
  // ──────────────────────────────────────────────────────────────────────────

  describe("Initiate e-sign", () => {
    it("asks for confirmation first", () => {
      startAction("Initiate e-sign");
      cy.contains("Are you sure you want to initiate e-sign").should("be.visible");
    });

    it("names the home, the sender and the recipient", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 201, {});
      startAction("Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.senderUserId).to.eq(TEST_USER_ID);
        expect(request.body.recipientUserId).to.eq(buildLead().userId);
      });
      cy.assertPopover("E-sign initiated. Check dashboard for details.");
    });

    it("refuses a lead with no email address", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      startAction("Initiate e-sign", [buildLead({ email: "" })]);
      sel.confirm().click();

      cy.assertPopover("E-sign cannot be initiated without a recipient email.");
      cy.assertNoRequest("@esign");
    });

    it("refuses a contract that has already been signed", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      startAction("Initiate e-sign", [
        buildLead({ onboardingESignEnvelopeStatus: "completed" }),
      ]);
      sel.confirm().click();

      cy.assertPopover("This contract has already been signed.");
      cy.assertNoRequest("@esign");
    });

    it("refuses when the legacy docusign envelope is the completed one", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      startAction("Initiate e-sign", [
        buildLead({ docusignEnvelopeStatus: "completed" }),
      ]);
      sel.confirm().click();

      cy.assertPopover("This contract has already been signed.");
      cy.assertNoRequest("@esign");
    });

    it("translates a missing file into an instruction to edit the documents", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 400, { error: "File not found" });
      startAction("Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("Please edit all documents before starting e-sign.");
    });

    it("translates a missing recipient into the email message", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 400, {
        error: "Recipient email does not exist",
      });
      startAction("Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("E-sign cannot be initiated without a recipient email.");
    });

    it("falls back to a generic message for an unrecognised error", () => {
      cy.stubPost("/v1/initiate-esign", "esign", 500, { error: "boom" });
      startAction("Initiate e-sign");
      sel.confirm().click();

      cy.wait("@esign");
      cy.assertPopover("Error in initiating e-sign. Please try again.");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Lost
  // ──────────────────────────────────────────────────────────────────────────

  describe("Lost", () => {
    it("asks which category the lead was lost to", () => {
      startAction("Lost");
      cy.contains("Mark as Lost").should("be.visible");
      LOST_CATEGORIES.forEach((category) =>
        sel.lostCategory(category).should("exist")
      );
    });

    it("starts with no category chosen for a lead that has never been lost", () => {
      startAction("Lost");
      cy.get('input[name="lostCategory"]:checked').should("not.exist");
    });

    it("pre-selects the category the lead already carries", () => {
      startAction("Lost", [buildLead({ lostCategory: "Pricing" })]);
      sel.lostCategory("Pricing").should("be.checked");
    });

    it("refuses to confirm before a category is chosen", () => {
      cy.intercept("PUT", "**/v1/user/**").as("markLost");
      startAction("Lost");
      sel.confirm().click();

      cy.assertPopover("Please select a lost category.");
      cy.assertNoRequest("@markLost");
    });

    it("keeps the dialog open when the category is missing", () => {
      startAction("Lost");
      sel.confirm().click();
      cy.dismissPopover();
      cy.contains("Mark as Lost").should("be.visible");
    });

    it("marks the lead lost against the chosen category", () => {
      cy.stubPut("/v1/user", "markLost", 200, {});
      startAction("Lost");
      sel.lostCategory("Location").click();
      sel.confirm().click();

      cy.wait("@markLost").then(({ request }) => {
        expect(request.body.milestone).to.include("lost");
        expect(request.body.lostCategory).to.eq("Location");
      });
      cy.assertPopover("Senior Lead marked as lost.");
    });

    it("keeps the milestones the lead had already reached", () => {
      cy.stubPut("/v1/user", "markLost", 200, {});
      startAction("Lost", [buildLead({ milestone: ["initial contact", "tour"] })]);
      sel.lostCategory("Timing").click();
      sel.confirm().click();

      cy.wait("@markLost").then(({ request }) => {
        expect(request.body.milestone).to.include.members([
          "initial contact",
          "tour",
          "lost",
        ]);
      });
    });

    it("lets the category be changed before confirming", () => {
      cy.stubPut("/v1/user", "markLost", 200, {});
      startAction("Lost");
      sel.lostCategory("Pricing").click();
      sel.lostCategory("Other").click();
      sel.confirm().click();

      cy.wait("@markLost").then(({ request }) => {
        expect(request.body.lostCategory).to.eq("Other");
      });
    });

    it("reports a rejected update", () => {
      cy.stubPut("/v1/user", "markLost", 500, { error: "Update rejected" });
      startAction("Lost");
      sel.lostCategory("Pricing").click();
      sel.confirm().click();

      cy.wait("@markLost");
      cy.assertPopover("Update rejected");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("PUT", "**/v1/user/**").as("markLost");
      startAction("Lost");
      sel.lostCategory("Pricing").click();
      sel.cancel().click();
      cy.assertNoRequest("@markLost");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Delete", () => {
    it("asks for confirmation first", () => {
      startAction("Delete");
      cy.contains("Delete Lead").should("be.visible");
    });

    it("deletes the lead by id", () => {
      cy.stubDelete("/v1/user", "deleteLead", 200, {});
      startAction("Delete");
      sel.confirm().click();

      cy.wait("@deleteLead").then(({ request }) => {
        expect(request.url).to.contain(buildLead().userId);
      });
      cy.assertPopover("Senior Lead deleted successfully!");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteLead");
      startAction("Delete");
      sel.cancel().click();
      cy.assertNoRequest("@deleteLead");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteLead", 500, { error: "Delete failed" });
      startAction("Delete");
      sel.confirm().click();

      cy.wait("@deleteLead");
      cy.assertPopover("Delete failed");
    });

    it("still offers Delete on a lost lead", () => {
      cy.stubDelete("/v1/user", "deleteLead", 200, {});
      startAction("Delete", [buildLead({ milestone: ["initial contact", "lost"] })]);
      sel.confirm().click();

      cy.wait("@deleteLead");
      cy.assertPopover("Senior Lead deleted successfully!");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — an e-sign is refused for want of an email, then succeeds once one exists", () => {
      cy.intercept("POST", "**/v1/initiate-esign").as("esign");
      startAction("Initiate e-sign", [buildLead({ email: "" })]);
      sel.confirm().click();
      cy.assertPopover("E-sign cannot be initiated without a recipient email.");
      cy.assertNoRequest("@esign");
      cy.dismissPopover();

      // The lead comes back from the API with an address on the next refetch.
      cy.stubUsers([buildLead()]);
      cy.stubPost("/v1/initiate-esign", "esignRetry", 201, {});
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      cy.openRowMenu(LEAD);
      sel.item("Initiate e-sign").click();
      sel.confirm().click();
      cy.wait("@esignRetry");
      cy.assertPopover("E-sign initiated. Check dashboard for details.");
    });

    it("E2E — a lead is marked lost and the menu closes down to Delete", () => {
      cy.stubPut("/v1/user", "markLost", 200, {});
      startAction("Lost");
      sel.lostCategory("Clinical Fit").click();
      sel.confirm().click();
      cy.wait("@markLost");
      cy.assertPopover("Senior Lead marked as lost.");
      cy.dismissPopover();

      // Re-read the board with the lead now lost.
      cy.stubUsers([buildLead({ milestone: ["initial contact", "lost"] })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      cy.openRowMenu(LEAD);
      sel.item("Delete").should("be.visible");
      sel.item("Lost").should("not.exist");
    });
  });
});
