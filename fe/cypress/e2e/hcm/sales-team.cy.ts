/// <reference types="cypress" />

/**
 * Staff Management — Sales Team (pages/hcm/sales-team/index.tsx)
 *
 *   components/sales/sales-team-home-page.tsx     the table
 *   components/sales/sales-team-cell.tsx          the name cell
 *   components/sales/sales-team-action-cell.tsx   the ⋮ menu and Onboard
 *   components/compliance/assign-sales-director-modal.tsx  Assign Sales Reps
 *
 * THE SCREEN IS REACHABLE BUT NOT LINKED
 *   `/hcm/sales-team` is gated on `HCM_SALES_TEAM` EDIT, which PCHO holds — but
 *   it is not in the Staff Management sidebar, so nothing in the app navigates
 *   here. Every test below reaches it by URL, which is the only way a user can.
 *
 * TWO QUERIES, ONE LIST
 *   The page asks `/v1/users` twice — once for `SalesRepresentative`, once for
 *   `SalesDirector` — and concatenates the two, reps first. So the stub has to
 *   answer per `userType`, and "which order" is a real assertion rather than an
 *   accident of one response.
 *
 * The row menu differs by role: everyone gets **Onboard**, and only a
 * **SalesDirector** also gets **Assign Sales Reps**.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const SALES_TEAM = "/hcm/sales-team";

const REP_ID = "11111111-1111-4111-8111-111111111111";
const DIRECTOR_ID = "22222222-2222-4222-8222-222222222222";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const salesRep = (overrides: Record<string, any> = {}) => ({
  userId: REP_ID,
  name: "Rita Rep",
  email: "rita.rep@assistly.com",
  mobile: "5551110001",
  role: "SalesRepresentative",
  homeId: TEST_HOME_ID,
  ...overrides,
});

const salesDirector = (overrides: Record<string, any> = {}) => ({
  userId: DIRECTOR_ID,
  name: "Dora Director",
  email: "dora.director@assistly.com",
  mobile: "5552220002",
  role: "SalesDirector",
  homeId: TEST_HOME_ID,
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  heading: () => cy.contains("Sales Team"),
  count: () => cy.contains(/Team members$/),
  addNew: () => cy.contains("button", "Add New"),
  row: (text: string) => cy.contains(text).closest('div[class*="border-b"]'),
  modal: () => cy.get(".ReactModal__Content", { timeout: 10000 }),
};

// ── Setup ────────────────────────────────────────────────────────────────────

type VisitOpts = {
  role?: any;
  reps?: any[];
  directors?: any[];
  home?: any;
};

/**
 * Land on the sales team screen.
 *
 * `/v1/users` is answered per `userType` so the two queries stay separable —
 * `cy.stubUsers()` answers both with the same body, which would make the
 * ordering assertions meaningless.
 */
const visitSalesTeam = (opts: VisitOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());

  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    if (userType === "SalesRepresentative") {
      req.alias = "getReps";
      req.reply({ statusCode: 200, body: { users: opts.reps ?? [] } });
      return;
    }
    if (userType === "SalesDirector") {
      req.alias = "getDirectors";
      req.reply({ statusCode: 200, body: { users: opts.directors ?? [] } });
      return;
    }
    req.reply({ statusCode: 200, body: { users: [] } });
  }).as("getUsers");

  cy.visit(SALES_TEAM);
};

const stubOnboard = (statusCode = 200, body: any = {}) => {
  cy.intercept("POST", "**/signup", { statusCode, body }).as("signup");
};

// ═══════════════════════════════════════════════════════════════════════════

describe("Staff Management — Sales Team", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The two user queries", () => {
    it("asks for sales representatives", () => {
      visitSalesTeam();
      cy.wait("@getReps");
    });

    it("asks for sales directors", () => {
      visitSalesTeam();
      cy.wait("@getDirectors");
    });

    it("scopes the rep query to the signed-in user's home", () => {
      visitSalesTeam();
      cy.wait("@getReps");
      cy.assertQuery("@getReps", { homeId: TEST_HOME_ID });
    });

    it("scopes the director query to the home too", () => {
      visitSalesTeam();
      cy.wait("@getDirectors");
      cy.assertQuery("@getDirectors", { homeId: TEST_HOME_ID });
    });

    it("authenticates the rep query with the session id token", () => {
      visitSalesTeam();
      cy.wait("@getReps");
      cy.assertAuthorized("@getReps");
    });

    it("reads the home so the sidebar can resolve", () => {
      visitSalesTeam();
      cy.wait("@getHome");
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The screen", () => {
    beforeEach(() => {
      visitSalesTeam({ reps: [salesRep()], directors: [salesDirector()] });
      cy.wait("@getReps");
      cy.wait("@getDirectors");
    });

    it("renders the page heading", () => {
      sel.heading().should("be.visible");
    });

    it("counts the team members", () => {
      cy.contains("2 Team members").should("be.visible");
    });

    it("offers an Add New button", () => {
      sel.addNew().should("be.visible");
    });

    it("renders the four named columns", () => {
      ["Name", "Email", "Phone", "Role"].forEach((header) => {
        cy.contains(header).should("be.visible");
      });
    });
  });

  // ── The list ───────────────────────────────────────────────────────────────

  describe("The list", () => {
    it("lists a sales representative", () => {
      visitSalesTeam({ reps: [salesRep()] });
      cy.contains("Rita Rep").should("be.visible");
    });

    it("lists a sales director", () => {
      visitSalesTeam({ directors: [salesDirector()] });
      cy.contains("Dora Director").should("be.visible");
    });

    it("lists both together", () => {
      visitSalesTeam({ reps: [salesRep()], directors: [salesDirector()] });
      cy.contains("Rita Rep").should("be.visible");
      cy.contains("Dora Director").should("be.visible");
    });

    it("puts the representatives ahead of the directors", () => {
      visitSalesTeam({ reps: [salesRep()], directors: [salesDirector()] });
      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((r) => r.textContent ?? "");
        const rep = text.findIndex((t) => t.includes("Rita Rep"));
        const director = text.findIndex((t) => t.includes("Dora Director"));
        expect(rep, "the rep row").to.be.greaterThan(-1);
        expect(director, "the director row").to.be.greaterThan(rep);
      });
    });

    it("shows the email", () => {
      visitSalesTeam({ reps: [salesRep()] });
      sel.row("Rita Rep").should("contain.text", "rita.rep@assistly.com");
    });

    it("shows the phone number", () => {
      visitSalesTeam({ reps: [salesRep()] });
      sel.row("Rita Rep").should("contain.text", "5551110001");
    });

    it("spells out the representative role", () => {
      visitSalesTeam({ reps: [salesRep()] });
      sel.row("Rita Rep").should("contain.text", "Sales Representative");
    });

    it("spells out the director role", () => {
      visitSalesTeam({ directors: [salesDirector()] });
      sel.row("Dora Director").should("contain.text", "Sales Director");
    });

    it("shows a dash for a missing email", () => {
      visitSalesTeam({ reps: [salesRep({ email: undefined })] });
      sel.row("Rita Rep").should("contain.text", "-");
    });

    it("shows a dash for a missing phone number", () => {
      visitSalesTeam({ reps: [salesRep({ mobile: undefined })] });
      sel.row("Rita Rep").should("contain.text", "-");
    });

    it("truncates a long email", () => {
      const long = "a".repeat(40) + "@assistly.com";
      visitSalesTeam({ reps: [salesRep({ email: long })] });
      sel.row("Rita Rep").should("contain.text", long.substring(0, 30) + "...");
    });

    it("truncates a long name", () => {
      visitSalesTeam({ reps: [salesRep({ name: "Rita Ramona Rappaport-Smythe" })] });
      cy.contains("Rita Ramona Rap...").should("be.visible");
    });

    it("keeps the full name on a title attribute", () => {
      visitSalesTeam({ reps: [salesRep({ name: "Rita Ramona Rappaport-Smythe" })] });
      cy.get('[title="Rita Ramona Rappaport-Smythe"]').should("exist");
    });

    it("counts several members", () => {
      visitSalesTeam({
        reps: [salesRep({ userId: "a", name: "Rep One" }), salesRep({ userId: "b", name: "Rep Two" })],
        directors: [salesDirector()],
      });
      cy.contains("3 Team members").should("be.visible");
    });

    it("reads zero for an empty team", () => {
      visitSalesTeam({ reps: [], directors: [] });
      cy.contains("0 Team members").should("be.visible");
    });

    it("shows the table's empty message for an empty team", () => {
      visitSalesTeam({ reps: [], directors: [] });
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("still offers Add New with an empty team", () => {
      visitSalesTeam({ reps: [], directors: [] });
      sel.addNew().should("be.visible");
    });
  });

  // ── The row menu ───────────────────────────────────────────────────────────

  describe("The row menu", () => {
    it("offers Onboard for a representative", () => {
      visitSalesTeam({ reps: [salesRep()] });
      cy.openRowMenu("Rita Rep");
      cy.contains("Onboard").should("be.visible");
    });

    it("offers Onboard for a director", () => {
      visitSalesTeam({ directors: [salesDirector()] });
      cy.openRowMenu("Dora Director");
      cy.contains("Onboard").should("be.visible");
    });

    it("offers Assign Sales Reps only for a director", () => {
      visitSalesTeam({ directors: [salesDirector()] });
      cy.openRowMenu("Dora Director");
      cy.contains("Assign Sales Reps").should("be.visible");
    });

    it("withholds Assign Sales Reps from a representative", () => {
      visitSalesTeam({ reps: [salesRep()] });
      cy.openRowMenu("Rita Rep");
      cy.contains("Assign Sales Reps").should("not.exist");
    });

    it("offers no delete — a sales member cannot be removed here", () => {
      visitSalesTeam({ reps: [salesRep()] });
      cy.openRowMenu("Rita Rep");
      cy.contains("Delete").should("not.exist");
    });
  });

  // ── Onboarding ─────────────────────────────────────────────────────────────

  describe("Onboarding a member", () => {
    const openConfirm = (opts: VisitOpts = { reps: [salesRep()] }) => {
      visitSalesTeam(opts);
      stubOnboard();
      cy.openRowMenu(opts.reps?.[0]?.name ?? "Dora Director");
      cy.contains("Onboard").click();
    };

    it("asks for confirmation first", () => {
      openConfirm();
      cy.contains("Onboard Sales Team Member").should("be.visible");
    });

    it("explains that an email will be sent", () => {
      openConfirm();
      cy.contains("An email will be sent to the sales team member").should("be.visible");
    });

    it("offers Cancel and Confirm", () => {
      openConfirm();
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Confirm").should("be.visible");
    });

    it("sends nothing until Confirm is pressed", () => {
      openConfirm();
      cy.assertNoRequest("@signup");
    });

    it("sends nothing on Cancel", () => {
      openConfirm();
      cy.contains("button", "Cancel").click();
      cy.assertNoRequest("@signup");
    });

    it("closes on Cancel", () => {
      openConfirm();
      cy.contains("button", "Cancel").click();
      cy.contains("Onboard Sales Team Member").should("not.exist");
    });

    it("POSTs to /signup on Confirm", () => {
      openConfirm();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.method").should("eq", "POST");
    });

    it("sends the member's email", () => {
      openConfirm();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.body.email").should("eq", "rita.rep@assistly.com");
    });

    it("sends the member's role", () => {
      openConfirm();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.body.role").should("eq", "SalesRepresentative");
    });

    it("sends the director's role when onboarding a director", () => {
      openConfirm({ directors: [salesDirector()] });
      cy.contains("button", "Confirm").click();
      cy.wait("@signup").its("request.body.role").should("eq", "SalesDirector");
    });

    it("confirms with a popover", () => {
      openConfirm();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Onboarding email sent successfully.");
    });

    it("closes the confirmation afterwards", () => {
      openConfirm();
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.contains("Onboard Sales Team Member").should("not.exist");
    });

    it("reports a server error", () => {
      openConfirm();
      cy.intercept("POST", "**/signup", {
        statusCode: 500,
        body: { error: "Address already registered" },
      }).as("signup");
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Address already registered");
    });

    it("falls back to its own message when the server says nothing useful", () => {
      openConfirm();
      cy.intercept("POST", "**/signup", { statusCode: 500, body: {} }).as("signup");
      cy.contains("button", "Confirm").click();
      cy.wait("@signup");
      cy.assertPopover("Onboarding failed");
    });

    it("refuses to onboard a member with no email, without calling the API", () => {
      visitSalesTeam({ reps: [salesRep({ email: undefined })] });
      stubOnboard();
      cy.openRowMenu("Rita Rep");
      cy.contains("Onboard").click();
      cy.contains("button", "Confirm").click();
      cy.assertPopover("Onboarding unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────

  describe("Role gating", () => {
    it("lets a PCHO manage the sales team", () => {
      visitSalesTeam({ role: "PCHO", reps: [salesRep()] });
      sel.heading().should("be.visible");
    });

    it("redirects a PCG away — HCM_SALES_TEAM is not theirs", { tags: [Tags.PCG] }, () => {
      visitSalesTeam({ role: "PCG" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", SALES_TEAM);
    });

    it("redirects a Nurse away", { tags: [Tags.NURSE] }, () => {
      visitSalesTeam({ role: "Nurse" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", SALES_TEAM);
    });

    it("redirects a Lead away", () => {
      visitSalesTeam({ role: "Lead" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", SALES_TEAM);
    });
  });

  // ── Failure handling ───────────────────────────────────────────────────────

  describe("When the API fails", () => {
    it("still renders the screen when the rep query fails", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.intercept("GET", "**/v1/users*", (req) => {
        if (req.query.userType === "SalesRepresentative") {
          req.reply({ statusCode: 500, body: { error: "boom" } });
          return;
        }
        req.reply({ statusCode: 200, body: { users: [salesDirector()] } });
      }).as("getUsers");
      cy.visit(SALES_TEAM);

      sel.heading().should("be.visible");
      cy.contains("Dora Director").should("be.visible");
    });

    it("counts only what came back", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.intercept("GET", "**/v1/users*", (req) => {
        if (req.query.userType === "SalesRepresentative") {
          req.reply({ statusCode: 500, body: { error: "boom" } });
          return;
        }
        req.reply({ statusCode: 200, body: { users: [salesDirector()] } });
      }).as("getUsers");
      cy.visit(SALES_TEAM);

      cy.contains("1 Team members").should("be.visible");
    });
  });
});
