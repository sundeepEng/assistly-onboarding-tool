/**
 * Clinical RBAC — utils/roleAccess.ts + utils/roles.ts
 *
 * `hasAccess(role, feature, access)` looks the feature up in exactly the list
 * asked for. There is no hierarchy: **EDIT does not imply VIEW.** A screen
 * gated on `hasAccess(role, F, "VIEW")` is therefore invisible to a role that
 * holds F as EDIT — which is a live bug in the Care Plan comments section, and
 * the reason this file exists.
 *
 * The tests below pin the clinical permission matrix as it stands. They are
 * deliberately explicit rather than looping over a table: when someone edits
 * `roles.ts`, the failing test name should say which role lost which
 * capability, not "matrix row 14".
 */

import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Permissions, Role } from "../../../utils/roles";

const CLINICAL_ROLES: Role[] = ["PCHO", "HomeAdmin", "PCG", "Nurse", "Senior"];

/** Every role that can reach a clinical screen at all. */
const holdsEither = (role: Role, feature: string) =>
  hasAccess(role, feature, ["VIEW", "EDIT"]);

// ─── The trap this file is named after ───────────────────────────────────────

describe("hasAccess — EDIT does not imply VIEW", () => {
  it("returns false for VIEW when the role holds the feature as EDIT", () => {
    // PCG has CLINICAL_CAREPLAN in its EDIT list and not its VIEW list.
    expect(Permissions.PCG.EDIT).toContain("CLINICAL_CAREPLAN");
    expect(Permissions.PCG.VIEW).not.toContain("CLINICAL_CAREPLAN");

    expect(hasAccess("PCG", "CLINICAL_CAREPLAN", "EDIT")).toBe(true);
    expect(hasAccess("PCG", "CLINICAL_CAREPLAN", "VIEW")).toBe(false);
  });

  it("returns true when either level is asked for", () => {
    // Passing both is the only safe way to ask "can this role reach it at all".
    expect(hasAccess("PCG", "CLINICAL_CAREPLAN", ["VIEW", "EDIT"])).toBe(true);
  });

  it("is the reason a VIEW-gated care plan section hides from an editor", () => {
    // careplan.tsx gates its comments on hasAccess(role, CLINICAL_CAREPLAN,
    // "VIEW"). Of the clinical roles only the Nurse satisfies that, so the
    // carer who works the round cannot leave a note and the Care Admin cannot
    // reach the comments it is separately granted permission to edit.
    const canSeeCarePlanComments = (role: Role) =>
      hasAccess(role, "CLINICAL_CAREPLAN", "VIEW");

    expect(canSeeCarePlanComments("Nurse")).toBe(true);
    expect(canSeeCarePlanComments("PCG")).toBe(false);
    expect(canSeeCarePlanComments("PCHO")).toBe(false);
    expect(canSeeCarePlanComments("HomeAdmin")).toBe(false);
  });

  it("grants PCHO the history-edit permission for comments it cannot see", () => {
    // The contradiction in one assertion: allowed to amend historical comments,
    // never shown the section that holds them.
    expect(hasAccess("PCHO", "CLINICAL_COMMENTS_HISTORY_EDIT", "EDIT")).toBe(true);
    expect(hasAccess("PCHO", "CLINICAL_CAREPLAN", "VIEW")).toBe(false);
  });
});

// ─── Unknown inputs ──────────────────────────────────────────────────────────

describe("hasAccess — unknown inputs", () => {
  it("denies an undefined role", () => {
    expect(hasAccess(undefined, "CLINICAL_TABS", "EDIT")).toBe(false);
  });

  it("denies a role that is not in the table", () => {
    expect(hasAccess("Janitor" as Role, "CLINICAL_TABS", "EDIT")).toBe(false);
  });

  it("denies a feature that does not exist", () => {
    expect(hasAccess("PCHO", "CLINICAL_TELEPORT", "EDIT")).toBe(false);
  });

  it("denies an empty feature name", () => {
    expect(hasAccess("PCHO", "", "EDIT")).toBe(false);
  });

  it("denies when the access list is empty", () => {
    expect(hasAccess("PCHO", "CLINICAL_TABS", [])).toBe(false);
  });
});

// ─── Who can open the clinical module at all ─────────────────────────────────

describe("Clinical module access", () => {
  it("gives every clinical role the dashboard", () => {
    ["PCHO", "HomeAdmin", "PCG", "Nurse"].forEach((role) => {
      expect(hasAccess(role as Role, "CLINICAL_DASHBOARD", "EDIT")).toBe(true);
    });
  });

  it("routes a Senior to their CRM record, not their clinical one", () => {
    // Worth stating because it reads backwards: a Senior's landing page is
    // /crm/{id}. The clinical board redirects them to /clinical/{id}
    // separately, in pages/clinical/index.tsx — the permission table alone
    // would send them to CRM.
    expect(hasAccess("Senior", "CLINICAL_DASHBOARD", "EDIT")).toBe(false);
    expect(Permissions.Senior.INITIAL_ROUTE("abc")).toBe("/crm/abc");
  });

  it("keeps a ComplianceGuest out of clinical entirely", () => {
    expect(holdsEither("ComplianceGuest" as Role, "CLINICAL_DASHBOARD")).toBe(false);
    expect(holdsEither("ComplianceGuest" as Role, "CLINICAL_TABS")).toBe(false);
  });

  it("keeps a CRM Lead out of clinical", () => {
    expect(holdsEither("Lead" as Role, "CLINICAL_DASHBOARD")).toBe(false);
  });
});

// ─── The tab strip ───────────────────────────────────────────────────────────

describe("CLINICAL_TABS — the short-circuit that shows everything", () => {
  it("is EDIT for the two admin roles", () => {
    expect(hasAccess("PCHO", "CLINICAL_TABS", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "CLINICAL_TABS", "EDIT")).toBe(true);
  });

  it("is VIEW only for the hands-on roles", () => {
    (["PCG", "Nurse", "Senior"] as Role[]).forEach((role) => {
      expect(hasAccess(role, "CLINICAL_TABS", "VIEW")).toBe(true);
      expect(hasAccess(role, "CLINICAL_TABS", "EDIT")).toBe(false);
    });
  });

  it("decides whether the per-feature checks are reached at all", () => {
    // Several screens read `hasAccess(role, X, ...) || hasAccess(role,
    // CLINICAL_TABS, "EDIT")`. For PCHO the second clause is always true, so
    // its per-feature grants are never consulted — which is why PCHO sees
    // controls it holds no specific permission for.
    expect(hasAccess("PCHO", "CLINICAL_MEDLIST", "EDIT")).toBe(false);
    expect(hasAccess("PCHO", "CLINICAL_TABS", "EDIT")).toBe(true);
  });
});

// ─── Medication and MedPass ──────────────────────────────────────────────────

describe("Medication permissions", () => {
  it("lets a Nurse add medication", () => {
    expect(hasAccess("Nurse", "CLINICAL_ADD", "EDIT")).toBe(true);
  });

  it("does not let a Personal Care Giver add medication", () => {
    expect(holdsEither("PCG", "CLINICAL_ADD")).toBe(false);
  });

  it("gives no role the medication list permission directly", () => {
    // CLINICAL_MEDLIST appears in no role's list — the "Medication List" button
    // is only ever shown through the CLINICAL_TABS EDIT short-circuit.
    CLINICAL_ROLES.forEach((role) => {
      expect(holdsEither(role, "CLINICAL_MEDLIST")).toBe(false);
    });
  });

  it("keeps the bulk OCR upload to the admin roles", () => {
    expect(hasAccess("PCHO", "MEDICATION_OCR_EXTRACTION", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "MEDICATION_OCR_EXTRACTION", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "MEDICATION_OCR_EXTRACTION")).toBe(false);
    expect(holdsEither("Nurse", "MEDICATION_OCR_EXTRACTION")).toBe(false);
  });

  it("gives the PCG no Medication tab to put the Bulk toggle on", () => {
    // Compounding: no CLINICAL_MEDICATION and CLINICAL_TABS only as VIEW, so
    // the tab is filtered out before the toggle's own gate is considered.
    expect(holdsEither("PCG", "CLINICAL_MEDICATION")).toBe(false);
    expect(hasAccess("PCG", "CLINICAL_TABS", "EDIT")).toBe(false);
  });

  it("lets every hands-on role work a MedPass round", () => {
    (["PCG", "Nurse"] as Role[]).forEach((role) => {
      expect(holdsEither(role, "CLINICAL_MEDPASS")).toBe(true);
    });
  });

  it("gives the MedPass date picker to the roles that review history", () => {
    expect(hasAccess("PCHO", "CLINICAL_MEDPASS_DATE_SELECTOR", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "CLINICAL_MEDPASS_DATE_SELECTOR")).toBe(true);
  });
});

// ─── Care plan ───────────────────────────────────────────────────────────────

describe("Care plan permissions", () => {
  it("lets a Personal Care Giver record services", () => {
    expect(hasAccess("PCG", "CLINICAL_CAREPLAN", "EDIT")).toBe(true);
  });

  it("gives a Nurse vitals to edit and the rest only to read", () => {
    // This is the split the product asks for: a Nurse performs vital-sign
    // activities and can see, but not work, the rest of the round.
    expect(hasAccess("Nurse", "CLINICAL_CAREPLAN_VITALS", "EDIT")).toBe(true);
    expect(hasAccess("Nurse", "CLINICAL_VITAL_SIGNS", "EDIT")).toBe(true);
    expect(hasAccess("Nurse", "CLINICAL_CAREPLAN", "VIEW")).toBe(true);
    expect(hasAccess("Nurse", "CLINICAL_CAREPLAN", "EDIT")).toBe(false);
    expect(hasAccess("Nurse", "CLINICAL_CAREPLAN_SERVICES", "EDIT")).toBe(false);
  });

  it("gives the PCG the vitals permission too", () => {
    expect(hasAccess("PCG", "CLINICAL_CAREPLAN_VITALS", "EDIT")).toBe(true);
  });

  it("keeps every history-edit permission to the admin roles", () => {
    const historyPermissions = [
      "CLINICAL_MEDPASS_HISTORY_EDIT",
      "CLINICAL_COMMENTS_HISTORY_EDIT",
      "CLINICAL_CAREPLAN_ADL_HISTORY_EDIT",
      "CLINICAL_CAREPLAN_HOUSEKEEPING_HISTORY_EDIT",
      "CLINICAL_CAREPLAN_VITALS_HISTORY_EDIT",
      "CLINICAL_CAREPLAN_COMMENTS_HISTORY_EDIT",
    ];

    historyPermissions.forEach((permission) => {
      expect(hasAccess("PCHO", permission, "EDIT")).toBe(true);
      expect(hasAccess("HomeAdmin", permission, "EDIT")).toBe(true);
      expect(holdsEither("PCG", permission)).toBe(false);
      expect(holdsEither("Nurse", permission)).toBe(false);
    });
  });

  it("means a carer may work today but never amend yesterday", () => {
    expect(hasAccess("PCG", "CLINICAL_CAREPLAN", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "CLINICAL_CAREPLAN_ADL_HISTORY_EDIT")).toBe(false);
  });
});

// ─── Other clinical surfaces ─────────────────────────────────────────────────

describe("Other clinical permissions", () => {
  it("lets every hands-on role record an over-the-counter dose", () => {
    (["PCHO", "PCG", "Nurse", "HomeAdmin"] as Role[]).forEach((role) => {
      expect(hasAccess(role, "CLINICAL_OTC_ADD", "EDIT")).toBe(true);
    });
  });

  it("keeps deleted seniors visible to the admin roles only", () => {
    expect(hasAccess("PCHO", "VIEW_DELETED_SENIORS", "EDIT")).toBe(true);
    expect(hasAccess("HomeAdmin", "VIEW_DELETED_SENIORS", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "VIEW_DELETED_SENIORS")).toBe(false);
    expect(holdsEither("Nurse", "VIEW_DELETED_SENIORS")).toBe(false);
  });

  it("keeps the senior's room number editable by the admin roles only", () => {
    expect(hasAccess("PCHO", "CLINICAL_SENIOR_ROOM_NUMBER", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "CLINICAL_SENIOR_ROOM_NUMBER")).toBe(false);
  });

  it("keeps the profile image editable by the admin roles only", () => {
    expect(hasAccess("PCHO", "CLINICAL_SENIOR_PROFILE_EDIT", "EDIT")).toBe(true);
    expect(holdsEither("PCG", "CLINICAL_SENIOR_PROFILE_EDIT")).toBe(false);
  });

  it("lets a PCG raise an incident report — a Nurse is locked out entirely", () => {
    expect(
      hasAccess("PCG", "CLINICAL_TABS_QUICK_ACTIONS_INCIDENT_REPORT", "EDIT")
    ).toBe(true);
    // Product decision, confirmed: the incident register is withheld from
    // nurses at every level — no VIEW (hides the tab), no ADD (can't raise).
    expect(holdsEither("Nurse", "CLINICAL_INCIDENT")).toBe(false);
    expect(holdsEither("Nurse", "CLINICAL_INCIDENT_ADD")).toBe(false);
  });

  it("keeps the carousel from a Nurse's view", () => {
    // The carousel is gated on CLINICAL_CAROUSEL; PCG holds it, Nurse does not.
    expect(hasAccess("PCG", "CLINICAL_CAROUSEL", "EDIT")).toBe(true);
    expect(holdsEither("Nurse", "CLINICAL_CAROUSEL")).toBe(false);
  });
});

// ─── Guarding the table itself ───────────────────────────────────────────────

describe("Permissions table integrity", () => {
  it("gives every clinical role both a VIEW and an EDIT list", () => {
    CLINICAL_ROLES.forEach((role) => {
      expect(Array.isArray(Permissions[role].VIEW)).toBe(true);
      expect(Array.isArray(Permissions[role].EDIT)).toBe(true);
    });
  });

  it("holds no empty entries left behind by editing", () => {
    // A stray comma in an array literal leaves `undefined`, which silently
    // matches nothing — this caught a real one in PCGLead's EDIT list.
    CLINICAL_ROLES.forEach((role) => {
      [...Permissions[role].VIEW, ...Permissions[role].EDIT].forEach((entry) => {
        expect(entry).toBeTruthy();
        expect(typeof entry).toBe("string");
      });
    });
  });

  it("lists no clinical feature twice in the same access level", () => {
    CLINICAL_ROLES.forEach((role) => {
      (["VIEW", "EDIT"] as const).forEach((level) => {
        const clinical = Permissions[role][level].filter((f: string) =>
          f.startsWith("CLINICAL")
        );
        expect(new Set(clinical).size).toBe(clinical.length);
      });
    });
  });

  it("documents the duplicate entries that already exist outside clinical", () => {
    // Harmless — `includes` does not care — but they are dead weight from
    // copy-paste edits, and pinning them means a NEW duplicate shows up as a
    // change here rather than passing unnoticed.
    const duplicatesIn = (list: string[]) =>
      [...new Set(list.filter((f, i) => list.indexOf(f) !== i))];

    expect(duplicatesIn(Permissions.PCHO.EDIT)).toEqual(["CRM_COMPLIANCE_HOME"]);
    expect(duplicatesIn(Permissions.HomeAdmin.EDIT)).toEqual(["CRM_COMPLIANCE_HOME"]);
    expect(duplicatesIn(Permissions.PCG.EDIT)).toEqual(["HCM_TIMESHEETS"]);
  });
});

// ─── Where each role lands after signing in ──────────────────────────────────

describe("getInitialRoute", () => {
  it("returns an empty string for no role", () => {
    expect(getInitialRoute(undefined)).toBe("");
  });

  it("returns an empty string for a role that is not in the table", () => {
    expect(getInitialRoute("Janitor" as Role)).toBe("");
  });

  it("sends a PCHO at a sales home to the sales dashboard", () => {
    expect(getInitialRoute("PCHO", "abc", true)).toBe("/crm/sales-dashboard");
  });

  it("sends a PCHO at a non-sales home to senior leads", () => {
    expect(getInitialRoute("PCHO", "abc", false)).toBe("/crm");
  });

  it("applies the same split to a HomeAdmin", () => {
    expect(getInitialRoute("HomeAdmin", "abc", true)).toBe("/crm/sales-dashboard");
    expect(getInitialRoute("HomeAdmin", "abc", false)).toBe("/crm");
  });

  it("falls back to the table when the sales flag is unknown", () => {
    // `isSalesRequired === undefined` skips the branch entirely, so a PCHO whose
    // home has not been fetched yet lands wherever the table says — not on
    // either sales route. That is why the post-login home lookup matters.
    // PCHO's INITIAL_ROUTE takes no id.
    expect(getInitialRoute("PCHO", "abc")).toBe(Permissions.PCHO.INITIAL_ROUTE());
  });

  it("ignores the sales flag for a role it does not apply to", () => {
    // A PCG goes to the clinical board whatever the home sells.
    expect(getInitialRoute("PCG", "abc", true)).toBe(Permissions.PCG.INITIAL_ROUTE("abc"));
  });

  it("routes a Senior to their own CRM record", () => {
    expect(getInitialRoute("Senior", "senior-1")).toBe("/crm/senior-1");
  });

  it("routes a Lead to their own CRM record", () => {
    expect(getInitialRoute("Lead", "lead-1")).toBe("/crm/lead-1");
  });

  it("routes a ComplianceGuest to compliance training", () => {
    expect(getInitialRoute("ComplianceGuest" as Role, "x")).toContain("compliance");
  });

  it("survives a missing id", () => {
    expect(() => getInitialRoute("Senior")).not.toThrow();
  });
});
