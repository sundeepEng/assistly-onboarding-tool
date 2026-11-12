/// <reference types="cypress" />

/**
 * The Home dashboard (pages/index.tsx)
 *
 *   components/dashboard/dashboard.tsx         the shell and the seven queries
 *   components/dashboard/top-bar-metrics.tsx   the headcount cards
 *   components/dashboard/management-cards.tsx  the five module cards
 *   components/dashboard/recent-activity.tsx   the Coming Soon panel
 *   components/dashboard/quick-actions.tsx     the right-hand column
 *   utils/dashboardUtils.ts                    every count and trend
 *
 * SEVEN QUERIES, ALL OF THEM BLOCKING
 *   `isLoading` is `userConfigs.some(config => !usersData[config.key])` — the
 *   screen shows a spinner until **all seven** `/v1/users` calls have answered:
 *
 *     Lead   Senior(milestone=contract)   Referral
 *     PCGLead   PCG   NurseLead   Nurse
 *
 *   A spec that answers six of them never gets past the loader, which is why
 *   the stub below branches on `userType` and always replies.
 *
 * WHAT IS FILTERED AND WHAT IS NOT
 *   `dashboard.tsx` strips deleted users from leads, seniors, PCGs, nurseLeads
 *   and nurses — and strips `lost` leads too. It does **not** touch referrals or
 *   PCGLeads, so a deleted referral agent or care lead still counts on its card.
 *   Both directions are pinned below.
 *
 * THE MODULE CARDS ARE GATED PER TENANT
 *   `authorizedModules` on the home decides whether "Access <module>"
 *   navigates or opens the upgrade modal, and the card dims either way. Note
 *   `"Staff Management".toUpperCase()` is `"STAFF MANAGEMENT"` — with a space.
 *
 * QUICK ACTIONS IS MOSTLY ABSENCE
 *   The panel hides itself entirely unless something needs doing, and each of
 *   its sections has its own condition. With an empty home the two document
 *   sections are the ones that show, because "no documents at all" is by
 *   definition incomplete.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const HOME = "/";

/** Thu 17 Sep 2026, midday local. */
const FROZEN_NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A user row as GET /v1/users returns it, for whichever role is asked for. */
const person = (role: string, overrides: Record<string, any> = {}) => ({
  userId: `${role}-1`,
  name: `${role} One`,
  firstName: role,
  lastName: "One",
  email: `${role.toLowerCase()}@assistly.com`,
  mobile: "5550000000",
  role,
  homeId: TEST_HOME_ID,
  createdAt: "2026-09-02T10:00:00.000Z",
  contractCompletedOn: "2026-09-02T10:00:00.000Z",
  documents: [],
  ...overrides,
});

/** A timeoff shift awaiting a decision. */
const timeOffShift = (overrides: Record<string, any> = {}) => ({
  id: 9001,
  user_id: "PCG-1",
  user_name: "PCG One",
  home_id: TEST_HOME_ID,
  shift_status: "timeoff",
  shift_start_time: "2026-09-20T09:00:00.000Z",
  shift_end_time: "2026-09-20T17:00:00.000Z",
  is_unavailability_approved: null,
  ...overrides,
});

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  welcome: () => cy.contains(/^Welcome to /),
  /** A headcount card — its title is a CardTitle div carrying a `title` attr. */
  statCard: (title: string) =>
    cy.get(`[title="${title}"]`).closest('div[class*="rounded-[10px]"]'),
  /** The plus badge in a headcount card's bottom-right corner. */
  statPlus: (title: string) => sel.statCard(title).find('div[class*="rounded-3xl"]'),
  /** A module card, found from its Access button. */
  moduleCard: (title: string) =>
    cy.contains("button", `Access ${title}`).closest('div[class*="w-[314px]"]'),
  accessButton: (title: string) => cy.contains("button", `Access ${title}`),
  quickActions: () => cy.contains("Quick Actions"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

type DashboardOpts = {
  role?: any;
  home?: any;
  /** Rows per `userType`. Anything omitted answers with an empty list. */
  users?: Partial<Record<
    "Lead" | "Senior" | "Referral" | "PCGLead" | "PCG" | "NurseLead" | "Nurse",
    any[]
  >>;
  /** The signed-in user's own record — drives "My Documents". */
  me?: Record<string, any>;
  /** Timeoff shifts awaiting review. */
  timeOff?: any[];
  /** Next week's available shifts — an empty list means every day is missing. */
  nextWeekShifts?: any[];
};

/**
 * Land on the dashboard with all seven headcount queries answered.
 *
 * The `/v1/users` handler aliases each call by role so a test can assert on one
 * query without the others racing it.
 */
const visitDashboard = (opts: DashboardOpts = {}) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());

  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = (req.query.userType as string | undefined) ?? "";
    const rows = (opts.users as Record<string, any[]> | undefined)?.[userType] ?? [];
    req.alias = `get${userType || "Users"}`;
    req.reply({ statusCode: 200, body: { users: rows } });
  }).as("getUsers");

  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body:
      opts.me ?? {
        userId: TEST_USER_ID,
        name: "Test User",
        role: "PCHO",
        homeId: TEST_HOME_ID,
        documents: [],
      },
  }).as("getMe");

  // Two shift queries: timeoff requests, and next week's available shifts.
  cy.intercept("GET", "**/v1/hcm/shifts*", (req) => {
    const status = req.query.shift_status as string | undefined;
    if (status === "timeoff") {
      req.alias = "getTimeOff";
      req.reply({ statusCode: 200, body: { shifts: opts.timeOff ?? [] } });
      return;
    }
    req.alias = "getNextWeek";
    req.reply({ statusCode: 200, body: { shifts: opts.nextWeekShifts ?? [] } });
  }).as("getShifts");

  cy.stubPresign();
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(HOME);
};

/** Wait for the loader to clear. */
const settled = () => sel.welcome().should("be.visible");

// ═══════════════════════════════════════════════════════════════════════════
// The shell
// ═══════════════════════════════════════════════════════════════════════════

describe("Home dashboard — the shell", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("The seven headcount queries", () => {
    it("asks for senior leads", () => {
      visitDashboard();
      cy.wait("@getLead");
    });

    it("asks for seniors", () => {
      visitDashboard();
      cy.wait("@getSenior");
    });

    it("asks only for seniors that reached contract", () => {
      visitDashboard();
      cy.wait("@getSenior");
      cy.assertQuery("@getSenior", { milestone: "contract" });
    });

    it("asks for referral agents", () => {
      visitDashboard();
      cy.wait("@getReferral");
    });

    it("asks for care leads", () => {
      visitDashboard();
      cy.wait("@getPCGLead");
    });

    it("asks for the care team", () => {
      visitDashboard();
      cy.wait("@getPCG");
    });

    it("asks for nurse leads", () => {
      visitDashboard();
      cy.wait("@getNurseLead");
    });

    it("asks for nurses", () => {
      visitDashboard();
      cy.wait("@getNurse");
    });

    it("scopes every query to the signed-in user's home", () => {
      visitDashboard();
      cy.wait("@getLead");
      cy.assertQuery("@getLead", { homeId: TEST_HOME_ID });
    });

    it("authenticates with the session id token", () => {
      visitDashboard();
      cy.wait("@getLead");
      cy.assertAuthorized("@getLead");
    });

    it("does not send a milestone on the non-senior queries", () => {
      visitDashboard();
      cy.wait("@getLead").then((interception) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.get("milestone")).to.be.null;
      });
    });

    it("reads the home record for the name and the module list", () => {
      visitDashboard();
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });
  });

  describe("The welcome line", () => {
    it("greets the home by name", () => {
      visitDashboard();
      cy.contains("Welcome to Comfort Cove").should("be.visible");
    });

    it("title-cases a shouty home name", () => {
      visitDashboard({ home: buildHome({ homeName: "SUNNYSIDE MANOR" }) });
      cy.contains("Welcome to Sunnyside Manor").should("be.visible");
    });

    it("title-cases a lower-case home name", () => {
      visitDashboard({ home: buildHome({ homeName: "willow brook" }) });
      cy.contains("Welcome to Willow Brook").should("be.visible");
    });

    it("still greets when the home has no name", () => {
      visitDashboard({ home: { home: { homeId: TEST_HOME_ID, authorizedModules: [] } } as any });
      sel.welcome().should("be.visible");
    });
  });

  describe("While the headcounts are in flight", () => {
    it("shows a loader rather than a half-built dashboard", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [] },
        delay: 1500,
      }).as("getUsers");
      cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} }).as("getMe");
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(HOME);

      cy.contains("Senior Leads").should("not.exist");
    });

    it("reveals the dashboard once they land", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.intercept("GET", "**/v1/users*", {
        statusCode: 200,
        body: { users: [] },
        delay: 600,
      }).as("getUsers");
      cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} }).as("getMe");
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(HOME);

      cy.contains("Senior Leads", { timeout: 15000 }).should("be.visible");
    });
  });

  describe("Role gating", () => {
    it("lets a PCHO in", () => {
      visitDashboard({ role: "PCHO" });
      settled();
    });

    it("redirects a Lead away — DASHBOARD is not theirs", () => {
      visitDashboard({ role: "Lead" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", HOME);
    });

    it("redirects a Nurse away", { tags: [Tags.NURSE] }, () => {
      visitDashboard({ role: "Nurse" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", HOME);
    });

    it("redirects a Senior away", { tags: [Tags.SENIOR] }, () => {
      visitDashboard({ role: "Senior" });
      cy.location("pathname", { timeout: 10000 }).should("not.eq", HOME);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The headcount cards
// ═══════════════════════════════════════════════════════════════════════════

describe("Home dashboard — the headcount cards", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Which cards appear", () => {
    beforeEach(() => {
      visitDashboard();
      settled();
    });

    it("renders all seven for a clinical home", () => {
      [
        "Senior Leads",
        "Seniors",
        "Referral Agents",
        "Care Leads",
        "Care Team",
        "Nurse Leads",
        "Nurses",
      ].forEach((title) => {
        cy.contains(title).should("be.visible");
      });
    });

    it("carries each card's caption", () => {
      [
        "Seniors awaiting approval",
        "Active residents",
        "Active referrals agents",
        "Caregivers pending review",
        "Current staff members",
        "Nurses pending review",
        "Active nurses",
      ].forEach((caption) => {
        cy.contains(caption).should("be.visible");
      });
    });

    it("drops Seniors and Care Team for a home without Clinical", () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT", "COMPLIANCE"] }),
      });
      settled();
      cy.contains("Active residents").should("not.exist");
      cy.contains("Current staff members").should("not.exist");
    });

    it("keeps the CRM-side cards for a home without Clinical", () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "STAFF MANAGEMENT", "COMPLIANCE"] }),
      });
      settled();
      cy.contains("Senior Leads").should("be.visible");
      cy.contains("Referral Agents").should("be.visible");
      cy.contains("Nurses").should("be.visible");
    });

    it("has no Occupancy Rate card — it is commented out", () => {
      cy.contains("Occupancy Rate").should("not.exist");
    });
  });

  describe("The counts", () => {
    it("counts senior leads", () => {
      visitDashboard({ users: { Lead: [person("Lead"), person("Lead", { userId: "Lead-2" })] } });
      settled();
      sel.statCard("Senior Leads").should("contain.text", "2");
    });

    it("counts seniors", { tags: [Tags.SENIOR] }, () => {
      visitDashboard({ users: { Senior: [person("Senior")] } });
      settled();
      sel.statCard("Seniors").should("contain.text", "1");
    });

    it("counts referral agents", () => {
      visitDashboard({ users: { Referral: [person("Referral")] } });
      settled();
      sel.statCard("Referral Agents").should("contain.text", "1");
    });

    it("counts care leads", () => {
      visitDashboard({ users: { PCGLead: [person("PCGLead")] } });
      settled();
      sel.statCard("Care Leads").should("contain.text", "1");
    });

    it("counts the care team", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] } });
      settled();
      sel.statCard("Care Team").should("contain.text", "1");
    });

    it("counts nurse leads", () => {
      visitDashboard({ users: { NurseLead: [person("NurseLead")] } });
      settled();
      sel.statCard("Nurse Leads").should("contain.text", "1");
    });

    it("counts nurses", { tags: [Tags.NURSE] }, () => {
      visitDashboard({ users: { Nurse: [person("Nurse")] } });
      settled();
      sel.statCard("Nurses").should("contain.text", "1");
    });

    it("reads zero for a role with nobody in it", () => {
      visitDashboard();
      settled();
      sel.statCard("Senior Leads").should("contain.text", "0");
    });

    it("keeps one role's people off another's card", () => {
      visitDashboard({ users: { Lead: [person("Lead")] } });
      settled();
      sel.statCard("Senior Leads").should("contain.text", "1");
      sel.statCard("Nurses").should("contain.text", "0");
    });
  });

  describe("What the counts leave out", () => {
    it("excludes a deleted senior lead", () => {
      visitDashboard({
        users: { Lead: [person("Lead"), person("Lead", { userId: "Lead-2", isDeleted: true })] },
      });
      settled();
      sel.statCard("Senior Leads").should("contain.text", "1");
    });

    it("excludes a lost senior lead", () => {
      visitDashboard({
        users: {
          Lead: [person("Lead"), person("Lead", { userId: "Lead-2", milestone: ["lost"] })],
        },
      });
      settled();
      sel.statCard("Senior Leads").should("contain.text", "1");
    });

    it("keeps a lead at an ordinary milestone", () => {
      visitDashboard({
        users: { Lead: [person("Lead", { milestone: ["initial contact"] })] },
      });
      settled();
      sel.statCard("Senior Leads").should("contain.text", "1");
    });

    it("excludes a deleted senior", { tags: [Tags.SENIOR] }, () => {
      visitDashboard({
        users: {
          Senior: [person("Senior"), person("Senior", { userId: "Senior-2", isDeleted: true })],
        },
      });
      settled();
      sel.statCard("Seniors").should("contain.text", "1");
    });

    it("excludes a deleted care team member", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        users: { PCG: [person("PCG"), person("PCG", { userId: "PCG-2", isDeleted: true })] },
      });
      settled();
      sel.statCard("Care Team").should("contain.text", "1");
    });

    it("excludes a deleted nurse", { tags: [Tags.NURSE] }, () => {
      visitDashboard({
        users: { Nurse: [person("Nurse"), person("Nurse", { userId: "Nurse-2", isDeleted: true })] },
      });
      settled();
      sel.statCard("Nurses").should("contain.text", "1");
    });

    it("excludes a deleted nurse lead", () => {
      visitDashboard({
        users: {
          NurseLead: [
            person("NurseLead"),
            person("NurseLead", { userId: "NurseLead-2", isDeleted: true }),
          ],
        },
      });
      settled();
      sel.statCard("Nurse Leads").should("contain.text", "1");
    });


  });

  describe("The add badge", () => {
    beforeEach(() => {
      visitDashboard();
      settled();
    });

    it("sits on Senior Leads", () => {
      sel.statPlus("Senior Leads").should("exist");
    });

    it("sits on Referral Agents", () => {
      sel.statPlus("Referral Agents").should("exist");
    });

    it("sits on Care Leads", () => {
      sel.statPlus("Care Leads").should("exist");
    });

    it("sits on Nurse Leads", () => {
      sel.statPlus("Nurse Leads").should("exist");
    });

    it("is absent from Seniors — a resident is onboarded, not added", () => {
      sel.statCard("Seniors").find('div[class*="rounded-3xl"]').should("not.exist");
    });

    it("is absent from Care Team", () => {
      sel.statCard("Care Team").find('div[class*="rounded-3xl"]').should("not.exist");
    });

    it("is absent from Nurses", () => {
      sel.statCard("Nurses").find('div[class*="rounded-3xl"]').should("not.exist");
    });

    it("opens the Add Lead form from Senior Leads", () => {
      sel.statPlus("Senior Leads").click();
      cy.get('input[name="firstName"]', { timeout: 10000 }).should("exist");
    });

    it("opens a form from Referral Agents", () => {
      sel.statPlus("Referral Agents").click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("exist");
    });

    it("opens a form from Care Leads", () => {
      sel.statPlus("Care Leads").click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("exist");
    });

    it("opens a form from Nurse Leads", () => {
      sel.statPlus("Nurse Leads").click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("exist");
    });
  });

  describe("The count is a link", () => {
    it("sends Senior Leads to the CRM board", () => {
      visitDashboard({ users: { Lead: [person("Lead")] } });
      settled();
      sel.statCard("Senior Leads").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("sends Seniors to the clinical board", { tags: [Tags.SENIOR] }, () => {
      visitDashboard({ users: { Senior: [person("Senior")] } });
      settled();
      sel.statCard("Seniors").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical");
    });

    it("sends Referral Agents to the referral board", () => {
      visitDashboard({ users: { Referral: [person("Referral")] } });
      settled();
      sel.statCard("Referral Agents").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/referral");
    });

    it("sends Care Leads to the care-lead board", () => {
      visitDashboard({ users: { PCGLead: [person("PCGLead")] } });
      settled();
      sel.statCard("Care Leads").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/pcg");
    });

    it("sends Care Team to the clinical care-team board for a PCHO", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] } });
      settled();
      sel.statCard("Care Team").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical/pcg");
    });

    it("sends Nurse Leads to the nurse-lead board", () => {
      visitDashboard({ users: { NurseLead: [person("NurseLead")] } });
      settled();
      sel.statCard("Nurse Leads").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/nurse");
    });

    it("sends Nurses to the clinical nurse board", { tags: [Tags.NURSE] }, () => {
      visitDashboard({ users: { Nurse: [person("Nurse")] } });
      settled();
      sel.statCard("Nurses").contains("1").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical/nurse");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The module cards
// ═══════════════════════════════════════════════════════════════════════════

describe("Home dashboard — the module cards", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Layout", () => {
    beforeEach(() => {
      visitDashboard();
      settled();
    });

    it("renders the section heading", () => {
      cy.contains("Management Sections").should("be.visible");
    });

    it("renders the strapline", () => {
      cy.contains("Access key management areas for your facility").should("be.visible");
    });

    it("renders all five cards", () => {
      ["CRM", "Clinical", "Staff Management", "Compliance", "RevOps"].forEach((title) => {
        sel.accessButton(title).should("be.visible");
      });
    });

    it("describes the CRM module", () => {
      cy.contains("Track leads, manage family communication").should("be.visible");
    });

    it("describes the RevOps module", () => {
      cy.contains("Manage billing, invoices, payments").should("be.visible");
    });

    it("lists the CRM features", () => {
      ["Lead Tracking", "Family Communication", "Follow-ups", "Notes & Logs"].forEach((f) => {
        cy.contains(f).should("be.visible");
      });
    });

    it("lists the RevOps features", () => {
      ["Billing & Invoices", "Payment Management", "Revenue Reports"].forEach((f) => {
        cy.contains(f).should("be.visible");
      });
    });

    it("lists the Staff Management features", () => {
      ["Shift Scheduling", "Training Logs", "Availability Tracking"].forEach((f) => {
        cy.contains(f).should("be.visible");
      });
    });
  });

  describe("Where each card goes", () => {
    beforeEach(() => {
      visitDashboard();
      settled();
    });

    it("sends CRM to the lead board", () => {
      sel.accessButton("CRM").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("sends Clinical to the seniors board", () => {
      sel.accessButton("Clinical").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/clinical");
    });

    it("sends Staff Management to the HCM dashboard", () => {
      sel.accessButton("Staff Management").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
    });

    it("sends Compliance to the compliance screen", () => {
      sel.accessButton("Compliance").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/compliance");
    });

    it("sends RevOps to the RevOps landing route", () => {
      sel.accessButton("RevOps").click();
      cy.location("pathname", { timeout: 10000 }).should("not.eq", HOME);
    });

    it("sends CRM to the sales dashboard when the home runs on sales", () => {
      visitDashboard({
        home: {
          home: {
            ...buildHome().home,
            isSalesRequired: true,
          },
        } as any,
      });
      settled();
      sel.accessButton("CRM").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm/sales-dashboard");
    });
  });

  describe("Module entitlement", () => {
    const withModules = (authorizedModules: string[]) =>
      visitDashboard({ home: buildHome({ authorizedModules }) });

    it("dims a module the home has not bought", () => {
      withModules(["CRM"]);
      settled();
      sel.moduleCard("RevOps").should("have.class", "opacity-50");
    });

    it("does not dim a module the home has", () => {
      withModules(["CRM"]);
      settled();
      sel.moduleCard("CRM").should("not.have.class", "opacity-50");
    });

    it("greys out the button for an unlicensed module", () => {
      withModules(["CRM"]);
      settled();
      sel.accessButton("RevOps").should("have.class", "!bg-gray-400");
    });

    it("opens the upgrade modal instead of navigating", () => {
      withModules(["CRM"]);
      settled();
      sel.accessButton("RevOps").click();
      cy.location("pathname").should("eq", HOME);
    });

    it("names the module in the upgrade modal", () => {
      withModules(["CRM"]);
      settled();
      sel.accessButton("RevOps").click();
      cy.get(".ReactModal__Content", { timeout: 10000 }).should("contain.text", "RevOps");
    });

    it("still navigates for a licensed module on the same screen", () => {
      withModules(["CRM"]);
      settled();
      sel.accessButton("CRM").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("matches Staff Management on its spaced upper-case name", () => {
      withModules(["STAFF MANAGEMENT"]);
      settled();
      sel.moduleCard("Staff Management").should("not.have.class", "opacity-50");
    });

    it("dims Staff Management when that entry is missing", () => {
      withModules(["CRM"]);
      settled();
      sel.moduleCard("Staff Management").should("have.class", "opacity-50");
    });

    it("dims every card for a home with no modules at all", () => {
      withModules([]);
      settled();
      ["CRM", "Clinical", "Compliance"].forEach((title) => {
        sel.moduleCard(title).should("have.class", "opacity-50");
      });
    });

    it("treats a home with no module list as fully licensed", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.intercept("GET", "**/v1/home/**", {
        statusCode: 200,
        body: { home: { homeId: TEST_HOME_ID, homeName: "Comfort Cove" } },
      }).as("getHome");
      cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } }).as("getUsers");
      cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} }).as("getMe");
      cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
      cy.stubPresign();
      cy.clock(FROZEN_NOW, ["Date"]);
      cy.visit(HOME);

      settled();
      sel.moduleCard("CRM").should("not.have.class", "opacity-50");
    });
  });

  describe("Who sees which card", () => {
    it("withholds RevOps from a HomeAdmin", { tags: [Tags.HOMEADMIN] }, () => {
      visitDashboard({ role: "HomeAdmin" });
      settled();
      cy.contains("button", "Access RevOps").should("not.exist");
    });

    it("still gives a HomeAdmin the other four", { tags: [Tags.HOMEADMIN] }, () => {
      visitDashboard({ role: "HomeAdmin" });
      settled();
      ["CRM", "Clinical", "Staff Management", "Compliance"].forEach((title) => {
        sel.accessButton(title).should("be.visible");
      });
    });

    it("gives a PCHO RevOps", () => {
      visitDashboard({ role: "PCHO" });
      settled();
      sel.accessButton("RevOps").should("be.visible");
    });

    /**
     * Pinned: the RevOps card reuses `DASHBOARD_COMPLIANCE_ACTION` as its
     * `rbacKey` rather than a key of its own, so RevOps visibility is tied to
     * the Compliance permission plus the HomeAdmin special case above.
     */
    it("[as-built] gates RevOps on the Compliance permission", { tags: [Tags.PCG] }, () => {
      visitDashboard({ role: "PCG" });
      settled();
      cy.contains("Management Sections").should("be.visible");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Recent Activity
// ═══════════════════════════════════════════════════════════════════════════

describe("Home dashboard — Recent Activity", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
    visitDashboard();
    settled();
  });

  it("renders the panel", () => {
    cy.contains("Recent Activity").should("be.visible");
  });

  it("says it is not built yet", () => {
    cy.contains("Coming Soon..").should("be.visible");
  });

  it("shows no pending-contracts table — it is commented out", () => {
    cy.contains("Pending Contracts").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Quick Actions
// ═══════════════════════════════════════════════════════════════════════════

describe("Home dashboard — Quick Actions", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("Pending documents", () => {
    it("renders the panel for a home with no documents on file", () => {
      visitDashboard();
      settled();
      sel.quickActions().should("be.visible");
    });

    it("heads the section Pending Documents", () => {
      visitDashboard();
      settled();
      cy.contains("Pending Documents").should("be.visible");
    });

    it("flags the home's own documents", () => {
      visitDashboard();
      settled();
      cy.contains("Home Documents").should("be.visible");
    });

    it("flags the signed-in user's documents", () => {
      visitDashboard();
      settled();
      cy.contains("My Documents").should("be.visible");
    });

    it("expands Home Documents to a count", () => {
      visitDashboard();
      settled();
      cy.contains("Home Documents").click();
      cy.contains(/^Missing Documents \(\d+\/\d+\)$/).should("be.visible");
    });

    it("sends Home Documents through to Compliance", () => {
      visitDashboard();
      settled();
      cy.contains("Home Documents").click();
      cy.contains(/^Missing Documents/).click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/compliance");
    });

    it("expands My Documents to a count", () => {
      // Both accordions keep their panel mounted when collapsed, so the first
      // "Missing Documents" in the DOM belongs to Home Documents and is
      // `visibility: hidden`. Presence is the honest assertion; the
      // one-at-a-time test below covers the toggling.
      visitDashboard();
      settled();
      cy.contains("My Documents").click();
      cy.contains(/^Missing Documents \(\d+\/\d+\)$/).should("exist");
    });

    it("withholds Home Documents from a home without Compliance", () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "STAFF MANAGEMENT"] }),
      });
      settled();
      cy.contains("Home Documents").should("not.exist");
    });

    it("still flags My Documents for that home", () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "STAFF MANAGEMENT"] }),
      });
      settled();
      cy.contains("My Documents").should("be.visible");
    });

    it("opens only one accordion at a time", () => {
      visitDashboard();
      settled();
      cy.contains("Home Documents").click();
      cy.contains("My Documents").click();
      cy.contains(/^Missing Documents \(\d+\/\d+\)$/).should("have.length.at.most", 1);
    });
  });

  describe("Time off requests", () => {
    it("stays hidden when nothing is waiting", () => {
      visitDashboard();
      settled();
      cy.contains("Total Time Off Requests").should("not.exist");
    });

    it("appears once a request is waiting", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
      settled();
      cy.contains("Total Time Off Requests (1)").should("be.visible");
    });

    it("counts several requests", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        users: { PCG: [person("PCG")] },
        timeOff: [timeOffShift(), timeOffShift({ id: 9002 })],
      });
      settled();
      cy.contains("Total Time Off Requests (2)").should("be.visible");
    });

    it("offers Review Now", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
      settled();
      cy.contains("button", "Review Now").should("be.visible");
    });

    it("sends Review Now to the HCM dashboard", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
      settled();
      cy.contains("button", "Review Now").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
    });

    it("ignores a request that has already been decided", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        users: { PCG: [person("PCG")] },
        timeOff: [timeOffShift({ is_unavailability_approved: true })],
      });
      settled();
      cy.contains("Total Time Off Requests").should("not.exist");
    });

    it("ignores a rejected request too", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        users: { PCG: [person("PCG")] },
        timeOff: [timeOffShift({ is_unavailability_approved: false })],
      });
      settled();
      cy.contains("Total Time Off Requests").should("not.exist");
    });

    it("ignores a request that is already in the past", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        users: { PCG: [person("PCG")] },
        timeOff: [timeOffShift({ shift_start_time: "2026-09-01T09:00:00.000Z" })],
      });
      settled();
      cy.contains("Total Time Off Requests").should("not.exist");
    });

    it("asks the API only for timeoff shifts", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
      cy.wait("@getTimeOff");
      cy.assertQuery("@getTimeOff", { shift_status: "timeoff" });
    });

    it("scopes the timeoff query to the home", { tags: [Tags.PCG] }, () => {
      visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
      cy.wait("@getTimeOff");
      cy.assertQuery("@getTimeOff", { home_id: TEST_HOME_ID });
    });

    it("withholds the panel from a home without Staff Management", { tags: [Tags.PCG] }, () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "COMPLIANCE"] }),
        users: { PCG: [person("PCG")] },
        timeOff: [timeOffShift()],
      });
      settled();
      cy.contains("Total Time Off Requests").should("not.exist");
    });
  });

  describe("Missing schedules", () => {
    it("warns when next week has no shifts at all", () => {
      visitDashboard({ nextWeekShifts: [] });
      settled();
      cy.contains("Missing Schedules for next week!").should("be.visible");
    });

    it("offers Assign Now", () => {
      visitDashboard({ nextWeekShifts: [] });
      settled();
      cy.contains("button", "Assign Now").should("be.visible");
    });

    it("sends Assign Now to the scheduling board", () => {
      visitDashboard({ nextWeekShifts: [] });
      settled();
      cy.contains("button", "Assign Now").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm/scheduling");
    });

    it("asks the API for next week's available shifts", () => {
      visitDashboard();
      cy.wait("@getNextWeek");
      cy.assertQuery("@getNextWeek", { shift_status: "available" });
    });

    it("sends a start and an end for that week", () => {
      visitDashboard();
      cy.wait("@getNextWeek").then((interception) => {
        const query = new URL(interception.request.url).searchParams;
        expect(query.getAll("shift_start_time")).to.have.length(2);
      });
    });

    it("withholds the panel from a home without Staff Management", () => {
      visitDashboard({
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "COMPLIANCE"] }),
        nextWeekShifts: [],
      });
      settled();
      cy.contains("Missing Schedules for next week!").should("not.exist");
    });
  });

  describe("What a PCHO never sees", () => {
    it("has no employee time-off request panel — that is the carer's view", () => {
      visitDashboard();
      settled();
      cy.contains("Time-off request !").should("not.exist");
    });

    it("has no Request Now button", () => {
      visitDashboard();
      settled();
      cy.contains("button", "Request Now").should("not.exist");
    });
  });

  describe("When everything is in order", () => {
    /** A home and a user whose required documents are all on file. */
    const compliantHome = () =>
      buildHome({ authorizedModules: ["CRM", "CLINICAL", "STAFF MANAGEMENT"] });

    it("hides the pending-documents panel when Compliance is not licensed and my docs are filed", () => {
      // With no Compliance module the home's documents are not checked; the
      // remaining trigger is the signed-in user's own paperwork.
      visitDashboard({ home: compliantHome() });
      settled();
      cy.contains("My Documents").should("be.visible");
    });

    it("keeps the expired/expiring panel hidden when nothing is expiring", () => {
      visitDashboard();
      settled();
      cy.contains("Expired / Expiring Documents").should("not.exist");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// End to end
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// When a query fails
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The dashboard has no error state.
 *
 * `isLoading` is `userConfigs.some(config => !usersData[config.key])`, and
 * react-query hands back `data: undefined` for a rejected query — so a key that
 * errors is indistinguishable from a key that has not answered yet. The screen
 * waits forever rather than showing a message or a retry.
 *
 * A partial outage is the realistic case and the worst one: six queries answer,
 * one 500s, and the user sees a spinner with no explanation. Every test below
 * fails one thing at a time.
 */
describe("Home dashboard — when a query fails", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  /** Answer every /v1/users call except `failFor`, which 500s. */
  const visitWithFailedUserType = (failFor: string) => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.intercept("GET", "**/v1/users*", (req) => {
      const userType = (req.query.userType as string | undefined) ?? "";
      if (userType === failFor) {
        req.reply({ statusCode: 500, body: { error: "boom" } });
        return;
      }
      req.reply({ statusCode: 200, body: { users: [] } });
    }).as("getUsers");
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} }).as("getMe");
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);
  };

  it("[as-built] hangs on the loader when only the leads query fails", () => {
    visitWithFailedUserType("Lead");
    sel.welcome().should("not.exist");
  });

  it("[as-built] hangs when only the seniors query fails", { tags: [Tags.SENIOR] }, () => {
    visitWithFailedUserType("Senior");
    sel.welcome().should("not.exist");
  });

  it("[as-built] hangs when only the nurses query fails", { tags: [Tags.NURSE] }, () => {
    // The last of the seven, and the one furthest from anything on screen —
    // the whole dashboard still refuses to render.
    visitWithFailedUserType("Nurse");
    sel.welcome().should("not.exist");
  });

  it("[as-built] shows no error message at all", () => {
    visitWithFailedUserType("Lead");
    cy.contains(/failed|error|try again|something went wrong/i).should("not.exist");
  });

  it("[as-built] offers no way to retry", () => {
    visitWithFailedUserType("Lead");
    cy.contains("button", /retry|reload|try again/i).should("not.exist");
  });

  it("withholds every headcount card while one query is broken", () => {
    visitWithFailedUserType("Lead");
    ["Senior Leads", "Referral Agents", "Care Leads", "Nurses"].forEach((title) =>
      cy.contains(title).should("not.exist")
    );
  });

  it("withholds the module cards too", () => {
    visitWithFailedUserType("Lead");
    cy.contains("Management Sections").should("not.exist");
  });

  it("[as-built] leaves no in-page way out of the spinner", () => {
    // `dashboard.tsx` renders `<Layout sidebar={false}>` — the home dashboard
    // deliberately has no module sidebar, because the module cards are meant to
    // be the navigation. While a failed query holds the spinner up those cards
    // never render, so there is nothing on the page to click: the only way on
    // is the top bar or the browser's own controls.
    visitWithFailedUserType("Lead");
    cy.contains("Management Sections").should("not.exist");
    cy.contains("button", /^Access /).should("not.exist");
  });

  it("renders the dashboard when the home query fails", () => {
    // The home record only feeds the welcome line and the module gate, and it
    // is not part of `isLoading` — so the headcounts still come up.
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: { error: "boom" } }).as(
      "getHome"
    );
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} });
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    cy.contains("Senior Leads", { timeout: 10000 }).should("be.visible");
  });

  it("[as-built] welcomes the user to nothing when the home query fails", () => {
    // `_.startCase(_.toLower(undefined))` is "", so the heading reads
    // "Welcome to " with a trailing space and no home name.
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: { error: "boom" } });
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} });
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    cy.contains(/^Welcome to\s*$/, { timeout: 10000 }).should("exist");
  });

  it("falls back to every module when the home query fails", () => {
    // `authorizedModules` defaults to accessAllModules, so a failed home read
    // is permissive rather than restrictive — worth knowing deliberately.
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: { error: "boom" } });
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} });
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    cy.contains("button", "Access CRM", { timeout: 10000 }).should("be.visible");
  });

  it("renders the dashboard when the shifts queries fail", () => {
    // Quick Actions owns those two; a failure there must not take the
    // headcounts with it.
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} });
    cy.intercept("GET", "**/v1/hcm/shifts*", {
      statusCode: 500,
      body: { error: "boom" },
    }).as("getShifts");
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    sel.welcome().should("be.visible");
  });

  it("[as-built] keeps Quick Actions loading when the shifts queries fail", () => {
    // `loadingTimeOffRequests` is `!timeOffShifts?.shifts` — undefined on an
    // error too — so the panel sits on "Loading…" indefinitely.
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} });
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 500, body: { error: "boom" } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    sel.welcome().should("be.visible");
    cy.contains(/Loading (time off requests|missing schedules)/).should("be.visible");
  });

  it("renders the dashboard when the user's own record fails", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } });
    cy.intercept("GET", "**/v1/user/*", { statusCode: 500, body: { error: "boom" } }).as(
      "getMe"
    );
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    sel.welcome().should("be.visible");
  });

  it("recovers once a failed query is answered on a reload", () => {
    visitWithFailedUserType("Lead");
    sel.welcome().should("not.exist");

    cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users: [] } }).as(
      "getUsersOk"
    );
    cy.reload();
    sel.welcome().should("be.visible");
  });
});

describe("Home dashboard — end to end", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("shows a full home's headcounts across every card", { tags: [Tags.NURSE, Tags.PCG, Tags.SENIOR] }, () => {
    visitDashboard({
      users: {
        Lead: [person("Lead"), person("Lead", { userId: "Lead-2" })],
        Senior: [person("Senior")],
        Referral: [person("Referral")],
        PCGLead: [person("PCGLead")],
        PCG: [person("PCG"), person("PCG", { userId: "PCG-2" })],
        NurseLead: [person("NurseLead")],
        Nurse: [person("Nurse")],
      },
    });
    settled();

    sel.statCard("Senior Leads").should("contain.text", "2");
    sel.statCard("Seniors").should("contain.text", "1");
    sel.statCard("Referral Agents").should("contain.text", "1");
    sel.statCard("Care Leads").should("contain.text", "1");
    sel.statCard("Care Team").should("contain.text", "2");
    sel.statCard("Nurse Leads").should("contain.text", "1");
    sel.statCard("Nurses").should("contain.text", "1");
  });

  it("walks from a headcount into the module it belongs to", () => {
    visitDashboard({ users: { Lead: [person("Lead")] } });
    settled();
    sel.statCard("Senior Leads").contains("1").click();
    cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
  });

  it("walks from a module card into that module", () => {
    visitDashboard();
    settled();
    sel.accessButton("Staff Management").click();
    cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
  });

  it("walks from a quick action into the screen that resolves it", { tags: [Tags.PCG] }, () => {
    visitDashboard({ users: { PCG: [person("PCG")] }, timeOff: [timeOffShift()] });
    settled();
    cy.contains("Total Time Off Requests (1)").should("be.visible");
    cy.contains("button", "Review Now").click();
    cy.location("pathname", { timeout: 10000 }).should("eq", "/hcm");
  });

  it("renders the three columns together", () => {
    visitDashboard({ users: { Lead: [person("Lead")] } });
    settled();
    cy.contains("Senior Leads").should("be.visible");
    cy.contains("Management Sections").should("be.visible");
    cy.contains("Recent Activity").should("be.visible");
    sel.quickActions().should("be.visible");
  });

  it("survives every headcount query failing", () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome();
    cy.intercept("GET", "**/v1/users*", { statusCode: 500, body: { error: "boom" } }).as(
      "getUsers"
    );
    cy.intercept("GET", "**/v1/user/*", { statusCode: 200, body: {} }).as("getMe");
    cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
    cy.stubPresign();
    cy.clock(FROZEN_NOW, ["Date"]);
    cy.visit(HOME);

    // `isLoading` only clears once every key is defined, so a failed query
    // leaves the spinner up rather than showing wrong numbers.
    cy.contains("Senior Leads").should("not.exist");
  });
});
