/**
 * Compliance — who can see and do what
 *
 *   utils/roleAccess.ts   hasAccess, getInitialRoute
 *   utils/roles.ts        the permission lists and roleNavAllow
 *
 * Clinical, CRM, Staff Management and RevOps each have a matrix test; the
 * Compliance module did not, despite being the one module an OUTSIDE party
 * logs in to use. A compliance guest is an auditor given a login that reaches
 * Compliance and nothing else, so the boundaries here are the ones that matter
 * most if they move.
 *
 * COMPLIANCE_CERTIFICATES IS NOT A PERMISSION AT ALL
 *   It appears in `roleNavAllow` — the sidebar list — but never in
 *   `Permissions`. So `hasAccess(anyRole, "COMPLIANCE_CERTIFICATES", …)` is
 *   false for every role in the app, and the Certificates screen is gated on
 *   something else entirely. Pinned below, because it looks exactly like a
 *   broken gate until you know.
 *
 * THE NAV AND THE PERMISSIONS DISAGREE ABOUT A CAREGIVER
 *   `roleNavAllow.PCG.compliance` lists COMPLIANCE_TRAINING, but a PCG does
 *   not hold that permission. The sidebar offers training to a caregiver that
 *   `hasAccess` would refuse — the one place in the app where the two gates
 *   contradict each other, and worth knowing before trusting either alone.
 */

import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Permissions, Role, roleNavAllow } from "../../../utils/roles";

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

/** Roles holding a feature at the given level. */
const holders = (feature: string, access: "VIEW" | "EDIT") =>
  ALL_ROLES.filter((r) => hasAccess(r, feature, access)).sort();

// ─── The module gate ─────────────────────────────────────────────────────────

describe("Reaching the Compliance module", () => {
  it("is granted as VIEW, not EDIT", () => {
    // The opposite of RevOps, where every feature is EDIT. Asking for the
    // wrong level here returns false for every role.
    expect(hasAccess("PCHO", "COMPLIANCE", "VIEW")).toBe(true);
    expect(hasAccess("PCHO", "COMPLIANCE", "EDIT")).toBe(false);
  });

  it("is held by five roles", () => {
    expect(holders("COMPLIANCE", "VIEW")).toEqual([
      "ComplianceGuest",
      "HomeAdmin",
      "PCG",
      "PCGLead",
      "PCHO",
    ]);
  });

  it("includes the outside auditor", () => {
    expect(hasAccess("ComplianceGuest", "COMPLIANCE", "VIEW")).toBe(true);
  });

  it("excludes clinical staff", () => {
    expect(hasAccess("Nurse", "COMPLIANCE", "VIEW")).toBe(false);
    expect(hasAccess("NurseLead", "COMPLIANCE", "VIEW")).toBe(false);
  });

  it("excludes residents and leads", () => {
    expect(hasAccess("Senior", "COMPLIANCE", "VIEW")).toBe(false);
    expect(hasAccess("Lead", "COMPLIANCE", "VIEW")).toBe(false);
  });

  it("excludes the sales roles", () => {
    expect(hasAccess("SalesRepresentative", "COMPLIANCE", "VIEW")).toBe(false);
    expect(hasAccess("SalesDirector", "COMPLIANCE", "VIEW")).toBe(false);
  });
});

// ─── Training ────────────────────────────────────────────────────────────────

describe("Training", () => {
  it("is held by a PCHO and a HomeAdmin only", () => {
    expect(holders("COMPLIANCE_TRAINING", "EDIT")).toEqual(["HomeAdmin", "PCHO"]);
  });

  it("[as-built] is NOT held by a caregiver, though the sidebar offers it", () => {
    // `roleNavAllow.PCG.compliance` includes COMPLIANCE_TRAINING while
    // `Permissions.PCG` does not — the two gates disagree, and which one wins
    // depends on which the screen happens to consult.
    expect(hasAccess("PCG", "COMPLIANCE_TRAINING", "EDIT")).toBe(false);
    expect(roleNavAllow.PCG?.compliance).toContain("COMPLIANCE_TRAINING");
  });

  it("[as-built] is NOT held by a compliance guest, whose whole job it is", () => {
    // The guest's nav lists training and certificates, but they hold neither
    // permission — so a screen gated on `hasAccess` would turn away the one
    // role that exists to use it.
    expect(hasAccess("ComplianceGuest", "COMPLIANCE_TRAINING", "EDIT")).toBe(false);
    expect(roleNavAllow.ComplianceGuest?.compliance).toContain("COMPLIANCE_TRAINING");
  });

  it("gives a HomeAdmin the same training rights as a PCHO", () => {
    expect(hasAccess("HomeAdmin", "COMPLIANCE_TRAINING", "EDIT")).toBe(
      hasAccess("PCHO", "COMPLIANCE_TRAINING", "EDIT")
    );
  });

  it("is not granted at VIEW to anyone", () => {
    expect(holders("COMPLIANCE_TRAINING", "VIEW")).toEqual([]);
  });
});

// ─── Documents ───────────────────────────────────────────────────────────────

describe("Documents", () => {
  it("is held by a PCHO and a HomeAdmin only", () => {
    expect(holders("COMPLIANCE_DOCUMENTS", "EDIT")).toEqual(["HomeAdmin", "PCHO"]);
  });

  it("is withheld from a caregiver", () => {
    expect(hasAccess("PCG", "COMPLIANCE_DOCUMENTS", "EDIT")).toBe(false);
  });

  it("[as-built] is withheld from a compliance guest", () => {
    // An auditor cannot reach the home's compliance documents through this
    // permission, which is the opposite of what the role name suggests.
    expect(hasAccess("ComplianceGuest", "COMPLIANCE_DOCUMENTS", "EDIT")).toBe(false);
  });

  it("travels with training — the same two roles hold both", () => {
    expect(holders("COMPLIANCE_DOCUMENTS", "EDIT")).toEqual(
      holders("COMPLIANCE_TRAINING", "EDIT")
    );
  });
});

// ─── Certificates ────────────────────────────────────────────────────────────

describe("Certificates", () => {
  it("[as-built] is not a permission at all — no role holds it", () => {
    // It exists only in `roleNavAllow`. Any screen gated on
    // `hasAccess(role, "COMPLIANCE_CERTIFICATES", …)` is closed to everybody.
    expect(holders("COMPLIANCE_CERTIFICATES", "VIEW")).toEqual([]);
    expect(holders("COMPLIANCE_CERTIFICATES", "EDIT")).toEqual([]);
  });

  it("[as-built] appears in the sidebar list regardless", () => {
    expect(roleNavAllow.PCHO?.compliance).toContain("COMPLIANCE_CERTIFICATES");
    expect(roleNavAllow.PCG?.compliance).toContain("COMPLIANCE_CERTIFICATES");
    expect(roleNavAllow.ComplianceGuest?.compliance).toContain(
      "COMPLIANCE_CERTIFICATES"
    );
  });

  it("is not reachable even by a PCHO through hasAccess", () => {
    expect(hasAccess("PCHO", "COMPLIANCE_CERTIFICATES", ["VIEW", "EDIT"])).toBe(false);
  });
});

// ─── The two navigation permissions ──────────────────────────────────────────

describe("The Compliance sidebar entries", () => {
  it("shows the top-level nav to a PCHO, a HomeAdmin, a caregiver and a guest", () => {
    expect(holders("COMPLIANCE_NAV", "EDIT")).toEqual([
      "ComplianceGuest",
      "HomeAdmin",
      "PCG",
      "PCHO",
    ]);
  });

  it("[as-built] withholds the top-level nav from a care lead who can still view the module", () => {
    // PCGLead holds COMPLIANCE but not COMPLIANCE_NAV, so they can reach the
    // module without a link to it.
    expect(hasAccess("PCGLead", "COMPLIANCE", "VIEW")).toBe(true);
    expect(hasAccess("PCGLead", "COMPLIANCE_NAV", "EDIT")).toBe(false);
  });

  it("shows the in-module sidenav to a care lead but not to a guest", () => {
    expect(holders("COMPLIANCE_SIDENAV", "EDIT")).toEqual([
      "HomeAdmin",
      "PCG",
      "PCGLead",
      "PCHO",
    ]);
  });

  it("[as-built] gives a compliance guest the nav entry but no sidenav", () => {
    // The guest gets in, then has no in-module navigation — which is why
    // their initial route drops them straight onto a specific screen.
    expect(hasAccess("ComplianceGuest", "COMPLIANCE_NAV", "EDIT")).toBe(true);
    expect(hasAccess("ComplianceGuest", "COMPLIANCE_SIDENAV", "EDIT")).toBe(false);
  });
});

// ─── roleNavAllow, for compliance ────────────────────────────────────────────

describe("roleNavAllow for Compliance", () => {
  it("offers a PCHO all three screens", () => {
    expect(roleNavAllow.PCHO?.compliance).toEqual([
      "COMPLIANCE_DOCUMENTS",
      "COMPLIANCE_TRAINING",
      "COMPLIANCE_CERTIFICATES",
    ]);
  });

  it("offers a caregiver training and certificates, but not documents", () => {
    expect(roleNavAllow.PCG?.compliance).toEqual([
      "COMPLIANCE_TRAINING",
      "COMPLIANCE_CERTIFICATES",
    ]);
  });

  it("offers a compliance guest exactly what a caregiver gets", () => {
    expect(roleNavAllow.ComplianceGuest?.compliance).toEqual(
      roleNavAllow.PCG?.compliance
    );
  });

  it("offers a Senior nothing", () => {
    expect(roleNavAllow.Senior?.compliance).toEqual([]);
  });

  it("offers a Lead nothing", () => {
    expect(roleNavAllow.Lead?.compliance).toEqual([]);
  });

  it("[as-built] lists compliance screens that hasAccess would refuse", () => {
    // The counterpart of the RevOps test, which finds no mismatches at all.
    // Here every caregiver and guest entry is a mismatch, because
    // COMPLIANCE_CERTIFICATES is not a permission and PCG lacks training.
    const mismatches: string[] = [];
    ALL_ROLES.forEach((role) => {
      (roleNavAllow[role]?.compliance ?? []).forEach((feature) => {
        if (!hasAccess(role, feature, ["VIEW", "EDIT"])) {
          mismatches.push(`${role}:${feature}`);
        }
      });
    });
    expect(mismatches).toEqual([
      "PCHO:COMPLIANCE_CERTIFICATES",
      "HomeAdmin:COMPLIANCE_CERTIFICATES",
      "PCG:COMPLIANCE_TRAINING",
      "PCG:COMPLIANCE_CERTIFICATES",
      "ComplianceGuest:COMPLIANCE_TRAINING",
      "ComplianceGuest:COMPLIANCE_CERTIFICATES",
    ]);
  });
});

// ─── Where a compliance guest lands ──────────────────────────────────────────

describe("A compliance guest's landing route", () => {
  it("goes straight to the training screen", () => {
    // They have no sidenav, so the initial route is the whole navigation.
    expect(getInitialRoute("ComplianceGuest")).toBe("/compliance/training");
  });

  it("ignores the user id", () => {
    expect(getInitialRoute("ComplianceGuest", "user-1")).toBe("/compliance/training");
  });

  it("[as-built] ignores the sales flag too", () => {
    // Only PCHO and HomeAdmin branch on `isSalesRequired`.
    expect(getInitialRoute("ComplianceGuest", "user-1", true)).toBe(
      "/compliance/training"
    );
  });

  it("lands them on a screen their own permissions would refuse", () => {
    // The route is fixed, the permission is absent — so whether they see
    // anything depends entirely on how the training page gates itself.
    expect(getInitialRoute("ComplianceGuest")).toContain("training");
    expect(hasAccess("ComplianceGuest", "COMPLIANCE_TRAINING", "EDIT")).toBe(false);
  });
});

// ─── A guard on the matrix itself ────────────────────────────────────────────

describe("The Compliance permission lists", () => {
  it("never lists the same compliance feature under both VIEW and EDIT", () => {
    const overlaps: string[] = [];
    ALL_ROLES.forEach((role) => {
      const view = (Permissions[role]?.VIEW ?? []) as string[];
      const edit = (Permissions[role]?.EDIT ?? []) as string[];
      view
        .filter((f) => f.startsWith("COMPLIANCE") && edit.includes(f))
        .forEach((f) => overlaps.push(`${role}:${f}`));
    });
    expect(overlaps).toEqual([]);
  });

  it("grants the module itself only as VIEW, never as EDIT", () => {
    expect(holders("COMPLIANCE", "EDIT")).toEqual([]);
  });

  it("grants every sub-feature only as EDIT, never as VIEW", () => {
    ["COMPLIANCE_NAV", "COMPLIANCE_SIDENAV", "COMPLIANCE_TRAINING", "COMPLIANCE_DOCUMENTS"]
      .forEach((f) => expect(holders(f, "VIEW")).toEqual([]));
  });

  it("gives no role a sub-feature without the module itself", () => {
    // Otherwise a role could hold Training while being unable to reach
    // Compliance at all.
    const orphans: string[] = [];
    ALL_ROLES.forEach((role) => {
      const hasSub = ["COMPLIANCE_TRAINING", "COMPLIANCE_DOCUMENTS"].some((f) =>
        hasAccess(role, f, "EDIT")
      );
      if (hasSub && !hasAccess(role, "COMPLIANCE", "VIEW")) orphans.push(role);
    });
    expect(orphans).toEqual([]);
  });
});
