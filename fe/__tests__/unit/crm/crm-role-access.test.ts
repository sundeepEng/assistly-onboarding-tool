/**
 * CRM access control — utils/roleAccess.ts against utils/roles.ts
 *
 * Every CRM screen gates on `hasAccess(role, feature, "EDIT")` and redirects to
 * `getInitialRoute(role, userId)` when it fails. A permission accidentally added
 * to (or dropped from) a role silently changes who can see other people's
 * records, so the CRM-relevant grants are pinned here explicitly.
 */

import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import type { Role } from "../../../utils/roles";
import { TEST_USER_ID } from "../../test-utils/auth";

describe("hasAccess — CRM dashboard", () => {
  it.each<Role>(["PCHO", "HomeAdmin"])(
    "%s can edit the CRM dashboard",
    (role) => {
      expect(hasAccess(role, "CRM_DASHBOARD", "EDIT")).toBe(true);
    }
  );

  it.each<Role>(["Lead", "Senior", "PCG", "Nurse", "PCGLead", "NurseLead", "ComplianceGuest"])(
    "%s cannot edit the CRM dashboard",
    (role) => {
      expect(hasAccess(role, "CRM_DASHBOARD", "EDIT")).toBe(false);
    }
  );

  it("gates the Senior Leads page on CRM_SENIOR_CAMPAIGN", () => {
    // pages/crm/index.tsx redirects anyone without this grant.
    expect(hasAccess("PCHO", "CRM_SENIOR_CAMPAIGN", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "CRM_SENIOR_CAMPAIGN", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "CRM_SENIOR_CAMPAIGN", "EDIT")).toBe(false);
  });

  it("restricts the bulk campaign feature to PCHO and HomeAdmin", () => {
    expect(hasAccess("PCHO", "SMART_CRM", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "SMART_CRM", "EDIT")).toBe(true);
    expect(hasAccess("PCGLead", "SMART_CRM", "EDIT")).toBe(false);
    expect(hasAccess("Lead", "SMART_CRM", "EDIT")).toBe(false);
  });
});

describe("hasAccess — CRM sub-sections", () => {
  it("only PCHO and HomeAdmin manage referral agents", () => {
    expect(hasAccess("PCHO", "CRM_REFERRAL", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "CRM_REFERRAL", "EDIT")).toBe(true);
    expect(hasAccess("PCGLead", "CRM_REFERRAL", "EDIT")).toBe(false);
    expect(hasAccess("NurseLead", "CRM_REFERRAL", "EDIT")).toBe(false);
  });

  it("a care lead reaches the care-lead section but not the nurse section", () => {
    expect(hasAccess("PCGLead", "CRM_PCG", "EDIT")).toBe(true);
    expect(hasAccess("PCGLead", "CRM_NURSE", "EDIT")).toBe(false);
  });

  it("a nurse lead reaches the nurse section but not the care-lead section", () => {
    expect(hasAccess("NurseLead", "CRM_NURSE", "EDIT")).toBe(true);
    expect(hasAccess("NurseLead", "CRM_PCG", "EDIT")).toBe(false);
  });

  it("a care team member (PCG) reaches the care-lead section", () => {
    expect(hasAccess("PCG", "CRM_PCG", "EDIT")).toBe(true);
  });
});

describe("hasAccess — a lead's own biography", () => {
  it("a Lead can edit their own biography and documents", () => {
    expect(hasAccess("Lead", "CRM_BIOGRAPHY", "EDIT")).toBe(true);
    expect(hasAccess("Lead", "CRM_BIOGRAPHY_DOCUMENTS", "EDIT")).toBe(true);
    expect(hasAccess("Lead", "CRM_BIOGRAPHY_FORMS", "EDIT")).toBe(true);
  });

  it("a Lead cannot reach anyone else's records", () => {
    // components/leads-table.tsx sends a Lead to `/crm/{their own id}` precisely
    // because they hold CRM_BIOGRAPHY but not CRM_DASHBOARD.
    expect(hasAccess("Lead", "CRM_DASHBOARD", "EDIT")).toBe(false);
    expect(hasAccess("Lead", "CRM_REFERRAL", "EDIT")).toBe(false);
    expect(hasAccess("Lead", "CRM_PCG", "EDIT")).toBe(false);
  });

  it("a Nurse can view a biography but has no CRM edit rights over it", () => {
    expect(hasAccess("Nurse", "CRM_BIOGRAPHY", "VIEW")).toBe(true);
    expect(hasAccess("Nurse", "CRM_BIOGRAPHY", "EDIT")).toBe(false);
  });
});

describe("hasAccess — semantics", () => {
  it("returns false for an undefined role rather than throwing", () => {
    // Server-render and first paint both run before the cookie is read.
    expect(hasAccess(undefined, "CRM_DASHBOARD", "EDIT")).toBe(false);
  });

  it("returns false for an unknown role", () => {
    expect(hasAccess("ADMIN" as Role, "CRM_DASHBOARD", "EDIT")).toBe(false);
  });

  it("returns false for an unknown feature", () => {
    expect(hasAccess("PCHO", "CRM_NOT_A_FEATURE", "EDIT")).toBe(false);
  });

  it("accepts an array of access levels and passes if ANY matches", () => {
    // "CRM" is a VIEW grant for PCHO, not an EDIT one.
    expect(hasAccess("PCHO", "CRM", "VIEW")).toBe(true);
    expect(hasAccess("PCHO", "CRM", "EDIT")).toBe(false);
    expect(hasAccess("PCHO", "CRM", ["EDIT", "VIEW"])).toBe(true);
  });

  it("returns false when neither access level in the array matches", () => {
    expect(hasAccess("Lead", "CRM_DASHBOARD", ["EDIT", "VIEW"])).toBe(false);
  });
});

describe("getInitialRoute — where each role lands after login", () => {
  it.each<[Role, string]>([
    ["PCHO", "/"],
    ["HomeAdmin", "/"],
    ["PCG", "/"],
    ["Nurse", "/clinical"],
    ["ComplianceGuest", "/compliance/training"],
  ])("routes %s to %s", (role, expected) => {
    expect(getInitialRoute(role, TEST_USER_ID)).toBe(expected);
  });

  it.each<[Role, string]>([
    ["Lead", `/crm/${TEST_USER_ID}`],
    ["Senior", `/crm/${TEST_USER_ID}`],
    ["PCGLead", `/crm/pcg/${TEST_USER_ID}`],
    ["NurseLead", `/crm/nurse/${TEST_USER_ID}`],
  ])("routes %s to their own record at %s", (role, expected) => {
    expect(getInitialRoute(role, TEST_USER_ID)).toBe(expected);
  });

  it("returns an empty string for an undefined role so callers skip the redirect", () => {
    // Screens guard with `route && router.push(route)`; an empty string keeps a
    // pre-hydration render from bouncing the user to "/undefined".
    expect(getInitialRoute(undefined, TEST_USER_ID)).toBe("");
  });

  it("returns an empty string for an unknown role", () => {
    expect(getInitialRoute("ADMIN" as Role, TEST_USER_ID)).toBe("");
  });

  it("still resolves a static route when no id is supplied", () => {
    expect(getInitialRoute("PCHO")).toBe("/");
    expect(getInitialRoute("Nurse")).toBe("/clinical");
  });

  it("produces an undefined-id URL for a self-scoped role with no id", () => {
    // Documents the trap: callers must pass the user id for these roles.
    expect(getInitialRoute("Lead")).toBe("/crm/undefined");
  });
});
