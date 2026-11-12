/**
 * RevOps — who can see and do what
 *
 *   utils/roleAccess.ts   hasAccess, getInitialRoute
 *   utils/roles.ts        the permission lists and roleNavAllow
 *
 * Clinical, CRM and Staff Management each have a matrix test; RevOps did not,
 * even though it is the module with the most role-dependent behaviour. Every
 * gate in it is `hasAccess(role, "REVOPS_…", "EDIT")`, and the Cypress specs
 * pick their fixtures from this matrix — so a permission moved in `roles.ts`
 * should fail one obvious test rather than a dozen opaque end-to-end ones.
 *
 * EVERY REVOPS FEATURE IS GRANTED AS **EDIT**, NEVER VIEW
 *   Unlike HCM, which uses the VIEW/EDIT split to drop columns for a
 *   HomeAdmin, RevOps lists all of its features under EDIT. A spec that checks
 *   `hasAccess(role, "REVOPS_BUDGET", "VIEW")` gets `false` for every role in
 *   the app, which looks like a broken gate and is really the wrong question.
 *   Pinned below so nobody re-learns it the hard way.
 *
 * TWO SEPARATE GATES
 *   `Permissions` decides what a role may do. `roleNavAllow` decides what
 *   appears in the sidebar. They disagree in at least one place — see the
 *   PCG/COMPLIANCE_TRAINING case in the compliance matrix test — so both are
 *   asserted here.
 */

import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Permissions, Role, roleNavAllow } from "../../../utils/roles";

/** Every role the app defines. */
const ALL_ROLES: Role[] = [
  "PCHO",
  "HomeAdmin",
  "PCG",
  "PCGLead",
  "Nurse",
  "NurseLead",
  "Senior",
  "Lead",
  "ComplianceGuest",
  "SalesRepresentative",
  "SalesDirector",
  "REFERRAL",
];

/** Roles that hold a given feature at EDIT. */
const holders = (feature: string) =>
  ALL_ROLES.filter((r) => hasAccess(r, feature, "EDIT")).sort();

// ─── The access level RevOps actually uses ───────────────────────────────────

describe("RevOps grants everything as EDIT", () => {
  const REVOPS_FEATURES = [
    "REVOPS_NAV",
    "REVOPS_DASHBOARD",
    "REVOPS_BILLING_INVOICE",
    "REVOPS_PAYROLL",
    "REVOPS_BUDGET",
    "REVOPS_PCHO_BILLING_INVOICE",
    "REVOPS_SENIOR_BILLING_INVOICE",
  ];

  it("gives no role any RevOps feature at VIEW", () => {
    const viewers = REVOPS_FEATURES.flatMap((f) =>
      ALL_ROLES.filter((r) => hasAccess(r, f, "VIEW")).map((r) => `${r}:${f}`)
    );
    expect(viewers).toEqual([]);
  });

  it("gives at least one role every feature at EDIT", () => {
    REVOPS_FEATURES.forEach((f) => expect(holders(f).length).toBeGreaterThan(0));
  });
});

// ─── /revops/billing-invoice ─────────────────────────────────────────────────

describe("Billing & Invoices", () => {
  it("is reachable by a PCHO and a Senior, and nobody else", () => {
    expect(holders("REVOPS_BILLING_INVOICE")).toEqual(["PCHO", "Senior"]);
  });

  it("shows a PCHO the admin view", () => {
    expect(hasAccess("PCHO", "REVOPS_PCHO_BILLING_INVOICE", "EDIT")).toBe(true);
  });

  it("shows a Senior the resident view instead", () => {
    // Same route, two entirely different component trees.
    expect(hasAccess("Senior", "REVOPS_SENIOR_BILLING_INVOICE", "EDIT")).toBe(true);
    expect(hasAccess("Senior", "REVOPS_PCHO_BILLING_INVOICE", "EDIT")).toBe(false);
  });

  it("never gives a PCHO the resident view", () => {
    expect(hasAccess("PCHO", "REVOPS_SENIOR_BILLING_INVOICE", "EDIT")).toBe(false);
  });

  it("keeps a HomeAdmin out of billing entirely", () => {
    expect(hasAccess("HomeAdmin", "REVOPS_BILLING_INVOICE", "EDIT")).toBe(false);
  });

  it("keeps a caregiver out of billing", () => {
    expect(hasAccess("PCG", "REVOPS_BILLING_INVOICE", "EDIT")).toBe(false);
  });
});

// ─── /revops/payments ────────────────────────────────────────────────────────

describe("Payment", () => {
  it("is held by exactly a PCHO and a caregiver", () => {
    expect(holders("REVOPS_PAYROLL")).toEqual(["PCG", "PCHO"]);
  });

  it("gives a PCHO the payroll screen", () => {
    expect(hasAccess("PCHO", "REVOPS_PAYROLL", "EDIT")).toBe(true);
  });

  it("gives a caregiver the same permission — the page then splits on role", () => {
    // Both pass the gate; `payments.tsx` renders PCGMyPayroll for a PCG rather
    // than the employer view, so the permission alone does not describe what
    // they see.
    expect(hasAccess("PCG", "REVOPS_PAYROLL", "EDIT")).toBe(true);
  });

  it("turns a HomeAdmin away", () => {
    expect(hasAccess("HomeAdmin", "REVOPS_PAYROLL", "EDIT")).toBe(false);
  });

  it("turns a Senior away — they hold billing but not payroll", () => {
    expect(hasAccess("Senior", "REVOPS_PAYROLL", "EDIT")).toBe(false);
  });

  it("turns a Lead away", () => {
    expect(hasAccess("Lead", "REVOPS_PAYROLL", "EDIT")).toBe(false);
  });

  it("turns a nurse away", () => {
    expect(hasAccess("Nurse", "REVOPS_PAYROLL", "EDIT")).toBe(false);
    expect(hasAccess("NurseLead", "REVOPS_PAYROLL", "EDIT")).toBe(false);
  });
});

// ─── /revops/budget ──────────────────────────────────────────────────────────

describe("Budget", () => {
  it("is PCHO-only — the narrowest gate in the module", () => {
    expect(holders("REVOPS_BUDGET")).toEqual(["PCHO"]);
  });

  it("keeps a HomeAdmin out", () => {
    expect(hasAccess("HomeAdmin", "REVOPS_BUDGET", "EDIT")).toBe(false);
  });

  it("keeps a caregiver out even though they reach payroll", () => {
    expect(hasAccess("PCG", "REVOPS_BUDGET", "EDIT")).toBe(false);
  });

  it("keeps a Senior out", () => {
    expect(hasAccess("Senior", "REVOPS_BUDGET", "EDIT")).toBe(false);
  });
});

// ─── The dashboards ──────────────────────────────────────────────────────────

describe("The three RevOps dashboards", () => {
  it("lets a PCHO, a caregiver and a Senior reach /revops", () => {
    expect(holders("REVOPS_DASHBOARD")).toEqual(["PCG", "PCHO", "Senior"]);
  });

  it("gives each of them a different dashboard", () => {
    expect(hasAccess("PCHO", "ADMIN_REVOPS_DASHBOARD", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "PCG_REVOPS_DASHBOARD", "EDIT")).toBe(true);
    expect(hasAccess("Senior", "SENIOR_REVOPS_DASHBOARD", "EDIT")).toBe(true);
  });

  it("gives nobody two of the three", () => {
    const dashboards = [
      "ADMIN_REVOPS_DASHBOARD",
      "PCG_REVOPS_DASHBOARD",
      "SENIOR_REVOPS_DASHBOARD",
    ];
    ALL_ROLES.forEach((role) => {
      const held = dashboards.filter((d) => hasAccess(role, d, "EDIT"));
      expect(held.length).toBeLessThanOrEqual(1);
    });
  });

  it("keeps a HomeAdmin off the RevOps dashboard", () => {
    expect(hasAccess("HomeAdmin", "REVOPS_DASHBOARD", "EDIT")).toBe(false);
  });
});

// ─── The sidebar entry ───────────────────────────────────────────────────────

describe("The RevOps sidebar entry", () => {
  it("shows for a PCHO, a caregiver and a Senior", () => {
    expect(holders("REVOPS_NAV")).toEqual(["PCG", "PCHO", "Senior"]);
  });

  it("[as-built] does not show for a HomeAdmin, who has no RevOps at all", () => {
    // Which is also why the Home dashboard hides the RevOps module card for
    // them by name rather than by permission.
    expect(hasAccess("HomeAdmin", "REVOPS_NAV", "EDIT")).toBe(false);
  });

  it("matches who can reach the dashboard", () => {
    expect(holders("REVOPS_NAV")).toEqual(holders("REVOPS_DASHBOARD"));
  });
});

// ─── roleNavAllow — the second gate ──────────────────────────────────────────

describe("roleNavAllow for RevOps", () => {
  it("offers a PCHO all four screens", () => {
    expect(roleNavAllow.PCHO?.revops).toEqual([
      "REVOPS_DASHBOARD",
      "REVOPS_BILLING_INVOICE",
      "REVOPS_PAYROLL",
      "REVOPS_BUDGET",
    ]);
  });

  it("offers a caregiver only the dashboard and their own payroll", () => {
    expect(roleNavAllow.PCG?.revops).toEqual(["REVOPS_DASHBOARD", "REVOPS_PAYROLL"]);
  });

  it("offers a Senior the dashboard and billing", () => {
    expect(roleNavAllow.Senior?.revops).toEqual([
      "REVOPS_DASHBOARD",
      "REVOPS_BILLING_INVOICE",
      "REVOPS_NAV",
    ]);
  });

  it("offers a HomeAdmin nothing", () => {
    expect(roleNavAllow.HomeAdmin?.revops).toBeUndefined();
  });

  it("offers a Lead nothing", () => {
    expect(roleNavAllow.Lead?.revops).toBeUndefined();
  });

  it("never lists a screen the role cannot actually reach", () => {
    // The nav and the permissions must agree, or the sidebar offers a link
    // that redirects straight back out.
    const mismatches: string[] = [];
    ALL_ROLES.forEach((role) => {
      (roleNavAllow[role]?.revops ?? []).forEach((feature) => {
        if (!hasAccess(role, feature, "EDIT")) mismatches.push(`${role}:${feature}`);
      });
    });
    expect(mismatches).toEqual([]);
  });
});

// ─── Stripe onboarding ───────────────────────────────────────────────────────

describe("Connecting Stripe", () => {
  it("is held by a PCHO, a HomeAdmin and a caregiver", () => {
    expect(holders("CONNECT_STRIPE")).toEqual(["HomeAdmin", "PCG", "PCHO"]);
  });

  it("[as-built] is the only RevOps-adjacent permission a HomeAdmin holds", () => {
    // A HomeAdmin can connect a Stripe account but cannot see billing,
    // payroll or the budget it would be used for.
    expect(hasAccess("HomeAdmin", "CONNECT_STRIPE", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "REVOPS_DASHBOARD", "EDIT")).toBe(false);
  });

  it("is withheld from a Senior, who pays rather than gets paid", () => {
    expect(hasAccess("Senior", "CONNECT_STRIPE", "EDIT")).toBe(false);
  });
});

// ─── The mechanism, at the edges ─────────────────────────────────────────────

describe("hasAccess at the edges", () => {
  it("refuses every RevOps feature when there is no role", () => {
    expect(hasAccess(undefined, "REVOPS_BUDGET", "EDIT")).toBe(false);
  });

  it("refuses a role it has never heard of", () => {
    expect(hasAccess("Accountant" as Role, "REVOPS_BUDGET", "EDIT")).toBe(false);
  });

  it("refuses a feature that does not exist", () => {
    expect(hasAccess("PCHO", "REVOPS_NOT_A_FEATURE", "EDIT")).toBe(false);
  });

  it("accepts either level when handed both", () => {
    expect(hasAccess("PCHO", "REVOPS_BUDGET", ["VIEW", "EDIT"])).toBe(true);
  });

  it("still refuses when the role holds neither level", () => {
    expect(hasAccess("Lead", "REVOPS_BUDGET", ["VIEW", "EDIT"])).toBe(false);
  });

  it("refuses an empty feature name", () => {
    expect(hasAccess("PCHO", "", "EDIT")).toBe(false);
  });
});

// ─── Where each role lands ───────────────────────────────────────────────────

describe("getInitialRoute", () => {
  it("sends a caregiver to their own dashboard", () => {
    expect(getInitialRoute("PCG", "user-1")).toBe("/"); // the home dashboard
  });

  it("returns nothing without a role", () => {
    expect(getInitialRoute(undefined)).toBe("");
  });

  it("returns nothing for a role it does not know", () => {
    expect(getInitialRoute("Accountant" as Role)).toBe("");
  });

  it("sends a PCHO at a sales home to the sales dashboard", () => {
    expect(getInitialRoute("PCHO", "user-1", true)).toContain("sales");
  });

  it("sends a PCHO at a non-sales home to the senior leads list", () => {
    expect(getInitialRoute("PCHO", "user-1", false)).toBe("/crm");
  });

  it("treats a HomeAdmin the same way", () => {
    expect(getInitialRoute("HomeAdmin", "user-1", false)).toBe("/crm");
  });

  it("[as-built] ignores the sales flag for every other role", () => {
    // Only PCHO and HomeAdmin branch on it; a Senior gets their own route
    // whatever the home is configured to do.
    expect(getInitialRoute("Senior", "user-1", true)).toBe(
      getInitialRoute("Senior", "user-1", false)
    );
  });
});

// ─── A guard on the matrix itself ────────────────────────────────────────────

describe("The permission lists", () => {
  it("[as-built] has no block for REFERRAL at all", () => {
    // `Role` includes "REFERRAL" but `Permissions` never defines it, so
    // `Permissions[role]?.[access]` is undefined and every check returns
    // false. A referral agent is therefore refused everything in the app
    // rather than being granted a referral-shaped subset — including their own
    // `/crm/referral` board, which is reached by a PCHO instead.
    // Cast: the type correctly has no REFERRAL key — that is the point.
    expect((Permissions as Record<string, unknown>).REFERRAL).toBeUndefined();
    expect(hasAccess("REFERRAL", "REVOPS_DASHBOARD", "EDIT")).toBe(false);
    expect(hasAccess("REFERRAL", "CRM", "VIEW")).toBe(false);
  });

  it("[as-built] leaves a REFERRAL with nowhere to land", () => {
    expect(getInitialRoute("REFERRAL", "user-1")).toBe("");
  });

  it("defines a block for every other role the type allows", () => {
    const missing = ALL_ROLES.filter((r) => r !== "REFERRAL" && !Permissions[r]);
    expect(missing).toEqual([]);
  });

  it("never lists the same RevOps feature under both VIEW and EDIT", () => {
    const overlaps: string[] = [];
    ALL_ROLES.forEach((role) => {
      const view = (Permissions[role]?.VIEW ?? []) as string[];
      const edit = (Permissions[role]?.EDIT ?? []) as string[];
      view
        .filter((f) => f.startsWith("REVOPS") && edit.includes(f))
        .forEach((f) => overlaps.push(`${role}:${f}`));
    });
    expect(overlaps).toEqual([]);
  });
});
