/**
 * Staff Management — who can see and do what
 *
 *   utils/roleAccess.ts   hasAccess, getInitialRoute
 *   utils/roles.ts        the permission lists themselves
 *
 * Every gate in the module is `hasAccess(role, FEATURE, ACCESS)`, and the
 * Cypress specs lean on this matrix constantly — the HomeAdmin fixtures, the
 * PCG fixtures and the two dashboards are all chosen from it. Pinning it here
 * means a permission moved in `roles.ts` fails one obvious test rather than
 * a dozen opaque end-to-end ones.
 *
 * THE RULE THAT CATCHES PEOPLE
 *   `hasAccess` checks the exact list for the exact access level. **EDIT does
 *   not imply VIEW**, and VIEW does not imply EDIT. A feature granted only as
 *   VIEW fails an EDIT check, which is precisely how the Care Team roster
 *   drops two columns for a HomeAdmin.
 *
 * Each block below states the gate it is protecting, so a failure says which
 * screen changed rather than just which string moved.
 */

import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";

// ─── The mechanism ───────────────────────────────────────────────────────────

describe("hasAccess", () => {
  it("grants a feature the role holds at that level", () => {
    expect(hasAccess("PCHO", "HCM_SCHEDULING", "EDIT")).toBe(true);
  });

  it("refuses a feature the role does not hold", () => {
    expect(hasAccess("Lead", "HCM_SCHEDULING", "EDIT")).toBe(false);
  });

  it("refuses everything when there is no role", () => {
    expect(hasAccess(undefined, "HCM_SCHEDULING", "EDIT")).toBe(false);
  });

  it("refuses a role it has never heard of", () => {
    expect(hasAccess("Janitor" as Role, "HCM_SCHEDULING", "EDIT")).toBe(false);
  });

  it("does not let EDIT stand in for VIEW", () => {
    // HomeAdmin holds HCM_TEAM_ROASTER as VIEW only.
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", "VIEW")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", "EDIT")).toBe(false);
  });

  it("accepts either level when handed both", () => {
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", ["VIEW", "EDIT"])).toBe(true);
  });

  it("still refuses when it holds neither of two levels", () => {
    expect(hasAccess("Lead", "HCM_TEAM_ROASTER", ["VIEW", "EDIT"])).toBe(false);
  });

  it("refuses a feature that does not exist", () => {
    expect(hasAccess("PCHO", "HCM_NOT_A_REAL_FEATURE", "EDIT")).toBe(false);
  });
});

// ─── /hcm — which dashboard ──────────────────────────────────────────────────

describe("The dashboard split", () => {
  it("gives a PCHO the employer dashboard", () => {
    expect(hasAccess("PCHO", "HCM_EMPLOYER_DASHBOARD", "EDIT")).toBe(true);
  });

  it("gives a HomeAdmin the employer dashboard too", () => {
    expect(hasAccess("HomeAdmin", "HCM_EMPLOYER_DASHBOARD", "EDIT")).toBe(true);
  });

  it("gives a carer the employee dashboard instead", () => {
    expect(hasAccess("PCG", "HCM_EMPLOYEE_DASHBOARD", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "HCM_EMPLOYER_DASHBOARD", "EDIT")).toBe(false);
  });

  it("keeps the employee dashboard away from a PCHO", () => {
    expect(hasAccess("PCHO", "HCM_EMPLOYEE_DASHBOARD", "EDIT")).toBe(false);
  });

  it("gives a Lead neither, so /hcm redirects it away", () => {
    expect(hasAccess("Lead", "HCM_EMPLOYER_DASHBOARD", "EDIT")).toBe(false);
    expect(hasAccess("Lead", "HCM_EMPLOYEE_DASHBOARD", "EDIT")).toBe(false);
  });
});

// ─── /hcm/scheduling ─────────────────────────────────────────────────────────

describe("The scheduling board", () => {
  it("lets a PCHO reach it", () => {
    // The page gate is HCM_TIMESHEETS EDIT plus HCM VIEW, not HCM_SCHEDULING.
    expect(hasAccess("PCHO", "HCM_TIMESHEETS", "EDIT")).toBe(true);
    expect(hasAccess("PCHO", "HCM", "VIEW")).toBe(true);
  });

  it("lets a Senior reach it without being able to edit it", () => {
    // This is the fixture the Copy week RBAC test uses.
    expect(hasAccess("Senior", "HCM_TIMESHEETS", "EDIT")).toBe(true);
    expect(hasAccess("Senior", "HCM_SCHEDULING", "EDIT")).toBe(false);
  });

  it("keeps a Lead out altogether", () => {
    expect(hasAccess("Lead", "HCM_TIMESHEETS", "EDIT")).toBe(false);
  });

  it("lets a PCHO add and move shifts", () => {
    expect(hasAccess("PCHO", "HCM_SCHEDULING", "EDIT")).toBe(true);
  });

  it("shows overlap warnings only to a PCHO and a HomeAdmin", () => {
    expect(hasAccess("PCHO", "HCM_SCHEDULING_OVERLAP", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_SCHEDULING_OVERLAP", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "HCM_SCHEDULING_OVERLAP", "EDIT")).toBe(false);
  });
});

// ─── /hcm/timesheet — the two tabs ───────────────────────────────────────────

describe("The timesheet tabs", () => {
  it("gives a PCHO both reviews", () => {
    expect(hasAccess("PCHO", "HCM_DAILY_REVIEW", "EDIT")).toBe(true);
    expect(hasAccess("PCHO", "HCM_PAY_PERIOD_REVIEW", "EDIT")).toBe(true);
  });

  it("gives a HomeAdmin the daily review only", () => {
    expect(hasAccess("HomeAdmin", "HCM_DAILY_REVIEW", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_PAY_PERIOD_REVIEW", "EDIT")).toBe(false);
  });

  it("gives a carer the pay period only", () => {
    // The mirror image of the HomeAdmin, and the reason the landing tab
    // differs by role.
    expect(hasAccess("PCG", "HCM_PAY_PERIOD_REVIEW", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "HCM_DAILY_REVIEW", "EDIT")).toBe(false);
  });

  it("lets a PCHO and a HomeAdmin correct a timecard", () => {
    expect(hasAccess("PCHO", "HCM_EDIT_TIMECARD", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_EDIT_TIMECARD", "EDIT")).toBe(true);
  });

  it("does not let a carer correct a timecard", () => {
    // Which is why "+ Add Clock In / Out" becomes a plain dash for them.
    expect(hasAccess("PCG", "HCM_EDIT_TIMECARD", "EDIT")).toBe(false);
  });
});

// ─── /hcm/team ───────────────────────────────────────────────────────────────

describe("The Care Team roster", () => {
  it("lets a PCHO edit the roster", () => {
    expect(hasAccess("PCHO", "HCM_TEAM_ROASTER", "EDIT")).toBe(true);
  });

  it("lets a HomeAdmin only look at it", () => {
    // VIEW rather than EDIT is what drops the Wage column and the ⋮ menu.
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", "VIEW")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", "EDIT")).toBe(false);
  });

  it("keeps a Lead off the roster entirely", () => {
    expect(hasAccess("Lead", "HCM_TEAM_ROASTER", ["VIEW", "EDIT"])).toBe(false);
  });

  it("lets a PCHO open a member's page", () => {
    expect(hasAccess("PCHO", "HCM_TEAM_DETAILED_VIEW", ["VIEW", "EDIT"])).toBe(true);
  });

  it("lets a HomeAdmin open a member's page too", () => {
    expect(hasAccess("HomeAdmin", "HCM_TEAM_DETAILED_VIEW", ["VIEW", "EDIT"])).toBe(
      true
    );
  });

  it("gives Job Details to a PCHO and not to a HomeAdmin", () => {
    // Which is why a HomeAdmin lands on Personal Information instead.
    expect(hasAccess("PCHO", "HCM_TEAM_JOB_DETAILS", ["VIEW", "EDIT"])).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_TEAM_JOB_DETAILS", ["VIEW", "EDIT"])).toBe(
      false
    );
  });

  it("gives the Documents tab to a PCHO", () => {
    expect(hasAccess("PCHO", "CARE_TEAM_DOCUMENTS", "EDIT")).toBe(true);
  });

  it("gates Add Team Member behind scheduling rather than the roster", () => {
    // The button is guarded by `HCM_SCHEDULING` EDIT, NOT by the roster
    // permission — so a HomeAdmin who may only VIEW the roster still gets it,
    // and can add a care lead from a table whose Wage column it cannot see.
    expect(hasAccess("PCHO", "HCM_SCHEDULING", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_SCHEDULING", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "HCM_TEAM_ROASTER", "EDIT")).toBe(false);
  });

  it("lets a PCHO see a deleted team member", () => {
    expect(hasAccess("PCHO", "VIEW_DELETED_CARETEAM", "EDIT")).toBe(true);
  });

  it("does not let a carer see a deleted team member", () => {
    expect(hasAccess("PCG", "VIEW_DELETED_CARETEAM", "EDIT")).toBe(false);
  });
});

// ─── The module itself ───────────────────────────────────────────────────────

describe("Reaching Staff Management at all", () => {
  it("lets a PCHO into the module", () => {
    expect(hasAccess("PCHO", "HCM", "VIEW")).toBe(true);
  });

  it("gives a PCHO the staff navigation", () => {
    expect(hasAccess("PCHO", "STAFF_MANAGEMENT_NAV", "EDIT")).toBe(true);
  });

  it("gives a PCHO the team broadcast", () => {
    expect(hasAccess("PCHO", "HCM_TEAM_BROADCAST", "EDIT")).toBe(true);
  });

  it("keeps a Lead out of the module", () => {
    expect(hasAccess("Lead", "HCM", "VIEW")).toBe(false);
  });
});

// ─── getInitialRoute ─────────────────────────────────────────────────────────

describe("getInitialRoute", () => {
  it("sends a PCHO to the root when sales is not in play", () => {
    expect(getInitialRoute("PCHO")).toBe("/");
  });

  it("sends a carer to the root", () => {
    expect(getInitialRoute("PCG")).toBe("/");
  });

  it("sends a nurse to the clinical board", () => {
    expect(getInitialRoute("Nurse")).toBe("/clinical");
  });

  it("sends a PCHO to senior leads when sales is switched off", () => {
    expect(getInitialRoute("PCHO", undefined, false)).toBe("/crm");
  });

  it("sends a PCHO to the sales dashboard when sales is required", () => {
    expect(getInitialRoute("PCHO", undefined, true)).not.toBe("/crm");
  });

  it("applies the same sales rule to a HomeAdmin", () => {
    expect(getInitialRoute("HomeAdmin", undefined, false)).toBe("/crm");
  });

  it("builds a per-user route for a role that needs one", () => {
    expect(getInitialRoute("Lead", "abc-123")).toBe("/crm/abc-123");
  });

  it("returns nothing without a role", () => {
    expect(getInitialRoute(undefined)).toBe("");
  });
});
